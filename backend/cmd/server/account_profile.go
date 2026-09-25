package main

import (
	"database/sql"
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"docto/db"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func accountGet(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)
	var address string
	if err := db.DB.QueryRowContext(r.Context(), `SELECT address_line FROM users WHERE id=$1`, u.ID).Scan(&address); err != nil {
		docError(w, "Profil indisponible.", 500)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	docJSON(w, map[string]string{"first_name": u.FirstName, "last_name": u.LastName, "email": u.Email, "phone": u.Phone, "address_line": address})
}

// Une seule propriété autorisée par requête ; l'identité cible vient de la session.
func accountPut(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Field    string `json:"field"`
		Value    string `json:"value"`
		Password string `json:"current_password"`
	}
	if !decodeBooking(w, r, &input) {
		return
	}
	sensitive := input.Field == "email" || input.Field == "phone" || input.Field == "password"
	if input.Field != "password" {
		input.Value = strings.TrimSpace(input.Value)
	}
	switch input.Field {
	case "first_name", "last_name":
		if utf8.RuneCountInString(input.Value) < 1 || utf8.RuneCountInString(input.Value) > 100 {
			docError(w, "Indiquez un nom de 1 à 100 caractères.", 400)
			return
		}
	case "address_line":
		if utf8.RuneCountInString(input.Value) > 500 {
			docError(w, "Adresse trop longue.", 400)
			return
		}
	case "email":
		address, err := mail.ParseAddress(input.Value)
		if err != nil || address.Address != input.Value || len(input.Value) > 254 {
			docError(w, "Adresse email invalide.", 400)
			return
		}
	case "phone":
		input.Value = strings.NewReplacer(" ", "", ".", "", "-", "", "(", "", ")", "").Replace(input.Value)
		if !regexp.MustCompile(`^\+?[0-9]{8,15}$`).MatchString(input.Value) {
			docError(w, "Numéro de téléphone invalide.", 400)
			return
		}
	case "password":
		if utf8.RuneCountInString(input.Value) < 12 || len(input.Value) > 72 {
			docError(w, "Utilisez au moins 12 caractères et au maximum 72 octets pour le mot de passe.", 400)
			return
		}
	default:
		docError(w, "Modification non autorisée.", 400)
		return
	}
	u := utilisateurCourant(r)
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		docError(w, "Modification impossible.", 500)
		return
	}
	defer tx.Rollback()
	var hash string
	if err = tx.QueryRowContext(r.Context(), `SELECT password_hash FROM users WHERE id=$1 FOR UPDATE`, u.ID).Scan(&hash); err != nil {
		docError(w, "Modification impossible.", 500)
		return
	}
	// Vérifier à nouveau la session après le verrou : une requête en attente peut avoir été révoquée.
	cookie, err := r.Cookie("session_id")
	if err != nil {
		docError(w, "Reconnectez-vous.", 401)
		return
	}
	var active bool
	if err = tx.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM sessions WHERE user_id=$1 AND token_hash=$2 AND revoked_at IS NULL AND expires_at>now())`, u.ID, hashToken(cookie.Value)).Scan(&active); err != nil {
		docError(w, "Vérification indisponible.", 500)
		return
	}
	if !active {
		docError(w, "Reconnectez-vous.", 401)
		return
	}
	if sensitive {
		var failures int
		var locked sql.NullTime
		err = tx.QueryRowContext(r.Context(), `SELECT failures,locked_until FROM account_verification_limits WHERE user_id=$1`, u.ID).Scan(&failures, &locked)
		if err != nil && err != sql.ErrNoRows {
			docError(w, "Vérification indisponible.", 500)
			return
		}
		if locked.Valid && locked.Time.After(time.Now()) {
			docError(w, "Trop de tentatives. Réessayez dans 15 minutes.", 429)
			return
		}
		if locked.Valid {
			failures = 0
		}
		if len(input.Password) > 72 || bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Password)) != nil {
			failures++
			_, err = tx.ExecContext(r.Context(), `INSERT INTO account_verification_limits(user_id,failures,locked_until)
    VALUES($1,$2,CASE WHEN $2>=5 THEN now()+interval '15 minutes' ELSE NULL END)
    ON CONFLICT(user_id) DO UPDATE SET failures=EXCLUDED.failures,locked_until=EXCLUDED.locked_until`, u.ID, failures)
			if err != nil {
				docError(w, "Vérification indisponible.", 500)
				return
			}
			if err = tx.Commit(); err != nil {
				docError(w, "Vérification indisponible.", 500)
				return
			}
			docError(w, "Mot de passe actuel incorrect.", 403)
			return
		}
	}
	var query string
	switch input.Field {
	case "first_name":
		query = `UPDATE users SET first_name=$2,updated_at=now() WHERE id=$1`
	case "last_name":
		query = `UPDATE users SET last_name=$2,updated_at=now() WHERE id=$1`
	case "address_line":
		query = `UPDATE users SET address_line=$2,updated_at=now() WHERE id=$1`
	case "phone":
		query = `UPDATE users SET phone=$2,updated_at=now() WHERE id=$1`
	case "email":
		query = `UPDATE users SET email=$2,email_verified_at=NULL,updated_at=now() WHERE id=$1`
	case "password":
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(input.Value)) == nil {
			docError(w, "Choisissez un mot de passe différent de l’actuel.", 400)
			return
		}
		newHash, hashErr := bcrypt.GenerateFromPassword([]byte(input.Value), bcrypt.DefaultCost)
		if hashErr != nil {
			docError(w, "Modification impossible.", 500)
			return
		}
		input.Value = string(newHash)
		query = `UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1`
	}
	if _, err = tx.ExecContext(r.Context(), query, u.ID, input.Value); err != nil {
		var pg *pq.Error
		if errors.As(err, &pg) && pg.Code == "23505" {
			docError(w, "Cette coordonnée est déjà utilisée. Choisissez-en une autre.", 409)
			return
		}
		docError(w, "Modification impossible.", 500)
		return
	}
	if sensitive {
		if _, err = tx.ExecContext(r.Context(), `DELETE FROM account_verification_limits WHERE user_id=$1`, u.ID); err != nil {
			docError(w, "Modification impossible.", 500)
			return
		}
		if _, err = tx.ExecContext(r.Context(), `UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, u.ID); err != nil {
			docError(w, "Modification impossible.", 500)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		docError(w, "Modification impossible.", 500)
		return
	}
	if sensitive {
		http.SetCookie(w, &http.Cookie{Name: "session_id", Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	}
	docJSON(w, map[string]bool{"updated": true, "reauthenticate": sensitive})
}
