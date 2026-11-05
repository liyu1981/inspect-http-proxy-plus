package config

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/pelletier/go-toml/v2"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
)

const (
	// ConfigVersion is the newest configuration file format version understood
	// by this build of ihpp.
	//
	// Bump this value whenever the on-disk layout changes, and add a migration
	// function for the previous version to configMigrations so that
	// `ihpp config --upgrade` can convert existing files.
	ConfigVersion = 1

	// ConfigVersionKey is the TOML key that records the format version of a
	// configuration file.
	ConfigVersionKey = "config-version"

	// DefaultConfigFileName is the configuration file ihpp looks for in the
	// current working directory.
	DefaultConfigFileName = ".proxy.config.toml"

	configFilePerm = 0644
)

const (
	proxiesKey = "proxies"

	commentRule = "# ============================================================================="
	thinRule    = "# -----------------------------------------------------------------------------"
)

// configField describes a supported top-level configuration key.
type configField struct {
	key   string
	doc   []string
	def   any
	value func(*core.SysConfig) any
}

// configFields lists every supported top-level key in display order.
var configFields = []configField{
	{
		key: "log-level",
		doc: []string{
			"Log verbosity: debug, info, warn, error, fatal, panic or disabled.",
			`Default: "disabled" ("debug" when APP_ENV=development)`,
		},
		def:   "info",
		value: func(c *core.SysConfig) any { return c.LogLevel },
	},
	{
		key: "log-dest",
		doc: []string{
			`Log destination: "console", "null", "default" or a file path.`,
			`A file path (or "default") enables rotating logs in ~/.ihpp/logs.`,
			`Default: "default" ("console" when APP_ENV=development)`,
		},
		def:   "default",
		value: func(c *core.SysConfig) any { return c.LogDest },
	},
	{
		key: "db-path",
		doc: []string{
			"Path to the SQLite database that stores captured sessions.",
			`Default: "~/.ihpp/proxy_logs.db" (leave empty to use the default)`,
		},
		def:   "",
		value: func(c *core.SysConfig) any { return c.DBPath },
	},
	{
		key: "in-memory",
		doc: []string{
			"Keep everything in memory and never write captured traffic to disk.",
			"Overrides db-path. Default: false",
		},
		def:   false,
		value: func(c *core.SysConfig) any { return c.InMemory },
	},
	{
		key: "api-addr",
		doc: []string{
			"Address of the web UI and management API.",
			`Default: ":20000"`,
		},
		def:   ":20000",
		value: func(c *core.SysConfig) any { return c.APIAddr },
	},
	{
		key: "max-sessions-retain",
		doc: []string{
			"Maximum number of captured sessions to keep. The oldest sessions are",
			"reaped once this limit is exceeded. Bookmarked sessions are never removed.",
			"Default: 10000 (100 when in-memory is true)",
		},
		def:   10000,
		value: func(c *core.SysConfig) any { return c.MaxSessionsRetain },
	},
}

// proxyField describes a supported key of a [[proxies]] entry.
type proxyField struct {
	key string
	doc []string
	def any
}

var proxyFields = []proxyField{
	{
		key: "listen",
		doc: []string{`Address and port ihpp listens on (":20003" listens on all interfaces).`},
		def: "",
	},
	{
		key: "target",
		doc: []string{"Upstream URL that captured traffic is forwarded to."},
		def: "",
	},
	{
		key: "truncate-log-body",
		doc: []string{"Truncate large request/response bodies in the captured log."},
		def: false,
	},
}

// configMigrations maps a config format version to the function that upgrades
// the raw TOML data of that version to the next one. Only versions older than
// ConfigVersion need an entry here.
var configMigrations = map[int]func(map[string]any) error{}

// deprecatedConfigKeys lists keys that were removed from the format. They are
// dropped during an upgrade instead of being carried over as unknown keys.
var deprecatedConfigKeys = map[string]struct{}{}

// knownConfigKeys is the set of top-level keys owned by the current format.
var knownConfigKeys = func() map[string]struct{} {
	keys := make(map[string]struct{}, len(configFields)+2)
	keys[ConfigVersionKey] = struct{}{}
	keys[proxiesKey] = struct{}{}
	for _, f := range configFields {
		keys[f.key] = struct{}{}
	}
	return keys
}()

