package core

import (
	"net/url"
	"testing"
	"time"
)

func TestReaper(t *testing.T) {
	db := setupTestDB(t)

	// Set GlobalVar sysConfig with max retain limit
	sys := &SysConfig{MaxSessionsRetain: 2}
	GlobalVar.SetSysConfig(sys)

	// Create sessions with different timestamps to ensure predictable order
	u, _ := url.Parse("http://example.com")
	now := time.Now()
	for i := 0; i < 4; i++ {
		entry := &LogEntry{
			ConfigID:      "test-reaper",
			Timestamp:     now.Add(time.Duration(i) * time.Second),
			RequestMethod: "GET",
			RequestURL:    u,
		}
		_, err := CreateProxySession(db, entry)
		if err != nil {
			t.Fatalf("Failed to create session %d: %v", i, err)
		}
	}

	// Verify count is 4 initially
	var count int64
	db.Model(&ProxySessionRow{}).Count(&count)
	if count != 4 {
		t.Errorf("Expected 4 sessions, got %d", count)
	}

	// Run reaper manually
	reaper := NewMaxSessionRowsReaper(db, nil)
	reaper.reap()

	// Verify count is now 2
	db.Model(&ProxySessionRow{}).Count(&count)
	if count != 2 {
		t.Errorf("Expected 2 sessions after reaping, got %d", count)
	}

	// Verify that the oldest ones were deleted
	var sessions []ProxySessionRow
	db.Order("timestamp ASC").Find(&sessions)
	if len(sessions) > 0 {
		// Oldest should have timestamp now + 2s and now + 3s
		if sessions[0].Timestamp.Before(now.Add(1 * time.Second)) {
			t.Errorf("Oldest remaining session should not be the first one, got timestamp %v", sessions[0].Timestamp)
		}
	}
}
