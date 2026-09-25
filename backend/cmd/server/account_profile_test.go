package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"docto/db"
	"golang.org/x/crypto/bcrypt"
)

func TestAccountChanges(t *testing.T) {
	if os.Getenv("ACCOUNT_INTEGRATION_TEST") != "1" {
		t.Skip("ACCOUNT_INTEGRATION_TEST=1 requis sur base locale migrée")
	}
	if err := db.Connect(); err != nil {
		t.Fatal(err)
	}
	password := "old-local-password-123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	for _, role := range []string{"client", "artisan"} {
		t.Run(role, func(t *testing.T) {
			key := fmt.Sprintf("account-test-%d", time.Now().UnixNano())
			var id string
			err := db.DB.QueryRow(`INSERT INTO users(role,email,password_hash,first_name,last_name,phone) VALUES($1,$2,$3,'Test','Compte',$4) RETURNING id`, role, key+"@example.invalid", string(hash), key).Scan(&id)
			if err != nil {
				t.Fatal(err)
			}
			defer db.DB.Exec(`DELETE FROM users WHERE id=$1`, id)
			u := &utilisateur{ID: id, Role: role}
			token := key + "-session"
			addSession := func(raw string) {
				t.Helper()
				if _, err := db.DB.Exec(`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')`, id, hashToken(raw)); err != nil {
					t.Fatal(err)
				}
			}
			addSession(token)
			addSession(token + "-other")
			call := func(field, value, current string) *httptest.ResponseRecorder {
				data, _ := json.Marshal(map[string]string{"field": field, "value": value, "current_password": current})
				r := httptest.NewRequest("PUT", "/api/account", bytes.NewReader(data))
				r.AddCookie(&http.Cookie{Name: "session_id", Value: token})
				r = r.WithContext(context.WithValue(r.Context(), cleUtilisateur, u))
				w := httptest.NewRecorder()
				accountPut(w, r)
				return w
			}
			check := func(w *httptest.ResponseRecorder, code int) {
				t.Helper()
				if w.Code != code {
					t.Fatalf("Attendu %d, reçu %d : %s", code, w.Code, w.Body)
				}
			}
			check(call("role", "admin", password), 400)
			check(call("first_name", "Nouveau", ""), 200)
			check(call("address_line", "10 rue des Tests", ""), 200)
			check(call("phone", "abc", password), 400)
			for i := 0; i < 5; i++ {
				check(call("email", key+"-new@example.invalid", "incorrect"), 403)
			}
			check(call("email", key+"-new@example.invalid", password), 429)
			var email string
			db.DB.QueryRow(`SELECT email FROM users WHERE id=$1`, id).Scan(&email)
			if email != key+"@example.invalid" {
				t.Fatal("Email modifié malgré vérification échouée")
			}
			if _, err := db.DB.Exec(`UPDATE account_verification_limits SET locked_until=now()-interval '1 second' WHERE user_id=$1`, id); err != nil {
				t.Fatal(err)
			}
			check(call("email", key+"-new@example.invalid", password), 200)
			var live int
			db.DB.QueryRow(`SELECT count(*) FROM sessions WHERE user_id=$1 AND revoked_at IS NULL`, id).Scan(&live)
			if live != 0 {
				t.Fatal("Des sessions restent actives")
			}
			check(call("first_name", "Intrusion", ""), 401)
			token += "-new"
			addSession(token)
			check(call("password", "new-local-password-456", password), 200)
			var updated string
			db.DB.QueryRow(`SELECT password_hash FROM users WHERE id=$1`, id).Scan(&updated)
			if bcrypt.CompareHashAndPassword([]byte(updated), []byte("new-local-password-456")) != nil || bcrypt.CompareHashAndPassword([]byte(updated), []byte(password)) == nil {
				t.Fatal("Mot de passe non remplacé correctement")
			}
			login := func(pass string) *httptest.ResponseRecorder {
				data, _ := json.Marshal(map[string]string{"email": key + "-new@example.invalid", "password": pass, "role": role})
				r := httptest.NewRequest("POST", "/api/login", bytes.NewReader(data))
				w := httptest.NewRecorder()
				loginHandler(w, r)
				return w
			}
			check(login(password), 401)
			check(login("new-local-password-456"), 200)
			token += "-phone"
			addSession(token)
			check(call("phone", "+33 6 12 34 56 78", "new-local-password-456"), 200)
			var phone string
			db.DB.QueryRow(`SELECT phone FROM users WHERE id=$1`, id).Scan(&phone)
			if phone != "+33612345678" {
				t.Fatal("Téléphone non enregistré")
			}
		})
	}
}
