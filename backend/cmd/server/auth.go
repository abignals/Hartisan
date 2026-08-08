package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"docto/db"
	//"golang.org/x/crypto/bcrypt"
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

func generateSessionToken() (string, error) {
	randomBytes := make([]byte, 32)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(randomBytes), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.URLEncoding.EncodeToString(sum[:])
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
	rawToken, err := generateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	tokenHash := hashToken(rawToken)

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = db.DB.Exec(
		"INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
		tokenHash, userID, expiresAt,
	)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    rawToken,
		HttpOnly: true,
		Path:     "/",
		Expires:  expiresAt,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"connecte"}`))
}