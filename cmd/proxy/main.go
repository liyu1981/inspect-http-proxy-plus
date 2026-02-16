package main

import (
	"fmt"
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

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
	"github.com/liyu1981/inspect-http-proxy/pkg/web"
)

const version = "v0.1.0"

func initFlags() {
	// Use pflag (POSIX compliant) for seamless Viper integration
	pflag.Bool("version", false, "Print version information")
	pflag.String("config", "", "Path to config file (default is ./.proxy.config.toml)")
	pflag.String("log-level", "debug", "Log level (trace, debug, info, warn, error, fatal, panic)")
	pflag.String("db-path", "", "Path to database file")
	pflag.String("api-addr", ":8080", "API server address")
	pflag.StringSlice("proxy", []string{}, "Proxy configuration in format 'listen_port,target[,truncate]' (can be specified multiple times)")

	pflag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Inspect HTTP Proxy - A simple proxy to inspect and log HTTP requests.\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n  %s [options]\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Options:\n")
		pflag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nProxy Format:\n")
		fmt.Fprintf(os.Stderr, "  --proxy listen_port,target[,truncate]\n")
		fmt.Fprintf(os.Stderr, "  Example: --proxy :3000,http://localhost:8000,true\n")
		fmt.Fprintf(os.Stderr, "  Multiple proxies: --proxy :3000,http://localhost:8000 --proxy :3001,http://localhost:8001\n")
	}
}

func loadConfig() {
	// Set default config file search parameters
	viper.SetConfigName(".proxy.config")
	viper.SetConfigType("toml")
	viper.AddConfigPath(".")

	// If a specific config file is passed via flag, use that
	if cfg, _ := pflag.CommandLine.GetString("config"); cfg != "" {
		viper.SetConfigFile(cfg)
	}

	// Read the config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			fmt.Fprintf(os.Stderr, "Error reading config: %v\n", err)
		}
	} else {
		log.Info().Str("file", viper.ConfigFileUsed()).Msg("Configuration loaded from file")
	}

	// Important: Bind flags to viper so they take precedence over config file
	viper.BindPFlags(pflag.CommandLine)
}

func parseProxyFlag(proxyStr string) (core.SysConfigProxyEntry, error) {
	parts := strings.Split(proxyStr, ",")
	if len(parts) < 2 {
		return core.SysConfigProxyEntry{}, fmt.Errorf("invalid proxy format, expected 'listen_port,target[,truncate]'")
	}

	listen := strings.TrimSpace(parts[0])
	target := strings.TrimSpace(parts[1])
	truncate := false

	if len(parts) >= 3 {
		truncateStr := strings.TrimSpace(parts[2])
		truncate = truncateStr == "true" || truncateStr == "1" || truncateStr == "yes"
	}

	return core.SysConfigProxyEntry{
		Listen:          listen,
		Target:          target,
		TruncateLogBody: truncate,
	}, nil
}

func setupLogger(logLevel string) {
	level, err := zerolog.ParseLevel(logLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	log.Logger = log.Output(zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: time.RFC3339,
	}).With().Caller().Logger()
}

func main() {
	initFlags()
	pflag.Parse()

	if ver, _ := pflag.CommandLine.GetBool("version"); ver {
		fmt.Printf("Inspect HTTP Proxy version %s\n", version)
		return
	}

	// 1. Load the config file
	loadConfig()

	// 2. Unmarshal into typed SysConfig struct
	var sysConfig core.SysConfig
	if err := viper.Unmarshal(&sysConfig); err != nil {
		log.Fatal().Err(err).Msg("Failed to unmarshal system configuration")
	}

	// Override with command-line proxy flags if provided
	proxyFlags, _ := pflag.CommandLine.GetStringSlice("proxy")
	if len(proxyFlags) > 0 {
		log.Info().Int("count", len(proxyFlags)).Msg("Overriding proxy configuration with command-line flags")
		sysConfig.Proxies = make([]core.SysConfigProxyEntry, 0, len(proxyFlags))
		for _, proxyStr := range proxyFlags {
			entry, err := parseProxyFlag(proxyStr)
			if err != nil {
				log.Fatal().Err(err).Str("proxy", proxyStr).Msg("Failed to parse proxy flag")
			}
			sysConfig.Proxies = append(sysConfig.Proxies, entry)
		}
	}

	// 3. Store SysConfig in GlobalVarStore
	core.GlobalVar.SetSysConfig(&sysConfig)

	// 4. Setup logger using config
	setupLogger(sysConfig.LogLevel)

	// 5. Validate proxy entries
	if len(sysConfig.Proxies) == 0 {
		log.Fatal().Msg("No [[proxies]] entries found in config")
	}

	// 6. Initialize database
	db, err := core.InitDatabase(sysConfig.DBPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Database initialization failed")
	}

	// 7. Initialize single shared UI server
	var uiServer *web.UIServer
	if db != nil && sysConfig.APIAddr != "" {
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

	// 8. Loop through all proxy entries and create corresponding threads
	for i, proxyEntry := range sysConfig.Proxies {
		core.StartProxyServer(i, proxyEntry, db, func(topic string, v any) {
			if uiServer != nil && uiServer.ApiHandler != nil {
				uiServer.ApiHandler.Publish(topic, v)
			}
		})
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
