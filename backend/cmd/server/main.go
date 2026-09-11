package main

import (
	"log"
	"docto/db"
	"net/http"
	"os"
	"fmt"
)

//func test



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
	mux.HandleFunc("GET /api/search/artisans", searchArtisans)
	mux.HandleFunc("GET /api/artisans/{id}", publicArtisanGet)
	mux.HandleFunc("GET /api/search/locations", searchLocations)
	mux.HandleFunc("GET /api/properties", exigeRole("client", propertiesGet))
	mux.HandleFunc("POST /api/properties", exigeRole("client", propertiesPost))
	mux.HandleFunc("GET /api/documents", exigeRole("client", documentsGet))
	mux.HandleFunc("POST /api/documents", exigeRole("client", documentsPost))
	mux.HandleFunc("GET /api/documents/{id}/file", exigeRole("client", documentFile))
	mux.HandleFunc("DELETE /api/documents/{id}", exigeRole("client", documentDelete))
	mux.HandleFunc("GET /health", func (w http.ResponseWriter, r *http.Request) {
		w.Write([]byte (`{"status":"ok"}`))
	})

	mux.HandleFunc("POST /api/register", registerHandler)
	mux.HandleFunc("POST /api/login", loginHandler)
	mux.HandleFunc("GET /api/me", exigeAuth(meHandler))
	mux.HandleFunc("POST /api/logout", logoutHandler)
	// mux.HandleFunc("POST /api/artisan/profile", exigeRole("artisan", artisanProfileHandler))

	//a peut etre enlever
	mux.HandleFunc("GET /api/trades", tradesHandler)
	mux.HandleFunc("GET /api/artisan/profile", exigeRole("artisan", artisanProfileGet))
	mux.HandleFunc("PUT /api/artisan/profile", exigeRole("artisan", artisanProfilePut))
	mux.HandleFunc("GET /api/conversations", exigeAuth(conversationListHandler))
	mux.HandleFunc("POST /api/conversations", exigeRole("client", conversationCreateHandler))
	mux.HandleFunc("GET /api/conversations/{id}/messages", exigeAuth(conversationMessageHandler))
	mux.HandleFunc("POST /api/conversations/{id}/messages", exigeAuth(messageEnvoyerHandler))
	
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