package api

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

// RequestPayload represents the incoming request from the UI when sent as JSON
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

	var method, targetURL string
	var headers map[string]string
	var reqBody io.Reader
	var contentType string

	// Check content type of the request from UI
	uiContentType := r.Header.Get("Content-Type")

	if strings.HasPrefix(uiContentType, "application/json") {
		// Parse request payload
		var payload RequestPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid request payload", err)
			return
		}
		method = payload.Method
		targetURL = payload.URL
		headers = payload.Headers
		if payload.Body != "" {
			reqBody = bytes.NewBufferString(payload.Body)
		}
	} else if strings.HasPrefix(uiContentType, "multipart/form-data") {
		// Parse multipart form (max 32MB in memory)
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			writeError(w, http.StatusBadRequest, "Failed to parse multipart form", err)
			return
		}

		method = r.FormValue("__method")
		targetURL = r.FormValue("__url")
		headersJSON := r.FormValue("__headers")
		if headersJSON != "" {
			if err := json.Unmarshal([]byte(headersJSON), &headers); err != nil {
				writeError(w, http.StatusBadRequest, "Invalid __headers field", err)
				return
			}
		}

		// Reconstruct multipart body for the target
		bodyBuf := &bytes.Buffer{}
		mw := multipart.NewWriter(bodyBuf)

		// Copy fields (excluding our internal ones)
		for key, values := range r.MultipartForm.Value {
			if strings.HasPrefix(key, "__") {
				continue
			}
			for _, val := range values {
				if err := mw.WriteField(key, val); err != nil {
					writeError(w, http.StatusInternalServerError, "Failed to write form field", err)
					return
				}
			}
		}

		// Copy files
		for key, files := range r.MultipartForm.File {
			for _, fileHeader := range files {
				file, err := fileHeader.Open()
				if err != nil {
					writeError(w, http.StatusInternalServerError, "Failed to open uploaded file", err)
					return
				}
				defer file.Close()

				part, err := mw.CreateFormFile(key, fileHeader.Filename)
				if err != nil {
					writeError(w, http.StatusInternalServerError, "Failed to create form file", err)
					return
				}
				if _, err = io.Copy(part, file); err != nil {
					writeError(w, http.StatusInternalServerError, "Failed to copy file content", err)
					return
				}
			}
		}
		mw.Close()
		reqBody = bodyBuf
		contentType = mw.FormDataContentType()
	} else {
		writeError(w, http.StatusUnsupportedMediaType, "Unsupported content type", nil)
		return
	}

	// Validate required fields
	if method == "" {
		writeError(w, http.StatusBadRequest, "Method is required", nil)
		return
	}
	if targetURL == "" {
		writeError(w, http.StatusBadRequest, "URL is required", nil)
		return
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * 60 * time.Second,
	}

	// Create the HTTP request
	req, err := http.NewRequest(method, targetURL, reqBody)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Failed to create request", err)
		return
	}

	// Set headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// If we reconstructed a multipart body, override the Content-Type header
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
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
