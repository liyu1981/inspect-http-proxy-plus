package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"
)

// RequestPayload represents the incoming request from the UI
type RequestPayload struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// ResponsePayload represents the response to send back to the UI
type ResponsePayload struct {
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Duration   int64             `json:"duration"` // in milliseconds
}

// handleProxyRequest handles proxying HTTP/HTTPS requests from the UI
func (h *ApiHandler) handleHttpReq(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request payload
	var payload RequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	// Validate required fields
	if payload.Method == "" {
		writeError(w, http.StatusBadRequest, "Method is required", nil)
		return
	}
	if payload.URL == "" {
		writeError(w, http.StatusBadRequest, "URL is required", nil)
		return
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * 60 * time.Second,
	}

	// Prepare request body
	var reqBody io.Reader
	if payload.Body != "" {
		reqBody = bytes.NewBufferString(payload.Body)
	}

	// Create the HTTP request
	req, err := http.NewRequest(payload.Method, payload.URL, reqBody)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to create request", err)
		return
	}

	// Set headers
	for key, value := range payload.Headers {
		req.Header.Set(key, value)
	}

	// Execute request and measure duration
	startTime := time.Now()
	resp, err := client.Do(req)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		writeError(w, http.StatusBadGateway, "Failed to execute request", err)
		return
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to read response body", err)
		return
	}

	// Collect response headers
	respHeaders := make(map[string]string)
	for key, values := range resp.Header {
		if len(values) > 0 {
			respHeaders[key] = values[0] // Take first value for simplicity
		}
	}

	// Build response payload
	response := ResponsePayload{
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    respHeaders,
		Body:       string(respBody),
		Duration:   duration,
	}

	writeJSON(w, http.StatusOK, response)
}
