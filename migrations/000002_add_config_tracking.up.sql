-- ============================================================
-- File: migrations/000002_add_config_tracking.up.sql
-- Description: Add configuration tracking and link to sessions
-- ============================================================

-- 1. Create the configurations table
CREATE TABLE IF NOT EXISTS proxy_configs (
    id TEXT PRIMARY KEY NOT NULL, -- NanoID generated in Go
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Provenance tracking
    source_path TEXT NOT NULL,         -- e.g., '/path-to/.proxy.config.toml' or 'shell'
    cwd TEXT NOT NULL,                 -- Current working directory
    
    -- The actual config content
    config_json TEXT NOT NULL,
    
    -- Composite unique fingerprint for fast lookup: Hash(source_path + cwd + config_json)
    fingerprint TEXT NOT NULL UNIQUE
);

-- 2. Add foreign key column to proxy_sessions
-- SQLite doesn't support adding a column with a REFERENCES constraint 
-- in a single step for existing tables without a default or allowing NULL.
-- We allow NULL initially to remain compatible with old logs.
ALTER TABLE proxy_sessions ADD COLUMN config_id TEXT REFERENCES proxy_configs(id);

-- 3. Index the relationship for fast filtering/joining
CREATE INDEX IF NOT EXISTS idx_sessions_config_id ON proxy_sessions(config_id);

-- 4. Index the fingerprint for fast "config exists" checks
CREATE INDEX IF NOT EXISTS idx_configs_fingerprint ON proxy_configs(fingerprint);