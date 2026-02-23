package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestHandleVersion(t *testing.T) {
	handler := NewHandler(&ApiConfig{DB: nil})
	req := httptest.NewRequest("GET", "/api/version", nil)
	w := httptest.NewRecorder()

	handler.handleVersion(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var result map[string]string
	json.NewDecoder(w.Body).Decode(&result)
	if result["version"] != core.Version {
		t.Errorf("Expected version %s, got %s", core.Version, result["version"])
	}

	// It should also contain latest_version and latest_version_tag (even if empty)
	if _, exists := result["latest_version"]; !exists {
		t.Errorf("Expected latest_version to exist in response")
	}
	if _, exists := result["latest_version_tag"]; !exists {
		t.Errorf("Expected latest_version_tag to exist in response")
	}
}
