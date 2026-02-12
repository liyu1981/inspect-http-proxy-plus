-- ============================================================
-- File: migrations/000004_add_proxy_bookmarks.up.sql
-- Description: Add proxy_bookmarks table and FTS for saved sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS proxy_bookmarks (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- User metadata
    note TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',

    -- Copied from proxy_sessions
    timestamp DATETIME NOT NULL,
    duration_ms INTEGER NOT NULL,
    client_addr TEXT NOT NULL,
    client_ip TEXT,
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_query TEXT,
    request_proto TEXT NOT NULL,
    request_host TEXT NOT NULL,
    request_url_full TEXT NOT NULL,
    request_headers TEXT,
    query_parameters TEXT,
    request_body BLOB,
    request_body_size INTEGER DEFAULT 0,
    request_content_type TEXT,
    request_content_encoding TEXT,
    response_status_code INTEGER NOT NULL,
    response_status_text TEXT,
    response_headers TEXT,
    response_body BLOB,
    response_body_size INTEGER DEFAULT 0,
    response_content_type TEXT,
    response_content_encoding TEXT,
    config_id TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bookmarks_timestamp ON proxy_bookmarks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bookmarks_config_id ON proxy_bookmarks(config_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_method_path ON proxy_bookmarks(request_method, request_path);
CREATE INDEX IF NOT EXISTS idx_bookmarks_status ON proxy_bookmarks(response_status_code);
CREATE INDEX IF NOT EXISTS idx_bookmarks_session_id ON proxy_bookmarks(session_id);

-- Create FTS5 virtual table for bookmarks
CREATE VIRTUAL TABLE IF NOT EXISTS proxy_bookmarks_fts USING fts5(
    bookmark_id UNINDEXED,
    config_id UNINDEXED,
    note,
    tags,
    request_method,
    request_path,
    request_query,
    request_host,
    request_url_full,
    request_headers,
    request_body,
    response_status_text,
    response_headers,
    response_body,
    tokenize="trigram"
);

-- Triggers to keep FTS index in sync for bookmarks
CREATE TRIGGER IF NOT EXISTS proxy_bookmarks_ai AFTER INSERT ON proxy_bookmarks BEGIN
    INSERT INTO proxy_bookmarks_fts (
        bookmark_id, config_id, note, tags, request_method, request_path, request_query,
        request_host, request_url_full, request_headers, request_body,
        response_status_text, response_headers, response_body
    ) VALUES (
        new.id, new.config_id, new.note, new.tags, new.request_method, new.request_path, new.request_query,
        new.request_host, new.request_url_full, new.request_headers,
        CASE 
            WHEN new.request_content_type LIKE '%text%' 
              OR new.request_content_type LIKE '%json%' 
              OR new.request_content_type LIKE '%xml%' 
              OR new.request_content_type LIKE '%javascript%' 
              OR new.request_content_type LIKE '%x-www-form-urlencoded%'
            THEN CAST(new.request_body AS TEXT) 
            ELSE NULL 
        END,
        new.response_status_text, new.response_headers,
        CASE 
            WHEN new.response_content_type LIKE '%text%' 
              OR new.response_content_type LIKE '%json%' 
              OR new.response_content_type LIKE '%xml%' 
              OR new.response_content_type LIKE '%javascript%' 
            THEN CAST(new.response_body AS TEXT) 
            ELSE NULL 
        END
    );
END;

CREATE TRIGGER IF NOT EXISTS proxy_bookmarks_au AFTER UPDATE ON proxy_bookmarks BEGIN
    UPDATE proxy_bookmarks_fts SET
        note = new.note,
        tags = new.tags
    WHERE bookmark_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS proxy_bookmarks_ad AFTER DELETE ON proxy_bookmarks BEGIN
    DELETE FROM proxy_bookmarks_fts WHERE bookmark_id = old.id;
END;
