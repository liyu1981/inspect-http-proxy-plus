package api

import (
	"net/http"

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
)

// handleMethodStats returns session count statistics grouped by HTTP method
func (h *ApiHandler) handleMethodStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := core.CountSessionsByMethod(h.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch method statistics", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"stats": stats,
	})
}

// handleDurationByPath returns average duration statistics grouped by request path
func (h *ApiHandler) handleDurationByPath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats, err := core.GetAverageDurationByPath(h.db)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch duration statistics", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"stats": stats,
	})
}
