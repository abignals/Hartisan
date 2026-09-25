package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"time"
	_ "time/tzdata"

	"docto/db"
)

// Les heures d'ouverture sont locales ; les rendez-vous sont stockés en UTC.
var bookingZone = func() *time.Location {
	zone, err := time.LoadLocation("Europe/Paris")
	if err != nil {
		panic(err)
	}
	return zone
}()

type availabilityWindow struct {
	Weekday int `json:"weekday"`
	Start   int `json:"start_minute"`
	End     int `json:"end_minute"`
}

type calendarSettings struct {
	Diagnostic int                  `json:"diagnostic_minutes"`
	Buffer     int                  `json:"buffer_minutes"`
	Windows    []availabilityWindow `json:"windows"`
}

type bookingSlot struct {
	Start     time.Time `json:"starts_at"`
	End       time.Time `json:"ends_at"`
	BusyUntil time.Time `json:"busy_until"`
}

type calendarReader interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func readCalendar(ctx context.Context, reader calendarReader, artisanID string) (calendarSettings, error) {
	settings := calendarSettings{Diagnostic: 60, Buffer: 30, Windows: []availabilityWindow{}}
	err := reader.QueryRowContext(ctx,
		`SELECT diagnostic_minutes, buffer_minutes FROM calendar_settings WHERE artisan_id=$1`, artisanID,
	).Scan(&settings.Diagnostic, &settings.Buffer)
	if err != nil && err != sql.ErrNoRows {
		return settings, err
	}
	rows, err := reader.QueryContext(ctx,
		`SELECT weekday, start_minute, end_minute FROM availability_windows WHERE artisan_id=$1 ORDER BY weekday, start_minute`, artisanID,
	)
	if err != nil {
		return settings, err
	}
	defer rows.Close()
	for rows.Next() {
		var window availabilityWindow
		if err := rows.Scan(&window.Weekday, &window.Start, &window.End); err != nil {
			return settings, err
		}
		settings.Windows = append(settings.Windows, window)
	}
	return settings, rows.Err()
}

func validCalendar(settings calendarSettings) bool {
	if settings.Diagnostic < 15 || settings.Diagnostic > 240 || settings.Diagnostic%15 != 0 || settings.Buffer < 0 || settings.Buffer > 120 || settings.Buffer%15 != 0 || len(settings.Windows) > 28 {
		return false
	}
	for i, a := range settings.Windows {
		if a.Weekday < 1 || a.Weekday > 7 || a.Start < 0 || a.End > 1440 || a.Start >= a.End || a.Start%15 != 0 || a.End%15 != 0 {
			return false
		}
		for j, b := range settings.Windows {
			if j > i && a.Weekday == b.Weekday && a.Start < b.End && b.Start < a.End {
				return false
			}
		}
	}
	return true
}

func localMidnight(t time.Time) time.Time {
	local := t.In(bookingZone)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, bookingZone)
}

