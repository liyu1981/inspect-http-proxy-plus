package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
	"github.com/liyu1981/inspect-http-proxy-plus/pkg/web"
)

func initFlags() {
	// Use pflag (POSIX compliant) for seamless Viper integration
	pflag.Bool("version", false, "Print version information")
	pflag.String("config", "", "Path to config file (default is ./.proxy.config.toml)")
	pflag.String("db-path", "", "Path to database file")
	pflag.Bool("in-memory", false, "Use in-memory database (no persistence)")
	pflag.String("log-level", "", "Log level: debug, info, warn, error, fatal, panic, disabled")
	pflag.String("log-dest", "", "Log destination: 'console', 'null', or a file path (default 'null', or 'console' in dev)")

	pflag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Inspect HTTP Proxy Plus - A simple proxy to inspect and log HTTP requests.\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n  %s [options] [proxy1] [proxy2] ...\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Options:\n")
		pflag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nProxy Format:\n")
		fmt.Fprintf(os.Stderr, "  target\n")
		fmt.Fprintf(os.Stderr, "  listen_port,target[,truncate]\n")
		fmt.Fprintf(os.Stderr, "  Example: :3000,http://localhost:8000,true\n")
		fmt.Fprintf(os.Stderr, "  Example: http://localhost:8000\n")
		fmt.Fprintf(os.Stderr, "  Multiple proxies: http://localhost:8000 http://localhost:8001\n")
	}
}

func resolveLogSettings() (string, string) {
	level := viper.GetString("log-level")
	dest := viper.GetString("log-dest")

	if dest == "" {
		if core.IsDev() {
			dest = "console"
		} else {
			dest = "null"
		}
	}

	if level == "" {
		if core.IsDev() {
			level = "debug"
		} else {
			level = core.LogLevelDisabled
		}
	}

	return level, dest
}

func loadConfig() {
	// Set default config file search parameters
	viper.SetConfigName(".proxy.config")
	viper.SetConfigType("toml")
	viper.AddConfigPath(".")

	// Important: Bind flags to viper so they take precedence over config file
	viper.BindPFlags(pflag.CommandLine)
	viper.BindPFlag("in-memory", pflag.Lookup("in-memory"))

	// If a specific config file is passed via flag, use that
	if cfg, _ := pflag.CommandLine.GetString("config"); cfg != "" {
		viper.SetConfigFile(cfg)
	}

	// Read the config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			fmt.Fprintf(os.Stderr, "Error reading config: %v\n", err)
		}
	}

	level, dest := resolveLogSettings()
	setupLogger(level, dest)

	if viper.ConfigFileUsed() != "" {
		fmt.Printf("%sConfig file:%s %s\n", core.ColorCyan, core.ColorReset, viper.ConfigFileUsed())
	}
	if viper.ConfigFileUsed() != "" {
		log.Info().Str("file", viper.ConfigFileUsed()).Msg("Configuration loaded from file")
	}

	// Support environment variables
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
}

func parseProxyFlag(proxyStr string, index int) (core.SysConfigProxyEntry, error) {
	parts := strings.Split(proxyStr, ",")

	var listen, target string
	truncate := true // Default to true as requested

	if len(parts) == 1 {
		// Only target provided, or only listen provided?
		// If it starts with http or contains :// it's likely a target
		if strings.Contains(parts[0], "://") || strings.HasPrefix(parts[0], "http") {
			target = strings.TrimSpace(parts[0])
			listen = fmt.Sprintf(":%d", 20003+index)
		} else {
			return core.SysConfigProxyEntry{}, fmt.Errorf("invalid proxy format: %s. If providing only one part, it must be the target URL", proxyStr)
		}
	} else {
		listen = strings.TrimSpace(parts[0])
		target = strings.TrimSpace(parts[1])
		if len(parts) >= 3 {
			truncateStr := strings.TrimSpace(parts[2])
			truncate = truncateStr == "true" || truncateStr == "1" || truncateStr == "yes"
		}
	}

	return core.SysConfigProxyEntry{
		Listen:          listen,
		Target:          target,
		TruncateLogBody: truncate,
	}, nil
}

