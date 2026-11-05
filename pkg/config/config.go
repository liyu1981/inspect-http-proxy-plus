package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
	ihppLog "github.com/liyu1981/inspect-http-proxy-plus/pkg/log"
	"github.com/rs/zerolog/log"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

func LoadConfig() {
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

	warnOutdatedConfig()

	level, dest := ihppLog.ResolveLogSettings()
	fmt.Printf("%sLog Setup Resolved:%s %v %v\n", core.ColorCyan, core.ColorReset, level, dest)
	ihppLog.SetupLogger(level, dest)

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

// warnOutdatedConfig prints a hint when the loaded configuration file was
// written for an older (or newer) ihpp release.
func warnOutdatedConfig() {
	file := viper.ConfigFileUsed()
	if file == "" {
		return
	}

	version := viper.GetInt(ConfigVersionKey)
	switch {
	case version < ConfigVersion:
		fmt.Fprintf(os.Stderr, "%sWARNING:%s config file %s uses format version %d, latest is %d.\n",
			core.ColorYellow, core.ColorReset, file, version, ConfigVersion)
		fmt.Fprintf(os.Stderr, "         Run 'ihpp config --upgrade' to migrate it while keeping your values.\n")
	case version > ConfigVersion:
		fmt.Fprintf(os.Stderr, "%sWARNING:%s config file %s uses format version %d, newer than this build supports (%d).\n",
			core.ColorYellow, core.ColorReset, file, version, ConfigVersion)
	}
}

func LoadSettingsFromDB(db *gorm.DB, sysConfig *core.SysConfig) {
	if sysConfig.InMemory {
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
			sysConfig.LogDest = "default"
		}
	}

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
}
