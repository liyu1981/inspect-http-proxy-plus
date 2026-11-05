package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pelletier/go-toml/v2"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

const legacyConfig = `# a hand written config without a format version
log-level = "debug"
db-path = "/tmp/ihpp-test.db"
in-memory = false
api-addr = ":20000"
max-sessions-retain = 500

[server]
api-addr = ":9999"
name = "legacy"

[[proxies]]
listen = ":20003"
target = "http://192.168.0.163:11434"
truncate-log-body = true
name = "ollama"

[[proxies]]
listen = ":20004"
target = "https://openrouter.ai/api"
extra = ["a", "b"]
`

func writeTempConfig(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), DefaultConfigFileName)
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write temp config: %v", err)
	}
	return path
}

func TestSampleConfigIsValid(t *testing.T) {
	sample := SampleConfig()

	var raw map[string]any
	if err := toml.Unmarshal([]byte(sample), &raw); err != nil {
		t.Fatalf("sample config is not valid TOML: %v\n%s", err, sample)
	}

	version, err := asInt(raw[ConfigVersionKey])
	if err != nil {
		t.Fatalf("failed to read %s: %v", ConfigVersionKey, err)
	}
	if version != ConfigVersion {
		t.Errorf("%s = %d, want %d", ConfigVersionKey, version, ConfigVersion)
	}

	var cfg core.SysConfig
	if err := toml.Unmarshal([]byte(sample), &cfg); err != nil {
		t.Fatalf("sample config does not decode into SysConfig: %v", err)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("log-level = %q, want %q", cfg.LogLevel, "info")
	}
	if cfg.APIAddr != ":20000" {
		t.Errorf("api-addr = %q, want %q", cfg.APIAddr, ":20000")
	}
	if len(cfg.Proxies) != 1 {
		t.Fatalf("proxies = %d, want 1", len(cfg.Proxies))
	}
	if cfg.Proxies[0].Listen != ":20003" || cfg.Proxies[0].Target != "http://localhost:8080" {
		t.Errorf("unexpected sample proxy: %+v", cfg.Proxies[0])
	}
}

func TestWriteSampleConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, DefaultConfigFileName)

	if err := WriteSampleConfig(path, false); err != nil {
		t.Fatalf("WriteSampleConfig() error = %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("config file was not created: %v", err)
	}

	if err := WriteSampleConfig(path, false); err == nil {
		t.Fatal("WriteSampleConfig() should refuse to overwrite an existing file")
	}

	if err := WriteSampleConfig(path, true); err != nil {
		t.Fatalf("WriteSampleConfig(force=true) error = %v", err)
	}
}

func TestUpgradeConfigPreservesValues(t *testing.T) {
	path := writeTempConfig(t, legacyConfig)

	result, err := UpgradeConfig(path, UpgradeOptions{})
	if err != nil {
		t.Fatalf("UpgradeConfig() error = %v", err)
	}

	if result.FromVersion != 0 {
		t.Errorf("FromVersion = %d, want 0", result.FromVersion)
	}
	if result.ToVersion != ConfigVersion {
		t.Errorf("ToVersion = %d, want %d", result.ToVersion, ConfigVersion)
	}
	if result.UpToDate {
		t.Error("UpToDate = true, want false")
	}
	if !result.Changed {
		t.Error("Changed = false, want true")
	}
	if result.ProxyCount != 2 {
		t.Errorf("ProxyCount = %d, want 2", result.ProxyCount)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read upgraded config: %v", err)
	}

	var raw map[string]any
	if err := toml.Unmarshal(content, &raw); err != nil {
		t.Fatalf("upgraded config is not valid TOML: %v\n%s", err, content)
	}

	version, err := asInt(raw[ConfigVersionKey])
	if err != nil {
		t.Fatalf("failed to read %s: %v", ConfigVersionKey, err)
	}
	if version != ConfigVersion {
		t.Errorf("%s = %d, want %d", ConfigVersionKey, version, ConfigVersion)
	}

	var cfg core.SysConfig
	if err := toml.Unmarshal(content, &cfg); err != nil {
		t.Fatalf("upgraded config does not decode into SysConfig: %v", err)
	}

	if cfg.LogLevel != "debug" {
		t.Errorf("log-level = %q, want %q", cfg.LogLevel, "debug")
	}
	if cfg.DBPath != "/tmp/ihpp-test.db" {
		t.Errorf("db-path = %q, want %q", cfg.DBPath, "/tmp/ihpp-test.db")
	}
	if cfg.APIAddr != ":20000" {
		t.Errorf("api-addr = %q, want %q", cfg.APIAddr, ":20000")
	}
	if cfg.MaxSessionsRetain != 500 {
		t.Errorf("max-sessions-retain = %d, want 500", cfg.MaxSessionsRetain)
	}
	if len(cfg.Proxies) != 2 {
		t.Fatalf("proxies = %d, want 2", len(cfg.Proxies))
	}
	if !cfg.Proxies[0].TruncateLogBody {
		t.Error("first proxy lost truncate-log-body = true")
	}
	if cfg.Proxies[1].Listen != ":20004" || cfg.Proxies[1].Target != "https://openrouter.ai/api" {
		t.Errorf("second proxy not preserved: %+v", cfg.Proxies[1])
	}

	// Unknown top-level keys and tables survive.
	server, ok := raw["server"].(map[string]any)
	if !ok {
		t.Fatalf("unknown table [server] was dropped, got %#v", raw["server"])
	}
	if server["name"] != "legacy" || server["api-addr"] != ":9999" {
		t.Errorf("[server] values changed: %#v", server)
	}

	// Unknown proxy keys survive.
	proxies, ok := raw["proxies"].([]any)
	if !ok || len(proxies) != 2 {
		t.Fatalf("unexpected proxies in upgraded config: %#v", raw["proxies"])
	}
	first, _ := proxies[0].(map[string]any)
	if first["name"] != "ollama" {
		t.Errorf("unknown proxy key was dropped: %#v", first)
	}
	second, _ := proxies[1].(map[string]any)
	extra, ok := second["extra"].([]any)
	if !ok || len(extra) != 2 || extra[0] != "a" || extra[1] != "b" {
		t.Errorf("unknown proxy list was dropped: %#v", second["extra"])
	}

	// Keys that were not configured are only added as commented defaults.
	assertCommentedKey(t, string(content), "log-dest", true)

	// A second run must be a no-op.
	again, err := UpgradeConfig(path, UpgradeOptions{})
	if err != nil {
		t.Fatalf("second UpgradeConfig() error = %v", err)
	}
	if !again.UpToDate || again.Changed {
		t.Errorf("second run: UpToDate = %v, Changed = %v, want true/false", again.UpToDate, again.Changed)
	}
}

