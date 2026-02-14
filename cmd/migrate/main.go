package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/liyu1981/inspect-http-proxy/migrations"
)

// must run as: go run --tags fts5 ./cmd/migrate/main.go

func main() {
	// 1. Define flags
	dbPath := flag.String("db", "", "Path to SQLite database (required)")
	action := flag.String("action", "up", "Migration action: up, down, version")
	steps := flag.Int("steps", 1, "Number of steps for down migration")
	help := flag.Bool("help", false, "Show help and usage")
	forceVersion := flag.Int("force", -1, "Force migration version (used with -action force)")

	// Custom Usage message for the -help flag
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage of %s:\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Example: ./migrate -db ./test.db -action up\n\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	// 2. Show usage if help is requested or no db path is provided
	if *help || *dbPath == "" {
		if *dbPath == "" && !*help {
			fmt.Fprintln(os.Stderr, "Error: The -db flag is required.")
		}
		flag.Usage()
		os.Exit(1)
	}

	// 3. Print flags before taking action for better transparency
	log.Printf("Starting Migration Tool...")
	log.Printf("Target DB: %s", *dbPath)
	log.Printf("Action:    %s", *action)
	if *action == "down" {
		log.Printf("Steps:     %d", *steps)
	}
	log.Println("---------------------------------")

	switch *action {
	case "up":
		log.Println("Running migrations...")
		if err := migrations.RunMigrations(*dbPath, false); err != nil {
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

	case "force":
		if *forceVersion < 0 {
			log.Fatal("Please provide a valid version with -force (e.g., -action force -force 2)")
		}
		log.Printf("Forcing database version to %d...", *forceVersion)
		if err := migrations.ForceVersion(*dbPath, *forceVersion); err != nil {
			log.Fatalf("Force version failed: %v", err)
		}
		log.Println("Database version forced successfully!")

	default:
		log.Fatalf("Unknown action: %s. Use -help for usage info.", *action)
	}
}