// knownProxyKeys is the set of keys owned by a [[proxies]] entry.
var knownProxyKeys = func() map[string]struct{} {
	keys := make(map[string]struct{}, len(proxyFields))
	for _, f := range proxyFields {
		keys[f.key] = struct{}{}
	}
	return keys
}()

// SampleConfig returns a fully commented sample configuration suitable for the
// current format version.
func SampleConfig() string {
	cfg := core.SysConfig{
		LogLevel:          "info",
		LogDest:           "default",
		DBPath:            "",
		InMemory:          false,
		APIAddr:           ":20000",
		MaxSessionsRetain: 10000,
	}

	proxies := []map[string]any{
		{
			"listen":            ":20003",
			"target":            "http://localhost:8080",
			"truncate-log-body": true,
		},
	}

	return renderConfig(cfg, nil, proxies, nil, ConfigVersion)
}

// WriteSampleConfig writes a sample configuration file to path. Unless force is
// true, an error is returned when the file already exists.
func WriteSampleConfig(path string, force bool) (err error) {
	if !force {
		if _, statErr := os.Stat(path); statErr == nil {
			return fmt.Errorf("config file %q already exists (use --force to overwrite, or --upgrade to migrate it)", path)
		} else if !os.IsNotExist(statErr) {
			return fmt.Errorf("cannot check config file %q: %w", path, statErr)
		}
	}

	if err := os.WriteFile(path, []byte(SampleConfig()), configFilePerm); err != nil {
		return fmt.Errorf("cannot write config file %q: %w", path, err)
	}
	return nil
}

// UpgradeOptions controls UpgradeConfig.
type UpgradeOptions struct {
	// DryRun builds the upgraded configuration but does not write it to disk.
	DryRun bool
	// Force rewrites the file even when it is already at ConfigVersion.
	Force bool
}

// UpgradeResult describes the outcome of UpgradeConfig.
type UpgradeResult struct {
	// Path is the configuration file that was inspected.
	Path string
	// FromVersion is the format version found in the file (0 when unversioned).
	FromVersion int
	// ToVersion is the format version this build of ihpp writes.
	ToVersion int
	// UpToDate is true when no upgrade was necessary.
	UpToDate bool
	// Changed is true when the generated content differs from the file.
	Changed bool
	// KeptValues lists known keys whose configured values were preserved.
	KeptValues []string
	// AddedKeys lists known keys that were missing from the old file and are
	// therefore added as commented-out defaults.
	AddedKeys []string
	// RemovedKeys lists keys that are no longer supported and were dropped.
	RemovedKeys []string
	// PreservedKeys lists unknown keys that were carried over unchanged.
	PreservedKeys []string
	// ProxyCount is the number of [[proxies]] entries found in the file.
	ProxyCount int
	// Content is the generated (or existing) configuration text.
	Content string
}

