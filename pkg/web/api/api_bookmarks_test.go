package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestHandleBookmarks(t *testing.T) {
	db := setupTestDB(t)
	handler := NewHandler(&ApiConfig{DB: db})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 1. Create a session to bookmark
	session, _ := core.CreateProxySession(db, &core.LogEntry{
		RequestURL: &url.URL{Path: "/to-bookmark"},
	})

	// 2. Test POST /api/bookmarks/{session_id}
	req := httptest.NewRequest("POST", "/api/bookmarks/"+session.ID, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var bookmark core.ProxyBookmark
	json.NewDecoder(w.Body).Decode(&bookmark)
	if bookmark.SessionID != session.ID {
		t.Errorf("Expected session ID %s, got %s", session.ID, bookmark.SessionID)
	}

	// 3. Test GET /api/bookmarks
	req = httptest.NewRequest("GET", "/api/bookmarks", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	var listResp map[string]any
	json.NewDecoder(w.Body).Decode(&listResp)
	bookmarks := listResp["bookmarks"].([]any)
	if len(bookmarks) != 1 {
		t.Errorf("Expected 1 bookmark, got %d", len(bookmarks))
	}

	// 4. Test PATCH /api/bookmarks/{id}
	updatePayload := map[string]string{"note": "my note", "tags": "tag1"}
	body, _ := json.Marshal(updatePayload)
	req = httptest.NewRequest("PATCH", "/api/bookmarks/"+bookmark.ID, bytes.NewReader(body))
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	json.NewDecoder(w.Body).Decode(&bookmark)
	if bookmark.Note != "my note" {
		t.Errorf("Expected note 'my note', got %s", bookmark.Note)
	}

	// 5. Test DELETE /api/bookmarks/{id}
	req = httptest.NewRequest("DELETE", "/api/bookmarks/"+bookmark.ID, nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// Verify deletion
	req = httptest.NewRequest("GET", "/api/bookmarks/"+bookmark.ID, nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", w.Code)
	}
}
