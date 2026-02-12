-- ============================================================
-- File: migrations/000007_add_max_sessions_setting.down.sql
-- Description: Remove the max_sessions_retain setting from the system_settings table.
-- ============================================================

DELETE FROM system_settings WHERE key = 'max_sessions_retain';
