package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "2000";
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func (w http.ResponseWriter, r *http.Request) {
		w.Write([]byte (`{"status":"ok"}`))
	})

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}