package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"docto/db"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
    Email		string	`json:"email"`
    Password	string	`json:"password"`
	FirstName	string	`json:"first_name"`
	LastName	string	`json:"last_name"`
	Phone		string	`json:"phone"`
	Role		string	`json:"role"`
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"corps de requete invalide"}`, http.StatusBadRequest)
		return
	}

	if req.Role != "client" && req.Role != "artisan" {
		http.Error(w, `{"error":"role invalide"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, `{"error":"email et password requis"}`, http.StatusBadRequest)
		return
	}

	if req.FirstName == "" || req.LastName == "" {
		http.Error(w, `{"error":"Prenom et nom de famille requis"}`, http.StatusBadRequest)
		return
	}

	if req.Phone == "" {
		http.Error(w, `{"error":"telephone requis"}`, http.StatusBadRequest)
		return
	}

	if len(req.Password) < 8 {
		http.Error(w, `{"error":"le mot de passe doit contenir au moins 8 caracteres"}`, http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	var id string

	err = db.DB.QueryRow(
		`INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		req.Email, string(hash), req.FirstName, req.LastName, req.Phone, req.Role,
	).Scan(&id)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			switch pqErr.Constraint {
			case "users_email_key":
					http.Error(w, `{"error":"cet email est deja utilise"}`, http.StatusConflict)
			case "users_phone_key":
					http.Error(w, `{"error":"ce numero de telephone est deja utilise"}`, http.StatusConflict)
			default:
				http.Error(w, `{"error":"conflite de donnees"}`, http.StatusConflict)
			}
			return
		}

		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf(`{"id":%d,"email":"%s"}`, id, req.Email)))
}