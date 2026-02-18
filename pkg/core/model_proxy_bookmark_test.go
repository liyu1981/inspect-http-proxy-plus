package core

import (
	"net/http"
	"net/url"
	"testing"
	"time"
)

func TestCreateBookmark(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-bookmark-test"

	// Create a session
	u, _ := url.Parse("http://example.com/api")
	entry := &LogEntry{
		ConfigID:      configID,
		Timestamp:     time.Now(),
		ClientAddr:    "127.0.0.1",
		RequestMethod: "GET",
		RequestURL:    u,
		RequestProto:  "HTTP/1.1",
		RequestHost:   "example.com",
		RequestHeaders: http.Header{},
	}
	session, err := CreateProxySession(db, entry)
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Create bookmark
	bookmark, err := CreateBookmark(db, session.ID)
	if err != nil {
		t.Fatalf("CreateBookmark failed: %v", err)
	}

	if bookmark.SessionID != session.ID {
		t.Errorf("Expected session ID %s, got %s", session.ID, bookmark.SessionID)
	}
	if bookmark.RequestPath != "/api" {
		t.Errorf("Expected path '/api', got %s", bookmark.RequestPath)
	}

	// Check IsSessionBookmarked
	isBookmarked, bookmarkID, err := IsSessionBookmarked(db, session.ID)
	if err != nil {
		t.Fatalf("IsSessionBookmarked failed: %v", err)
	}
	if !isBookmarked || bookmarkID != bookmark.ID {
		t.Error("Expected session to be bookmarked")
	}
}

func TestUpdateBookmarkMetadata(t *testing.T) {
	db := setupTestDB(t)
	
	// Pre-create bookmark with dummy session
	session, _ := CreateProxySession(db, &LogEntry{RequestURL: &url.URL{Path: "/foo"}})
	bookmark, _ := CreateBookmark(db, session.ID)

	updated, err := UpdateBookmarkMetadata(db, bookmark.ID, "Note text", "tag1,tag2")
	if err != nil {
		t.Fatalf("UpdateBookmarkMetadata failed: %v", err)
	}

	if updated.Note != "Note text" || updated.Tags != "tag1,tag2" {
		t.Errorf("Expected Note text and tag1,tag2, got %s and %s", updated.Note, updated.Tags)
	}
}

func TestDeleteBookmark(t *testing.T) {
	db := setupTestDB(t)
	
	session, _ := CreateProxySession(db, &LogEntry{RequestURL: &url.URL{Path: "/foo"}})
	bookmark, _ := CreateBookmark(db, session.ID)

	err := DeleteBookmark(db, bookmark.ID)
	if err != nil {
		t.Fatalf("DeleteBookmark failed: %v", err)
	}

	found, err := GetBookmark(db, bookmark.ID)
	if err == nil {
		t.Errorf("Expected error for deleted bookmark, got %v", found)
	}
}

func TestGetBookmarks(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-get-bookmarks"

	// Create two bookmarks for different paths
	for _, path := range []string{"/apple", "/banana"} {
		session, _ := CreateProxySession(db, &LogEntry{
			ConfigID:   configID,
			RequestURL: &url.URL{Path: path},
		})
		_, err := CreateBookmark(db, session.ID)
		if err != nil {
			t.Fatalf("Failed to create bookmark for %s: %v", path, err)
		}
	}

	// Get bookmarks
	bookmarks, total, err := GetBookmarks(db, configID, "", 10, 0)
	if err != nil {
		t.Fatalf("GetBookmarks failed: %v", err)
	}

	if total != 2 {
		t.Errorf("Expected 2 bookmarks, got %d", total)
	}
	if len(bookmarks) != 2 {
		t.Errorf("Expected 2 bookmarks in list, got %d", len(bookmarks))
	}
}

func TestGetBookmarks_Search(t *testing.T) {
	db := setupTestDB(t)
	configID := "config-search-bookmarks"

	// Create sessions with specific content and bookmark them
	contents := []string{"orange", "grape"}
	for _, content := range contents {
		session, _ := CreateProxySession(db, &LogEntry{
			ConfigID:   configID,
			RequestURL: &url.URL{Path: "/" + content},
			RequestBody: []byte("body " + content),
		})
		_, err := CreateBookmark(db, session.ID)
		if err != nil {
			t.Fatalf("Failed to create bookmark for %s: %v", content, err)
		}
	}

	// Search for "orange"
	results, total, err := GetBookmarks(db, configID, "orange", 10, 0)
	if err != nil {
		t.Fatalf("GetBookmarks search failed: %v", err)
	}

	if total != 1 {
		t.Fatalf("Expected 1 result for 'orange', got %d. Total: %d", total, total)
	}
	if results[0].RequestPath != "/orange" {
		t.Errorf("Expected path '/orange', got '%s'", results[0].RequestPath)
	}
}
