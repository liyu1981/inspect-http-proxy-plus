package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/signal"
	"runtime"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/config"
	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
	"github.com/liyu1981/inspect-http-proxy-plus/pkg/web"
)

func initFlags() {
	// Use pflag (POSIX compliant) for seamless Viper integration
	pflag.BoolP("help", "h", false, "Show this help message and exit")
	pflag.Bool("version", false, "Print version information and exit")
	pflag.String("config", "", "Path to config file (default is ./.proxy.config.toml)")
	pflag.String("db-path", "", "Path to database file")
	pflag.Bool("in-memory", false, "Use in-memory database (no persistence)")
	pflag.String("log-level", "", "Log level: debug, info, warn, error, fatal, panic, disabled")
	pflag.String("log-dest", "", "Log destination: 'console', 'null', or a file path (default 'null', or 'console' in dev)")
	pflag.BoolP("daemon", "d", false, "Run in background as a daemon")

	// Options of the `config` command, hidden from the main help output.
	pflag.Bool("upgrade", false, "Upgrade an existing config file to the latest format")
	pflag.Bool("force", false, "Overwrite the config file when generating a sample")
	pflag.Bool("dry-run", false, "Print the result instead of writing the config file")
	for _, name := range []string{"upgrade", "force", "dry-run"} {
		_ = pflag.CommandLine.MarkHidden(name)
	}

	pflag.Usage = func() {
		printHelp(os.Stderr)
	}
}

// printHelp prints the top-level help message.
func printHelp(w io.Writer) {
	fmt.Fprint(w, `Inspect HTTP Proxy Plus (ihpp) - a reverse proxy that captures and inspects
HTTP traffic, with a real-time web UI.

Usage:
  ihpp [options] [proxy ...]
  ihpp <command> [command options]

Commands:
  config [options]   Generate a sample config file, or upgrade an existing one
  version            Print version information
  status             Show the status of a running daemon
  stop               Stop a running daemon
  help [command]     Show help for a command

Options:
`)
	fmt.Fprint(w, pflag.CommandLine.FlagUsages())
	fmt.Fprint(w, `
Proxy Arguments:
  target                             Listen on :20003 and forward to target
  listen_port,target[,truncate]      Listen on listen_port, forward to target

  Examples:
    ihpp :3000,http://localhost:8000,true
    ihpp http://localhost:8000
    ihpp http://localhost:8000 http://localhost:8001

Run 'ihpp help <command>' for more information on a command.
`)
}

// printCommandHelp prints the help message of a single command.
func printCommandHelp(w io.Writer, command string) {
	switch command {
	case "config":
		fmt.Fprint(w, `Generate a sample configuration file in the current directory, or upgrade an
existing configuration file to the latest format.

Usage:
  ihpp config [options]              Write ./.proxy.config.toml
  ihpp config --upgrade [options]    Upgrade the existing config file in place

Upgrading keeps every value that is already configured, drops keys that are no
longer supported, and carries unknown keys over unchanged. Missing settings are
added as commented-out defaults.

Options:
`)
		fmt.Fprint(w, flagUsages("config", "upgrade", "force", "dry-run"))
		fmt.Fprint(w, `
Examples:
  ihpp config                        Create ./.proxy.config.toml
  ihpp config --force                Overwrite an existing config file
  ihpp config --dry-run              Print the sample config without writing it
  ihpp config --upgrade              Migrate the config file in place
  ihpp config --upgrade --dry-run    Show the migrated config without writing it
`)
	case "version":
		fmt.Fprint(w, `Print the ihpp version together with Go build information.

Usage:
  ihpp version
  ihpp --version
`)
	case "status":
		fmt.Fprint(w, `Show the status of the running daemon, including PID, uptime, database path,
management API address and the active/inactive proxies.

Usage:
  ihpp status
`)
	case "stop":
		fmt.Fprint(w, `Ask the running daemon to shut down gracefully.

Usage:
  ihpp stop
`)
	case "help", "":
		printHelp(w)
	default:
		fmt.Fprintf(w, "Unknown command %q.\n\n", command)
		printHelp(w)
	}
}

// flagUsages renders the usage of the named flags.
func flagUsages(names ...string) string {
	set := pflag.NewFlagSet("ihpp", pflag.ContinueOnError)
	for _, name := range names {
		flag := pflag.Lookup(name)
		if flag == nil {
			continue
		}
		// Copy the flag so that hidden command options can be shown here
		// without changing the global flag definitions.
		copy := *flag
		copy.Hidden = false
		set.AddFlag(&copy)
	}
	return set.FlagUsages()
}

