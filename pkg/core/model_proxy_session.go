package core

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	gonanoid "github.com/matoous/go-nanoid/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ============================================================
// GORM Models (Simplified with JSON)
// ============================================================

// ProxySessionRow represents a complete HTTP request/response cycle
type ProxySessionRow struct {
	ID        string    `gorm:"primaryKey;type:text"`
	ConfigID  string    `gorm:"index"` // References ProxyConfig.ID
	CreatedAt time.Time `gorm:"index:idx_sessions_created_at"`

	// Timing information
	Timestamp  time.Time `gorm:"not null;index:idx_sessions_timestamp"`
	DurationMs int64     `gorm:"not null;index:idx_sessions_duration"` // Duration in milliseconds

	// Client information
	ClientAddr string `gorm:"not null"`
	ClientIP   string `gorm:"index:idx_sessions_client_ip"` // Extracted IP without port

	// Request information
	RequestMethod  string `gorm:"not null;index:idx_sessions_method_path"`
	RequestPath    string `gorm:"not null;index:idx_sessions_method_path"`
	RequestQuery   string // Raw query string
	RequestProto   string `gorm:"not null"`
	RequestHost    string `gorm:"not null"`
	RequestURLFull string `gorm:"not null"` // Complete URL for reference

	// Request headers and query params as JSON
	RequestHeaders  datatypes.JSON `gorm:"type:text"` // Stored as JSON
	QueryParameters datatypes.JSON `gorm:"type:text"` // Stored as JSON

	// Request body
	RequestBody            []byte `gorm:"type:blob"`
	RequestBodySize        int    `gorm:"default:0"`
	RequestContentType     string
	RequestContentEncoding string

	// Response information
	ResponseStatusCode int `gorm:"not null;index:idx_sessions_status_code"` // response_status_code = 0 for pending responses
	ResponseStatusText string

	// Response headers as JSON
	ResponseHeaders datatypes.JSON `gorm:"type:text"` // Stored as JSON

	// Response body
	ResponseBody            []byte `gorm:"type:blob"`
	ResponseBodySize        int    `gorm:"default:0"`
	ResponseContentType     string
	ResponseContentEncoding string
}

// BeforeCreate is a GORM hook that runs before inserting into the DB
func (s *ProxySessionRow) BeforeCreate(tx *gorm.DB) (err error) {
	// Generate a 12-character NanoID
	id, err := gonanoid.New(12)
	if err != nil {
		return err
	}
	s.ID = id
	return nil
}

// TableName overrides the default tablename
func (ProxySessionRow) TableName() string {
	return "proxy_sessions"
}

type ProxySessionStub struct {
	ID                 string
	ConfigID           string
	ResponseStatusCode int
	RequestMethod      string
	RequestPath        string
	Timestamp          time.Time
	DurationMs         int64
	Note               string
	Tags               string
}

// ============================================================
// Helper Functions for Data Insertion
// ============================================================

// StartProxySession inserts a new proxy session with initial request data
func StartProxySession(db *gorm.DB, entry *LogEntry) (*ProxySessionRow, error) {
	requestHeadersJSON, err := headerToJSON(entry.RequestHeaders)
	if err != nil {
		return nil, err
	}

	queryParamsJSON, err := queryParamsToJSON(entry.RequestURL.Query())
	if err != nil {
		return nil, err
	}

	session := ProxySessionRow{
		ConfigID:   entry.ConfigID,
		Timestamp:  entry.Timestamp,
		DurationMs: 0,

		ClientAddr: entry.ClientAddr,
		ClientIP:   extractIP(entry.ClientAddr),

		RequestMethod:  entry.RequestMethod,
		RequestPath:    entry.RequestURL.Path,
		RequestQuery:   entry.RequestURL.RawQuery,
		RequestProto:   entry.RequestProto,
		RequestHost:    entry.RequestHost,
		RequestURLFull: entry.RequestURL.String(),

		RequestHeaders:  requestHeadersJSON,
		QueryParameters: queryParamsJSON,

		RequestBody:            entry.RequestBody,
		RequestBodySize:        len(entry.RequestBody),
		RequestContentType:     entry.RequestHeaders.Get("Content-Type"),
		RequestContentEncoding: entry.RequestHeaders.Get("Content-Encoding"),

		ResponseStatusCode: 0, // Pending
	}

	if err := db.Create(&session).Error; err != nil {
		return nil, err
	}

	return &session, nil
}

