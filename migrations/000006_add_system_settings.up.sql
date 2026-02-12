-- ============================================================
-- File: migrations/000006_add_system_settings.up.sql
-- Description: Add system_settings table for persistent configuration
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial values if they don't exist
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('log_level', 'debug');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('api_addr', ':8080');