// printVersion prints version and build information.
func printVersion() {
	fmt.Printf("Inspect HTTP Proxy Plus version %s\n", core.Version)

	goVersion := runtime.Version()
	var revision, buildTime string
	if info, ok := debug.ReadBuildInfo(); ok {
		if info.GoVersion != "" {
			goVersion = info.GoVersion
		}
		for _, setting := range info.Settings {
			switch setting.Key {
			case "vcs.revision":
				revision = setting.Value
			case "vcs.time":
				buildTime = setting.Value
			}
		}
	}

	fmt.Printf("  go version: %s\n", goVersion)
	fmt.Printf("  platform:   %s/%s\n", runtime.GOOS, runtime.GOARCH)
	if revision != "" {
		if len(revision) > 12 {
			revision = revision[:12]
		}
		fmt.Printf("  commit:     %s\n", revision)
	}
	if buildTime != "" {
		fmt.Printf("  built:      %s\n", buildTime)
	}
}

// handleConfigCommand implements `ihpp config [--upgrade] [--force] [--dry-run]`.
func handleConfigCommand() {
	upgrade, _ := pflag.CommandLine.GetBool("upgrade")
	force, _ := pflag.CommandLine.GetBool("force")
	dryRun, _ := pflag.CommandLine.GetBool("dry-run")

	path, _ := pflag.CommandLine.GetString("config")
	if path == "" {
		path = os.Getenv("IHPP_CONFIG")
	}
	if path == "" {
		path = config.DefaultConfigFileName
	}

	if pflag.NArg() > 1 {
		fmt.Fprintf(os.Stderr, "Error: unexpected argument %q\n", pflag.Arg(1))
		fmt.Fprintf(os.Stderr, "Run 'ihpp help config' for usage.\n")
		os.Exit(1)
	}

	if !upgrade {
		if dryRun {
			fmt.Print(config.SampleConfig())
			return
		}

		if err := config.WriteSampleConfig(path, force); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("%sCreated sample config:%s %s\n", core.ColorGreen, core.ColorReset, path)
		fmt.Printf("Edit it, then start ihpp with: ihpp --config %s\n", path)
		return
	}

	if _, err := os.Stat(path); err != nil {
		fmt.Fprintf(os.Stderr, "Error: no config file found at %s\n", path)
		fmt.Fprintf(os.Stderr, "Create one first with: ihpp config\n")
		os.Exit(1)
	}

	result, err := config.UpgradeConfig(path, config.UpgradeOptions{DryRun: dryRun, Force: force})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if dryRun {
		fmt.Print(result.Content)
		fmt.Fprintf(os.Stderr, "\nDry run: %s was not modified.\n", path)
		return
	}

	if result.UpToDate {
		fmt.Printf("%sConfig file is already up to date%s (format version %d): %s\n",
			core.ColorGreen, core.ColorReset, result.ToVersion, result.Path)
		fmt.Printf("Use --force to regenerate the comments of the file.\n")
		return
	}

	if !result.Changed {
		fmt.Printf("%sConfig file already matches format version %d%s: %s\n",
			core.ColorGreen, result.ToVersion, core.ColorReset, result.Path)
		return
	}

	if result.FromVersion == result.ToVersion {
		fmt.Printf("%sRewrote config:%s %s (format version %d)\n",
			core.ColorGreen, core.ColorReset, result.Path, result.ToVersion)
	} else {
		fmt.Printf("%sUpgraded config:%s %s (format version %d -> %d)\n",
			core.ColorGreen, core.ColorReset, result.Path, result.FromVersion, result.ToVersion)
	}

	if len(result.KeptValues) > 0 {
		fmt.Printf("  preserved values: %s\n", strings.Join(result.KeptValues, ", "))
	}
	if len(result.AddedKeys) > 0 {
		fmt.Printf("  unset settings:   %s (added as commented defaults)\n", strings.Join(result.AddedKeys, ", "))
	}
	if len(result.PreservedKeys) > 0 {
		fmt.Printf("  unknown settings: %s (kept as-is)\n", strings.Join(result.PreservedKeys, ", "))
	}
	if len(result.RemovedKeys) > 0 {
		fmt.Printf("  removed settings: %s\n", strings.Join(result.RemovedKeys, ", "))
	}
	fmt.Printf("  proxies:          %d\n", result.ProxyCount)
}

