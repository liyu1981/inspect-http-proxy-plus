package api

import (
	"net/http"

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
	"github.com/rs/zerolog/log"
)

// handleProxyServerStart starts a proxy server by config ID
func (h *ApiHandler) handleProxyServerStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("id")
	if configID == "" {
		http.Error(w, "Missing config ID", http.StatusBadRequest)
		return
	}

	// Check if server is already running
	if core.GlobalVar.HasProxyServer(configID) {
		writeError(w, http.StatusConflict, "Proxy server already running", nil)
		return
	}

	// Get the ProxyConfig from GlobalVar
	proxyConfig := core.GlobalVar.GetProxyConfig(configID)
	if proxyConfig == nil {
		http.Error(w, "Config not found in GlobalVar", http.StatusNotFound)
		return
	}

	// Get system config to find the matching proxy entry
	sysConfig := core.GlobalVar.GetSysConfig()
	if sysConfig == nil {
		writeError(w, http.StatusInternalServerError, "System configuration not available", nil)
		return
	}

	// Find the matching proxy entry by comparing target URL
	var matchingEntry *core.SysConfigProxyEntry
	var matchingIndex int
	targetURLStr := proxyConfig.TargetURL.String()
	for i, proxyEntry := range sysConfig.Proxies {
		if proxyEntry.Target == targetURLStr {
			matchingEntry = &proxyEntry
			matchingIndex = i
			break
		}
	}

	if matchingEntry == nil {
		writeError(w, http.StatusNotFound, "No matching proxy entry found in system config", nil)
		return
	}

	// Get websocket broadcast function from ApiHandler
	wsPublishFn := func(topic string, v any) {
		if h != nil {
			h.Publish(topic, v)
		}
	}

	// Start the proxy server
	log.Info().
		Str("config_id", configID).
		Str("listen", matchingEntry.Listen).
		Str("target", matchingEntry.Target).
		Msg("Starting proxy server via API")

	core.StartProxyServer(matchingIndex, *matchingEntry, h.db, wsPublishFn)

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
	})
}

// handleProxyServerStop stops a proxy server by config ID
func (h *ApiHandler) handleProxyServerStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	configID := r.PathValue("id")
	if configID == "" {
		http.Error(w, "Missing config ID", http.StatusBadRequest)
		return
	}

	// Check if server exists
	if !core.GlobalVar.HasProxyServer(configID) {
		writeError(w, http.StatusNotFound, "Proxy server not running", nil)
		return
	}

	log.Info().
		Str("config_id", configID).
		Msg("Stopping proxy server via API")

	// Stop the proxy server
	err := core.StopProxyServer(configID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to stop proxy server", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"config_id": configID,
	})
}
