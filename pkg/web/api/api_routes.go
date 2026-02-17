package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gorm.io/gorm"
)

// ApiHandler represents the API handler
type ApiHandler struct {
	db  *gorm.DB
	hub *WsHub
}

// ApiConfig holds the API handler configuration
type ApiConfig struct {
	DB *gorm.DB
}

// NewHandler creates a new API handler instance
func NewHandler(config *ApiConfig) *ApiHandler {
	h := &ApiHandler{
		db:  config.DB,
		hub: NewWsHub(),
	}
	go h.hub.run()
	return h
}

// RegisterRoutes configures all API routes on the provided mux
func (h *ApiHandler) RegisterRoutes(mux *http.ServeMux) {
	// Global Helpers
	mux.HandleFunc("/health", h.handleHealth)
	mux.HandleFunc("/api/version", h.handleVersion)
	mux.HandleFunc("/api/ws", h.handleWS)

	// System config endpoint
	mux.HandleFunc("/api/sysconfig", h.handleSysConfig)

	// Config Management
	mux.HandleFunc("/api/configs/current", h.handleCurrentConfigs)
	mux.HandleFunc("/api/configs/history", h.handleConfigHistory)
	mux.HandleFunc("/api/configs/{id}", h.handleConfigDetail)
	mux.HandleFunc("/api/configs/{id}/sessions", h.handleSessionsByConfig)

	// Proxy server control endpoints
	mux.HandleFunc("/api/proxyserver/create", h.handleProxyServerCreate)
	mux.HandleFunc("/api/proxyserver/export", h.handleProxyServerExport)
	mux.HandleFunc("/api/proxyserver/{id}/start", h.handleProxyServerStart)
	mux.HandleFunc("/api/proxyserver/{id}/stop", h.handleProxyServerStop)

	// Scoped Session Handlers (Contextual to a Config ID)
	mux.HandleFunc("/api/sessions/recent/{config_id}", h.handleRecentSessions)
	mux.HandleFunc("/api/sessions/errors/{config_id}", h.handleErrorSessions)
	mux.HandleFunc("/api/sessions/slow/{config_id}", h.handleSlowSessions)

	// Scoped Query Handlers
	mux.HandleFunc("/api/sessions/by-path/{config_id}", h.handleSessionsByPath)
	mux.HandleFunc("/api/sessions/by-method/{config_id}", h.handleSessionsByMethod)
	mux.HandleFunc("/api/sessions/by-header/{config_id}", h.handleSessionsWithHeader)
	mux.HandleFunc("/api/sessions/by-header-value/{config_id}", h.handleSessionsByHeaderValue)
	mux.HandleFunc("/api/sessions/by-query-param/{config_id}", h.handleSessionsWithQueryParam)
	mux.HandleFunc("/api/sessions/search/{config_id}", h.handleSearchSessions)

	// General Session Handlers
	mux.HandleFunc("/api/sessions/{id}", h.handleSessionDetail)

	// Global Statistics
	mux.HandleFunc("/api/stats/methods", h.handleMethodStats)
	mux.HandleFunc("/api/stats/duration-by-path", h.handleDurationByPath)

	// HttpReq
	mux.HandleFunc("/api/httpreq", h.handleHttpReq)

	// Bookmarks
	mux.HandleFunc("POST /api/bookmarks/{session_id}", h.handleCreateBookmark)
	mux.HandleFunc("GET /api/bookmarks", h.handleGetBookmarks)
	mux.HandleFunc("GET /api/bookmarks/{id}", h.handleGetBookmark)
	mux.HandleFunc("DELETE /api/bookmarks/{id}", h.handleDeleteBookmark)
	mux.HandleFunc("PATCH /api/bookmarks/{id}", h.handleUpdateBookmark)
}

// handleHealth returns the health status of the API
func (h *ApiHandler) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "healthy",
	})
}

// --- Helper Functions ---

func getIntParam(r *http.Request, key string, defaultValue int) int {
	valStr := r.URL.Query().Get(key)
	if val, err := strconv.Atoi(valStr); err == nil {
		return val
	}
	return defaultValue
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string, err error) {
	details := ""
	if err != nil {
		details = err.Error()
	}
	writeJSON(w, status, map[string]any{"error": message, "details": details})
}
