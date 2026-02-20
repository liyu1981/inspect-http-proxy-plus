package core

// Config represents the top-level configuration structure
type SysConfig struct {
	LogLevel          string                `mapstructure:"log-level" json:"log_level" toml:"log-level"`
	LogDest           string                `mapstructure:"log-dest" json:"log_dest" toml:"log-dest"`
	DBPath            string                `mapstructure:"db-path" json:"db_path" toml:"db-path"`
	InMemory          bool                  `mapstructure:"in-memory" json:"in_memory" toml:"in-memory"`
	APIAddr           string                `mapstructure:"api-addr" json:"api_addr" toml:"api-addr"`
	MaxSessionsRetain int                   `mapstructure:"max-sessions-retain" json:"max_sessions_retain" toml:"max-sessions-retain"`
	Proxies           []SysConfigProxyEntry `mapstructure:"proxies" json:"proxies" toml:"proxies"`
}

// ProxyEntry represents a single proxy configuration
type SysConfigProxyEntry struct {
	Listen          string `mapstructure:"listen" json:"listen" toml:"listen"`
	Target          string `mapstructure:"target" json:"target" toml:"target"`
	TruncateLogBody bool   `mapstructure:"truncate-log-body" json:"truncate_log_body" toml:"truncate-log-body"`
}
