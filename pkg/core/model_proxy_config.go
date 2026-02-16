package core

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	gonanoid "github.com/matoous/go-nanoid/v2"
	"gorm.io/gorm"
)

// ProxyConfigRow represents the database record for a specific environment and settings.
type ProxyConfigRow struct {
	ID        string    `gorm:"primaryKey;type:text"`
	CreatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP"`

	// Where the config was loaded from (e.g., /path/to/file or "shell")
	SourcePath string `gorm:"not null"`

	// The directory where the proxy was executed
	Cwd string `gorm:"not null"`

	// The full configuration content in JSON format
	ConfigJSON string `gorm:"not null"`

	// A unique hash of (SourcePath + Cwd + ConfigJSON) for fast lookup
	Fingerprint string `gorm:"uniqueIndex;not null"`

	// Relationship: One config row can have many sessions
	Sessions []ProxySessionRow `gorm:"foreignKey:ConfigID"`
}

// TableName overrides the default tablename to proxy_configs
func (ProxyConfigRow) TableName() string {
	return "proxy_configs"
}

// GetOrCreateConfigRow ensures the current environment is registered in the DB.
// It checks the fingerprint first; if missing, it creates a new row with a NanoID.
func GetOrCreateConfigRow(db *gorm.DB, sourcePath, cwd, configJSON string) (*ProxyConfigRow, error) {
	// 1. Generate the unique fingerprint
	fp := generateFingerprint(sourcePath, cwd, configJSON)

	var row ProxyConfigRow

	// 2. Fast check: See if this environment has been seen before
	err := db.Where("fingerprint = ?", fp).First(&row).Error

	if err == nil {
		return &row, nil
	}

	// 3. If not found, generate NanoID and insert
	if err == gorm.ErrRecordNotFound {
		newID, err := gonanoid.New()
		if err != nil {
			return nil, fmt.Errorf("failed to generate nanoid: %w", err)
		}

		row = ProxyConfigRow{
			ID:          newID,
			SourcePath:  sourcePath,
			Cwd:         cwd,
			ConfigJSON:  configJSON,
			Fingerprint: fp,
		}

		if err := db.Create(&row).Error; err != nil {
			// Fallback for race conditions: if another process inserted it
			// between our First() and Create(), just fetch that one.
			if err := db.Where("fingerprint = ?", fp).First(&row).Error; err == nil {
				return &row, nil
			}
			return nil, fmt.Errorf("failed to save config row: %w", err)
		}

		return &row, nil
	}

	return nil, err
}

// GetConfigRowByID retrieves a specific configuration row by its NanoID.
func GetConfigRowByID(db *gorm.DB, id string) (*ProxyConfigRow, error) {
	var row ProxyConfigRow
	if err := db.First(&row, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// generateFingerprint creates a SHA-256 hash of the unique config identity.
func generateFingerprint(sourcePath, cwd, configJSON string) string {
	// Using prefixes and separators to ensure the hash is mathematically distinct
	data := fmt.Sprintf("src:%s|cwd:%s|cfg:%s", sourcePath, cwd, configJSON)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}
