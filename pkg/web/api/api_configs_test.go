package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestHandleConfigs(t *testing.T) {
	db := setupTestDB(t)
	handler := NewHandler(&ApiConfig{DB: db})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 1. Create some config history
	config1, _ := core.GetOrCreateConfigRow(db, "src1", "cwd1", `{"p":1}`)
	core.GetOrCreateConfigRow(db, "src2", "cwd2", `{"p":2}`)

	// 2. Test GET /api/configs/history
	req := httptest.NewRequest("GET", "/api/configs/history", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	var history []any
	json.NewDecoder(w.Body).Decode(&history)
	if len(history) != 2 {
		t.Errorf("Expected 2 history items, got %d", len(history))
	}

	// 3. Test GET /api/configs/{id}
	req = httptest.NewRequest("GET", "/api/configs/"+config1.ID, nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// 4. Test GET /api/configs/current
	core.GlobalVar.ConfigClear()
	core.GlobalVar.ConfigAdd(config1.ID)
	
	req = httptest.NewRequest("GET", "/api/configs/current", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
	var current []any
	json.NewDecoder(w.Body).Decode(&current)
	if len(current) != 1 {
		t.Errorf("Expected 1 current config, got %d", len(current))
	}

	// 5. Test GET /api/configs/{id}/sessions
	core.CreateProxySession(db, &core.LogEntry{
		ConfigID:   config1.ID,
		RequestURL: &url.URL{Path: "/sessions-test"},
	})
	req = httptest.NewRequest("GET", "/api/configs/"+config1.ID+"/sessions", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}