func FormatSessionStub(session *ProxySessionRow) map[string]any {
	return map[string]any{
		"type": "new_session",
		"session": ProxySessionStub{
			ID:                 session.ID,
			ConfigID:           session.ConfigID,
			ResponseStatusCode: session.ResponseStatusCode,
			RequestMethod:      session.RequestMethod,
			RequestPath:        session.RequestPath,
			Timestamp:          session.Timestamp,
			DurationMs:         session.DurationMs,
		},
	}
}

// FinishProxySession updates an existing proxy session with response data
func FinishProxySession(db *gorm.DB, session *ProxySessionRow, entry *LogEntry) error {
	responseHeadersJSON, err := headerToJSON(entry.ResponseHeaders)
	if err != nil {
		return err
	}

	session.DurationMs = entry.Duration.Milliseconds()
	session.ResponseStatusCode = entry.StatusCode
	session.ResponseStatusText = http.StatusText(entry.StatusCode)
	session.ResponseHeaders = responseHeadersJSON
	session.ResponseBody = entry.ResponseBody
	session.ResponseBodySize = len(entry.ResponseBody)
	session.ResponseContentType = entry.ResponseHeaders.Get("Content-Type")
	session.ResponseContentEncoding = entry.ResponseHeaders.Get("Content-Encoding")

	return db.Save(session).Error
}

// CreateProxySession inserts a new proxy session with all data
func CreateProxySession(db *gorm.DB, entry *LogEntry) (*ProxySessionRow, error) {
	session, err := StartProxySession(db, entry)
	if err != nil {
		return nil, err
	}
	if err := FinishProxySession(db, session, entry); err != nil {
		return nil, err
	}
	return session, nil
}

// ============================================================
// Query Helper Functions (Updated with ConfigID filtering and pagination)
// ============================================================

// GetRecentSessions retrieves the most recent sessions for a specific config
func GetRecentSessions(db *gorm.DB, configID string, limit int, offset int, since time.Time) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	query := db.Where("config_id = ?", configID)

	if !since.IsZero() {
		query = query.Where("timestamp > ?", since)
	}

	query = query.Order("timestamp DESC")

	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}

	err := query.Find(&sessions).Error
	return sessions, err
}

// GetSessionByID retrieves a single session by ID
func GetSessionByID(db *gorm.DB, sessionID string) (*ProxySessionRow, error) {
	var session ProxySessionRow
	err := db.Where("id = ?", sessionID).First(&session).Error
	return &session, err
}

