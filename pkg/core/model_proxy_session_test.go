package core

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"gorm.io/gorm"
)

// setupTestDB initializes an in-memory database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := InitDatabase(":memory:")
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	return db
}

func TestStartProxySession(t *testing.T) {
	db := setupTestDB(t)

	u, _ := url.Parse("http://example.com/foo?bar=baz")
	entry := &LogEntry{
		ConfigID:      "test-config-1",
		Timestamp:     time.Now(),
		ClientAddr:    "127.0.0.1:12345",
		RequestMethod: "GET",
		RequestURL:    u,
		RequestProto:  "HTTP/1.1",
		RequestHost:   "example.com",
		RequestHeaders: http.Header{
			"Content-Type": []string{"application/json"},
		},
		RequestBody: []byte(`{"key": "value"}`),
	}

	session, err := StartProxySession(db, entry)
	if err != nil {
		t.Fatalf("StartProxySession failed: %v", err)
	}

	if session.ID == "" {
		t.Error("Expected session ID to be generated")
	}
	if session.ConfigID != "test-config-1" {
		t.Errorf("Expected ConfigID 'test-config-1', got '%s'", session.ConfigID)
	}
	if session.ResponseStatusCode != 0 {
		t.Errorf("Expected initial status code 0, got %d", session.ResponseStatusCode)
	}
}

func TestFinishProxySession(t *testing.T) {
	db := setupTestDB(t)

	u, _ := url.Parse("http://example.com/foo")
	entry := &LogEntry{
		ConfigID:       "test-config-1",
		Timestamp:      time.Now(),
		ClientAddr:     "127.0.0.1:54321",
		RequestMethod:  "POST",
		RequestURL:     u,
		RequestProto:   "HTTP/1.1",
		RequestHost:    "example.com",
		RequestHeaders: http.Header{},
	}

	session, err := StartProxySession(db, entry)
	if err != nil {
		t.Fatalf("StartProxySession failed: %v", err)
	}

	// Simulate response
	entry.StatusCode = 201
	entry.ResponseHeaders = http.Header{"Server": []string{"TestServer"}}
	entry.ResponseBody = []byte("Created")
	entry.Duration = 100 * time.Millisecond

	err = FinishProxySession(db, session, entry)
	if err != nil {
		t.Fatalf("FinishProxySession failed: %v", err)
	}

	// Reload session from DB to verify
	var updatedSession ProxySessionRow
	if err := db.First(&updatedSession, "id = ?", session.ID).Error; err != nil {
		t.Fatalf("Failed to find session: %v", err)
	}

	if updatedSession.ResponseStatusCode != 201 {
		t.Errorf("Expected status code 201, got %d", updatedSession.ResponseStatusCode)
	}
	if updatedSession.DurationMs != 100 {
		t.Errorf("Expected duration 100ms, got %d", updatedSession.DurationMs)
	}
}

func TestGetRecentSessions(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-recent"

	// Create 3 sessions
	for i := 0; i < 3; i++ {
		u, _ := url.Parse("http://example.com")
		entry := &LogEntry{
			ConfigID:      configID,
			Timestamp:     time.Now().Add(time.Duration(i) * time.Minute),
			ClientAddr:    "127.0.0.1",
			RequestMethod: "GET",
			RequestURL:    u,
			RequestProto:  "HTTP/1.1",
			RequestHost:   "example.com",
		}
		_, err := CreateProxySession(db, entry)
		if err != nil {
			t.Fatalf("Failed to create session %d: %v", i, err)
		}
	}

	sessions, err := GetRecentSessions(db, configID, 10, 0, time.Time{})
	if err != nil {
		t.Fatalf("GetRecentSessions failed: %v", err)
	}

	if len(sessions) != 3 {
		t.Errorf("Expected 3 sessions, got %d", len(sessions))
	}
}

func TestSearchSessions(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-search"

	// Create sessions with specific content
	contents := []string{"apple", "banana", "cherry"}
	for _, content := range contents {
		u, _ := url.Parse("http://example.com/" + content)
		entry := &LogEntry{
			ConfigID:      configID,
			Timestamp:     time.Now(),
			ClientAddr:    "127.0.0.1",
			RequestMethod: "GET",
			RequestURL:    u,
			RequestProto:  "HTTP/1.1",
			RequestHost:   "example.com",
			RequestBody:   []byte("body content " + content),
		}
		_, err := CreateProxySession(db, entry)
		if err != nil {
			t.Fatalf("Failed to create session for %s: %v", content, err)
		}
	}

	// Search for "banana"
	// FTS5 uses specific syntax, depending on how proxy_sessions_fts is implemented
	// Assuming it indexes request_body
	results, err := SearchSessions(db, configID, "banana", 10, 0)
	if err != nil {
		t.Fatalf("SearchSessions failed: %v", err)
	}

	if len(results) != 1 {
		// If FTS is not working or not enabled, this might return 0
		t.Fatalf("Expected 1 result for 'banana', got %d. Make sure --tags fts5 is used.", len(results))
	}
	if results[0].RequestURLFull != "http://example.com/banana" {
		t.Errorf("Expected URL 'http://example.com/banana', got '%s'", results[0].RequestURLFull)
	}
}
