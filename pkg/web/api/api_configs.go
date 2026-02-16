package api

import (
	"encoding/json"
	"net/http"

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
)

// handleSysConfig returns the system configuration
func (h *ApiHandler) handleSysConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get system config from GlobalVarStore
	sysConfig := core.GlobalVar.GetSysConfig()
	if sysConfig == nil {
		http.Error(w, "System configuration not available", http.StatusNotFound)
		return
	}

	response := map[string]any{
		"log_level": sysConfig.LogLevel,
		"db_path":   sysConfig.DBPath,
		"api_addr":  sysConfig.APIAddr,
		"proxies":   sysConfig.Proxies,
	}

	writeJSON(w, http.StatusOK, response)
}

// handleCurrentConfigs returns the currently active proxy configurations
func (h *ApiHandler) handleCurrentConfigs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve active IDs from the global thread-safe store
	activeIDs := core.GlobalVar.ConfigGetAll()

	if len(activeIDs) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"count":   0,
			"configs": []any{},
		})
		return
	}

	var fullConfigs []any

	// Fetch full data for each active ID from database
	for _, id := range activeIDs {
		configRow, err := core.GetConfigRowByID(h.db, id)
		if err != nil || configRow == nil {
			// Skip IDs that aren't found or have errors to avoid breaking the whole list
			continue
		}

		// Get the runtime ProxyConfig from GlobalVarStore
		proxyConfig := core.GlobalVar.GetProxyConfig(id)

		// Check if proxy server is active
		isProxyServerActive := core.GlobalVar.HasProxyServer(id)

		// Combine database record with runtime config details
		fullConfig := map[string]any{
			"id":                    configRow.ID,
			"created_at":            configRow.CreatedAt,
			"config_row":            configRow,
			"is_proxyserver_active": isProxyServerActive,
		}

		// Add runtime proxy config details if available
		if proxyConfig != nil {
			fullConfig["target_url"] = proxyConfig.TargetURL.String()
		}

		fullConfigs = append(fullConfigs, fullConfig)
	}

	writeJSON(w, http.StatusOK, fullConfigs)
}

// handleConfigDetail returns detailed information about a specific configuration
func (h *ApiHandler) handleConfigDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := r.PathValue("id")
	configRow, err := core.GetConfigRowByID(h.db, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Database error", err)
		return
	}
	if configRow == nil {
		http.Error(w, "Config not found", http.StatusNotFound)
		return
	}

	var parsedJSON any
	_ = json.Unmarshal([]byte(configRow.ConfigJSON), &parsedJSON)

	// Get runtime proxy config if available
	proxyConfig := core.GlobalVar.GetProxyConfig(id)

	// Check if proxy server is active
	isProxyServerActive := core.GlobalVar.HasProxyServer(id)

	response := map[string]any{
		"id":                    configRow.ID,
		"created_at":            configRow.CreatedAt,
		"config_row":            configRow,
		"parsed_config":         parsedJSON,
		"is_proxyserver_active": isProxyServerActive,
	}

	// Add runtime details if available
	if proxyConfig != nil {
		response["runtime_config"] = map[string]any{
			"target_url":        proxyConfig.TargetURL.String(),
			"truncate_log_body": proxyConfig.TruncateLogBody,
		}
	}

	writeJSON(w, http.StatusOK, response)
}

// handleSessionsByConfig returns all sessions for a specific configuration
func (h *ApiHandler) handleSessionsByConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("id")
	limit := getIntParam(r, "limit", 50)

	var sessions []core.ProxySessionRow
	err := h.db.Where("config_id = ?", configID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&sessions).Error

	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch sessions for config", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
		"count":     len(sessions),
		"sessions":  sessions,
	})
}