func handleSubcommands() bool {
	if pflag.NArg() == 0 {
		return false
	}

	cmd := pflag.Arg(0)
	switch cmd {
	case "help":
		printCommandHelp(os.Stdout, pflag.Arg(1))
		return true
	case "version":
		if pflag.NArg() > 1 {
			fmt.Fprintf(os.Stderr, "Error: unexpected argument %q\n", pflag.Arg(1))
			fmt.Fprintf(os.Stderr, "Run 'ihpp help version' for usage.\n")
			os.Exit(1)
		}
		printVersion()
		return true
	case "config":
		handleConfigCommand()
		return true
	case "stop":
		resp, err := core.SendDaemonCommand(core.DaemonCommand{Command: core.DaemonCommandStop})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error stopping daemon: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("%s\n", resp.Message)
		os.Exit(0)
	case "status":
		resp, err := core.SendDaemonCommand(core.DaemonCommand{Command: core.DaemonCommandStatus})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error getting daemon status: %v\n", err)
			os.Exit(1)
		}
		dataJson, _ := json.MarshalIndent(resp.Data, "", "  ")
		fmt.Printf("Daemon Status:\n%s\n", string(dataJson))
		os.Exit(0)
	default:
		// If it's not a known command, it might be a proxy argument
		return false
	}
	return false
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

