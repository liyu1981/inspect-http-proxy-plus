-- ============================================================
-- File: migrations/000002_add_config_tracking.down.sql
-- Description: Rollback configuration tracking changes
-- ============================================================

-- 1. Remove the indexes first
DROP INDEX IF EXISTS idx_sessions_config_id;
DROP INDEX IF EXISTS idx_configs_fingerprint;

-- 2. Remove the config_id column from proxy_sessions
-- Note: SQLite (3.35.0+) supports dropping columns. 
-- If using an older version, this would require a table recreation.
ALTER TABLE proxy_sessions DROP COLUMN config_id;

-- 3. Drop the configurations table
DROP TABLE IF EXISTS proxy_configs;