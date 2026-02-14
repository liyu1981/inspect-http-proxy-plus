package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
)

// handleRecentSessions returns recent sessions for a specific config
func (h *ApiHandler) handleRecentSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	var since time.Time
	sinceStr := r.URL.Query().Get("since")
	if sinceStr != "" {
		// Try RFC3339
		t, err := time.Parse(time.RFC3339, sinceStr)
		if err != nil {
			// Try Unix milliseconds
			ms, err2 := strconv.ParseInt(sinceStr, 10, 64)
			if err2 == nil {
				t = time.UnixMilli(ms)
				err = nil
			}
		}
		if err == nil {
			since = t
		}
	}

	// If since is provided and limit is not explicitly set in the query, default limit to 0 (fetch all)
	if sinceStr != "" && r.URL.Query().Get("limit") == "" {
		limit = 0
	}

	sessions, err := core.GetRecentSessions(h.db, configID, limit, offset, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch sessions", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
		"count":     len(sessions),
		"limit":     limit,
		"offset":    offset,
		"sessions":  sessions,
	})
}

// handleErrorSessions returns sessions with errors for a specific config
func (h *ApiHandler) handleErrorSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetErrorSessions(h.db, configID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch error sessions", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
		"count":     len(sessions),
		"limit":     limit,
		"offset":    offset,
		"sessions":  sessions,
	})
}

// handleSlowSessions returns slow sessions for a specific config
func (h *ApiHandler) handleSlowSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	minDuration := int64(getIntParam(r, "min_duration", 1000))
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetSlowSessions(h.db, configID, minDuration, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch slow sessions", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id":    configID,
		"min_duration": minDuration,
		"count":        len(sessions),
		"limit":        limit,
		"offset":       offset,
		"sessions":     sessions,
	})
}

// handleSessionsByPath returns sessions matching a specific path
func (h *ApiHandler) handleSessionsByPath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	path := r.URL.Query().Get("path")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetSessionsByPath(h.db, configID, path, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Query failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
		"path":      path,
		"count":     len(sessions),
		"limit":     limit,
		"offset":    offset,
		"sessions":  sessions,
	})
}

// handleSessionsByMethod returns sessions matching a specific HTTP method
func (h *ApiHandler) handleSessionsByMethod(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	method := r.URL.Query().Get("method")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetSessionsByMethod(h.db, configID, method, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Query failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
		"method":    method,
		"count":     len(sessions),
		"limit":     limit,
		"offset":    offset,
		"sessions":  sessions,
	})
}

// handleSessionsWithHeader returns sessions containing a specific header
func (h *ApiHandler) handleSessionsWithHeader(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	name := r.URL.Query().Get("name")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetSessionsWithHeader(h.db, configID, name, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Query failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id":   configID,
		"header_name": name,
		"count":       len(sessions),
		"limit":       limit,
		"offset":      offset,
		"sessions":    sessions,
	})
}

// handleSessionsByHeaderValue returns sessions with a specific header value
func (h *ApiHandler) handleSessionsByHeaderValue(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	name := r.URL.Query().Get("name")
	value := r.URL.Query().Get("value")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetSessionsByHeaderValue(h.db, configID, name, value, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Query failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id":    configID,
		"header_name":  name,
		"header_value": value,
		"count":        len(sessions),
		"limit":        limit,
		"offset":       offset,
		"sessions":     sessions,
	})
}

// handleSessionsWithQueryParam returns sessions containing a specific query parameter
func (h *ApiHandler) handleSessionsWithQueryParam(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	name := r.URL.Query().Get("name")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	sessions, err := core.GetSessionsWithQueryParam(h.db, configID, name, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Query failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id":  configID,
		"param_name": name,
		"count":      len(sessions),
		"limit":      limit,
		"offset":     offset,
		"sessions":   sessions,
	})
}

// handleSearchSessions handles full-text search requests
func (h *ApiHandler) handleSearchSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("config_id")
	query := r.URL.Query().Get("q")
	limit := getIntParam(r, "limit", 20)
	offset := getIntParam(r, "offset", 0)

	if query == "" {
		// Fallback to recent sessions if query is empty
		sessions, err := core.GetRecentSessions(h.db, configID, limit, offset, time.Time{})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Failed to fetch sessions", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"config_id": configID,
			"count":     len(sessions),
			"limit":     limit,
			"offset":    offset,
			"sessions":  sessions,
		})
		return
	}

	sessions, err := core.SearchSessions(h.db, configID, query, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Search failed", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
		"query":     query,
		"count":     len(sessions),
		"limit":     limit,
		"offset":    offset,
		"sessions":  sessions,
	})
}

// handleSessionDetail returns detailed information about a specific session
func (h *ApiHandler) handleSessionDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	session, err := core.GetSessionByID(h.db, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Session not found", err)
		return
	}

	reqH, _ := session.ParseRequestHeaders()
	respH, _ := session.ParseResponseHeaders()
	qp, _ := session.ParseQueryParameters()

	writeJSON(w, http.StatusOK, map[string]any{
		"session":          session,
		"request_headers":  reqH,
		"response_headers": respH,
		"query_parameters": qp,
	})
}
