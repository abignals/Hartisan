package main

import (
	"encoding/json"
	"net/http"

	"docto/db"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type registerRequestUser struct {
    Email		string	`json:"email"`
    Password	string	`json:"password"`
	FirstName	string	`json:"first_name"`
	LastName	string	`json:"last_name"`
	Phone		string	`json:"phone"`
	Role		string	`json:"role"`

	// Si Role = artisan
	CompanyName string `json:"company_name"`
	AddressLine string `json:"address_line"`
	PostalCode  string `json:"postal_code"`
	City        string `json:"city"`
	Siret string `json:"siret"`
	Description string `json:"description"`
	TradeIDs []int `json:"trade_ids"`
	ServiceRadiusM int `json:"service_radius_m"`
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req registerRequestUser
	if !decodeBooking(w, r, &req) { return }
	if role := r.PathValue("registrationRole"); role != "" && role != req.Role {
		docError(w, "Ce formulaire ne correspond pas au type de compte demandé.", 400)
		return
	}
	if message := validateRegistration(&req); message != "" {
		docError(w, message, 400)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	// On ouvre une transaction : soit tout réussit (user + profil artisan), soit rien n'est enregistré
	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var id string
	err = tx.QueryRow(
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

	if req.Role == "artisan" {
		var profileID string
		err = tx.QueryRow(
			`INSERT INTO artisan_profiles (user_id, company_name, address_line, postal_code, city, location, siret, description, service_radius_m, status)
			 VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography, $6, $7, $8, 'pending') RETURNING id`,
			id, req.CompanyName, req.AddressLine, req.PostalCode, req.City, req.Siret, req.Description, req.ServiceRadiusM,
		).Scan(&profileID)
		if err != nil {
			if pg, ok := err.(*pq.Error); ok && pg.Code == "23505" { docError(w, "Ce SIRET est déjà associé à un compte.", 409); return }
			docError(w, "Création du profil impossible.", 500)
			return
		}
		for _, tradeID := range req.TradeIDs {
			result, tradeErr := tx.Exec(`INSERT INTO artisan_trades(artisan_id,trade_id) SELECT $1,id FROM trades WHERE id=$2 AND is_active`, profileID, tradeID)
			if tradeErr != nil { docError(w, "Enregistrement des métiers impossible.", 500); return }
			count, countErr := result.RowsAffected()
			if countErr != nil || count != 1 { docError(w, "Un métier sélectionné n’est plus disponible.", 400); return }
		}

	}

	if err := tx.Commit(); err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": id, "email": req.Email})
}