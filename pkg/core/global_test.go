package core

import (
	"net/http"
	"testing"
)

func TestGlobalVarStore(t *testing.T) {
	g := &GlobalVarStore{
		id_to_config:      make(map[string]*ProxyConfig),
		id_to_proxyserver: make(map[string]*http.Server),
	}

	// 1. SysConfig
	sys := &SysConfig{LogLevel: "info", APIAddr: ":80"}
	g.SetSysConfig(sys)
	if g.GetLogLevel() != "info" {
		t.Errorf("Expected log level info, got %s", g.GetLogLevel())
	}
	if g.GetAPIAddr() != ":80" {
		t.Errorf("Expected api addr :80, got %s", g.GetAPIAddr())
	}

	// 2. Config IDs
	g.ConfigAdd("id1")
	g.ConfigAdd("id2")
	g.ConfigAdd("id1") // duplicate
	ids := g.ConfigGetAll()
	if len(ids) != 2 {
		t.Errorf("Expected 2 config IDs, got %d", len(ids))
	}

	g.ConfigClear()
	if len(g.ConfigGetAll()) != 0 {
		t.Errorf("Expected 0 config IDs after clear, got %d", len(g.ConfigGetAll()))
	}

	// 3. Proxy Config
	cfg := &ProxyConfig{ConfigID: "cfg1"}
	g.AddProxyConfig("cfg1", cfg)
	if !g.HasProxyConfig("cfg1") {
		t.Error("Expected to have proxy config cfg1")
	}
	if found := g.GetProxyConfig("cfg1"); found != cfg {
		t.Error("Expected to get same proxy config")
	}

	g.RemoveProxyConfig("cfg1")
	if g.HasProxyConfig("cfg1") {
		t.Error("Expected proxy config to be removed")
	}

	// 4. Proxy Server
	srv := &http.Server{}
	g.AddProxyServer("srv1", srv)
	if !g.HasProxyServer("srv1") {
		t.Error("Expected to have proxy server srv1")
	}
	if found := g.GetProxyServer("srv1"); found != srv {
		t.Error("Expected to get same proxy server")
	}

	g.RemoveProxyServer("srv1")
	if g.HasProxyServer("srv1") {
		t.Error("Expected proxy server to be removed")
	}
}
