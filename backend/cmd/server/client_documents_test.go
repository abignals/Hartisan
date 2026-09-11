package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"docto/db"
)

// Test d’intégration : activation explicite sur une base locale avec les migrations appliquées.
func TestClientDocumentsLifecycle(t *testing.T) {
	if os.Getenv("DOCUMENTS_INTEGRATION_TEST") != "1" {
		t.Skip("set DOCUMENTS_INTEGRATION_TEST=1 with a migrated local DATABASE")
	}

	if err := db.Connect(); err != nil {
		t.Fatal(err)
	}

	t.Setenv("DOCUMENTS_DIR", t.TempDir())

	// Création de deux clients pour vérifier la séparation de leurs documents.
	users := []string{}
	for i := 0; i < 2; i++ {
		var id string
		unique := fmt.Sprintf("documents-test-%d-%d", time.Now().UnixNano(), i)
		err := db.DB.QueryRow(
			`INSERT INTO users(role,email,password_hash,first_name,last_name,phone) VALUES('client',$1,'unused','Test','Documents',$2)
			 RETURNING id`,
			unique+"@example.invalid", unique,
		).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}

		users = append(users, id)
	}

	defer func() {
		for _, id := range users {
			db.DB.Exec("DELETE FROM documents WHERE user_id=$1", id)
			db.DB.Exec("DELETE FROM properties WHERE user_id=$1", id)
			db.DB.Exec("DELETE FROM users WHERE id=$1", id)
		}
	}()

	request := func(
		handler http.HandlerFunc,
		method, path string,
		body *bytes.Buffer,
		contentType, userID, id string,
	) *httptest.ResponseRecorder {
		if body == nil {
			body = &bytes.Buffer{}
		}

		req := httptest.NewRequest(method, path, body)
		req.Header.Set("Content-Type", contentType)
		req.SetPathValue("id", id)
		req = req.WithContext(context.WithValue(req.Context(), cleUtilisateur, &utilisateur{ID: userID, Role: "client"}))
		rec := httptest.NewRecorder()
		handler(rec, req)
		return rec
	}

	// Un visiteur sans session ne peut pas consulter les documents.
	unauthorized := httptest.NewRecorder()
	exigeRole("client", documentsGet)(unauthorized, httptest.NewRequest("GET", "/api/documents", nil))
	if unauthorized.Code != 401 {
		t.Fatalf("anonymous access = %d", unauthorized.Code)
	}

	home := request(propertiesPost, "POST", "/api/properties", bytes.NewBufferString(`{"name":"Logement test"}`), "application/json", users[0], "")
	if home.Code != 200 {
		t.Fatalf("property: %d %s", home.Code, home.Body)
	}

	var property map[string]string
	json.Unmarshal(home.Body.Bytes(), &property)
	upload := func(userID, category, date, content string) *httptest.ResponseRecorder {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		writer.WriteField("title", "Facture de test")
		writer.WriteField("category", category)
		writer.WriteField("property_id", property["id"])
		writer.WriteField("document_date", date)
		part, _ := writer.CreateFormFile("file", "facture.pdf")
		part.Write([]byte(content))
		writer.Close()
		return request(documentsPost, "POST", "/api/documents", &body, writer.FormDataContentType(), userID, "")
	}

	// Vérification des fichiers et des métadonnées refusés.
	pdf := "%PDF-1.4\nDocument de test\n%%EOF"
	for _, tc := range []struct {
		name, user, category, date, content string
	}{
		{"foreign property", users[1], "facture", "2023-06-01", pdf},
		{"invalid category", users[0], "unknown", "2023-06-01", pdf},
		{"invalid date", users[0], "facture", "2023-02-30", pdf},
		{"fake pdf", users[0], "facture", "2023-06-01", "<html>unsafe</html>"},
		{"empty file", users[0], "facture", "2023-06-01", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if rec := upload(tc.user, tc.category, tc.date, tc.content); rec.Code != 400 {
				t.Fatalf("got %d: %s", rec.Code, rec.Body)
			}
		})
	}

	if rec := upload(users[0], "facture", "2023-06-01", pdf); rec.Code != 201 {
		t.Fatalf("upload: %d %s", rec.Code, rec.Body)
	}

	list := request(documentsGet, "GET", "/api/documents", nil, "", users[0], "")
	var docs []struct {
		ID   string `json:"id"`
		Date string `json:"document_date"`
	}

	json.Unmarshal(list.Body.Bytes(), &docs)
	if list.Code != 200 || len(docs) != 1 || docs[0].Date != "2023-06-01" {
		t.Fatalf("list: %d %s", list.Code, list.Body)
	}

	id := docs[0].ID

	// Le second client ne doit ni voir, ni télécharger, ni supprimer le document.
	other := request(documentsGet, "GET", "/api/documents", nil, "", users[1], "")
	if strings.TrimSpace(other.Body.String()) != "[]" {
		t.Fatal("other user sees documents")
	}

	for _, handler := range []http.HandlerFunc{documentFile, documentDelete} {
		if rec := request(handler, "GET", "/", nil, "", users[1], id); rec.Code != 404 {
			t.Fatalf("foreign access: %d", rec.Code)
		}
	}

	// Le propriétaire peut télécharger puis supprimer son document.
	download := request(documentFile, "GET", "/api/documents/"+id+"/file?download=1", nil, "", users[0], id)
	if download.Code != 200 || download.Body.String() != pdf || !strings.HasPrefix(download.Header().Get("Content-Disposition"), "attachment;") {
		t.Fatalf("download: %d %s", download.Code, download.Body)
	}

	if rec := request(documentDelete, "DELETE", "/", nil, "", users[0], id); rec.Code != 204 {
		t.Fatalf("delete: %d %s", rec.Code, rec.Body)
	}

	if rec := request(documentFile, "GET", "/", nil, "", users[0], id); rec.Code != 404 {
		t.Fatalf("deleted file: %d", rec.Code)
	}

	files, err := os.ReadDir(os.Getenv("DOCUMENTS_DIR"))
	if err != nil || len(files) != 0 {
		t.Fatalf("files remaining after deletion or invalid upload: %v %d", err, len(files))
	}
}