func TestUpgradeConfigAddsMissingKeysAsComments(t *testing.T) {
	path := writeTempConfig(t, "log-level = \"warn\"\n")

	result, err := UpgradeConfig(path, UpgradeOptions{})
	if err != nil {
		t.Fatalf("UpgradeConfig() error = %v", err)
	}

	for _, key := range []string{"db-path", "in-memory", "api-addr", "max-sessions-retain", "log-dest"} {
		assertCommentedKey(t, result.Content, key, true)
	}
	assertCommentedKey(t, result.Content, "log-level", false)

	var cfg core.SysConfig
	if err := toml.Unmarshal([]byte(result.Content), &cfg); err != nil {
		t.Fatalf("upgraded config does not decode into SysConfig: %v", err)
	}
	if cfg.LogLevel != "warn" {
		t.Errorf("log-level = %q, want %q", cfg.LogLevel, "warn")
	}
	if cfg.APIAddr != "" {
		t.Errorf("api-addr = %q, want empty so the built-in default applies", cfg.APIAddr)
	}
}

func TestUpgradeConfigNewerVersion(t *testing.T) {
	path := writeTempConfig(t, `config-version = 99`+"\n")

	if _, err := UpgradeConfig(path, UpgradeOptions{}); err == nil {
		t.Fatal("UpgradeConfig() should fail for a newer config version")
	}
}

func TestUpgradeConfigInvalidTOML(t *testing.T) {
	path := writeTempConfig(t, "log-level = [not valid\n")

	if _, err := UpgradeConfig(path, UpgradeOptions{}); err == nil {
		t.Fatal("UpgradeConfig() should fail for invalid TOML")
	}
}

func TestUpgradeConfigDryRun(t *testing.T) {
	path := writeTempConfig(t, legacyConfig)

	result, err := UpgradeConfig(path, UpgradeOptions{DryRun: true})
	if err != nil {
		t.Fatalf("UpgradeConfig() error = %v", err)
	}
	if !result.Changed {
		t.Error("Changed = false, want true")
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read config: %v", err)
	}
	if string(content) != legacyConfig {
		t.Error("DryRun modified the config file")
	}
}

func TestUpgradeConfigForce(t *testing.T) {
	sample := SampleConfig()
	path := writeTempConfig(t, "# custom comment\n"+sample)

	result, err := UpgradeConfig(path, UpgradeOptions{Force: true})
	if err != nil {
		t.Fatalf("UpgradeConfig() error = %v", err)
	}
	if result.UpToDate {
		t.Error("UpToDate = true, want false when Force is set")
	}
	if strings.Contains(result.Content, "custom comment") {
		t.Error("Force should regenerate the file including its comments")
	}
	if !strings.Contains(result.Content, "config-version = 1") {
		t.Error("regenerated config is missing config-version")
	}
}

func TestUpgradeConfigForceNoChange(t *testing.T) {
	path := writeTempConfig(t, SampleConfig())

	result, err := UpgradeConfig(path, UpgradeOptions{Force: true})
	if err != nil {
		t.Fatalf("UpgradeConfig() error = %v", err)
	}
	if result.Changed {
		t.Error("Changed = true, want false for an already regenerated sample")
	}
}

// assertCommentedKey checks that a key is present and, depending on commented,
// either rendered as an active assignment or as a commented-out default.
func assertCommentedKey(t *testing.T, content, key string, commented bool) {
	t.Helper()

	content = "\n" + content
	hasActive := strings.Contains(content, "\n"+key+" = ")
	hasComment := strings.Contains(content, "\n# "+key+" = ")

	if commented {
		if hasActive {
			t.Errorf("key %q should be commented out, but is active", key)
		}
		if !hasComment {
			t.Errorf("key %q should be added as a commented default", key)
		}
		return
	}

	if !hasActive {
		t.Errorf("key %q should be active", key)
	}
	if hasComment {
		t.Errorf("key %q should not be commented out", key)
	}
}
