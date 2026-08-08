package main

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"docto/db"
	"github.com/lib/pq"
)

type artisanProfile struct {
	CompanyName        string `json:"company_name"`
	Siret              string `json:"siret"`
	Description        string `json:"description"`
	AddressLine        string `json:"address_line"`
	PostalCode         string `json:"postal_code"`
	City               string `json:"city"`
	ServiceRadiusM     int    `json:"service_radius_m"`
	DefaultSlotMinutes int    `json:"default_slot_minutes"`
	Status             string `json:"status"`
	TradeIDs           []int  `json:"trade_ids"`
}

// Liste des metiers proposes (public : sert aussi a la recherche)
func tradesHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(
		`SELECT id, slug, label FROM trades WHERE is_active ORDER BY label`,
	)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type trade struct {
		ID    int    `json:"id"`
		Slug  string `json:"slug"`
		Label string `json:"label"`
	}

	metiers := []trade{}
	for rows.Next() {
		var t trade
		if err := rows.Scan(&t.ID, &t.Slug, &t.Label); err != nil {
			http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
			return
		}
		metiers = append(metiers, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metiers)
}

func artisanProfileGet(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)

	// COALESCE : le front recoit "" plutot que null sur les colonnes nullables
	var p artisanProfile
	var artisanID string
	err := db.DB.QueryRow(
		`SELECT id, company_name, COALESCE(siret,''), COALESCE(description,''),
		        COALESCE(address_line,''), postal_code, city,
		        service_radius_m, default_slot_minutes, status
		   FROM artisan_profiles
		  WHERE user_id = $1`,
		u.ID,
	).Scan(&artisanID, &p.CompanyName, &p.Siret, &p.Description,
		&p.AddressLine, &p.PostalCode, &p.City,
		&p.ServiceRadiusM, &p.DefaultSlotMinutes, &p.Status)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"profil introuvable"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	rows, err := db.DB.Query(
		`SELECT trade_id FROM artisan_trades WHERE artisan_id = $1`, artisanID,
	)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	p.TradeIDs = []int{} // jamais nil : le front recoit [] et non null
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
			return
		}
		p.TradeIDs = append(p.TradeIDs, id)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func artisanProfilePut(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)

	var req artisanProfile
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"corps de requete invalide"}`, http.StatusBadRequest)
		return
	}

	if req.CompanyName == "" || req.PostalCode == "" || req.City == "" {
		http.Error(w, `{"error":"nom d'entreprise, code postal et ville requis"}`, http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// status n'est pas modifiable ici : c'est l'admin qui valide
	var artisanID string
	err = tx.QueryRow(
		`UPDATE artisan_profiles
		    SET company_name         = $2,
		        siret                = NULLIF($3,''),
		        description          = NULLIF($4,''),
		        address_line         = NULLIF($5,''),
		        postal_code          = $6,
		        city                 = $7,
		        service_radius_m     = $8,
		        default_slot_minutes = $9,
		        updated_at           = now()
		  WHERE user_id = $1
		  RETURNING id`,
		u.ID, req.CompanyName, req.Siret, req.Description, req.AddressLine,
		req.PostalCode, req.City, req.ServiceRadiusM, req.DefaultSlotMinutes,
	).Scan(&artisanID)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"profil introuvable"}`, http.StatusNotFound)
		return
	}
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			http.Error(w, `{"error":"ce SIRET est deja utilise"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	// on remplace la liste des metiers plutot que de calculer un diff
	if _, err := tx.Exec(`DELETE FROM artisan_trades WHERE artisan_id = $1`, artisanID); err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	for _, tid := range req.TradeIDs {
		if _, err := tx.Exec(
			`INSERT INTO artisan_trades (artisan_id, trade_id) VALUES ($1, $2)`,
			artisanID, tid,
		); err != nil {
			http.Error(w, `{"error":"metier invalide"}`, http.StatusBadRequest)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"enregistre"}`))
}
