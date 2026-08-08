package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
	"net"

	"docto/db"
	"golang.org/x/crypto/bcrypt"
)

type loginRequest struct {
	Email		string `json:"email"`
	Password	string `json:"password"`
	Role		string `json:"role"`
}

func generateSessionToken() (string, error) {
	randomBytes := make([]byte, 32)
	//filling "randomBytes" with : random bytes :D
	if _, err := rand.Read(randomBytes); err != nil {
		return "", err
	}
	//encoder les octets (illisible) en texte utilisable dans un cookie/URL
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
	var userID string
	var passwordHash string
	var role string
	err = db.DB.QueryRow("SELECT id, password_hash, role FROM users WHERE email = $1", req.Email,).Scan(&userID, &passwordHash, &role)
	if err != nil {
		http.Error(w, `{"error":"email n'exsite pas"}`, http.StatusUnauthorized)
		return
	}

	if req.Role != role {
	http.Error(w, `{"error":"role invalide pour ce compte"}`, http.StatusUnauthorized)
	return
}

	//Error management
	rawToken, err := generateSessionToken()
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}
	tokenHash := hashToken(rawToken)

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
    	http.Error(w, `{"error":"Mot de passe invalide"}`, http.StatusUnauthorized)
    	return
	}

	userAgent := r.UserAgent()

	ipAddress, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		ipAddress = r.RemoteAddr // fallback si pas de port dans l'adresse
	}

	expiresAt := time.Now().Add(24 * time.Hour)
	_, err = db.DB.Exec(
		"INSERT INTO sessions (token_hash, user_id, user_agent, ip_address, expires_at) VALUES ($1, $2, $3, $4, $5)",
		tokenHash, userID, userAgent, ipAddress, expiresAt,
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
	json.NewEncoder(w).Encode(map[string]string{
		"status": "connecte",
		"role":   role,
	})
}