package main

// import (
// 	"bytes"
// 	"databse/sql"
// 	"encoding/json"
// 	"io"
// 	"net/http"
// 	"os"
// 	"path/filepath"

// 	"docto/db"
// )

// const tailleMaxDoc = 8 << 20 // 8Mo

// var dossierDoc = os.Getenv("DOCUMENTS_DIR")

// func artisanDocPost(w http.ResponseWriter, r *http.Request) {
// 	u := utilisateurCourant(r)
//   	// Borne la taille du corps AVANT de lire quoi que ce soit.                                                                                                	// Sans ca, un client peut envoyer 10 Go et saturer la RAM et le disque
// 	r.Body = http.MaxBytesReader(w, r.Body, tailleMaxDoc+(1<<20))

// 	if err := r.ParseMultipartForm(4 << 20); err != nil {
// 		http.Error(w, `{"error":"fichier trop volumineux"}`, http.StatusRequestEntityTooLarge)
// 		return
// 	}

// 	kind := r.FormValue("kind")
// 	if kind != "insurance_decennale" && kind != "diploma" {
// 		http.Error(w, `{"error":"tpe de document invalide"}`, http.StatusBadRequest)
// 		return
// 	}

// }