package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestHandleHealth(t *testing.T) {
	handler := NewHandler(&ApiConfig{DB: nil})
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	handler.handleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var result map[string]string
	json.NewDecoder(w.Body).Decode(&result)
	if result["status"] != "healthy" {
		t.Errorf("Expected status healthy, got %s", result["status"])
	}
}

func TestHandleSysConfig(t *testing.T) {
	db := setupTestDB(t)
	handler := NewHandler(&ApiConfig{DB: db})

	// Setup GlobalVar with some data
	sysConfig := &core.SysConfig{
		LogLevel: "debug",
		DBPath:   ":memory:",
		APIAddr:  ":8080",
	}
	core.GlobalVar.SetSysConfig(sysConfig)

	// GET /api/sysconfig
	req := httptest.NewRequest("GET", "/api/sysconfig", nil)
	w := httptest.NewRecorder()
	handler.handleSysConfig(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var result map[string]any
	json.NewDecoder(w.Body).Decode(&result)
	if result["log_level"] != "debug" {
		t.Errorf("Expected log_level debug, got %v", result["log_level"])
	}
}
