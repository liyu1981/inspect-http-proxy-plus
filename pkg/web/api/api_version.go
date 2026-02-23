package api

import (
	"net/http"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

// handleVersion returns the current application version
func (h *ApiHandler) handleVersion(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	latestVersion, latestVersionTag := core.GlobalVar.GetLatestVersion()

	writeJSON(w, http.StatusOK, map[string]any{
		"version":            core.Version,
		"latest_version":     latestVersion,
		"latest_version_tag": latestVersionTag,
	})
}
