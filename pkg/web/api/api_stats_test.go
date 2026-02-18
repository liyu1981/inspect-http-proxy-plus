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

func TestHandleStats(t *testing.T) {
	db := setupTestDB(t)
	handler := NewHandler(&ApiConfig{DB: db})
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// Create some sessions with different methods and paths
	sessions := []struct {
		method string
		path   string
		dur    time.Duration
	}{
		{"GET", "/a", 100 * time.Millisecond},
		{"GET", "/a", 200 * time.Millisecond},
		{"POST", "/b", 500 * time.Millisecond},
	}

	for _, s := range sessions {
		entry := &core.LogEntry{
			RequestMethod: s.method,
			RequestURL:    &url.URL{Path: s.path},
			Duration:      s.dur,
			StatusCode:    200,
		}
		core.CreateProxySession(db, entry)
	}

	// 1. Test GET /api/stats/methods
	req := httptest.NewRequest("GET", "/api/stats/methods", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	var methodsResp map[string]any
	json.NewDecoder(w.Body).Decode(&methodsResp)
	stats := methodsResp["stats"].(map[string]any)
	if stats["GET"].(float64) != 2 {
		t.Errorf("Expected 2 GETs, got %v", stats["GET"])
	}
	if stats["POST"].(float64) != 1 {
		t.Errorf("Expected 1 POST, got %v", stats["POST"])
	}

	// 2. Test GET /api/stats/duration-by-path
	req = httptest.NewRequest("GET", "/api/stats/duration-by-path", nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	var durationResp map[string]any
	json.NewDecoder(w.Body).Decode(&durationResp)
	durStats := durationResp["stats"].(map[string]any)
	// Avg of 100 and 200 is 150
	if durStats["/a"].(float64) != 150 {
		t.Errorf("Expected avg 150 for /a, got %v", durStats["/a"])
	}
}
