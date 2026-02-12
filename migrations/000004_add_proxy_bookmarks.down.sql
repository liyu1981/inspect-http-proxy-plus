-- ============================================================
-- File: migrations/000004_add_proxy_bookmarks.down.sql
-- Description: Drop proxy_bookmarks table and FTS
-- ============================================================

DROP TRIGGER IF EXISTS proxy_bookmarks_ad;
DROP TRIGGER IF EXISTS proxy_bookmarks_au;
DROP TRIGGER IF EXISTS proxy_bookmarks_ai;
DROP TABLE IF EXISTS proxy_bookmarks_fts;
DROP TABLE IF EXISTS proxy_bookmarks;
