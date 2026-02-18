package core

import (
	"testing"

	"github.com/spf13/viper"
)

func TestRegisterConfiguration(t *testing.T) {
	db := setupTestDB(t)

	// Mock viper
	viper.Reset()
	viper.SetConfigFile("test-config.toml")

	entry := SysConfigProxyEntry{
		Listen: ":8080",
		Target: "http://target.com",
	}

	configID, err := RegisterConfiguration(db, entry)
	if err != nil {
		t.Fatalf("RegisterConfiguration failed: %v", err)
	}

	if configID == "" {
		t.Error("Expected configID to be non-empty")
	}

	// Verify it exists in DB
	row, _ := GetConfigRowByID(db, configID)
	if row == nil {
		t.Errorf("Config row %s not found in DB", configID)
	}
}
