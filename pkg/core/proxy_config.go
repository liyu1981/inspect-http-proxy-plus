package core

import (
	"encoding/json"
	"os"

	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

// RegisterConfiguration handles the registration of current configuration with the database
// Returns the configuration ID that can be used to link proxy sessions
func RegisterConfiguration(db *gorm.DB, proxyEntry SysConfigProxyEntry) (string, error) {
	if db == nil {
		return "", nil
	}

	sourcePath := viper.ConfigFileUsed()
	if sourcePath == "" {
		sourcePath = "cli-flags"
	}

	cwd, err := os.Getwd()
	if err != nil {
		log.Warn().Err(err).Msg("Could not determine current working directory")
		cwd = "."
	}

	// Generate JSON representation of all current settings
	settingsMap := proxyEntry
	settingsBytes, err := json.Marshal(settingsMap)
	if err != nil {
		return "", err
	}
	configJSON := string(settingsBytes)

	// Get or Create Config Row
	configRow, err := GetOrCreateConfigRow(db, sourcePath, cwd, configJSON)
	if err != nil {
		return "", err
	}

	log.Info().Str("config_id", configRow.ID).Msg("Configuration session initialized")
	return configRow.ID, nil
}
