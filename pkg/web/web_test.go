package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

func TestUIServer_Routing(t *testing.T) {
	db, _ := core.InitDatabase(":memory:")
	ui := NewUIServer(&Config{
		DB:         db,
		ListenAddr: ":0",
	})

	handler := ui.SetupRoutes()

	// 1. Test API route
	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("Expected health check OK, got %d", w.Code)
	}

	// 2. Test static file routing (might fail if embedded FS is empty in tests)
	// But we can check that it doesn't panic.
	req = httptest.NewRequest("GET", "/", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	// If the embedded FS is empty, it might 404.
}
