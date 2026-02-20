package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestHandleRecentSessions(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-api-test"

	u, _ := url.Parse("http://example.com/foo")
	// Create a dummy session
	entry := &core.LogEntry{
		ConfigID:       configID,
		Timestamp:      time.Now(),
		ClientAddr:     "127.0.0.1:12345",
		RequestMethod:  "GET",
		RequestURL:     u,
		RequestProto:   "HTTP/1.1",
		RequestHost:    "example.com",
		RequestHeaders: http.Header{},
	}

	_, err := core.CreateProxySession(db, entry)
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	handler := NewHandler(&ApiConfig{DB: db})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/sessions/recent/"+configID, nil)
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if result["config_id"] != configID {
		t.Errorf("Expected config_id %s, got %v", configID, result["config_id"])
	}

	sessions, ok := result["sessions"].([]any)
	if !ok {
		t.Errorf("Expected sessions array in response")
	} else if len(sessions) != 1 {
		t.Errorf("Expected 1 session, got %d", len(sessions))
	}
}

func TestHandleSessionDetail(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-api-detail"

	u, _ := url.Parse("http://example.com/bar")
	entry := &core.LogEntry{
		ConfigID:       configID,
		Timestamp:      time.Now(),
		ClientAddr:     "127.0.0.1:12345",
		RequestMethod:  "POST",
		RequestURL:     u,
		RequestProto:   "HTTP/1.1",
		RequestHost:    "example.com",
		RequestHeaders: http.Header{"Content-Type": []string{"application/json"}},
	}

	session, err := core.CreateProxySession(db, entry)
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	handler := NewHandler(&ApiConfig{DB: db})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	req := httptest.NewRequest("GET", "/api/sessions/"+session.ID, nil)
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	sessMap, ok := result["session"].(map[string]any)
	if !ok {
		t.Fatalf("Expected session object in response")
	}

	if sessMap["ID"] != session.ID {
		t.Errorf("Expected session ID %s, got %v", session.ID, sessMap["ID"])
	}
	if sessMap["RequestMethod"] != "POST" {
		t.Errorf("Expected method POST, got %v", sessMap["RequestMethod"])
	}
}
