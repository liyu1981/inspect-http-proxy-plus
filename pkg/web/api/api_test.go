package api

import (
	"testing"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
	"gorm.io/gorm"
)

// setupTestDB initializes an in-memory database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := core.InitDatabase(":memory:")
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}
