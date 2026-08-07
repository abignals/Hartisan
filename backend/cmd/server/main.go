package main

import (
	"log"
	"docto/db"
	"net/http"
	"os"
	"fmt"
	"encoding/json"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type registerRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"corps de requete invalide"}`, http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		http.Error(w, `{"error":"email et password requis"}`, http.StatusBadRequest)
		return
	}
	
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	var id int
	err = db.DB.QueryRow(
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
		req.Email, string(hash),
	).Scan(&id)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			http.Error(w, `{"error":"cet email est deja utilise"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"erreur interne"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf(`{"id":%d,"email":"%s"}`, id, req.Email)))
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "2000";
	}
	
	if err:= db.Connect(); err != nil {
		log.Fatal("Erreur de connexion DB:", err)
	}

	log.Println("Serveur ok")
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func (w http.ResponseWriter, r *http.Request) {
		w.Write([]byte (`{"status":"ok"}`))
	})

	mux.HandleFunc("POST /api/register", registerHandler)
	mux.HandleFunc("POST /api/login", loginHandler)
	
	mux.HandleFunc("GET /api/db-test", func(w http.ResponseWriter, r *http.Request) {
		var now string
		err := db.DB.QueryRow("SELECT NOW()").Scan(&now)
		if err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err), http.StatusInternalServerError)
			//http.Error : le writer, le message d'erreur (JSON), le type d'erreur (code d'erreur)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(fmt.Sprintf(`{"db_time":"%s"}`, now)))
		//fmt.Sprintf({"db_time":"%s"}, now) : construit le JSON final, ex {"db_time":"2026-08-06 17:45:12.123456"}.
		//[]byte = void * + length (en format byte (uint8))

		// plus complexe utiliser la package standart enconding/json : json.NewEncoder(w).Encode(map[string]string{"db_time": now})
	})

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}