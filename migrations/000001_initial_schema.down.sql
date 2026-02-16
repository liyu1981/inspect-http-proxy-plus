-- ============================================================
-- File: migrations/000001_initial_schema.down.sql
-- Description: Rollback initial schema
-- ============================================================

DROP INDEX IF EXISTS idx_sessions_created_at;
DROP INDEX IF EXISTS idx_sessions_duration;
DROP INDEX IF EXISTS idx_sessions_client_ip;
DROP INDEX IF EXISTS idx_sessions_status;
DROP INDEX IF EXISTS idx_sessions_method_path;
DROP INDEX IF EXISTS idx_sessions_timestamp;

DROP TABLE IF EXISTS proxy_sessions;