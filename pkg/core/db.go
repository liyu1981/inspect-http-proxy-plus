package core

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/liyu1981/inspect-http-proxy/migrations"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func DefaultDbPath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ".proxy.db" // Fallback to current directory
	}
	return filepath.Join(homeDir, ".proxy/proxy_logs.db")
}

// initDatabase initializes the database with migrations
func InitDatabase(dbPath string) (*gorm.DB, error) {
	log.Debug().Str("db_path", dbPath).Msg("Initializing database")

	// 1. Handle default path and directory creation
	if dbPath == "" {
		dbPath = DefaultDbPath()
	}

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory %s: %w", dir, err)
	}

	// 2. Backup before migration if file exists
	backupPath := dbPath + ".bak"
	backupCreated := false
	if _, err := os.Stat(dbPath); err == nil {
		log.Info().Str("path", dbPath).Str("backup", backupPath).Msg("Creating database backup before migration...")
		if err := CopyFile(dbPath, backupPath); err != nil {
			return nil, fmt.Errorf("failed to create database backup: %w", err)
		}
		backupCreated = true
	}

	// 3. Run migrations
	log.Info().Str("path", dbPath).Msg("Running database migrations...")
	if err := migrations.RunMigrations(dbPath); err != nil {
		if backupCreated {
			log.Error().Str("backup_path", backupPath).Msg("Migration failed. A backup is available at the backup_path.")
		}
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	// Migration succeeded, remove backup
	if backupCreated {
		if err := os.Remove(backupPath); err != nil {
			log.Warn().Err(err).Str("path", backupPath).Msg("Failed to remove backup file after successful migration")
		} else {
			log.Debug().Str("path", backupPath).Msg("Backup file removed after successful migration")
		}
	}

	// 4. Open GORM connection
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	// 4. Enable WAL mode & performance tweaks
	// WAL mode allows multiple readers and one writer simultaneously
	if err := db.Exec("PRAGMA journal_mode=WAL;").Error; err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}

	// busy_timeout helps prevent "database is locked" errors during concurrent writes
	if err := db.Exec("PRAGMA busy_timeout = 5000;").Error; err != nil {
		return nil, fmt.Errorf("failed to set busy timeout: %w", err)
	}

	log.Info().Str("db_path", dbPath).Msg("Database initialized successfully")
	return db, nil
}

func GetCurrentDBSize(dbPath string) (int64, error) {
	if dbPath == "" {
		dbPath = DefaultDbPath()
	}
	return GetFileSize(dbPath)
}
