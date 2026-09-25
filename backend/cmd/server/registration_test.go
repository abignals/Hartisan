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

func TestRegistrationValidation(t *testing.T) {
	valid := registerRequestUser{Role: "client", Email: "test@example.invalid", Password: "a-long-test-password", FirstName: "Test", LastName: "Compte", Phone: "06 12 34 56 78"}
	if message := validateRegistration(&valid); message != "" || valid.Phone != "0612345678" {
		t.Fatal(message)
	}
	for _, change := range []func(*registerRequestUser){
		func(r *registerRequestUser) { r.Role = "admin" },
		func(r *registerRequestUser) { r.Password = "short" },
		func(r *registerRequestUser) { r.Email = "not-email" },
		func(r *registerRequestUser) { r.Phone = "text" },
		func(r *registerRequestUser) { r.CompanyName = "Entreprise" },
		func(r *registerRequestUser) { r.FirstName = "   " },
	} {
		copy := valid
		change(&copy)
		if validateRegistration(&copy) == "" {
			t.Fatal("Requête invalide acceptée")
		}
	}
}

func TestRegistrationForms(t *testing.T) {
	if os.Getenv("REGISTRATION_INTEGRATION_TEST") != "1" {
		t.Skip("REGISTRATION_INTEGRATION_TEST=1 requis sur base locale migrée")
	}
	if err := db.Connect(); err != nil {
		t.Fatal(err)
	}
	var tradeID int
	if err := db.DB.QueryRow(`SELECT id FROM trades WHERE is_active LIMIT 1`).Scan(&tradeID); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	defer func() {
		for _, id := range ids {
			db.DB.Exec(`DELETE FROM artisan_trades WHERE artisan_id IN(SELECT id FROM artisan_profiles WHERE user_id=$1)`, id)
			db.DB.Exec(`DELETE FROM users WHERE id=$1`, id)
		}
	}()
	request := func(role string, input registerRequestUser) *httptest.ResponseRecorder {
		data, _ := json.Marshal(input)
		r := httptest.NewRequest("POST", "/api/register/"+role, bytes.NewReader(data))
		r.SetPathValue("registrationRole", role)
		w := httptest.NewRecorder()
		registerHandler(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, code int) {
		t.Helper()
		if w.Code != code {
			t.Fatalf("Statut %d au lieu de %d : %s", w.Code, code, w.Body)
		}
	}
	base := func(role string) registerRequestUser {
		unique := fmt.Sprintf("%014d", time.Now().UnixNano()%100000000000000)
		return registerRequestUser{Role: role, Email: "signup-" + unique + "@example.invalid", Phone: unique, Password: "local-password-1234", FirstName: "Test", LastName: "Inscription"}
	}
	client := base("client")
	check(request("artisan", client), 400)
	w := request("client", client)
	check(w, 201)
	var result map[string]string
	json.Unmarshal(w.Body.Bytes(), &result)
	ids = append(ids, result["id"])
	check(request("client", client), 409)
	pro := base("artisan")
	pro.CompanyName = "TEST Entreprise"
	pro.Siret = pro.Phone
	pro.Description = "Plomberie et installations sanitaires de test."
	pro.AddressLine = "10 rue Fictive"
	pro.PostalCode = "75011"
	pro.City = "Paris"
	pro.ServiceRadiusM = 35000
	pro.TradeIDs = []int{tradeID}
	invalid := pro
	invalid.TradeIDs = []int{32767}
	check(request("artisan", invalid), 400)
	var count int
	db.DB.QueryRow(`SELECT count(*) FROM users WHERE email=$1`, pro.Email).Scan(&count)
	if count != 0 {
		t.Fatal("Compte partiel conservé après métier invalide")
	}
	w = request("artisan", pro)
	check(w, 201)
	json.Unmarshal(w.Body.Bytes(), &result)
	ids = append(ids, result["id"])
	var status, siret, description string
	var radius int
	if err := db.DB.QueryRow(`SELECT status,siret,description,service_radius_m FROM artisan_profiles WHERE user_id=$1`, result["id"]).Scan(&status, &siret, &description, &radius); err != nil {
		t.Fatal(err)
	}
	if status != "pending" || siret != pro.Siret || description != pro.Description || radius != 35000 {
		t.Fatal("Profil incorrect", status, siret, radius)
	}
	db.DB.QueryRow(`SELECT count(*) FROM artisan_trades WHERE artisan_id IN(SELECT id FROM artisan_profiles WHERE user_id=$1) AND trade_id=$2`, result["id"], tradeID).Scan(&count)
	if count != 1 {
		t.Fatal("Métier non enregistré")
	}
	duplicate := pro
	next := base("artisan")
	duplicate.Email = next.Email
	duplicate.Phone = next.Phone
	check(request("artisan", duplicate), 409)
	db.DB.QueryRow(`SELECT count(*) FROM users WHERE email=$1`, duplicate.Email).Scan(&count)
	if count != 0 {
		t.Fatal("Compte partiel conservé après SIRET dupliqué")
	}
}
