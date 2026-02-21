package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleHttpReq_JSON(t *testing.T) {
	// 1. Mock Target
	mockTarget := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify method
		if r.Method != "POST" {
			t.Errorf("Target expected POST, got %s", r.Method)
		}
		// Verify header
		if r.Header.Get("X-Custom") != "Bar" {
			t.Errorf("Target expected header X-Custom: Bar, got %s", r.Header.Get("X-Custom"))
		}
		// Verify body
		body, _ := io.ReadAll(r.Body)
		if string(body) != "test body" {
			t.Errorf("Target expected body 'test body', got '%s'", string(body))
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer mockTarget.Close()

	// 2. Setup Handler
	// DB is not used in handleHttpReq
	handler := NewHandler(&ApiConfig{DB: nil})

	// 3. Create Request Payload
	payload := map[string]any{
		"method": "POST",
		"url":    mockTarget.URL,
		"headers": map[string]string{
			"X-Custom": "Bar",
		},
		"body": "test body",
	}
	payloadBytes, _ := json.Marshal(payload)

	req := httptest.NewRequest("POST", "/api/httpreq", bytes.NewReader(payloadBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	// 4. Serve
	// We can call the handler function directly since we are testing the function unit
	handler.handleHttpReq(w, req)

	// 5. Verify Response from Handler
	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Body is []byte in Go, which is base64 encoded in JSON
	bodyVal, ok := result["body"].(string)
	if !ok {
		t.Fatalf("Expected body to be a string (base64), got %T", result["body"])
	}

	if bodyVal != "b2s=" { // "ok" in base64
		t.Errorf("Expected response body 'b2s=' (base64 of 'ok'), got %v", bodyVal)
	}
	if status, ok := result["status"].(float64); !ok || status != 200 {
		t.Errorf("Expected status 200, got %v", result["status"])
	}
}
