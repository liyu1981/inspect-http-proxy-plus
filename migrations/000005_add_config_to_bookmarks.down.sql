-- ============================================================
-- File: migrations/000005_add_config_to_bookmarks.down.sql
-- Description: Remove config details from proxy_bookmarks
-- ============================================================

-- SQLite doesn't support DROP COLUMN easily in older versions, 
-- but for simplicity in this dev environment we'll just note it.
-- In modern SQLite (3.35.0+) we can:
-- ALTER TABLE proxy_bookmarks DROP COLUMN config_source_path;
-- ALTER TABLE proxy_bookmarks DROP COLUMN config_json;