func main() {
	initFlags()
	pflag.Parse()

	if help, _ := pflag.CommandLine.GetBool("help"); help {
		// `ihpp help <command>` when flags are provided as well.
		if pflag.NArg() > 0 {
			printCommandHelp(os.Stdout, pflag.Arg(0))
			return
		}
		printHelp(os.Stdout)
		return
	}

	if ver, _ := pflag.CommandLine.GetBool("version"); ver {
		printVersion()
		return
	}

	if handleSubcommands() {
		return
	}

	// Check for updates
	core.CheckForUpdates()

	// Load the config file (bootstrap for db-path and initial settings)
	config.LoadConfig()

	// Unmarshal into typed SysConfig struct
	var sysConfig core.SysConfig
	if err := viper.Unmarshal(&sysConfig); err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: Failed to unmarshal system configuration: %v\n", err)
		log.Fatal().Err(err).Msg("Failed to unmarshal system configuration")
	}

	// Handle in-memory flag
	if sysConfig.InMemory {
		sysConfig.DBPath = ":memory:"
	}
	if sysConfig.DBPath == "" {
		sysConfig.DBPath = core.DefaultDbPath()
	}

	// Override with command-line proxy positional arguments if provided
	proxyArgs := pflag.Args()
	if len(proxyArgs) > 0 {
		sysConfig.Proxies = make([]core.SysConfigProxyEntry, 0, len(proxyArgs))
		for i, proxyStr := range proxyArgs {
			entry, err := parseProxyFlag(proxyStr, i)
			if err != nil {
				fmt.Fprintf(os.Stderr, "FATAL: Failed to parse proxy argument '%s': %v\n", proxyStr, err)
				fmt.Fprintf(os.Stderr, "Run 'ihpp help' for usage.\n")
				log.Fatal().Err(err).Str("proxy", proxyStr).Msg("Failed to parse proxy argument")
			}
			sysConfig.Proxies = append(sysConfig.Proxies, entry)
		}
	}

	// Check if daemon is already running and handle proxy merging
	daemonCheck, err := core.CheckDaemonAndGetNewProxies(sysConfig.Proxies)
	if err == nil && daemonCheck.IsRunning {
		fmt.Print(daemonCheck.ResponseMsg)

		if len(daemonCheck.NewProxies) > 0 {
			fmt.Printf("%d new/different proxies found. Do you want to merge them into the existing instance? (y/n): ", len(daemonCheck.NewProxies))
			var response string
			fmt.Scanln(&response)
			if strings.ToLower(response) == "y" || strings.ToLower(response) == "yes" {
				resp, err := core.MergeProxiesIntoDaemon(daemonCheck.MergeProxies)
				if err != nil {
					fmt.Fprintf(os.Stderr, "Error merging proxies: %v\n", err)
					os.Exit(1)
				}
				dataJson, _ := json.MarshalIndent(resp.Data, "", "  ")
				fmt.Printf("%s\n%s\n", resp.Message, string(dataJson))
				os.Exit(0)
			}
		}
		os.Exit(0)
	}

	core.CleanupStaleSocket()

	daemonFlag, _ := pflag.CommandLine.GetBool("daemon")
	if daemonFlag {
		if err := core.Daemonize(); err != nil {
			fmt.Fprintf(os.Stderr, "Error starting daemon: %v\n", err)
			os.Exit(1)
		}
	}

	if err := core.WritePIDFile(); err != nil {
		log.Warn().Err(err).Msg("Failed to write PID file")
	}
	defer core.RemovePIDFile()

	// Initialize database (needed for persistent settings)
	// Use resolved settings from config/flags for bootstrap
	db, err := core.InitDatabase(sysConfig.DBPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL: Database initialization failed: %v\n", err)
		log.Fatal().Err(err).Msg("Database initialization failed")
	}

	// Load persistent settings from DB, falling back to config file/defaults
	config.LoadSettingsFromDB(db, &sysConfig)

	// Setup logger and global config early with final settings from DB
	log.Debug().Interface("sysConfig", sysConfig).Msg("System config")
	core.GlobalVar.SetSysConfig(&sysConfig)

	// Validate proxy entries
	if len(sysConfig.Proxies) == 0 {
		log.Warn().Msg("No [[proxies]] entries found in configuration. Only UI server will be active.")
	}

	startTime := time.Now()

	// Initialize single shared UI server
	uiServer, err := web.StartUIServer(db, sysConfig.APIAddr)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to start UI server")
	}
	if uiServer != nil {
		fmt.Printf("%sUI Server:%s http://%s\n", core.ColorCyan, core.ColorReset, sysConfig.APIAddr)
	}

	// Start the reaper
	publishFunc := func(topic string, v any) {
		if uiServer != nil && uiServer.ApiHandler != nil {
			uiServer.ApiHandler.Publish(topic, v)
		}
	}
	reaper := core.NewMaxSessionRowsReaper(db, publishFunc)
	reaper.Start(5 * time.Minute)

	// Loop through all proxy entries and create corresponding threads
	for i, proxyEntry := range sysConfig.Proxies {
		err := core.StartProxyServer(i, proxyEntry, db, publishFunc)
		if err != nil {
			fmt.Fprintf(os.Stderr, "WARNING: Skipping proxy entry %d due to error: %v\n", i, err)
			log.Warn().Err(err).Int("index", i).Msg("Skipping malformed proxy entry")
		}
	}

	// Graceful shutdown handler
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	// Start Daemon Listener
	err = core.StartDaemonListener(
		func() {
			shutdown <- syscall.SIGTERM
		},
		func(newProxies []core.SysConfigProxyEntry) any {
			results := make([]map[string]any, 0)
			for _, newProxy := range newProxies {
				found := false
				for _, existing := range sysConfig.Proxies {
					if existing.Listen == newProxy.Listen {
						if existing.Target == newProxy.Target {
							results = append(results, map[string]any{
								"proxy":  newProxy.Listen,
								"result": "ignored",
								"reason": "identical config exists",
							})
						} else {
							results = append(results, map[string]any{
								"proxy":  newProxy.Listen,
								"result": "conflict",
								"reason": "port already in use by another target",
							})
						}
						found = true
						break
					}
				}
				if !found {
					err := core.StartProxyServer(len(sysConfig.Proxies), newProxy, db, publishFunc)
					if err != nil {
						results = append(results, map[string]any{
							"proxy":  newProxy.Listen,
							"result": "error",
							"reason": err.Error(),
						})
						newProxy.Active = false
						newProxy.Error = err.Error()
					} else {
						results = append(results, map[string]any{
							"proxy":  newProxy.Listen,
							"result": "success",
						})
						newProxy.Active = true
					}
					sysConfig.Proxies = append(sysConfig.Proxies, newProxy)
				}
			}
			return results
		},
		func() any {
			// Enrich with active status from GlobalVarStore
			allServers := core.GlobalVar.GetAllProxyServers()
			enrichedProxies := make([]map[string]any, 0)

			// Get actual proxy configs from GlobalVarStore to see their IDs and settings
			idToConfig := core.GlobalVar.GetAllProxyConfigs()

			for id, config := range idToConfig {
				active := false
				if _, ok := allServers[id]; ok {
					active = true
				}
				enrichedProxies = append(enrichedProxies, map[string]any{
					"config_id": id,
					"listen":    config.ListenAddr,
					"target":    config.TargetURL.String(),
					"active":    active,
				})
			}

			return map[string]any{
				"pid":      os.Getpid(),
				"uptime":   time.Since(startTime).String(),
				"db_path":  sysConfig.DBPath,
				"api_addr": sysConfig.APIAddr,
				"proxies":  enrichedProxies,
			}
		},
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to start daemon listener")
	}

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
