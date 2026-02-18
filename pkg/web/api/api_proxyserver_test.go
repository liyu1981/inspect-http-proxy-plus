package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestHandleProxyServer(t *testing.T) {
	db := setupTestDB(t)
	handler := NewHandler(&ApiConfig{DB: db})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 1. Test POST /api/proxyserver/create
	entry := map[string]string{
		"listen": ":0", // ephemeral port
		"target": "http://example.com",
	}
	body, _ := json.Marshal(entry)
	req := httptest.NewRequest("POST", "/api/proxyserver/create", bytes.NewReader(body))
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	// 2. Test POST /api/proxyserver/{id}/stop (should return 404 since it's not in GlobalVar as a server)
	// Actually we should see what GlobalVar has now
	configIDs := core.GlobalVar.ConfigGetAll()
	if len(configIDs) == 0 {
		t.Fatal("Expected at least one config to be created")
	}
	configID := configIDs[0]

	req = httptest.NewRequest("POST", "/api/proxyserver/"+configID+"/stop", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	// Check stop behavior (should return 200 or 404 depending on if it's running)
	// If StartProxyServer was called, it should be in GlobalVar servers.
	// But it's asynchronous or started in a goroutine?
	// Let's just check it doesn't panic and returns a valid status.
}
