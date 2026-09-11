package main

import (
	"encoding/json"
 "database/sql"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"docto/db"
)

type searchArtisan struct {
 TestKey string `json:"test_key,omitempty"`
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	City        string  `json:"city"`
	PostalCode  string  `json:"postal_code"`
	Description string  `json:"description"`
	Trades      string  `json:"trades"`
	Distance    float64 `json:"distance_km"`
	Radius      int     `json:"radius_km"`
}

// La distance est indicative : elle part du centre de la commune choisie.
func searchArtisans(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	lat, errLat := strconv.ParseFloat(q.Get("lat"), 64)
	lon, errLon := strconv.ParseFloat(q.Get("lon"), 64)
	trade := q.Get("trade")
	if errLat != nil || errLon != nil || math.IsNaN(lat) || math.IsNaN(lon) || math.IsInf(lat, 0) || math.IsInf(lon, 0) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || len(trade) == 0 || len(trade) > 60 {
		docError(w, "Choisissez un métier et une ville dans les suggestions.", http.StatusBadRequest)
		return
	}
	rows, err := db.DB.QueryContext(r.Context(),
		`SELECT a.user_id, a.company_name, a.city, a.postal_code,
          COALESCE(a.description, ''),
          (SELECT string_agg(t.label, ', ' ORDER BY t.label)
           FROM artisan_trades at JOIN trades t ON t.id = at.trade_id
           WHERE at.artisan_id = a.id AND t.is_active),
          ST_Distance(a.location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) / 1000,
          a.service_radius_m / 1000, u.email
   FROM artisan_profiles a JOIN users u ON u.id = a.user_id
   WHERE a.status = 'approved' AND u.suspended_at IS NULL AND u.role = 'artisan'
     AND EXISTS(SELECT 1 FROM artisan_trades at JOIN trades t ON t.id = at.trade_id
                WHERE at.artisan_id = a.id AND t.slug = $3 AND t.is_active)
     AND ST_DWithin(a.location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, a.service_radius_m)
   ORDER BY ST_Distance(a.location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography), a.user_id
   LIMIT 51`, lon, lat, trade,
	)
	if err != nil {
		docError(w, "La recherche est momentanément indisponible.", 500)
		return
	}
	defer rows.Close()
	results := []searchArtisan{}
	for rows.Next() {
		var a searchArtisan
 var email string
		if err := rows.Scan(&a.ID, &a.Name, &a.City, &a.PostalCode, &a.Description, &a.Trades, &a.Distance, &a.Radius, &email); err != nil {
			docError(w, "Impossible de lire les résultats.", 500)
			return
		}
		a.TestKey = searchTestKey(email)
		results = append(results, a)
	}
	if rows.Err() != nil {
		docError(w, "Impossible de lire les résultats.", 500)
		return
	}
	more := len(results) > 50
	if more {
		results = results[:50]
	}
	docJSON(w, map[string]any{"artisans": results, "more": more})
}

type searchLocation struct {
 Code string `json:"code,omitempty"`
 Department string `json:"department,omitempty"`
	Name       string  `json:"name"`
	PostalCode string  `json:"postal_code"`
	Lat        float64 `json:"lat"`
	Lon        float64 `json:"lon"`
	Resolve    bool    `json:"resolve,omitempty"`
}

var communeClient = &http.Client{Timeout: 5 * time.Second}

