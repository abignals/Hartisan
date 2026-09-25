package main

import (
	"bytes"
	"crypto/rand"
	"docto/db"
	"encoding/hex"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Les photos sont décodées puis réencodées : aucune métadonnée GPS conservée.
func messagePhotoPost(w http.ResponseWriter, r *http.Request) {
	u := utilisateurCourant(r)
	conv := r.PathValue("id")
	var allowed bool
	if err := db.DB.QueryRowContext(r.Context(), `SELECT EXISTS(SELECT 1 FROM conversations WHERE id::text=$1 AND $2 IN(client_id,artisan_id))`, conv, u.ID).Scan(&allowed); err != nil || !allowed {
		docError(w, "Conversation introuvable.", 404)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 9<<20)
	if err := r.ParseMultipartForm(9 << 20); err != nil {
		docError(w, "Photo trop volumineuse (8 Mo maximum).", 400)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("photo")
	if err != nil {
		docError(w, "Photo requise.", 400)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, (8<<20)+1))
	if err != nil || len(data) > 8<<20 {
		docError(w, "Photo trop volumineuse (8 Mo maximum).", 400)
		return
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > 20000000 {
		docError(w, "Choisissez une photo JPEG ou PNG, de 20 mégapixels maximum.", 400)
		return
	}
	photo, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		docError(w, "Photo illisible.", 400)
		return
	}
	random := make([]byte, 24)
	if _, err = rand.Read(random); err != nil {
		docError(w, "Enregistrement impossible.", 500)
		return
	}
	key := hex.EncodeToString(random) + ".jpg"
	dir := filepath.Join(documentDir(), "message-photos")
	if err = os.MkdirAll(dir, 0700); err != nil {
		docError(w, "Stockage indisponible.", 500)
		return
	}
	path := filepath.Join(dir, key)
	output, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		docError(w, "Stockage indisponible.", 500)
		return
	}
	committed := false
	defer func() {
		if !committed {
			os.Remove(path)
		}
	}()
	encodeErr := jpeg.Encode(output, photo, &jpeg.Options{Quality: 85})
	closeErr := output.Close()
	if encodeErr != nil || closeErr != nil {
		docError(w, "Enregistrement impossible.", 500)
		return
	}
	tx, err := db.DB.BeginTx(r.Context(), nil)
	if err != nil {
		docError(w, "Enregistrement impossible.", 500)
		return
	}
	defer tx.Rollback()
	m := messageLigne{DeMoi: true, Body: "Photo"}
	err = tx.QueryRowContext(r.Context(), `INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,'Photo') RETURNING id,created_at`, conv, u.ID).Scan(&m.ID, &m.CreatedAt)
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO message_photos(message_id,storage_key) VALUES($1,$2)`, m.ID, key)
	}
	if err == nil {
		_, err = tx.ExecContext(r.Context(), `UPDATE conversations SET last_message_at=$2 WHERE id=$1`, conv, m.CreatedAt)
	}
	if err != nil {
		docError(w, "Enregistrement impossible.", 500)
		return
	}
	if err = tx.Commit(); err != nil {
		docError(w, "Enregistrement impossible.", 500)
		return
	}
	committed = true
	m.PhotoURL = "/api/messages/" + m.ID + "/photo"
	docJSON(w, m)
}

func messagePhotoGet(w http.ResponseWriter, r *http.Request) {
	var key string
	err := db.DB.QueryRowContext(r.Context(), `SELECT p.storage_key FROM message_photos p JOIN messages m ON m.id=p.message_id JOIN conversations c ON c.id=m.conversation_id WHERE m.id::text=$1 AND $2 IN(c.client_id,c.artisan_id)`, r.PathValue("id"), utilisateurCourant(r).ID).Scan(&key)
	if err != nil {
		docError(w, "Photo introuvable.", 404)
		return
	}
	if filepath.Base(key) != key {
		docError(w, "Photo introuvable.", 404)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Type", "image/jpeg")
	http.ServeFile(w, r, filepath.Join(documentDir(), "message-photos", key))
}

func messageReportPost(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Reason string `json:"reason"`
	}
	if !decodeBooking(w, r, &input) {
		return
	}
	input.Reason = strings.TrimSpace(input.Reason)
	if len(input.Reason) < 3 || len(input.Reason) > 1000 {
		docError(w, "Précisez le motif (3 à 1000 caractères).", 400)
		return
	}
	result, err := db.DB.ExecContext(r.Context(), `INSERT INTO message_reports(message_id,reporter_id,reason)
 SELECT m.id,$2,$3 FROM messages m JOIN conversations c ON c.id=m.conversation_id
 WHERE m.id::text=$1 AND c.artisan_id=$2 AND m.sender_id=c.client_id
 ON CONFLICT(message_id,reporter_id) DO UPDATE SET reason=EXCLUDED.reason`, r.PathValue("id"), utilisateurCourant(r).ID, input.Reason)
	if err != nil {
		docError(w, "Signalement impossible.", 500)
		return
	}
	count, _ := result.RowsAffected()
	if count == 0 {
		docError(w, "Message introuvable.", 404)
		return
	}
	docJSON(w, map[string]bool{"reported": true})
}
