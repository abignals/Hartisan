package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"docto/db"
)

const maxDocument = 20 << 20

var documentTypes = map[string]bool{
	"application/pdf": true,
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"video/mp4":       true,
	"video/webm":      true,
}
var documentCategories = map[string]bool{
	"devis":      true,
	"facture":    true,
	"assurance":  true,
	"garantie":   true,
	"diagnostic": true,
	"photo":      true,
	"video":      true,
	"autre":      true,
}

func docJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func docError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func documentDir() string {
	if dir := os.Getenv("DOCUMENTS_DIR"); dir != "" {
		return dir
	}

	return "/data/documents"
}

func propertiesGet(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.QueryContext(
		r.Context(), `SELECT id, name
		 FROM properties
		 WHERE user_id=$1
		 ORDER BY name`,
		utilisateurCourant(r).ID,
	)
	if err != nil {
		docError(w, "Impossible de charger les logements.", 500)
		return
	}

	defer rows.Close()

	result := []map[string]string{}
	for rows.Next() {
		var id, name string
		if rows.Scan(&id, &name) != nil {
			docError(w, "Erreur de lecture.", 500)
			return
		}

		result = append(result, map[string]string{"id": id, "name": name})
	}

	if rows.Err() != nil {
		docError(w, "Erreur de lecture.", 500)
		return
	}

	docJSON(w, result)
}

func propertiesPost(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 2048)
	var input struct {
		Name string `json:"name"`
	}

	if json.NewDecoder(r.Body).Decode(&input) != nil {
		docError(w, "Nom de logement invalide.", 400)
		return
	}

	input.Name = strings.TrimSpace(input.Name)
	if len(input.Name) == 0 || len(input.Name) > 120 {
		docError(w, "Le nom doit contenir entre 1 et 120 caractères.", 400)
		return
	}

	var id string
	err := db.DB.QueryRowContext(
		r.Context(), `INSERT INTO properties(user_id,name) VALUES($1,$2) ON CONFLICT(user_id,name) DO UPDATE SET name=EXCLUDED.name
		 RETURNING id`,
		utilisateurCourant(r).ID, input.Name,
	).Scan(&id)
	if err != nil {
		docError(w, "Impossible d'ajouter le logement.", 500)
		return
	}

	docJSON(w, map[string]string{"id": id, "name": input.Name})
}

func documentsGet(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.QueryContext(
		r.Context(), `SELECT d.id,d.property_id,p.name,d.title,d.original_filename,d.category,d.mime_type,d.size,d.created_at,COALESCE(d.document_date::text,'')
		 FROM documents d
		 JOIN properties p ON p.id=d.property_id
		 WHERE d.user_id=$1
		 ORDER BY d.created_at DESC`,
		utilisateurCourant(r).ID,
	)
	if err != nil {
		docError(w, "Impossible de charger les documents.", 500)
		return
	}

	defer rows.Close()

	result := []map[string]any{}
	for rows.Next() {
		var id, pid, pname, title, filename, category, mt, date string
		var size int64
		var created time.Time
		if rows.Scan(&id, &pid, &pname, &title, &filename, &category, &mt, &size, &created, &date) != nil {
			docError(w, "Erreur de lecture.", 500)
			return
		}

		result = append(result, map[string]any{
			"id":                id,
			"property_id":       pid,
			"property_name":     pname,
			"title":             title,
			"original_filename": filename,
			"category":          category,
			"mime_type":         mt,
			"size":              size,
			"created_at":        created,
			"document_date":     date,
		})
	}

	if rows.Err() != nil {
		docError(w, "Erreur de lecture.", 500)
		return
	}

	docJSON(w, result)
}

