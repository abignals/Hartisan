package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"docto/db"
)

type conversationResume struct {
	ID				string		`json:"id"`
	AutreNom		string		`json:"autre_nom"`
	AutreRole		string		`json:"autre_role"`
	DernierMessage	string		`json:"dernier_message"`
	NonLus			int 		`json:"non_lus"`
	LastMessageAt	time.Time	`json:"last_message_at"`
}

type messageLigne struct {
	ID			string		`json:"id"`
	DeMoi		bool		`json:"de_moi"`
	Body		string		`json:"body"`
	CreatedAt 	time.Time	`json:"created_at"`
}

func conversationMessageHandler(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)
	convID := r.PathValue("id")

	var existe int
	err := db.DB.QueryRow(
		`SELECT 1 FROM conversations
		 WHERE id = $1 AND $2 IN (client_id, artisan_id)`,
		 convID, u.ID,
	).Scan(&existe)
	if err != nil {
		http.Error(w, `{"error":"conversation introuvable"}`, http.StatusNotFound)
		return
	}

	//ouvrir la conversation = lire tout ce que l'autre m'a envoye
	//(rejouable sans effet : le polling du front et le double appel de StrictMode ne posent pas de souci)
	if _, err := db.DB.Exec(
		`UPDATE messages SET read_at = now()
		  WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
		convID, u.ID,
	); err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	rows, err := db.DB.Query(
		`SELECT m.id, m.sender_id = $2 AS de_moi, m.body, m.created_at
			FROM messages m
		 WHERE m.conversation_id = $1
		 ORDER by m.created_at`,
		 convID, u.ID,
	)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	messages := []messageLigne{}
	for rows.Next() {
		var m messageLigne
		if err := rows.Scan(&m.ID, &m.DeMoi, &m.Body, &m.CreatedAt); err != nil {
			http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
			return
		}
		messages = append(messages, m)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func conversationListHandler(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)

	rows, err := db.DB.Query (`
			SELECT c.id,
					u.first_name, u.last_name, u.role,
					c.last_message_at,
					COALESCE(m.body, '') AS dernier_message,
					(SELECT count(*) FROM messages
						WHERE conversation_id = c.id
							AND sender_id <> $1
							AND read_at IS NULL) AS non_lus
				FROM conversations c
				JOIN users u
				  ON u.id = CASE WHEN c.client_id = $1 THEN c.artisan_id ELSE c.client_id END
				LEFT JOIN LATERAL (
					SELECT body FROM messages
					WHERE conversation_id = c.id
					ORDER BY created_at DESC
					LIMIT 1
				) m ON true
			  WHERE $1 IN (c.client_id, c.artisan_id)
			  ORDER BY c.last_message_at DESC`,
			  u.ID,
	)
	if err != nil {
		http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	conversations := []conversationResume{}
	for rows.Next() {
		var c conversationResume
		var prenom, nom string
		if err := rows.Scan(&c.ID, &prenom, &nom, &c.AutreRole,
				&c.LastMessageAt, &c.DernierMessage, &c.NonLus); err != nil {
					http.Error(w, `{"error":"Erreur interne"}`, http.StatusInternalServerError)
					return
		}
		c.AutreNom = prenom + " " + nom
		conversations = append(conversations, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conversations)
}

type nouvelleConversation struct {
	ArtisanID string `json:"artisan_id"`
}

func conversationCreateHandler(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)

	var req nouvelleConversation
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ArtisanID == "" {
		http.Error(w, `{"error":"artisan_id requis"}`, http.StatusBadRequest)
		return
	}

	//la base ne verifie pas le role : on s'assure ici que la cible est bien un artisan actif
	var existe int
	err := db.DB.QueryRow(
		`SELECT 1 FROM users
		  WHERE id = $1 AND role = 'artisan' AND suspended_at IS NULL`,
		req.ArtisanID,
	).Scan(&existe)
	if err != nil {
		http.Error(w, `{"error":"artisan introuvable"}`, http.StatusNotFound)
		return
	}

	//si la conversation existe deja, on renvoie la meme au lieu d'echouer sur le UNIQUE
	//(avec DO NOTHING, RETURNING ne renverrait aucune ligne)
	var convID string
	err = db.DB.QueryRow(
		`INSERT INTO conversations (client_id, artisan_id) VALUES ($1, $2)
		 ON CONFLICT (client_id, artisan_id) DO UPDATE SET client_id = EXCLUDED.client_id
		 RETURNING id`,
		u.ID, req.ArtisanID,
	).Scan(&convID)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"id": convID})
}

type nouveauMessage struct {
	Body string `json:"body"`
}

func messageEnvoyerHandler(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)
	convID := r.PathValue("id")

	//5000 caracteres max en base : 64 Ko de JSON suffisent largement, au-dela on coupe
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	var req nouveauMessage
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"corps de requete invalide"}`, http.StatusBadRequest)
		return
	}

	//RuneCount et pas len() : len compte les octets, un "é" en vaut 2,
	//alors que le CHECK de la base compte les caracteres
	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > 5000 {
		http.Error(w, `{"error":"message vide ou trop long (5000 caracteres max)"}`, http.StatusBadRequest)
		return
	}

	var existe int
	err := db.DB.QueryRow(
		`SELECT 1 FROM conversations
		 WHERE id = $1 AND $2 IN (client_id, artisan_id)`,
		convID, u.ID,
	).Scan(&existe)
	if err != nil {
		http.Error(w, `{"error":"conversation introuvable"}`, http.StatusNotFound)
		return
	}

	//insert + mise a jour du tri ensemble : sinon un crash entre les deux
	//laisse un message que la liste ne fait pas remonter
	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	m := messageLigne{DeMoi: true, Body: body}
	err = tx.QueryRow(
		`INSERT INTO messages (conversation_id, sender_id, body)
		 VALUES ($1, $2, $3)
		 RETURNING id, created_at`,
		convID, u.ID, body,
	).Scan(&m.ID, &m.CreatedAt)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(
		`UPDATE conversations SET last_message_at = $2 WHERE id = $1`,
		convID, m.CreatedAt,
	)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	//on renvoie le message au format du GET : le front l'ajoute au fil sans tout recharger
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}