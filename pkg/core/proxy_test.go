package core

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestProxyHandler_EndToEnd(t *testing.T) {
	// 1. Setup Mock Target Server
	mockTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request details received by target
		if r.Method != "POST" {
			t.Errorf("Target expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/api/resource" {
			t.Errorf("Target expected /api/resource, got %s", r.URL.Path)
		}
		if r.Header.Get("X-Custom-Header") != "Foo" {
			t.Errorf("Target expected X-Custom-Header: Foo")
		}

		body, _ := io.ReadAll(r.Body)
		if string(body) != "request body" {
			t.Errorf("Target expected body 'request body', got '%s'", string(body))
		}

		// Send response
		w.Header().Set("X-Response-Header", "Bar")
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("response body"))
	}))
	defer mockTarget.Close()

	targetURL, _ := url.Parse(mockTarget.URL)

	// 2. Setup Database
	db := setupTestDB(t)

	// 3. Configure Proxy
	config := &ProxyConfig{
		ConfigID:        "test-proxy-config",
		ListenAddr:      ":0", // Not used in handler directly but good to set
		TargetURL:       targetURL,
		TruncateLogBody: false,
		DB:              db,
		WsPublishFn:     func(topic string, v any) {},
	}

	proxyHandler := NewProxyHandler(config)

	// 4. Create Request to Proxy
	reqBody := strings.NewReader("request body")
	req := httptest.NewRequest("POST", "http://proxy.local/api/resource", reqBody)
	req.Header.Set("X-Custom-Header", "Foo")

	w := httptest.NewRecorder()

	// 5. Serve Request
	proxyHandler(w, req)

	// 6. Verify Response
	resp := w.Result()
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("Expected status 201, got %d", resp.StatusCode)
	}
	if resp.Header.Get("X-Response-Header") != "Bar" {
		t.Errorf("Expected X-Response-Header: Bar")
	}
	respBody, _ := io.ReadAll(resp.Body)
	if string(respBody) != "response body" {
		t.Errorf("Expected response body 'response body', got '%s'", string(respBody))
	}

	// 7. Verify Database Session
	// Wait for async DB update
	var session ProxySessionRow
	var found bool
	for i := 0; i < 20; i++ {
		if err := db.Where("config_id = ?", "test-proxy-config").First(&session).Error; err == nil {
			if session.ResponseStatusCode == 201 {
				found = true
				break
			}
		}
		time.Sleep(50 * time.Millisecond)
	}

	if !found {
		t.Fatalf("Session not updated in time or not found. Last status: %d", session.ResponseStatusCode)
	}

	if session.RequestMethod != "POST" {
		t.Errorf("DB: Expected method POST, got %s", session.RequestMethod)
	}
	if session.ResponseStatusCode != 201 {
		t.Errorf("DB: Expected status 201, got %d", session.ResponseStatusCode)
	}
	if string(session.RequestBody) != "request body" {
		t.Errorf("DB: Expected request body 'request body', got '%s'", string(session.RequestBody))
	}
}
