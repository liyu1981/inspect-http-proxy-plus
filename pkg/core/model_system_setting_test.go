package core

import (
	"testing"
)

func TestSystemSetting(t *testing.T) {
	db := setupTestDB(t)

	// 1. Get non-existent setting (should return default)
	val := GetSystemSetting(db, "non-existent", "default")
	if val != "default" {
		t.Errorf("Expected 'default', got '%s'", val)
	}

	// 2. Set system setting
	err := SetSystemSetting(db, "test-key", "test-value")
	if err != nil {
		t.Fatalf("SetSystemSetting failed: %v", err)
	}

	// 3. Get system setting
	val = GetSystemSetting(db, "test-key", "default")
	if val != "test-value" {
		t.Errorf("Expected 'test-value', got '%s'", val)
	}

	// 4. Update system setting
	err = SetSystemSetting(db, "test-key", "updated-value")
	if err != nil {
		t.Fatalf("Update SetSystemSetting failed: %v", err)
	}
	val = GetSystemSetting(db, "test-key", "default")
	if val != "updated-value" {
		t.Errorf("Expected 'updated-value', got '%s'", val)
	}

	// 5. GetAllSystemSettings
	settings, err := GetAllSystemSettings(db)
	if err != nil {
		t.Fatalf("GetAllSystemSettings failed: %v", err)
	}
	if len(settings) < 1 {
		t.Errorf("Expected at least 1 setting, got %d", len(settings))
	}
	if settings["test-key"] != "updated-value" {
		t.Errorf("Expected 'updated-value', got '%s'", settings["test-key"])
	}
}