func setupLogger(logLevel string, logDest string) {
	if logLevel == core.LogLevelDisabled {
		zerolog.SetGlobalLevel(zerolog.Disabled)
		return
	}
	level, err := zerolog.ParseLevel(logLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	var out io.Writer
	switch logDest {
	case "console":
		out = zerolog.ConsoleWriter{
			Out:        os.Stderr,
			TimeFormat: time.RFC3339,
		}
	case "null":
		out = io.Discard
	case "":
		// Default case if empty string somehow gets here
		if core.IsDev() {
			out = zerolog.ConsoleWriter{
				Out:        os.Stderr,
				TimeFormat: time.RFC3339,
			}
		} else {
			out = io.Discard
		}
	default:
		// Assume file path
		f, err := os.OpenFile(logDest, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error opening log file %s: %v. Falling back to console.\n", logDest, err)
			out = zerolog.ConsoleWriter{
				Out:        os.Stderr,
				TimeFormat: time.RFC3339,
			}
		} else {
			out = f
		}
	}

	log.Logger = log.Output(out).With().Caller().Logger()
}

func main() {
	initFlags()
	pflag.Parse()

	if ver, _ := pflag.CommandLine.GetBool("version"); ver {
		fmt.Printf("Inspect HTTP Proxy Plus version %s\n", core.Version)
		return
	}

	// 1. Load the config file (bootstrap for db-path and initial settings)
	loadConfig()

	// 2. Unmarshal into typed SysConfig struct
	var sysConfig core.SysConfig
	if err := viper.Unmarshal(&sysConfig); err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: Failed to unmarshal system configuration: %v\n", err)
		log.Fatal().Err(err).Msg("Failed to unmarshal system configuration")
	}

	// Handle in-memory flag
	if sysConfig.InMemory {
		sysConfig.DBPath = ":memory:"
	}

	// 3. Initialize database (needed for persistent settings)
	// Use resolved settings from config/flags for bootstrap
	db, err := core.InitDatabase(sysConfig.DBPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: Database initialization failed: %v\n", err)
		log.Fatal().Err(err).Msg("Database initialization failed")
	}

	// 4. Load persistent settings from DB, falling back to config file/defaults
	if !sysConfig.InMemory {
		sysConfig.LogLevel = core.GetSystemSetting(db, "log_level", sysConfig.LogLevel)
	}
	if sysConfig.LogLevel == "" {
		if core.IsDev() {
			sysConfig.LogLevel = "debug"
		} else {
			sysConfig.LogLevel = core.LogLevelDisabled
		}
	}

	if !sysConfig.InMemory {
		sysConfig.LogDest = core.GetSystemSetting(db, "log_dest", sysConfig.LogDest)
	}
	if sysConfig.LogDest == "" {
		if core.IsDev() {
			sysConfig.LogDest = "console"
		} else {
			sysConfig.LogDest = "null"
		}
	}

	// 5. Setup logger and global config early with final settings from DB
	core.GlobalVar.SetSysConfig(&sysConfig)
	setupLogger(sysConfig.LogLevel, sysConfig.LogDest)

	if !sysConfig.InMemory {
		sysConfig.APIAddr = core.GetSystemSetting(db, "api_addr", sysConfig.APIAddr)
	}
	if sysConfig.APIAddr == "" {
		sysConfig.APIAddr = ":20000"
	}

	if sysConfig.InMemory {
		sysConfig.MaxSessionsRetain = 100
	} else {
		maxRetainStr := core.GetSystemSetting(db, "max_sessions_retain", "")
		if maxRetainStr != "" {
			fmt.Sscanf(maxRetainStr, "%d", &sysConfig.MaxSessionsRetain)
		}
	}

	if sysConfig.MaxSessionsRetain <= 0 {
		sysConfig.MaxSessionsRetain = 10000
	}

	// Ensure DB is seeded with current values if they are new
	if !sysConfig.InMemory {
		_ = core.SetSystemSetting(db, "log_level", sysConfig.LogLevel)
		_ = core.SetSystemSetting(db, "log_dest", sysConfig.LogDest)
		_ = core.SetSystemSetting(db, "api_addr", sysConfig.APIAddr)
		_ = core.SetSystemSetting(db, "max_sessions_retain", fmt.Sprintf("%d", sysConfig.MaxSessionsRetain))
	}

	// Override with command-line proxy positional arguments if provided
	proxyArgs := pflag.Args()
	if len(proxyArgs) > 0 {
		log.Info().Int("count", len(proxyArgs)).Msg("Overriding proxy configuration with command-line arguments")
		sysConfig.Proxies = make([]core.SysConfigProxyEntry, 0, len(proxyArgs))
		for i, proxyStr := range proxyArgs {
			entry, err := parseProxyFlag(proxyStr, i)
			if err != nil {
				fmt.Fprintf(os.Stderr, "FATAL: Failed to parse proxy argument '%s': %v\n", proxyStr, err)
				log.Fatal().Err(err).Str("proxy", proxyStr).Msg("Failed to parse proxy argument")
			}
			sysConfig.Proxies = append(sysConfig.Proxies, entry)
		}
	}

	// 7. Validate proxy entries
	if len(sysConfig.Proxies) == 0 {
		log.Warn().Msg("No [[proxies]] entries found in configuration. Only UI server will be active.")
	}

	// 8. Initialize single shared UI server
	var uiServer *web.UIServer
	if db != nil && sysConfig.APIAddr != "" {
		fmt.Printf("%sUI Server:%s http://%s\n", core.ColorCyan, core.ColorReset, sysConfig.APIAddr)
		uiServer = web.NewUIServer(&web.Config{
			DB:         db,
			ListenAddr: sysConfig.APIAddr,
		})
		go func() {
			if err := uiServer.Start(); err != nil && err != http.ErrServerClosed {
				log.Warn().Err(err).Msg("UI server error")
			}
		}()
	}

	// Start the reaper
	publishFunc := func(topic string, v any) {
		if uiServer != nil && uiServer.ApiHandler != nil {
			uiServer.ApiHandler.Publish(topic, v)
		}
	}
	reaper := core.NewMaxSessionRowsReaper(db, publishFunc)
	reaper.Start(5 * time.Minute)

	// 9. Loop through all proxy entries and create corresponding threads
	isOverridden := len(proxyArgs) > 0
	for i, proxyEntry := range sysConfig.Proxies {
		err := core.StartProxyServer(i, proxyEntry, db, publishFunc)
		if err != nil {
			if isOverridden {
				fmt.Fprintf(os.Stderr, "FATAL: Proxy server %d failed: %v\n", i, err)
				log.Fatal().Err(err).Int("index", i).Msg("Proxy server failed (command-line override)")
			} else {
				fmt.Fprintf(os.Stderr, "WARNING: Skipping proxy entry %d due to error: %v\n", i, err)
				log.Warn().Err(err).Int("index", i).Msg("Skipping malformed proxy entry from configuration")
			}
		}
	}

	// 9. Graceful shutdown handler
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	<-shutdown
	log.Info().Msg("Shutting down...")

	// Close all proxy servers from GlobalVarStore
	allProxyServers := core.GlobalVar.GetAllProxyServers()
	for configID, srv := range allProxyServers {
		log.Info().Str("config_id", configID).Msg("Closing proxy server")
		srv.Close()
	}

	// Close UI server
	if uiServer != nil {
		log.Info().Msg("Closing UI server")
		uiServer.Shutdown()
	}

	log.Info().Msg("Shutdown complete")
}
