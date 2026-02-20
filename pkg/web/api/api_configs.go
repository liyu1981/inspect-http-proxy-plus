package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
	"github.com/spf13/viper"
)

// handleSysConfig returns or updates the system configuration
func (h *ApiHandler) handleSysConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		// Get system config from GlobalVarStore
		sysConfig := core.GlobalVar.GetSysConfig()
		if sysConfig == nil {
			http.Error(w, "System configuration not available", http.StatusNotFound)
			return
		}

		dbSize, _ := core.GetCurrentDBSize(sysConfig.DBPath)

		response := map[string]any{
			"log_level":           sysConfig.LogLevel,
			"db_path":             sysConfig.DBPath,
			"api_addr":            sysConfig.APIAddr,
			"max_sessions_retain": sysConfig.MaxSessionsRetain,
			"db_size":             dbSize,
			"config_file":         viper.ConfigFileUsed(),
			"proxies":             sysConfig.Proxies,
		}

		writeJSON(w, http.StatusOK, response)
		return
	}

	if r.Method == http.MethodPost {
		var updates map[string]string
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		for k, v := range updates {
			if k == "log_level" || k == "api_addr" || k == "max_sessions_retain" {
				if err := core.SetSystemSetting(h.db, k, v); err != nil {
					writeError(w, http.StatusInternalServerError, "Failed to save setting: "+k, err)
					return
				}
			}
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "success", "message": "Settings saved. Changes will take effect after restart."})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// handleConfigHistory returns a list of unique past configurations
func (h *ApiHandler) handleConfigHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := r.URL.Query().Get("q")
	limit := getIntParam(r, "limit", 10)

	var configs []core.ProxyConfigRow
	dbQuery := h.db.Order("created_at DESC").Limit(limit)

	if query != "" {
		// Search in ConfigJSON for the target URL or listen port
		dbQuery = dbQuery.Where("ConfigJSON LIKE ?", "%"+query+"%")
	}

	if err := dbQuery.Find(&configs).Error; err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch config history", err)
		return
	}

	// Parse ConfigJSON for each row to make it easier for the frontend
	type HistoryItem struct {
		ID           string    `json:"id"`
		CreatedAt    time.Time `json:"created_at"`
		ParsedConfig any       `json:"parsed_config"`
		SourcePath   string    `json:"source_path"`
		Cwd          string    `json:"cwd"`
	}

	history := make([]HistoryItem, 0, len(configs))
	for _, c := range configs {
		var parsed any
		_ = json.Unmarshal([]byte(c.ConfigJSON), &parsed)
		history = append(history, HistoryItem{
			ID:           c.ID,
			CreatedAt:    c.CreatedAt,
			ParsedConfig: parsed,
			SourcePath:   c.SourcePath,
			Cwd:          c.Cwd,
		})
	}

	writeJSON(w, http.StatusOK, history)
}

// handleCurrentConfigs returns the currently active proxy configurations
func (h *ApiHandler) handleCurrentConfigs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Retrieve active IDs from the global thread-safe store
	activeIDs := core.GlobalVar.ConfigGetAll()

	var fullConfigs []any = make([]any, 0)

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

		var parsedJSON any
		_ = json.Unmarshal([]byte(configRow.ConfigJSON), &parsedJSON)

		// Combine database record with runtime config details
		fullConfig := map[string]any{
			"id":                    configRow.ID,
			"created_at":            configRow.CreatedAt,
			"config_row":            configRow,
			"parsed_config":         parsedJSON,
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
