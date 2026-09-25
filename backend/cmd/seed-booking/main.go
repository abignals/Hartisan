// Prépare uniquement les comptes fictifs locaux, sans remplacer leurs réglages.
package main

import (
	"crypto/rand"
	"database/sql"
	"docto/db"
	"encoding/hex"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"log"
	"os"
)

func main() {
	if os.Getenv("ALLOW_BOOKING_TEST_ACCOUNTS") != "1" {
		log.Fatal("ALLOW_BOOKING_TEST_ACCOUNTS=1 requis, uniquement en local")
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
	var client string
	err = tx.QueryRow(`INSERT INTO users(role,email,password_hash,first_name,last_name,phone)
 VALUES('client','test-rdv-client@example.invalid',$1,'Camille','Test','test-rdv-client')
 ON CONFLICT(email) DO NOTHING RETURNING id`, string(hash)).Scan(&client)
	if err != nil && err != sql.ErrNoRows {
		log.Fatal(err)
	}
	created := err == nil
	for _, slug := range []string{"plombier-lyon", "plombier-villeurbanne", "electricien-lyon", "chauffagiste-lyon", "plombier-paris", "electricien-paris"} {
		var id string
		err = tx.QueryRow(`INSERT INTO calendar_settings(artisan_id)
 SELECT id FROM users WHERE email=$1 AND role='artisan'
 ON CONFLICT DO NOTHING RETURNING artisan_id`, "test-recherche-"+slug+"@example.invalid").Scan(&id)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			log.Fatal(err)
		}
		for day := 1; day <= 5; day++ {
			if _, err := tx.Exec(`INSERT INTO availability_windows(artisan_id,weekday,start_minute,end_minute) VALUES($1,$2,480,720),($1,$2,780,1080)`, id, day); err != nil {
				log.Fatal(err)
			}
		}
	}
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	if created {
		fmt.Println("Client : test-rdv-client@example.invalid\nMot de passe local :", password)
	} else {
		fmt.Println("Client déjà présent : mot de passe conservé.")
	}
	fmt.Println("Horaires des artisans fictifs initialisés si absents : lundi–vendredi, 8–12 h et 13–18 h.")
}