func searchLocations(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(query) < 2 || len(query) > 80 {
		docJSON(w, []searchLocation{})
		return
	}
	numeric := true
	for _, c := range query {
		if c < '0' || c > '9' {
			numeric = false
		}
	}
	// Les préfixes postaux proposent les villes déjà représentées sur la plateforme.
	if numeric && len(query) < 5 {
		rows, err := db.DB.QueryContext(r.Context(),
			`SELECT DISTINCT a.city, a.postal_code
    FROM artisan_profiles a JOIN users u ON u.id = a.user_id
    WHERE a.status = 'approved' AND u.suspended_at IS NULL AND a.postal_code LIKE $1
    ORDER BY a.city, a.postal_code LIMIT 8`, query+"%",
		)
		if err != nil {
			docError(w, "Suggestions indisponibles.", 503)
			return
		}
		defer rows.Close()
		items := []searchLocation{}
		for rows.Next() {
			var item searchLocation
			if rows.Scan(&item.Name, &item.PostalCode) != nil {
				docError(w, "Suggestions indisponibles.", 503)
				return
			}
			item.Resolve = true
			items = append(items, item)
		}
		if rows.Err() != nil {
			docError(w, "Suggestions indisponibles.", 503)
			return
		}
		docJSON(w, items)
		return
	}
	params := url.Values{"fields": {"nom,code,departement,codesPostaux,centre"}, "limit": {"8"}, "boost": {"population"}}
	if numeric {
		params.Set("codePostal", query)
	} else {
		params.Set("nom", query)
	}
	req, err := http.NewRequestWithContext(r.Context(), "GET", "https://geo.api.gouv.fr/communes?"+params.Encode(), nil)
	if err != nil {
		docError(w, "Recherche de ville impossible.", 503)
		return
	}
	res, err := communeClient.Do(req)
	if err != nil {
		docError(w, "Les suggestions de villes sont indisponibles. Réessayez dans un instant.", 503)
		return
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		docError(w, "Suggestions de villes indisponibles.", 503)
		return
	}
	var communes []struct {
 Code string `json:"code"`
 Department struct { Code string `json:"code"`; Name string `json:"nom"` } `json:"departement"`
		Name        string   `json:"nom"`
		PostalCodes []string `json:"codesPostaux"`
		Center      struct {
			Coordinates []float64 `json:"coordinates"`
		} `json:"centre"`
	}
	if json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(&communes) != nil {
		docError(w, "Suggestions de villes indisponibles.", 503)
		return
	}
	items := []searchLocation{}
	for _, c := range communes {
		if len(c.Center.Coordinates) != 2 {
			continue
		}
        if !numeric {
            items = append(items, searchLocation{Name: c.Name, Code: c.Code, Department: c.Department.Name, Lat: c.Center.Coordinates[1], Lon: c.Center.Coordinates[0]})
            continue
        }
		for _, postal := range c.PostalCodes {
			if numeric && postal != query {
				continue
			}
			items = append(items, searchLocation{Name: c.Name, PostalCode: postal, Code: c.Code, Department: c.Department.Name, Lat: c.Center.Coordinates[1], Lon: c.Center.Coordinates[0]})
			if len(items) == 12 {
				docJSON(w, items)
				return
			}
		}
	}
	docJSON(w, items)
}

// Seuls les six comptes réservés à l’essai reçoivent des compléments fictifs côté interface.
func searchTestKey(email string) string {
 for _, key := range []string{"plombier-lyon", "plombier-villeurbanne", "electricien-lyon", "chauffagiste-lyon", "plombier-paris", "electricien-paris"} {
  if email == "test-recherche-" + key + "@example.invalid" {
   return key
  }
 }
 return ""
}

// Une page publique ne doit jamais rendre accessible un profil non publiable.
func publicArtisanGet(w http.ResponseWriter, r *http.Request) {
 var a searchArtisan
 var email string
 err := db.DB.QueryRowContext(r.Context(),
  `SELECT a.user_id, a.company_name, a.city, a.postal_code,
          COALESCE(a.description, ''), a.service_radius_m / 1000, u.email,
          COALESCE((SELECT string_agg(t.label, ', ' ORDER BY t.label)
           FROM artisan_trades at JOIN trades t ON t.id = at.trade_id
           WHERE at.artisan_id = a.id AND t.is_active), '')
   FROM artisan_profiles a JOIN users u ON u.id = a.user_id
   WHERE a.user_id::text = $1 AND a.status = 'approved'
     AND u.role = 'artisan' AND u.suspended_at IS NULL`,
  r.PathValue("id"),
 ).Scan(&a.ID, &a.Name, &a.City, &a.PostalCode, &a.Description, &a.Radius, &email, &a.Trades)
 if err == sql.ErrNoRows {
  docError(w, "Ce profil est introuvable ou n’est plus disponible.", http.StatusNotFound)
  return
 }
 if err != nil {
  docError(w, "Impossible de charger ce profil.", http.StatusInternalServerError)
  return
 }
 a.TestKey = searchTestKey(email)
 docJSON(w, a)
}