// GetErrorSessions retrieves sessions with error status codes for a specific config
func GetErrorSessions(db *gorm.DB, configID string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	err := db.Where("config_id = ? AND response_status_code >= ?", configID, 400).
		Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// GetSlowSessions retrieves sessions that exceeded duration for a specific config
func GetSlowSessions(db *gorm.DB, configID string, minDurationMs int64, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	err := db.Where("config_id = ? AND duration_ms > ?", configID, minDurationMs).
		Order("duration_ms DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// GetSessionsByPath retrieves sessions for a specific endpoint and config
func GetSessionsByPath(db *gorm.DB, configID string, path string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	err := db.Where("config_id = ? AND request_path = ?", configID, path).
		Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// GetSessionsByMethod retrieves sessions by HTTP method and config
func GetSessionsByMethod(db *gorm.DB, configID string, method string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	err := db.Where("config_id = ? AND request_method = ?", configID, method).
		Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// GetSessionsWithHeader retrieves sessions that have a specific request header for a config
func GetSessionsWithHeader(db *gorm.DB, configID string, headerName string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	// SQLITE json_extract check
	query := "config_id = ? AND json_extract(request_headers, '$.' || ?) IS NOT NULL"
	err := db.Where(query, configID, headerName).
		Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// GetSessionsByHeaderValue retrieves sessions where a header contains specific value for a config
func GetSessionsByHeaderValue(db *gorm.DB, configID string, headerName, value string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	query := "config_id = ? AND json_extract(request_headers, '$.' || ? || '[0]') LIKE ?"
	err := db.Where(query, configID, headerName, "%"+value+"%").
		Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// GetSessionsWithQueryParam retrieves sessions with a specific query parameter for a config
func GetSessionsWithQueryParam(db *gorm.DB, configID string, paramName string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow
	query := "config_id = ? AND json_extract(query_parameters, '$.' || ?) IS NOT NULL"
	err := db.Where(query, configID, paramName).
		Order("timestamp DESC").
		Limit(limit).
		Offset(offset).
		Find(&sessions).Error
	return sessions, err
}

// SearchSessions performs a full-text search using FTS5
func SearchSessions(db *gorm.DB, configID string, searchText string, limit int, offset int) ([]ProxySessionRow, error) {
	var sessions []ProxySessionRow

	// Construct the FTS5 query
	// We join with proxy_sessions_fts and filter by config_id
	// The results are ordered by the FTS rank (relevance) or timestamp?
	// Usually, for a log-like tool, timestamp DESC is preferred, but FTS rank is good for search.
	// Let's use timestamp DESC as primary, or just rely on FTS rank if desired.
	// For now, let's keep it consistent with other queries: timestamp DESC.

	sql := `
		SELECT s.* 
		FROM proxy_sessions s
		JOIN proxy_sessions_fts f ON s.id = f.session_id
		WHERE f.config_id = ? AND proxy_sessions_fts MATCH ?
		ORDER BY s.timestamp DESC
		LIMIT ? OFFSET ?
	`

	err := db.Raw(sql, configID, searchText, limit, offset).Scan(&sessions).Error
	return sessions, err
}

// ============================================================
// Internal Helpers & Stats
// ============================================================

func headerToJSON(headers http.Header) (datatypes.JSON, error) {
	if len(headers) == 0 {
		return datatypes.JSON("{}"), nil
	}
	data, err := json.Marshal(headers)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(data), nil
}

func queryParamsToJSON(params url.Values) (datatypes.JSON, error) {
	if len(params) == 0 {
		return datatypes.JSON("{}"), nil
	}
	data, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(data), nil
}

func extractIP(addr string) string {
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	return addr
}

func CountSessionsByMethod(db *gorm.DB) (map[string]int64, error) {
	type Result struct {
		RequestMethod string
		Count         int64
	}
	var results []Result
	err := db.Model(&ProxySessionRow{}).
		Select("request_method, count(*) as count").
		Group("request_method").
		Find(&results).Error

	if err != nil {
		return nil, err
	}

	counts := make(map[string]int64)
	for _, r := range results {
		counts[r.RequestMethod] = r.Count
	}
	return counts, nil
}

func GetAverageDurationByPath(db *gorm.DB) (map[string]float64, error) {
	type Result struct {
		RequestPath string
		AvgDuration float64
	}
	var results []Result
	err := db.Model(&ProxySessionRow{}).
		Select("request_path, AVG(duration_ms) as avg_duration").
		Group("request_path").
		Order("avg_duration DESC").
		Find(&results).Error

	if err != nil {
		return nil, err
	}

	avgDurations := make(map[string]float64)
	for _, r := range results {
		avgDurations[r.RequestPath] = r.AvgDuration
	}
	return avgDurations, nil
}

func DeleteOldSessions(db *gorm.DB, olderThan time.Duration) (int64, error) {
	cutoffTime := time.Now().Add(-olderThan)
	result := db.Where("timestamp < ?", cutoffTime).Delete(&ProxySessionRow{})
	return result.RowsAffected, result.Error
}

// ============================================================
// Struct Methods for Parsing
// ============================================================

func (s *ProxySessionRow) ParseRequestHeaders() (http.Header, error) {
	var headers http.Header
	if len(s.RequestHeaders) == 0 || string(s.RequestHeaders) == "{}" {
		return http.Header{}, nil
	}
	err := json.Unmarshal(s.RequestHeaders, &headers)
	return headers, err
}

func (s *ProxySessionRow) ParseResponseHeaders() (http.Header, error) {
	var headers http.Header
	if len(s.ResponseHeaders) == 0 || string(s.ResponseHeaders) == "{}" {
		return http.Header{}, nil
	}
	err := json.Unmarshal(s.ResponseHeaders, &headers)
	return headers, err
}

func (s *ProxySessionRow) ParseQueryParameters() (url.Values, error) {
	var params url.Values
	if len(s.QueryParameters) == 0 || string(s.QueryParameters) == "{}" {
		return url.Values{}, nil
	}
	err := json.Unmarshal(s.QueryParameters, &params)
	return params, err
}
