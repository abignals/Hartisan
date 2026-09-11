// Outil local explicite : crée uniquement les comptes réservés aux essais de recherche.
package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"

	"docto/db"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if os.Getenv("ALLOW_SEARCH_TEST_ACCOUNTS") != "1" {
		log.Fatal("Activation explicite requise : ALLOW_SEARCH_TEST_ACCOUNTS=1")
	}
	if err := db.Connect(); err != nil {
		log.Fatal(err)
	}
	random := make([]byte, 12)
	if _, err := rand.Read(random); err != nil {
		log.Fatal(err)
	}
	password := hex.EncodeToString(random)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}
	tx, err := db.DB.Begin()
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback()
	samples := []struct {
		slug, name, trade, city, postal string
		lon, lat                        float64
	}{
		{"plombier-lyon", "Atelier plomberie Lyon", "plombier", "Lyon", "69003", 4.85, 45.76},
		{"plombier-villeurbanne", "Plomberie Villeurbanne", "plombier", "Villeurbanne", "69100", 4.88, 45.77},
		{"electricien-lyon", "Électricité Lyon", "electricien", "Lyon", "69007", 4.84, 45.74},
		{"chauffagiste-lyon", "Chauffage Lyon", "chauffagiste", "Lyon", "69008", 4.87, 45.73},
		{"plombier-paris", "Plomberie Paris", "plombier", "Paris", "75011", 2.38, 48.86},
		{"electricien-paris", "Électricité Paris", "electricien", "Paris", "75012", 2.40, 48.84},
	}
	for i, sample := range samples {
		email := "test-recherche-" + sample.slug + "@example.invalid"
		var userID string
		err := tx.QueryRow(
			`INSERT INTO users(role,email,password_hash,first_name,last_name,phone)
    VALUES('artisan',$1,$2,'Artisan','Fictif',$3)
    ON CONFLICT(email) DO NOTHING RETURNING id`, email, string(hash), fmt.Sprintf("test-recherche-%d", i),
		).Scan(&userID)
		if err != nil {
			log.Fatalf("Création interrompue (comptes déjà présents ou erreur) : %v", err)
		}
		var artisanID string
		err = tx.QueryRow(
			`INSERT INTO artisan_profiles(user_id,company_name,description,address_line,postal_code,city,location,status)
    VALUES($1,$2,'Compte fictif créé pour tester la recherche. Aucune intervention réelle.','Adresse fictive',$3,$4,ST_SetSRID(ST_MakePoint($5,$6),4326)::geography,'approved') RETURNING id`,
			userID, "[TEST] "+sample.name, sample.postal, sample.city, sample.lon, sample.lat,
		).Scan(&artisanID)
		if err != nil {
			log.Fatal(err)
		}
		if _, err := tx.Exec(`INSERT INTO artisan_trades(artisan_id,trade_id) SELECT $1,id FROM trades WHERE slug=$2`, artisanID, sample.trade); err != nil {
			log.Fatal(err)
		}
	}
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("6 comptes fictifs créés. Mot de passe commun local :", password)
	for _, sample := range samples {
		fmt.Println("test-recherche-" + sample.slug + "@example.invalid")
	}
}