func documentsPost(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxDocument+(1<<20))
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		docError(w, "Envoi invalide ou fichier supérieur à 20 Mo.", 413)
		return
	}

	defer r.MultipartForm.RemoveAll()

	title, category, pid := strings.TrimSpace(r.FormValue("title")), r.FormValue("category"), r.FormValue("property_id")
	if len(title) == 0 || len(title) > 200 || !documentCategories[category] {
		docError(w, "Titre ou catégorie invalide.", 400)
		return
	}

	date := r.FormValue("document_date")
	if date != "" {
		if _, err := time.Parse("2006-01-02", date); err != nil {
			docError(w, "Date invalide.", 400)
			return
		}
	}

	var owner bool
	if db.DB.QueryRowContext(
		r.Context(), `SELECT EXISTS(SELECT 1
		 FROM properties
		 WHERE id::text=$1 AND user_id=$2)`,
		pid, utilisateurCourant(r).ID,
	).Scan(&owner) != nil {
		docError(w, "Impossible de vérifier le logement.", 500)
		return
	}

	if !owner {
		docError(w, "Logement introuvable.", 400)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		docError(w, "Fichier manquant.", 400)
		return
	}

	defer file.Close()
	if header.Size <= 0 || header.Size > maxDocument {
		docError(w, "Le fichier doit contenir entre 1 octet et 20 Mo.", 400)
		return
	}

	buffer := make([]byte, 512)
	n, _ := file.Read(buffer)
	mt := http.DetectContentType(buffer[:n])
	if !documentTypes[mt] {
		docError(w, "Format accepté : PDF, JPG, PNG, WebP, MP4 ou WebM.", 400)
		return
	}

	if _, err = file.Seek(0, 0); err != nil {
		docError(w, "Lecture impossible.", 500)
		return
	}

	keyBytes := make([]byte, 32)
	if _, err = rand.Read(keyBytes); err != nil {
		docError(w, "Erreur de stockage.", 500)
		return
	}

	key := hex.EncodeToString(keyBytes)
	if os.MkdirAll(documentDir(), 0700) != nil {
		docError(w, "Stockage indisponible.", 500)
		return
	}

	path := filepath.Join(documentDir(), key)
	out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		docError(w, "Stockage indisponible.", 500)
		return
	}

	saved := false
	defer func() {
		if !saved {
			os.Remove(path)
		}
	}()

	size, copyErr := io.Copy(out, io.LimitReader(file, maxDocument+1))
	closeErr := out.Close()
	if copyErr != nil || closeErr != nil || size > maxDocument {
		docError(w, "Impossible d'enregistrer le fichier.", 500)
		return
	}

	filename := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
	if len(filename) > 255 {
		docError(w, "Nom de fichier trop long.", 400)
		return
	}

	_, err = db.DB.ExecContext(
		r.Context(), `INSERT INTO documents(user_id,property_id,title,original_filename,category,mime_type,size,storage_key,document_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULLIF($9,'')::date)`,
		utilisateurCourant(r).ID, pid, title, filename, category, mt, size, key, date,
	)
	if err != nil {
		docError(w, "Impossible d'enregistrer le document.", 500)
		return
	}

	saved = true
	w.WriteHeader(http.StatusCreated)
}

func documentFile(w http.ResponseWriter, r *http.Request) {
	var key, filename, mt string
	err := db.DB.QueryRowContext(
		r.Context(), `SELECT storage_key,original_filename,mime_type
		 FROM documents
		 WHERE id::text=$1 AND user_id=$2`,
		r.PathValue("id"), utilisateurCourant(r).ID,
	).Scan(&key, &filename, &mt)
	if err == sql.ErrNoRows {
		docError(w, "Document introuvable.", 404)
		return
	}

	if err != nil {
		docError(w, "Lecture impossible.", 500)
		return
	}

	file, err := os.Open(filepath.Join(documentDir(), key))
	if err != nil {
		docError(w, "Fichier indisponible.", 404)
		return
	}

	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		docError(w, "Lecture impossible.", 500)
		return
	}

	disposition := "inline"
	if r.URL.Query().Get("download") == "1" {
		disposition = "attachment"
	}

	w.Header().Set("Content-Type", mt)
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": filename}))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Security-Policy", "sandbox")
	http.ServeContent(w, r, filename, info.ModTime(), file)
}

func documentDelete(w http.ResponseWriter, r *http.Request) {
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		docError(w, "Suppression impossible.", 500)
		return
	}

	defer tx.Rollback()

	var key string
	err = tx.QueryRowContext(
		r.Context(), `DELETE
		 FROM documents
		 WHERE id::text=$1 AND user_id=$2
		 RETURNING storage_key`,
		r.PathValue("id"), utilisateurCourant(r).ID,
	).Scan(&key)
	if err == sql.ErrNoRows {
		docError(w, "Document introuvable.", 404)
		return
	}

	if err != nil {
		docError(w, "Suppression impossible.", 500)
		return
	}

	if err = os.Remove(filepath.Join(documentDir(), key)); err != nil && !os.IsNotExist(err) {
		docError(w, "Suppression du fichier impossible.", 500)
		return
	}

	if tx.Commit() != nil {
		docError(w, "Suppression incomplète, veuillez réessayer.", 500)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
