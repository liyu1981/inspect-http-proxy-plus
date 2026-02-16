-- ============================================================
-- File: migrations/000001_initial_schema.up.sql
-- Description: Initial schema for HTTP proxy logging (simplified with JSON)
-- ============================================================

-- Main sessions table with JSON columns for headers and query params
CREATE TABLE IF NOT EXISTS proxy_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Timing information
    timestamp DATETIME NOT NULL,
    duration_ms INTEGER NOT NULL,
    
    -- Client information
    client_addr TEXT NOT NULL,
    client_ip TEXT,
    
    -- Request information
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_query TEXT,
    request_proto TEXT NOT NULL,
    request_host TEXT NOT NULL,
    request_url_full TEXT NOT NULL,
    
    -- Request headers as JSON
    request_headers TEXT, -- JSON format: {"Content-Type": ["application/json"], "User-Agent": ["..."]}
    
    -- Query parameters as JSON
    query_parameters TEXT, -- JSON format: {"page": ["1"], "limit": ["10"]}
    
    -- Request body
    request_body BLOB,
    request_body_size INTEGER DEFAULT 0,
    request_content_type TEXT,
    request_content_encoding TEXT,
    
    -- Response information
    response_status_code INTEGER NOT NULL, -- response_status_code = 0 for pending responses
    response_status_text TEXT,
    
    -- Response headers as JSON
    response_headers TEXT, -- JSON format: {"Content-Type": ["application/json"], "Cache-Control": ["no-cache"]}
    
    -- Response body
    response_body BLOB,
    response_body_size INTEGER DEFAULT 0,
    response_content_type TEXT,
    response_content_encoding TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON proxy_sessions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_method_path ON proxy_sessions(request_method, request_path);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON proxy_sessions(response_status_code);
CREATE INDEX IF NOT EXISTS idx_sessions_client_ip ON proxy_sessions(client_ip);
CREATE INDEX IF NOT EXISTS idx_sessions_duration ON proxy_sessions(duration_ms DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON proxy_sessions(created_at DESC);

-- ============================================================
-- USAGE NOTES
-- ============================================================

/*
JSON FORMAT EXAMPLES:

1. Headers (http.Header type):
{
  "Content-Type": ["application/json"],
  "User-Agent": ["Mozilla/5.0..."],
  "Accept-Encoding": ["gzip", "deflate", "br"]
}

2. Query Parameters (url.Values type):
{
  "page": ["1"],
  "limit": ["10"],
  "filter": ["active", "pending"]
}

QUERYING JSON IN SQLITE:

-- Find sessions with specific header:
SELECT * FROM proxy_sessions 
WHERE json_extract(request_headers, '$.User-Agent') IS NOT NULL;

-- Find sessions with specific query param:
SELECT * FROM proxy_sessions 
WHERE json_extract(query_parameters, '$.page') IS NOT NULL;

-- Extract header value:
SELECT 
    id, 
    request_path,
    json_extract(request_headers, '$.Content-Type[0]') as content_type
FROM proxy_sessions;

-- Find all POST requests with JSON content type:
SELECT * FROM proxy_sessions 
WHERE request_method = 'POST' 
AND json_extract(request_headers, '$.Content-Type[0]') LIKE '%application/json%';

BENEFITS OF JSON APPROACH:

1. Simpler schema - single table instead of 4 tables
2. No JOIN queries needed
3. Easier to query specific headers/params with json_extract()
4. Better performance for small-medium datasets
5. Atomic inserts (no multi-table transaction complexity)
6. Easier backup/restore (single table)

TRADE-OFFS:

1. Slightly larger storage (JSON overhead)
2. Can't index individual headers efficiently
3. Less normalized (acceptable for logging use case)
4. JSON queries are slower than indexed columns (but still fast enough)

For a logging/debugging proxy, the simplified schema is recommended.
*/