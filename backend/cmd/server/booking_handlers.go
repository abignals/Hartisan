package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"docto/db"
	"github.com/lib/pq"
)

func decodeBooking(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		docError(w, "Formulaire invalide.", 400)
		return false
	}
	if decoder.Decode(new(any)) != io.EOF {
		docError(w, "Formulaire invalide.", 400)
		return false
	}
	return true
}

func bookingWriteError(w http.ResponseWriter, err error) {
	var pg *pq.Error
	if errors.As(err, &pg) && (pg.Code == "23P01" || pg.Code == "23505") {
		docError(w, "Ce créneau vient d’être occupé. Actualisez le planning et choisissez un autre horaire.", http.StatusConflict)
		return
	}
	docError(w, "Impossible d’enregistrer cette modification. Veuillez réessayer.", 500)
}

func calendarSettingsGet(w http.ResponseWriter, r *http.Request) {
	settings, err := readCalendar(r.Context(), db.DB, utilisateurCourant(r).ID)
	if err != nil {
		docError(w, "Impossible de charger vos horaires.", 500)
		return
	}
	docJSON(w, settings)
}

func calendarSettingsPut(w http.ResponseWriter, r *http.Request) {
	var settings calendarSettings
	if !decodeBooking(w, r, &settings) {
		return
	}
	if !validCalendar(settings) {
		docError(w, "Vérifiez les durées et les plages horaires : elles ne doivent pas se chevaucher.", 400)
		return
	}
	id := utilisateurCourant(r).ID
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	defer tx.Rollback()
	if err = lockCalendar(r.Context(), tx, id); err != nil {
		bookingWriteError(w, err)
		return
	}
	if _, err = tx.ExecContext(r.Context(),
		`INSERT INTO calendar_settings(artisan_id,diagnostic_minutes,buffer_minutes) VALUES($1,$2,$3)
   ON CONFLICT(artisan_id) DO UPDATE SET diagnostic_minutes=$2, buffer_minutes=$3`, id, settings.Diagnostic, settings.Buffer,
	); err != nil {
		bookingWriteError(w, err)
		return
	}
	if _, err = tx.ExecContext(r.Context(), `DELETE FROM availability_windows WHERE artisan_id=$1`, id); err != nil {
		bookingWriteError(w, err)
		return
	}
	for _, window := range settings.Windows {
		if _, err = tx.ExecContext(r.Context(), `INSERT INTO availability_windows(artisan_id,weekday,start_minute,end_minute) VALUES($1,$2,$3,$4)`, id, window.Weekday, window.Start, window.End); err != nil {
			bookingWriteError(w, err)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		bookingWriteError(w, err)
		return
	}
	docJSON(w, settings)
}

type diagnosticRequest struct {
	ArtisanID    string    `json:"artisan_id"`
	Start        time.Time `json:"starts_at"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Address      string    `json:"address"`
	PostalCode   string    `json:"postal_code"`
	City         string    `json:"city"`
	ContactName  string    `json:"contact_name"`
	ContactPhone string    `json:"contact_phone"`
	Authorized   bool      `json:"authorized"`
}

func bookingCreate(w http.ResponseWriter, r *http.Request) {
	var input diagnosticRequest
	if !decodeBooking(w, r, &input) {
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.Address = strings.TrimSpace(input.Address)
	input.City = strings.TrimSpace(input.City)
	input.ContactName = strings.TrimSpace(input.ContactName)
	input.ContactPhone = strings.TrimSpace(input.ContactPhone)
	now := time.Now()
	if !input.Authorized || input.Start.Before(now.Add(24*time.Hour)) || input.Start.After(now.AddDate(0, 0, 90)) ||
		utf8.RuneCountInString(input.Title) < 1 || utf8.RuneCountInString(input.Title) > 160 ||
		utf8.RuneCountInString(input.Description) < 10 || utf8.RuneCountInString(input.Description) > 2000 ||
		len(input.Address) < 5 || len(input.Address) > 500 || len(input.City) < 2 || len(input.City) > 160 ||
		!regexp.MustCompile(`^\d{5}$`).MatchString(input.PostalCode) ||
		len(input.ContactName) < 2 || len(input.ContactName) > 160 || len(input.ContactPhone) < 6 || len(input.ContactPhone) > 40 {
		docError(w, "Complétez le motif, la description, l’adresse et le contact. Le rendez-vous doit être prévu entre 24 heures et 90 jours à l’avance.", 400)
		return
	}
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	defer tx.Rollback()
	if err = lockCalendar(r.Context(), tx, input.ArtisanID); err == sql.ErrNoRows {
		docError(w, "Artisan introuvable.", 404)
		return
	} else if err != nil {
		bookingWriteError(w, err)
		return
	}
	var public bool
	if err = tx.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM artisan_profiles a JOIN users u ON u.id=a.user_id WHERE a.user_id=$1 AND a.status='approved' AND u.suspended_at IS NULL)`, input.ArtisanID).Scan(&public); err != nil {
		bookingWriteError(w, err)
		return
	}
	if !public {
		docError(w, "Cet artisan n’accepte pas de demandes.", 404)
		return
	}
	settings, err := readCalendar(r.Context(), tx, input.ArtisanID)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	date := localMidnight(input.Start)
	busy, err := readOccupied(r.Context(), tx, input.ArtisanID, date, date.AddDate(0, 0, 2))
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	var chosen *bookingSlot
	for _, slot := range calendarSlots(settings, date, 1, time.Now(), busy) {
		if slot.Start.Equal(input.Start) {
			copy := slot
			chosen = &copy
			break
		}
	}
	if chosen == nil {
		docError(w, "Ce créneau n’est plus disponible. Choisissez un autre horaire.", 409)
		return
	}
	var id string
	err = tx.QueryRowContext(r.Context(),
		`INSERT INTO calendar_events(artisan_id,client_id,kind,status,starts_at,ends_at,busy_until,expires_at,title,description,address,postal_code,city,contact_name,contact_phone)
   VALUES($1,$2,'diagnostic','pending',$3,$4,$5,LEAST(now()+interval '24 hours',$3),$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
		input.ArtisanID, utilisateurCourant(r).ID, chosen.Start, chosen.End, chosen.BusyUntil, input.Title, input.Description, input.Address, input.PostalCode, input.City, input.ContactName, input.ContactPhone,
	).Scan(&id)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	var conversationID string
	err = tx.QueryRowContext(r.Context(), `INSERT INTO conversations(client_id,artisan_id) VALUES($1,$2)
 ON CONFLICT(client_id,artisan_id) DO UPDATE SET client_id=EXCLUDED.client_id RETURNING id`, utilisateurCourant(r).ID, input.ArtisanID).Scan(&conversationID)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		bookingWriteError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	docJSON(w, map[string]string{"id": id, "status": "pending", "conversation_id": conversationID})
}

type calendarEvent struct {
	ConversationID string     `json:"conversation_id"`
	ID             string     `json:"id"`
	ArtisanID      string     `json:"artisan_id"`
	ArtisanName    string     `json:"artisan_name"`
	ClientName     string     `json:"client_name"`
	Kind           string     `json:"kind"`
	Status         string     `json:"status"`
	Start          time.Time  `json:"starts_at"`
	End            time.Time  `json:"ends_at"`
	BusyUntil      time.Time  `json:"busy_until"`
	Expires        *time.Time `json:"expires_at"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	Address        string     `json:"address"`
	PostalCode     string     `json:"postal_code"`
	City           string     `json:"city"`
	ContactName    string     `json:"contact_name"`
	ContactPhone   string     `json:"contact_phone"`
	ChangeReason   string     `json:"change_reason"`
}

func bookingList(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)
	if u.Role != "artisan" && u.Role != "client" {
		docError(w, "Accès réservé aux clients et artisans.", 403)
		return
	}
	from, until, err := bookingDateRange(r, 93)
	detailID := r.PathValue("id")
	if detailID != "" {
		from = time.Now()
		until = from
		err = nil
	}
	if err != nil {
		docError(w, err.Error(), 400)
		return
	}
	rows, err := db.DB.QueryContext(r.Context(),
		`SELECT e.id,e.artisan_id,COALESCE(a.company_name,''),COALESCE(c.first_name||' '||c.last_name,''),e.kind,
          CASE WHEN e.status='pending' AND e.expires_at<=now() THEN 'expired' ELSE e.status END,
          e.starts_at,e.ends_at,e.busy_until,e.expires_at,e.title,e.description,e.address,e.postal_code,e.city,e.contact_name,e.contact_phone,e.change_reason,
 COALESCE((SELECT id::text FROM conversations WHERE client_id=e.client_id AND artisan_id=e.artisan_id), '')
   FROM calendar_events e LEFT JOIN artisan_profiles a ON a.user_id=e.artisan_id LEFT JOIN users c ON c.id=e.client_id
   WHERE (($2='artisan' AND e.artisan_id=$1) OR ($2='client' AND e.client_id=$1))
     AND (($5='' AND e.starts_at<$4 AND e.busy_until>$3) OR ($5<>'' AND e.id::text=$5)) ORDER BY e.starts_at,e.id`, u.ID, u.Role, from, until, detailID,
	)
	if err != nil {
		docError(w, "Impossible de charger les rendez-vous.", 500)
		return
	}
	defer rows.Close()
	events := []calendarEvent{}
	for rows.Next() {
		var event calendarEvent
		if err = rows.Scan(&event.ID, &event.ArtisanID, &event.ArtisanName, &event.ClientName, &event.Kind, &event.Status, &event.Start, &event.End, &event.BusyUntil, &event.Expires, &event.Title, &event.Description, &event.Address, &event.PostalCode, &event.City, &event.ContactName, &event.ContactPhone, &event.ChangeReason, &event.ConversationID); err != nil {
			docError(w, "Impossible de lire les rendez-vous.", 500)
			return
		}
		events = append(events, event)
	}
	if rows.Err() != nil {
		docError(w, "Impossible de lire les rendez-vous.", 500)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	if detailID != "" {
		if len(events) == 0 {
			docError(w, "Rendez-vous introuvable.", 404)
			return
		}
		docJSON(w, events[0])
		return
	}
	docJSON(w, events)
}

func calendarBlockCreate(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Kind   string    `json:"kind"`
		Title  string    `json:"title"`
		Start  time.Time `json:"starts_at"`
		End    time.Time `json:"ends_at"`
		Buffer bool      `json:"with_buffer"`
	}
	if !decodeBooking(w, r, &input) {
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	now := time.Now()
	if (input.Kind != "absence" && input.Kind != "external") || len(input.Title) == 0 || utf8.RuneCountInString(input.Title) > 160 || !input.End.After(input.Start) || input.Start.Before(now.Add(-time.Minute)) || input.End.Sub(input.Start) > 90*24*time.Hour || input.Start.After(now.AddDate(1, 0, 0)) {
		docError(w, "Indiquez un titre et une période future valide (90 jours maximum).", 400)
		return
	}
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	defer tx.Rollback()
	id := utilisateurCourant(r).ID
	if err = lockCalendar(r.Context(), tx, id); err != nil {
		bookingWriteError(w, err)
		return
	}
	settings, err := readCalendar(r.Context(), tx, id)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	until := input.End
	if input.Kind == "external" && input.Buffer {
		until = until.Add(time.Duration(settings.Buffer) * time.Minute)
	}
	var eventID string
	err = tx.QueryRowContext(r.Context(), `INSERT INTO calendar_events(artisan_id,kind,status,starts_at,ends_at,busy_until,title) VALUES($1,$2,'confirmed',$3,$4,$5,$6) RETURNING id`, id, input.Kind, input.Start, input.End, until, input.Title).Scan(&eventID)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		bookingWriteError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	docJSON(w, map[string]string{"id": eventID})
}

func bookingTransition(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if !decodeBooking(w, r, &input) {
		return
	}
	if len(input.Reason) > 1000 {
		docError(w, "Le motif est trop long.", 400)
		return
	}
	u := utilisateurCourant(r)
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	defer tx.Rollback()
	var artisanID string
	err = tx.QueryRowContext(r.Context(), `SELECT artisan_id FROM calendar_events WHERE id::text=$1 AND (artisan_id=$2 OR client_id=$2)`, r.PathValue("id"), u.ID).Scan(&artisanID)
	if err == sql.ErrNoRows {
		docError(w, "Rendez-vous introuvable.", 404)
		return
	}
	if err != nil {
		bookingWriteError(w, err)
		return
	}
	if err = lockCalendar(r.Context(), tx, artisanID); err != nil {
		bookingWriteError(w, err)
		return
	}
	var kind, status string
	var start time.Time
	if err = tx.QueryRowContext(r.Context(), `SELECT kind,status,starts_at FROM calendar_events WHERE id::text=$1 FOR UPDATE`, r.PathValue("id")).Scan(&kind, &status, &start); err != nil {
		bookingWriteError(w, err)
		return
	}
	target := ""
	owner := u.Role == "artisan" && u.ID == artisanID
	switch input.Action {
	case "accept":
		if owner && kind == "diagnostic" && status == "pending" && start.After(time.Now()) {
			target = "confirmed"
		}
	case "reject":
		if owner && kind == "diagnostic" && status == "pending" {
			target = "rejected"
		}
	case "cancel":
		if (status == "pending" || status == "confirmed") && (owner || (u.Role == "client" && kind == "diagnostic" && start.After(time.Now()))) {
			target = "cancelled"
		}
	}
	if target == "" {
		docError(w, "Cette action n’est plus possible. Actualisez les rendez-vous.", 409)
		return
	}
	// L'acceptation et l'ouverture de la conversation sont atomiques.
	if target == "confirmed" {
		if _, err = tx.ExecContext(r.Context(), `INSERT INTO conversations(client_id,artisan_id)
 SELECT client_id,artisan_id FROM calendar_events WHERE id::text=$1
 ON CONFLICT(client_id,artisan_id) DO NOTHING`, r.PathValue("id")); err != nil {
			bookingWriteError(w, err)
			return
		}
	}
	if _, err = tx.ExecContext(r.Context(), `UPDATE calendar_events SET status=$2,change_reason=$3,updated_at=now() WHERE id::text=$1`, r.PathValue("id"), target, strings.TrimSpace(input.Reason)); err != nil {
		bookingWriteError(w, err)
		return
	}
	if err = tx.Commit(); err != nil {
		bookingWriteError(w, err)
		return
	}
	docJSON(w, map[string]string{"status": target})
}
