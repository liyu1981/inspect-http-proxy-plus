-- ============================================================
-- File: migrations/000005_add_config_to_bookmarks.up.sql
-- Description: Add config details to proxy_bookmarks for self-containment
-- ============================================================

ALTER TABLE proxy_bookmarks ADD COLUMN config_source_path TEXT;
ALTER TABLE proxy_bookmarks ADD COLUMN config_json TEXT;
