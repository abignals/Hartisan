package main

import (
	"bytes"
	"context"
	"docto/db"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestCalendarSlots(t *testing.T) {
	day := time.Date(2026, 10, 26, 0, 0, 0, 0, bookingZone)
	settings := calendarSettings{60, 30, []availabilityWindow{{1, 480, 720}}}
	busy := bookingSlot{day.Add(9 * time.Hour), day.Add(10 * time.Hour), day.Add(10*time.Hour + 30*time.Minute)}
	slots := calendarSlots(settings, day, 1, day.Add(-48*time.Hour), []bookingSlot{busy})
	if len(slots) != 1 || slots[0].Start.In(bookingZone).Hour() != 10 || slots[0].Start.In(bookingZone).Minute() != 30 {
		t.Fatalf("Trajet ou limites incorrectes : %+v", slots)
	}
	if len(calendarSlots(settings, day, 1, day, nil)) != 0 {
		t.Fatal("Le préavis de 24 h est ignoré")
	}
	settings.Windows = append(settings.Windows, availabilityWindow{1, 700, 780})
	if validCalendar(settings) {
		t.Fatal("Chevauchement accepté")
	}
	// Deux changements d'heure : les ouvertures doivent rester à 8 h locales.
	for _, date := range []time.Time{time.Date(2026, 3, 28, 0, 0, 0, 0, bookingZone), time.Date(2026, 10, 24, 0, 0, 0, 0, bookingZone)} {
		settings.Windows = []availabilityWindow{{6, 480, 570}, {7, 480, 570}, {1, 480, 570}}
		slots = calendarSlots(settings, date, 3, date.Add(-48*time.Hour), nil)
		if len(slots) != 3 {
			t.Fatalf("Changement d'heure : %d créneaux", len(slots))
		}
		for _, slot := range slots {
			if slot.Start.In(bookingZone).Hour() != 8 || slot.BusyUntil.Sub(slot.Start) != 90*time.Minute {
				t.Fatal("Heure locale/durée incorrecte")
			}
		}
	}
}

func TestBookingLifecycle(t *testing.T) {
	if os.Getenv("BOOKING_INTEGRATION_TEST") != "1" {
		t.Skip("BOOKING_INTEGRATION_TEST=1 requis sur une base locale migrée")
	}
	if err := db.Connect(); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	defer func() {
		for _, id := range ids {
			db.DB.Exec(`DELETE FROM calendar_events WHERE artisan_id=$1 OR client_id=$1`, id)
		}
		for _, id := range ids {
			db.DB.Exec(`DELETE FROM users WHERE id=$1`, id)
		}
	}()
	for _, role := range []string{"artisan", "client", "client"} {
		key := fmt.Sprintf("booking-test-%d", time.Now().UnixNano())
		var id string
		if err := db.DB.QueryRow(`INSERT INTO users(role,email,password_hash,first_name,last_name,phone) VALUES($1,$2::text,'unused','Test','RDV',$2::text) RETURNING id`, role, key+"@example.invalid").Scan(&id); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
	}
	artisan := &utilisateur{ID: ids[0], Role: "artisan"}
	client := &utilisateur{ID: ids[1], Role: "client"}
	other := &utilisateur{ID: ids[2], Role: "client"}
	if _, err := db.DB.Exec(`INSERT INTO artisan_profiles(user_id,company_name,status,postal_code,city,location) VALUES($1,'Test','approved','75011','Paris',ST_SetSRID(ST_MakePoint(2.38,48.86),4326)::geography)`, artisan.ID); err != nil {
		t.Fatal(err)
	}
	call := func(handler http.HandlerFunc, user *utilisateur, body any, id string) *httptest.ResponseRecorder {
		data, _ := json.Marshal(body)
		r := httptest.NewRequest("POST", "/api/appointments?from="+localMidnight(time.Now()).Format("2006-01-02")+"&until="+localMidnight(time.Now()).AddDate(0, 0, 10).Format("2006-01-02"), bytes.NewReader(data))
		r = r.WithContext(context.WithValue(r.Context(), cleUtilisateur, user))
		r.SetPathValue("id", id)
		w := httptest.NewRecorder()
		handler(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, code int) {
		t.Helper()
		if w.Code != code {
			t.Fatalf("Statut %d attendu %d : %s", w.Code, code, w.Body)
		}
	}
	settings := calendarSettings{60, 30, []availabilityWindow{}}
	for day := 1; day <= 7; day++ {
		settings.Windows = append(settings.Windows, availabilityWindow{day, 480, 1080})
	}
	check(call(calendarSettingsPut, artisan, settings, ""), 200)
	start := localMidnight(time.Now()).AddDate(0, 0, 3).Add(8 * time.Hour)
	input := diagnosticRequest{artisan.ID, start, "Diagnostic", "Fuite visible sous un évier", "10 rue Fictive", "75011", "Paris", "Camille Test", "0600000000", true}
	// Deux requêtes concurrentes : une seule réservation doit réussir.
	results := make(chan *httptest.ResponseRecorder, 2)
	for i := 0; i < 2; i++ {
		go func() { results <- call(bookingCreate, client, input, "") }()
	}
	a, b := <-results, <-results
	if a.Code == 409 {
		a, b = b, a
	}
	check(a, 201)
	check(b, 409)
	var created map[string]string
	json.Unmarshal(a.Body.Bytes(), &created)
	id := created["id"]
	if created["conversation_id"] == "" {
		t.Fatal("Conversation absente pendant la demande")
	}
	t.Setenv("DOCUMENTS_DIR", t.TempDir())
	conv := created["conversation_id"]
	upload := func(user *utilisateur, data []byte) *httptest.ResponseRecorder {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		part, _ := writer.CreateFormFile("photo", "photo.png")
		part.Write(data)
		writer.Close()
		r := httptest.NewRequest("POST", "/api/conversations/"+conv+"/photos", &body)
		r.Header.Set("Content-Type", writer.FormDataContentType())
		r.SetPathValue("id", conv)
		r = r.WithContext(context.WithValue(r.Context(), cleUtilisateur, user))
		w := httptest.NewRecorder()
		messagePhotoPost(w, r)
		return w
	}
	var picture bytes.Buffer
	png.Encode(&picture, image.NewRGBA(image.Rect(0, 0, 8, 8)))
	check(upload(other, picture.Bytes()), 404)
	check(upload(client, []byte("<script>alert(1)</script>")), 400)
	photoResponse := upload(client, picture.Bytes())
	check(photoResponse, 200)
	var photo messageLigne
	if err := json.Unmarshal(photoResponse.Body.Bytes(), &photo); err != nil || photo.PhotoURL == "" {
		t.Fatalf("Photo absente : %s", photoResponse.Body)
	}
	check(call(messagePhotoGet, artisan, nil, photo.ID), 200)
	check(call(messagePhotoGet, other, nil, photo.ID), 404)
	check(call(messageReportPost, artisan, map[string]string{"reason": "Contenu inapproprié"}, photo.ID), 200)
	check(call(messageReportPost, artisan, map[string]string{"reason": "Contenu inapproprié"}, photo.ID), 200)
	check(call(messageReportPost, other, map[string]string{"reason": "Intrusion"}, photo.ID), 404)
	messages := call(conversationMessageHandler, artisan, nil, conv)
	check(messages, 200)
	var thread []messageLigne
	if json.Unmarshal(messages.Body.Bytes(), &thread) != nil || len(thread) != 1 || !thread[0].Reported || thread[0].PhotoURL == "" {
		t.Fatalf("Photo/signalement non restitué : %s", messages.Body)
	}

	check(call(bookingTransition, other, map[string]string{"action": "cancel"}, id), 404)
	check(call(bookingTransition, client, map[string]string{"action": "accept"}, id), 409)
	empty := call(bookingList, other, nil, "")
	check(empty, 200)
	if empty.Body.String() != "[]\n" {
		t.Fatalf("Fuite de données : %s", empty.Body)
	}
	block := map[string]any{"kind": "external", "title": "Chantier privé", "starts_at": start.Add(time.Hour), "ends_at": start.Add(3 * time.Hour), "with_buffer": true}
	check(call(calendarBlockCreate, artisan, block, ""), 409)
	check(call(bookingTransition, artisan, map[string]string{"action": "accept"}, id), 200)
	detail := call(bookingList, client, nil, id)
	check(detail, 200)
	var appointment calendarEvent
	if err := json.Unmarshal(detail.Body.Bytes(), &appointment); err != nil || appointment.ConversationID == "" {
		t.Fatalf("Conversation absente après acceptation : %s", detail.Body)
	}
	check(call(bookingList, other, nil, id), 404)
	check(call(messageEnvoyerHandler, artisan, map[string]string{"body": "Bonjour, pouvez-vous préciser le problème ?"}, appointment.ConversationID), 201)
	check(call(conversationMessageHandler, client, nil, appointment.ConversationID), 200)
	check(call(messageEnvoyerHandler, other, map[string]string{"body": "Intrusion"}, appointment.ConversationID), 404)
	check(call(conversationMessageHandler, other, nil, appointment.ConversationID), 404)

	settings.Diagnostic = 120
	check(call(calendarSettingsPut, artisan, settings, ""), 200)
	var duration float64
	if err := db.DB.QueryRow(`SELECT extract(epoch from ends_at-starts_at) FROM calendar_events WHERE id=$1`, id).Scan(&duration); err != nil || duration != 3600 {
		t.Fatal("La modification des horaires a changé le rendez-vous existant", err, duration)
	}
	check(call(bookingTransition, client, map[string]string{"action": "cancel"}, id), 200)
	a = call(bookingCreate, client, input, "")
	check(a, 201)
	json.Unmarshal(a.Body.Bytes(), &created)
	id = created["id"]
	if _, err := db.DB.Exec(`UPDATE calendar_events SET expires_at=now()-interval '1 second' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	check(call(bookingTransition, artisan, map[string]string{"action": "accept"}, id), 409)
	a = call(bookingCreate, client, input, "")
	check(a, 201)
	json.Unmarshal(a.Body.Bytes(), &created)
	check(call(bookingTransition, artisan, map[string]string{"action": "reject"}, created["id"]), 200)
	block["starts_at"] = start
	block["ends_at"] = start.Add(48 * time.Hour)
	a = call(calendarBlockCreate, artisan, block, "")
	check(a, 201)
	json.Unmarshal(a.Body.Bytes(), &created)
	check(call(bookingCreate, client, input, ""), 409)
	check(call(bookingTransition, artisan, map[string]string{"action": "cancel"}, created["id"]), 200)
	check(call(bookingCreate, client, input, ""), 201)
}
