package main

import (
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"

	"docto/db"
)

type artisanContactRequest struct {
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	CompanyName  string `json:"company_name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Trade        string `json:"trade"`
	PostalCode   string `json:"postal_code"`
	Message      string `json:"message"`
	Availability string `json:"availability"`
	Consent      bool   `json:"consent"`
	Website      string `json:"website"`
}

func artisanContactPost(w http.ResponseWriter, r *http.Request) {
	var input artisanContactRequest
	if !decodeBooking(w, r, &input) {
		return
	}
	// Champ invisible destiné aux robots ; aucune fausse demande n'est enregistrée.
	if input.Website != "" {
		docJSON(w, map[string]bool{"recorded": true})
		return
	}
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.LastName = strings.TrimSpace(input.LastName)
	input.Email = strings.TrimSpace(input.Email)
	input.CompanyName = strings.TrimSpace(input.CompanyName)
	input.Phone = strings.NewReplacer(" ", "", ".", "", "-", "", "(", "", ")", "").Replace(strings.TrimSpace(input.Phone))
	input.Message = strings.TrimSpace(input.Message)
	email, err := mail.ParseAddress(input.Email)
	if err != nil || email.Address != input.Email || len(input.Email) > 254 || !input.Consent || input.FirstName == "" || input.LastName == "" || utf8.RuneCountInString(input.FirstName) > 100 || utf8.RuneCountInString(input.LastName) > 100 || utf8.RuneCountInString(input.CompanyName) > 160 || !regexp.MustCompile(`^\+?[0-9]{8,15}$`).MatchString(input.Phone) || !regexp.MustCompile(`^[0-9]{5}$`).MatchString(input.PostalCode) || utf8.RuneCountInString(input.Message) > 2000 {
		docError(w, "Vérifiez vos coordonnées et votre accord pour être recontacté.", 400)
		return
	}
	if input.Availability != "" && input.Availability != "matin" && input.Availability != "apres-midi" && input.Availability != "indifferent" {
		docError(w, "Disponibilité invalide.", 400)
		return
	}
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		docError(w, "Enregistrement indisponible.", 500)
		return
	}
	defer tx.Rollback()
	if input.Trade != "autre" {
		var valid bool
		if err = tx.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM trades WHERE slug=$1 AND is_active)`, input.Trade).Scan(&valid); err != nil {
			docError(w, "Enregistrement indisponible.", 500)
			return
		}
		if !valid {
			docError(w, "Choisissez votre métier.", 400)
			return
		}
	}
	// Sérialisation par email pour éviter les soumissions répétées simultanées.
	if _, err = tx.ExecContext(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "artisan-contact:"+strings.ToLower(input.Email)); err != nil {
		docError(w, "Enregistrement indisponible.", 500)
		return
	}
	var count int
	if err = tx.QueryRowContext(r.Context(), `SELECT count(*) FROM artisan_contact_requests WHERE email=$1 AND created_at>now()-interval '1 hour'`, input.Email).Scan(&count); err != nil {
		docError(w, "Enregistrement indisponible.", 500)
		return
	}
	if count >= 3 {
		docError(w, "Plusieurs demandes ont déjà été enregistrées avec cet email. Réessayez plus tard.", 429)
		return
	}
	_, err = tx.ExecContext(r.Context(), `INSERT INTO artisan_contact_requests(first_name,last_name,company_name,email,phone,trade,postal_code,message,availability) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, input.FirstName, input.LastName, input.CompanyName, input.Email, input.Phone, input.Trade, input.PostalCode, input.Message, input.Availability)
	if err != nil {
		docError(w, "Enregistrement indisponible.", 500)
		return
	}
	if err = tx.Commit(); err != nil {
		docError(w, "Enregistrement indisponible.", 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	docJSON(w, map[string]bool{"recorded": true})
}
