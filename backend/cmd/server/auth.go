package main

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"time"
	"golang.org/x/crypto/bcrypt"
	"docto/db"
	"encoding/json"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func generateSessionID() (string, error) {
	randomBytes := make([]byte, 32)
	//filling "randomBytes" with : random bytes :D
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	//encoder les octets (illisible) en texte utilisable dans un cookie/URL
	return base64.URLEncoding.EncodeToString(randomBytes), nil
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	//lire le JSON envoye par le front
	var req loginRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, `{"error":"corps de requete invalide"}`, http.StatusBadRequest)
		return
	}

	//Cherche le USER dans la base selon son ID
	var userID int
	var passwordHash string
	err = db.DB.QueryRow("SELECT id, password_hash FROM users WHERE email = $1", req.Email,).Scan(&userID, &passwordHash)

	//Error management
	if err != nil {
		http.Error(w, `{"error":"email invalide"}`, http.StatusUnauthorized)
		return
	}

	passwordErr := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password))
	if passwordErr != nil {
		http.Error(w, `{"error":"mot de passe invalide"}`, http.StatusUnauthorized)
		return
	}

	sessionID, err := generateSessionID()
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	//Enregistrer la session dans la DB
	expiresAt := time.Now().Add(time.Minute)
	_, err = db.DB.Exec("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", sessionID, userID, expiresAt, )

	if err  != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	//Envoi des infos de session au navigateur sous forme de cookie
	http.SetCookie(w, &http.Cookie{
		Name:		"session_id",
		Value:		sessionID,
		HttpOnly:	true,
		Path:		"/",
		Expires:	expiresAt,
		SameSite:	http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"connecte"}`))
}