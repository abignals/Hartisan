package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"docto/db"
)

func TestArtisanContact(t *testing.T) {
	call := func(input artisanContactRequest) *httptest.ResponseRecorder {
		data, _ := json.Marshal(input)
		r := httptest.NewRequest("POST", "/api/pro/contact", bytes.NewReader(data))
		w := httptest.NewRecorder()
		artisanContactPost(w, r)
		return w
	}
	if w := call(artisanContactRequest{}); w.Code != 400 {
		t.Fatalf("Formulaire vide accepté : %s", w.Body)
	}
	if os.Getenv("CONTACT_INTEGRATION_TEST") != "1" {
		t.Skip("CONTACT_INTEGRATION_TEST=1 requis sur base locale migrée")
	}
	if err := db.Connect(); err != nil {
		t.Fatal(err)
	}
	email := fmt.Sprintf("contact-test-%d@example.invalid", time.Now().UnixNano())
	defer db.DB.Exec(`DELETE FROM artisan_contact_requests WHERE email=$1`, email)
	input := artisanContactRequest{FirstName: "Test", LastName: "Artisan", CompanyName: "Entreprise fictive", Email: email, Phone: "0600000000", Trade: "autre", PostalCode: "75011", Consent: true, Availability: "matin", Message: "Test local de demande de contact"}
	for i := 0; i < 3; i++ {
		if w := call(input); w.Code != 201 {
			t.Fatalf("Création : %d %s", w.Code, w.Body)
		}
	}
	if w := call(input); w.Code != 429 {
		t.Fatalf("Limitation absente : %d", w.Code)
	}
	var count int
	var company, message string
	if err := db.DB.QueryRow(`SELECT count(*) FROM artisan_contact_requests WHERE email=$1`, email).Scan(&count); err != nil || count != 3 {
		t.Fatal("Nombre de demandes incorrect", count, err)
	}
	if err := db.DB.QueryRow(`SELECT company_name,message FROM artisan_contact_requests WHERE email=$1 LIMIT 1`, email).Scan(&company, &message); err != nil || company != input.CompanyName || message != input.Message {
		t.Fatal("Informations non enregistrées", err)
	}
	input.Consent = false
	if w := call(input); w.Code != 400 {
		t.Fatal("Accord non vérifié")
	}
	input.Consent = true
	input.Trade = "inconnu"
	if w := call(input); w.Code != 400 {
		t.Fatal("Métier non vérifié")
	}
}
