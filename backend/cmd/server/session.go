package main

import (
	"context"
	"net/http"

	"docto/db"
	"encoding/json"
)

type cleContexte string

const cleUtilisateur cleContexte = "utilisateur"

type utilisateur struct {
	ID 			string
	Role		string
	FirstName	string
	LastName	string
	Email		string
	Phone		string
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"id":   		u.ID,
		"role": 		u.Role,
		"first_name": 	u.FirstName,
		"last_name":	u.LastName,
		"email":		u.Email,
		"phone":		u.Phone,
	})
}

func logoutHandler(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("session_id"); err == nil {
		db.DB.Exec(
			"UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
			hashToken(cookie.Value),
		)
	}

	http.SetCookie(w, &http.Cookie {
		Name:	"session_id",
		Value:	"",
		HttpOnly: true,
		Path:	"/",
		MaxAge: -1,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"deconnecte"}`))
}

func utilisateurDeLaRequete(r *http.Request) (*utilisateur, error) {
	cookie, err := r.Cookie("session_id")
	if err != nil {
		return nil, err
	}

	tokenHash := hashToken(cookie.Value)

	var u utilisateur
	err = db.DB.QueryRow(
		`SELECT u.id, u.role, u.first_name, u.last_name, u.email, u.phone
			FROM sessions s
			JOIN users u ON u.id = s.user_id
			WHERE s.token_hash = $1
			AND s.revoked_at IS NULL
			AND s.expires_at > now()
			AND u.suspended_at IS NULL`,
			tokenHash,
	).Scan(&u.ID, &u.Role, &u.FirstName, &u.LastName, &u.Email, &u.Phone)
	if err != nil {
		return nil, err
	}

	return &u, nil
}

func exigeAuth(suivant http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, err := utilisateurDeLaRequete(r)
		if err != nil {
			http.Error(w, `{"error":"non authentifie"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), cleUtilisateur, u)
		suivant(w, r.WithContext(ctx))
	}
}

func exigeRole(role string, suivant http.HandlerFunc) http.HandlerFunc {
	return exigeAuth(func(w http.ResponseWriter, r *http.Request) {
		if utilisateurCourant(r).Role != role {
			http.Error(w, `{"error":"acces refuse"}`, http.StatusForbidden)
			return
		}
		suivant(w, r)
	})
}

func utilisateurCourant(r *http.Request) *utilisateur {
	u, _ := r.Context().Value(cleUtilisateur).(*utilisateur)
	return u
}
