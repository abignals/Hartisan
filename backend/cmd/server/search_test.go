package main

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"docto/db"
)

func TestSearchRejectsInvalidCoordinates(t *testing.T) {
	for _, coordinates := range []string{"lat=NaN&lon=4", "lat=91&lon=4", "lat=45&lon=Inf", "lat=45&lon=181", "lat=&lon=4"} {
		rec := httptest.NewRecorder()
		searchArtisans(rec, httptest.NewRequest("GET", "/api/search/artisans?trade=plombier&"+coordinates, nil))
		if rec.Code != 400 {
			t.Fatalf("%s: statut %d", coordinates, rec.Code)
		}
	}
}

// Activation explicite : test sur une base locale migrée, comptes temporaires nettoyés.
func TestSearchVisibility(t *testing.T) {
	if os.Getenv("SEARCH_INTEGRATION_TEST") != "1" {
		t.Skip("SEARCH_INTEGRATION_TEST=1 requis")
	}
	if err := db.Connect(); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	defer func() {
		for _, id := range ids {
			db.DB.Exec(`DELETE FROM artisan_trades WHERE artisan_id IN (SELECT id FROM artisan_profiles WHERE user_id=$1)`, id)
			db.DB.Exec(`DELETE FROM users WHERE id=$1`, id)
		}
	}()
	cases := []struct {
		status, trade string
		suspended     bool
		lon           float64
	}{
		{"approved", "plombier", false, 40},
		{"pending", "plombier", false, 40},
		{"suspended", "plombier", false, 40},
		{"approved", "plombier", true, 40},
		{"approved", "electricien", false, 40},
		{"approved", "plombier", false, 45},
	}
	for i, c := range cases {
		key := fmt.Sprintf("search-check-%d-%d", time.Now().UnixNano(), i)
		var id, profile string
		err := db.DB.QueryRow(`INSERT INTO users(role,email,password_hash,first_name,last_name,phone,suspended_at)
   VALUES('artisan',$1,'unused','Test','Search',$2,CASE WHEN $3 THEN now() ELSE NULL END) RETURNING id`, key+"@example.invalid", key, c.suspended).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, id)
		err = db.DB.QueryRow(`INSERT INTO artisan_profiles(user_id,company_name,city,postal_code,location,status)
   VALUES($1,'TEST','Test','00000',ST_SetSRID(ST_MakePoint($2,10),4326)::geography,$3) RETURNING id`, id, c.lon, c.status).Scan(&profile)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.DB.Exec(`INSERT INTO artisan_trades(artisan_id,trade_id) SELECT $1,id FROM trades WHERE slug=$2`, profile, c.trade); err != nil {
			t.Fatal(err)
		}
	}
	rec := httptest.NewRecorder()
	searchArtisans(rec, httptest.NewRequest("GET", "/api/search/artisans?trade=plombier&lat=10&lon=40", nil))
	var result struct {
		Artisans []searchArtisan `json:"artisans"`
	}
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &result) != nil {
		t.Fatalf("Réponse: %d %s", rec.Code, rec.Body)
	}
	if len(result.Artisans) != 1 || result.Artisans[0].ID != ids[0] {
		t.Fatalf("Filtrage incorrect: %s", rec.Body)
	}
	// Le lien direct d’un profil applique les mêmes restrictions de publication.
	for i, id := range ids {
		request := httptest.NewRequest("GET", "/api/artisans/"+id, nil)
		request.SetPathValue("id", id)
		profile := httptest.NewRecorder()
		publicArtisanGet(profile, request)
		expected := 200
		if i == 1 || i == 2 || i == 3 {
			expected = 404
		}
		if profile.Code != expected {
			t.Fatalf("Profil %d : statut %d, attendu %d", i, profile.Code, expected)
		}
		for _, private := range []string{"email", "phone", "address_line", "password_hash"} {
			if strings.Contains(profile.Body.String(), `"`+private+`"`) {
				t.Fatalf("Champ privé publié dans le profil : %s", private)
			}
		}
	}

	for _, private := range []string{"email", "phone", "address_line", "password_hash"} {
		if strings.Contains(rec.Body.String(), `"`+private+`"`) {
			t.Fatalf("Champ privé publié: %s", private)
		}
	}
}
