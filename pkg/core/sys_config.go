package core

// Config represents the top-level configuration structure
type SysConfig struct {
	LogLevel           string                `mapstructure:"log-level"`
	DBPath             string                `mapstructure:"db-path"`
	APIAddr            string                `mapstructure:"api-addr"`
	MaxSessionsRetain  int                   `mapstructure:"max-sessions-retain"`
	Proxies            []SysConfigProxyEntry `mapstructure:"proxies"`
}

// ProxyEntry represents a single proxy configuration
type SysConfigProxyEntry struct {
	Listen          string `mapstructure:"listen"`
	Target          string `mapstructure:"target"`
	TruncateLogBody bool   `mapstructure:"truncate-log-body"`
}