// UpgradeConfig migrates the configuration file at path to the latest format
// version while preserving every value that is already configured.
func UpgradeConfig(path string, opts UpgradeOptions) (*UpgradeResult, error) {
	oldContent, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read config file %q: %w", path, err)
	}

	raw := map[string]any{}
	if err := toml.Unmarshal(oldContent, &raw); err != nil {
		return nil, fmt.Errorf("cannot parse config file %q: %w", path, err)
	}

	fromVersion := 0
	if v, ok := raw[ConfigVersionKey]; ok {
		fromVersion, err = asInt(v)
		if err != nil {
			return nil, fmt.Errorf("invalid %q in %q: %w", ConfigVersionKey, path, err)
		}
	}
	if fromVersion > ConfigVersion {
		return nil, fmt.Errorf(
			"config file %q uses format version %d, but this build of ihpp only supports up to version %d; please upgrade ihpp",
			path, fromVersion, ConfigVersion)
	}

	proxies := proxyEntries(raw)
	res := &UpgradeResult{
		Path:        path,
		FromVersion: fromVersion,
		ToVersion:   ConfigVersion,
		ProxyCount:  len(proxies),
	}

	if fromVersion == ConfigVersion && !opts.Force {
		res.UpToDate = true
		res.Content = string(oldContent)
		return res, nil
	}

	for v := fromVersion; v < ConfigVersion; v++ {
		migrate, ok := configMigrations[v]
		if !ok {
			continue
		}
		if err := migrate(raw); err != nil {
			return nil, fmt.Errorf("cannot migrate config from version %d: %w", v, err)
		}
	}

	// Re-read the (possibly migrated) data with the typed struct.
	var cfg core.SysConfig
	if err := decodeRaw(raw, &cfg); err != nil {
		return nil, fmt.Errorf("cannot decode config file %q: %w", path, err)
	}
	// Migrations may have touched the proxies, so use the final raw view.
	proxies = proxyEntries(raw)

	present := make(map[string]struct{}, len(configFields))
	extras := map[string]any{}
	for key, value := range raw {
		switch {
		case key == ConfigVersionKey:
			// Managed by ihpp.
		case key == proxiesKey:
			// Rendered from the raw proxy entries so unknown keys survive.
		default:
			if _, known := knownConfigKeys[key]; known {
				present[key] = struct{}{}
				res.KeptValues = append(res.KeptValues, key)
				continue
			}
			if _, removed := deprecatedConfigKeys[key]; removed {
				res.RemovedKeys = append(res.RemovedKeys, key)
				continue
			}
			extras[key] = value
			res.PreservedKeys = append(res.PreservedKeys, key)
		}
	}
	for _, f := range configFields {
		if _, ok := present[f.key]; !ok {
			res.AddedKeys = append(res.AddedKeys, f.key)
		}
	}

	sort.Strings(res.KeptValues)
	sort.Strings(res.AddedKeys)
	sort.Strings(res.RemovedKeys)
	sort.Strings(res.PreservedKeys)

	res.Content = renderConfig(cfg, present, proxies, extras, fromVersion)
	res.ProxyCount = len(proxies)
	res.Changed = res.Content != string(oldContent)

	if !opts.DryRun && res.Changed {
		if err := os.WriteFile(path, []byte(res.Content), configFilePerm); err != nil {
			return nil, fmt.Errorf("cannot write config file %q: %w", path, err)
		}
	}

	return res, nil
}

// renderConfig builds the configuration file text.
//
// When present is nil every known key is rendered as active (used for sample
// generation). Otherwise keys missing from present are rendered as commented
// defaults so that unset values keep falling back to the built-in defaults.
func renderConfig(
	cfg core.SysConfig,
	present map[string]struct{},
	proxies []map[string]any,
	extras map[string]any,
	fromVersion int,
) string {
	allPresent := present == nil

	w := &tomlWriter{}
	w.line(commentRule)
	w.line("# Inspect HTTP Proxy Plus (ihpp) configuration")
	w.line("#")
	w.line("# Generate a fresh file with `ihpp config`. Migrate an older file with")
	w.line("# `ihpp config --upgrade`, which keeps every value you have configured and")
	w.line("# carries unknown keys over unchanged.")
	w.line("#")
	w.line("# `config-version` tracks the layout of this file and is managed by ihpp.")
	if fromVersion != ConfigVersion {
		w.line(fmt.Sprintf("# Upgraded from format version %d to %d.", fromVersion, ConfigVersion))
	}
	w.line(commentRule)
	w.blank()

	w.line(fmt.Sprintf("%s = %d", ConfigVersionKey, ConfigVersion))
	w.blank()

	for _, f := range configFields {
		for _, doc := range f.doc {
			w.line("# " + doc)
		}

		_, isPresent := present[f.key]
		if allPresent {
			isPresent = true
		}

		if isPresent {
			w.line(f.key + " = " + tomlValue(f.value(&cfg)))
		} else {
			// Setting these to their zero value would change behaviour, so the
			// default is shown commented out instead.
			w.line("# " + f.key + " = " + tomlValue(f.def) + "  # default, uncomment to override")
		}
		w.blank()
	}

	if len(extras) > 0 {
		w.line(thinRule)
		w.line("# Settings preserved from a previous configuration version")
		w.line("# (not interpreted by this build of ihpp)")
		w.line(thinRule)
		for _, key := range sortedKeys(extras) {
			w.line(tomlKey(key) + " = " + inlineTOML(extras[key]))
		}
		w.blank()
	}

	w.line(thinRule)
	w.line("# Proxies")
	w.line("#")
	w.line("# Each [[proxies]] entry starts one reverse proxy listener: traffic arriving")
	w.line("# on `listen` is forwarded to `target`, and every request/response pair is")
	w.line("# captured for the web UI. Add as many entries as you need.")
	w.line(thinRule)
	w.blank()

	if len(proxies) == 0 {
		w.line("# Example proxy entry (uncomment and adjust):")
		w.line("# [[proxies]]")
		for _, f := range proxyFields {
			w.line("# " + f.key + " = " + tomlValue(f.def))
		}
		w.blank()
		return w.String()
	}

	for i, proxy := range proxies {
		if i > 0 {
			w.blank()
		}
		w.line("[[proxies]]")
		for _, f := range proxyFields {
			if i == 0 {
				for _, doc := range f.doc {
					w.line("# " + doc)
				}
			}
			value, ok := proxy[f.key]
			if !ok {
				value = f.def
			}
			w.line(f.key + " = " + tomlValue(value))
		}
		for _, key := range sortedKeys(proxy) {
			if _, known := knownProxyKeys[key]; known {
				continue
			}
			w.line(tomlKey(key) + " = " + inlineTOML(proxy[key]))
		}
	}

	return w.String()
}