// Un départ toutes les 30 minutes, à partir de l'ouverture ; durée réelle réglable.
func calendarSlots(settings calendarSettings, from time.Time, days int, now time.Time, occupied []bookingSlot) []bookingSlot {
	slots := []bookingSlot{}
	from = localMidnight(from)
	for day := 0; day < days; day++ {
		date := from.AddDate(0, 0, day)
		weekday := int(date.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		for _, window := range settings.Windows {
			if weekday != window.Weekday {
				continue
			}
			start := time.Date(date.Year(), date.Month(), date.Day(), window.Start/60, window.Start%60, 0, 0, bookingZone)
			close := time.Date(date.Year(), date.Month(), date.Day(), window.End/60, window.End%60, 0, 0, bookingZone)
			for cursor := start; cursor.Before(close); cursor = cursor.Add(30 * time.Minute) {
				end := cursor.Add(time.Duration(settings.Diagnostic) * time.Minute)
				until := end.Add(time.Duration(settings.Buffer) * time.Minute)
				if cursor.Before(now.Add(24*time.Hour)) || until.After(close) {
					continue
				}
				// time.Date normalise une heure inexistante lors du passage à l'heure d'été.
				local := cursor.In(bookingZone)
				if local.Hour()*60+local.Minute() < window.Start || local.Day() != date.Day() {
					continue
				}
				available := true
				for _, busy := range occupied {
					if cursor.Before(busy.BusyUntil) && busy.Start.Before(until) {
						available = false
						break
					}
				}
				if available {
					slots = append(slots, bookingSlot{cursor.UTC(), end.UTC(), until.UTC()})
				}
			}
		}
	}
	return slots
}

func readOccupied(ctx context.Context, reader calendarReader, artisanID string, from, until time.Time) ([]bookingSlot, error) {
	rows, err := reader.QueryContext(ctx,
		`SELECT starts_at, ends_at, busy_until FROM calendar_events
   WHERE artisan_id=$1 AND starts_at<$3 AND busy_until>$2
     AND (status='confirmed' OR (status='pending' AND expires_at>now()))`, artisanID, from, until,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	occupied := []bookingSlot{}
	for rows.Next() {
		var slot bookingSlot
		if err := rows.Scan(&slot.Start, &slot.End, &slot.BusyUntil); err != nil {
			return nil, err
		}
		occupied = append(occupied, slot)
	}
	return occupied, rows.Err()
}

// Toutes les écritures d'un planning prennent le même verrou, avant de vérifier les créneaux.
func lockCalendar(ctx context.Context, tx *sql.Tx, artisanID string) error {
	var id string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM users WHERE id::text=$1 AND role='artisan' FOR UPDATE`, artisanID).Scan(&id); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx,
		`UPDATE calendar_events SET status='expired', updated_at=now()
   WHERE artisan_id=$1 AND status='pending' AND expires_at<=now()`, artisanID,
	)
	return err
}

func expireBookingRequests() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_, err := db.DB.ExecContext(ctx, `WITH due AS (SELECT id FROM calendar_events WHERE status='pending' AND expires_at<=now() FOR UPDATE SKIP LOCKED)
 UPDATE calendar_events SET status='expired', updated_at=now() WHERE id IN (SELECT id FROM due)`)
		cancel()
		if err != nil {
			log.Println("Expiration des demandes de rendez-vous :", err)
		}
		<-ticker.C
	}
}

func bookingDateRange(r *http.Request, maxDays int) (time.Time, time.Time, error) {
	from, err := time.ParseInLocation("2006-01-02", r.URL.Query().Get("from"), bookingZone)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Date de début invalide.")
	}
	until, err := time.ParseInLocation("2006-01-02", r.URL.Query().Get("until"), bookingZone)
	if err != nil || !until.After(from) || until.After(from.AddDate(0, 0, maxDays)) {
		return from, until, errors.New("Période invalide ou trop longue.")
	}
	return from, until, nil
}

func bookingSlotsGet(w http.ResponseWriter, r *http.Request) {
	from, until, err := bookingDateRange(r, 14)
	now := time.Now()
	if err != nil || from.Before(localMidnight(now)) || until.After(localMidnight(now).AddDate(0, 0, 91)) {
		docError(w, "Choisissez une période de 14 jours maximum dans les 90 prochains jours.", 400)
		return
	}
	artisanID := r.PathValue("id")
	var exists bool
	if err := db.DB.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM artisan_profiles a JOIN users u ON u.id=a.user_id
   WHERE a.user_id::text=$1 AND a.status='approved' AND u.role='artisan' AND u.suspended_at IS NULL)`, artisanID,
	).Scan(&exists); err != nil {
		docError(w, "Planning indisponible.", 500)
		return
	}
	if !exists {
		docError(w, "Artisan introuvable.", 404)
		return
	}
	settings, err := readCalendar(r.Context(), db.DB, artisanID)
	if err != nil {
		docError(w, "Planning indisponible.", 500)
		return
	}
	busy, err := readOccupied(r.Context(), db.DB, artisanID, from, until.AddDate(0, 0, 1))
	if err != nil {
		docError(w, "Planning indisponible.", 500)
		return
	}
	days := 0
	for date := from; date.Before(until); date = date.AddDate(0, 0, 1) {
		days++
	}
	w.Header().Set("Cache-Control", "no-store")
	docJSON(w, map[string]any{"slots": calendarSlots(settings, from, days, now, busy), "diagnostic_minutes": settings.Diagnostic, "buffer_minutes": settings.Buffer, "timezone": "Europe/Paris"})
}
