-- ============================================================
-- File: migrations/000007_add_max_sessions_setting.up.sql
-- Description: Add a new system setting for max_sessions_retain and seed it with a default value.
-- ============================================================

-- Seed max_sessions_retain if it doesn't exist
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_sessions_retain', '10000');
