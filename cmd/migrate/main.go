package main

import (
	"flag"
	"log"

	"github.com/liyu1981/inspect-http-proxy/migrations"
)

func main() {
	dbPath := flag.String("db", "proxy_logs.db", "Path to SQLite database")
	action := flag.String("action", "up", "Migration action: up, down, version")
	steps := flag.Int("steps", 1, "Number of steps for down migration")
	flag.Parse()

	switch *action {
	case "up":
		log.Println("Running migrations...")
		if err := migrations.RunMigrations(*dbPath); err != nil {
			log.Fatalf("Migration failed: %v", err)
		}
		log.Println("Migrations completed successfully!")

	case "down":
		log.Printf("Rolling back %d migration(s)...", *steps)
		if err := migrations.MigrateDown(*dbPath, *steps); err != nil {
			log.Fatalf("Rollback failed: %v", err)
		}
		log.Println("Rollback completed successfully!")

	case "version":
		version, dirty, err := migrations.GetMigrationVersion(*dbPath)
		if err != nil {
			log.Fatalf("Failed to get version: %v", err)
		}
		if version == 0 {
			log.Println("No migrations applied yet")
		} else {
			log.Printf("Current version: %d (dirty: %v)", version, dirty)
		}

	default:
		log.Fatalf("Unknown action: %s", *action)
	}
}
