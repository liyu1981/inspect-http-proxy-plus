package core

import (
	"net/http"
	"sync"
)

// GlobalVarStore manages the active configuration IDs in a thread-safe manner.
type GlobalVarStore struct {
	mu                sync.RWMutex
	sysConfig         *SysConfig
	config_ids        []string
	id_to_config      map[string]*ProxyConfig
	id_to_proxyserver map[string]*http.Server
}

// GlobalVar is the shared instance of the configuration store.
var GlobalVar = &GlobalVarStore{
	sysConfig:         nil,
	config_ids:        make([]string, 0),
	id_to_config:      make(map[string]*ProxyConfig),
	id_to_proxyserver: make(map[string]*http.Server),
}

// ====================
// SysConfig Methods
// ====================

// SetSysConfig stores the system configuration.
func (g *GlobalVarStore) SetSysConfig(cfg *SysConfig) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.sysConfig = cfg
}

// GetSysConfig returns a pointer to the stored system configuration.
func (g *GlobalVarStore) GetSysConfig() *SysConfig {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.sysConfig
}

// GetLogLevel returns the log level from system config.
func (g *GlobalVarStore) GetLogLevel() string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if g.sysConfig != nil {
		return g.sysConfig.LogLevel
	}
	return ""
}

// GetDBPath returns the database path from system config.
func (g *GlobalVarStore) GetDBPath() string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if g.sysConfig != nil {
		return g.sysConfig.DBPath
	}
	return ""
}

// GetAPIAddr returns the API address from system config.
func (g *GlobalVarStore) GetAPIAddr() string {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if g.sysConfig != nil {
		return g.sysConfig.APIAddr
	}
	return ""
}

// GetProxies returns a copy of all proxy entries from system config.
func (g *GlobalVarStore) GetProxies() []SysConfigProxyEntry {
	g.mu.RLock()
	defer g.mu.RUnlock()
	if g.sysConfig != nil && len(g.sysConfig.Proxies) > 0 {
		// Return a copy to prevent external modification
		cp := make([]SysConfigProxyEntry, len(g.sysConfig.Proxies))
		copy(cp, g.sysConfig.Proxies)
		return cp
	}
	return nil
}

// ====================
// Config ID Methods
// ====================

// ConfigSet replaces all existing IDs with a single new ID.
func (g *GlobalVarStore) ConfigSet(id string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.config_ids = []string{id}
}

// ConfigAdd appends a new ID to the active list if it doesn't already exist (upsert behavior).
func (g *GlobalVarStore) ConfigAdd(id string) {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Check if ID already exists
	for _, existingID := range g.config_ids {
		if existingID == id {
			// ID already exists, no need to add
			return
		}
	}

	// ID doesn't exist, append it
	g.config_ids = append(g.config_ids, id)
}

// ConfigGetAll returns a copy of all stored configuration IDs.
func (g *GlobalVarStore) ConfigGetAll() []string {
	g.mu.RLock()
	defer g.mu.RUnlock()

	// Returning a copy prevents race conditions if the caller iterates over the slice
	cp := make([]string, len(g.config_ids))
	copy(cp, g.config_ids)
	return cp
}

// ConfigClear empties the configuration ID list.
func (g *GlobalVarStore) ConfigClear() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.config_ids = []string{}
}

// ====================
// ProxyConfig CRUD Methods
// ====================

// AddProxyConfig adds or updates a ProxyConfig in the map.
func (g *GlobalVarStore) AddProxyConfig(id string, config *ProxyConfig) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.id_to_config[id] = config
}

// GetProxyConfig retrieves a ProxyConfig by ID. Returns nil if not found.
func (g *GlobalVarStore) GetProxyConfig(id string) *ProxyConfig {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.id_to_config[id]
}

// GetAllProxyConfigs returns a copy of all ProxyConfigs as a map.
func (g *GlobalVarStore) GetAllProxyConfigs() map[string]*ProxyConfig {
	g.mu.RLock()
	defer g.mu.RUnlock()

	cp := make(map[string]*ProxyConfig, len(g.id_to_config))
	for k, v := range g.id_to_config {
		cp[k] = v
	}
	return cp
}

// RemoveProxyConfig deletes a ProxyConfig by ID. Returns true if found and deleted.
func (g *GlobalVarStore) RemoveProxyConfig(id string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	if _, exists := g.id_to_config[id]; exists {
		delete(g.id_to_config, id)
		return true
	}
	return false
}

// HasProxyConfig checks if a ProxyConfig exists for the given ID.
func (g *GlobalVarStore) HasProxyConfig(id string) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	_, exists := g.id_to_config[id]
	return exists
}

// ClearProxyConfigs removes all ProxyConfigs from the map.
func (g *GlobalVarStore) ClearProxyConfigs() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.id_to_config = make(map[string]*ProxyConfig)
}

// ====================
// ProxyServer CRUD Methods
// ====================

// AddProxyServer adds or updates an http.Server in the map.
func (g *GlobalVarStore) AddProxyServer(id string, server *http.Server) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.id_to_proxyserver[id] = server
}

// GetProxyServer retrieves an http.Server by ID. Returns nil if not found.
func (g *GlobalVarStore) GetProxyServer(id string) *http.Server {
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.id_to_proxyserver[id]
}

// GetAllProxyServers returns a copy of all http.Servers as a map.
func (g *GlobalVarStore) GetAllProxyServers() map[string]*http.Server {
	g.mu.RLock()
	defer g.mu.RUnlock()

	cp := make(map[string]*http.Server, len(g.id_to_proxyserver))
	for k, v := range g.id_to_proxyserver {
		cp[k] = v
	}
	return cp
}

// RemoveProxyServer deletes an http.Server by ID. Returns true if found and deleted.
func (g *GlobalVarStore) RemoveProxyServer(id string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	if _, exists := g.id_to_proxyserver[id]; exists {
		delete(g.id_to_proxyserver, id)
		return true
	}
	return false
}

// HasProxyServer checks if an http.Server exists for the given ID.
func (g *GlobalVarStore) HasProxyServer(id string) bool {
	g.mu.RLock()
	defer g.mu.RUnlock()
	_, exists := g.id_to_proxyserver[id]
	return exists
}

// ClearProxyServers removes all http.Servers from the map.
func (g *GlobalVarStore) ClearProxyServers() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.id_to_proxyserver = make(map[string]*http.Server)
}