// proxyEntries extracts the raw [[proxies]] entries from decoded TOML data.
func proxyEntries(raw map[string]any) []map[string]any {
	value, ok := raw[proxiesKey]
	if !ok {
		return nil
	}
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	entries := make([]map[string]any, 0, len(items))
	for _, item := range items {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		entries = append(entries, entry)
	}
	return entries
}

// decodeRaw decodes generic TOML data into a typed value.
func decodeRaw(raw map[string]any, out any) error {
	content, err := toml.Marshal(raw)
	if err != nil {
		return err
	}
	return toml.Unmarshal(content, out)
}

// asInt converts a decoded TOML value to an int.
func asInt(value any) (int, error) {
	switch v := value.(type) {
	case int:
		return v, nil
	case int64:
		return int(v), nil
	case float64:
		return int(v), nil
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(v))
		if err != nil {
			return 0, fmt.Errorf("expected an integer, got %q", v)
		}
		return n, nil
	default:
		return 0, fmt.Errorf("expected an integer, got %T", value)
	}
}

// tomlWriter accumulates configuration file text.
type tomlWriter struct {
	sb strings.Builder
}

func (w *tomlWriter) line(s string) {
	w.sb.WriteString(s)
	w.sb.WriteByte('\n')
}

func (w *tomlWriter) blank() {
	w.sb.WriteByte('\n')
}

func (w *tomlWriter) String() string {
	return w.sb.String()
}

// tomlValue renders a value as a single-line TOML expression, using a map
// wrapper so that go-toml performs the encoding (strings, times, numbers...).
func tomlValue(value any) string {
	content, err := toml.Marshal(map[string]any{"v": value})
	if err != nil {
		return strconv.Quote(fmt.Sprintf("%v", value))
	}
	rendered := strings.TrimSpace(string(content))
	rendered = strings.TrimPrefix(rendered, "v = ")
	return strings.TrimSpace(rendered)
}

// inlineTOML renders nested values as inline TOML so they always stay attached
// to the key they belong to (instead of becoming a trailing table header).
func inlineTOML(value any) string {
	switch v := value.(type) {
	case map[string]any:
		if len(v) == 0 {
			return "{}"
		}
		parts := make([]string, 0, len(v))
		for _, key := range sortedKeys(v) {
			parts = append(parts, tomlKey(key)+" = "+inlineTOML(v[key]))
		}
		return "{ " + strings.Join(parts, ", ") + " }"
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, inlineTOML(item))
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case []map[string]any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			parts = append(parts, inlineTOML(item))
		}
		return "[" + strings.Join(parts, ", ") + "]"
	default:
		return tomlValue(value)
	}
}

// tomlKey renders a TOML key, quoting it when it is not a bare key.
func tomlKey(key string) string {
	if key == "" {
		return strconv.Quote(key)
	}
	for _, r := range key {
		isBare := r >= 'a' && r <= 'z' ||
			r >= 'A' && r <= 'Z' ||
			r >= '0' && r <= '9' ||
			r == '-' || r == '_'
		if !isBare {
			return strconv.Quote(key)
		}
	}
	return key
}

// sortedKeys returns the map keys in deterministic order.
func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
