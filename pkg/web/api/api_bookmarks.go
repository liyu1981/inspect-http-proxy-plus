package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
	"github.com/rs/zerolog/log"
)

// handleCreateBookmark creates a new bookmark for a session
// POST /api/bookmarks/{session_id}
func (h *ApiHandler) handleCreateBookmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.PathValue("session_id")
	if sessionID == "" {
		http.Error(w, "Session ID required", http.StatusBadRequest)
		return
	}

	log.Info().Str("session_id", sessionID).Msg("Creating bookmark")

	// Check if already bookmarked
	exists, bookmarkID, err := core.IsSessionBookmarked(h.db, sessionID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check bookmark status")
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if exists {
		// Return existing bookmark
		bookmark, err := core.GetBookmark(h.db, bookmarkID)
		if err != nil {
			log.Error().Err(err).Msg("Failed to fetch existing bookmark")
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(bookmark)
		return
	}

	bookmark, err := core.CreateBookmark(h.db, sessionID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create bookmark")
		http.Error(w, "Failed to create bookmark: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bookmark)
}

// handleGetBookmarks retrieves a list of bookmarks
// GET /api/bookmarks?config_id=...&q=...&limit=...&offset=...
func (h *ApiHandler) handleGetBookmarks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.URL.Query().Get("config_id")
	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0

	if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
		limit = val
	}
	if val, err := strconv.Atoi(offsetStr); err == nil && val >= 0 {
		offset = val
	}

	bookmarks, total, err := core.GetBookmarks(h.db, configID, query, limit, offset)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch bookmarks")
		http.Error(w, "Failed to fetch bookmarks", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"bookmarks": bookmarks,
		"total":     total,
		"limit":     limit,
		"offset":    offset,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleGetBookmark retrieves a single bookmark by ID
// GET /api/bookmarks/{id}
func (h *ApiHandler) handleGetBookmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bookmarkID := r.PathValue("id")
	if bookmarkID == "" {
		http.Error(w, "Bookmark ID required", http.StatusBadRequest)
		return
	}

	bookmark, err := core.GetBookmark(h.db, bookmarkID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to fetch bookmark")
		http.Error(w, "Bookmark not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bookmark)
}

// handleDeleteBookmark deletes a bookmark
// DELETE /api/bookmarks/{id}
func (h *ApiHandler) handleDeleteBookmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bookmarkID := r.PathValue("id")
	if bookmarkID == "" {
		http.Error(w, "Bookmark ID required", http.StatusBadRequest)
		return
	}

	if err := core.DeleteBookmark(h.db, bookmarkID); err != nil {
		log.Error().Err(err).Msg("Failed to delete bookmark")
		http.Error(w, "Failed to delete bookmark", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleUpdateBookmark updates bookmark metadata
// PATCH /api/bookmarks/{id}
func (h *ApiHandler) handleUpdateBookmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bookmarkID := r.PathValue("id")
	if bookmarkID == "" {
		http.Error(w, "Bookmark ID required", http.StatusBadRequest)
		return
	}

	var payload struct {
		Note string `json:"note"`
		Tags string `json:"tags"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	bookmark, err := core.UpdateBookmarkMetadata(h.db, bookmarkID, payload.Note, payload.Tags)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update bookmark")
		http.Error(w, "Failed to update bookmark", http.StatusInternalServerError)
		return
	}

	// Notify via WebSocket
	h.Publish("saved_sessions", map[string]any{
		"type":     "update_session",
		"bookmark": bookmark,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bookmark)
}
