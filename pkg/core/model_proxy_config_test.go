package core

import (
	"testing"
)

func TestGetOrCreateConfigRow(t *testing.T) {
	db := setupTestDB(t)

	sourcePath := "/tmp/config.toml"
	cwd := "/home/user/project"
	configJSON := `{"port": 8080}`

	// 1. Create a new config row
	row1, err := GetOrCreateConfigRow(db, sourcePath, cwd, configJSON)
	if err != nil {
		t.Fatalf("Failed to create config row: %v", err)
	}

	if row1.ID == "" {
		t.Error("Expected row ID to be generated")
	}
	if row1.SourcePath != sourcePath {
		t.Errorf("Expected SourcePath %s, got %s", sourcePath, row1.SourcePath)
	}

	// 2. Get the same config row (should return existing)
	row2, err := GetOrCreateConfigRow(db, sourcePath, cwd, configJSON)
	if err != nil {
		t.Fatalf("Failed to get existing config row: %v", err)
	}

	if row2.ID != row1.ID {
		t.Errorf("Expected same ID, got %s and %s", row1.ID, row2.ID)
	}

	// 3. Create a different config row
	row3, err := GetOrCreateConfigRow(db, sourcePath, cwd, `{"port": 9090}`)
	if err != nil {
		t.Fatalf("Failed to create different config row: %v", err)
	}

	if row3.ID == row1.ID {
		t.Error("Expected different ID for different configJSON")
	}
}

func TestGetConfigRowByID(t *testing.T) {
	db := setupTestDB(t)

	row, _ := GetOrCreateConfigRow(db, "path", "cwd", "json")
	
	found, err := GetConfigRowByID(db, row.ID)
	if err != nil {
		t.Fatalf("GetConfigRowByID failed: %v", err)
	}
	if found == nil || found.ID != row.ID {
		t.Errorf("Expected to find row %s", row.ID)
	}

	notFound, err := GetConfigRowByID(db, "non-existent")
	if err != nil {
		t.Fatalf("GetConfigRowByID failed for non-existent: %v", err)
	}
	if notFound != nil {
		t.Error("Expected nil for non-existent ID")
	}
}
