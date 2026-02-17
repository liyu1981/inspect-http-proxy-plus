package migrations

import (
	"database/sql"
	"embed"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/mattn/go-sqlite3" // Ensure driver is matched with golang-migrate sqlite3
)

//go:embed *.sql
var migrationFS embed.FS

// Helper to avoid repeating boilerplate setup
func newMigrateInstance(dbPath string) (*migrate.Migrate, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	return newMigrateInstanceFromDB(db)
}

func newMigrateInstanceFromDB(db *sql.DB) (*migrate.Migrate, error) {
	driver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to create migrate driver: %w", err)
	}

	sourceDriver, err := iofs.New(migrationFS, ".")
	if err != nil {
		return nil, fmt.Errorf("failed to create source driver: %w", err)
	}

	return migrate.NewWithInstance("iofs", sourceDriver, "sqlite3", driver)
}

func RunMigrationsWithDB(db *sql.DB) error {
	m, err := newMigrateInstanceFromDB(db)
	if err != nil {
		return err
	}
	// Do NOT call m.Close() because it closes the underlying sql.DB connection even when passed as instance
	// which is fatal for :memory: databases.

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	} else if err == migrate.ErrNoChange {
		version, _, _ := m.Version()
		fmt.Printf("\033[36mMigration:\033[0m Database is up to date (version %d)\n", version)
	} else {
		version, _, _ := m.Version()
		fmt.Printf("\033[36mMigration:\033[0m Successfully migrated to version %d\n", version)
	}
	return nil
}

func RunMigrations(dbPath string) error {
	m, err := newMigrateInstance(dbPath)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	} else if err == migrate.ErrNoChange {
		version, _, _ := m.Version()
		fmt.Printf("\033[36mMigration:\033[0m Database is up to date (version %d)\n", version)
	} else {
		version, _, _ := m.Version()
		fmt.Printf("\033[36mMigration:\033[0m Successfully migrated to version %d\n", version)
	}
	return nil
}

func MigrateDown(dbPath string, steps int) error {
	m, err := newMigrateInstance(dbPath)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Steps(-steps); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("rollback failed: %w", err)
	}
	return nil
}

// ForceVersion manually sets the version and clears the dirty flag
func ForceVersion(dbPath string, version int) error {
	m, err := newMigrateInstance(dbPath)
	if err != nil {
		return err
	}
	defer m.Close()

	return m.Force(version)
}

func GetMigrationVersion(dbPath string) (uint, bool, error) {
	m, err := newMigrateInstance(dbPath)
	if err != nil {
		return 0, false, err
	}
	defer m.Close()

	version, dirty, err := m.Version()
	if err == migrate.ErrNilVersion {
		return 0, false, nil
	}
	return version, dirty, err
}
