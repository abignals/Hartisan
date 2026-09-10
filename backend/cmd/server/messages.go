package main

import (
	"encoding/json"
	"net/http"
	"time"

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
		http.Error(w, `{"error":"Erreur interner"}`, http.StatusInternalServerError)
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