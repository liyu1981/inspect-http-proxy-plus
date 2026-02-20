package core

import (
	"time"

	gonanoid "github.com/matoous/go-nanoid/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ProxyBookmark represents a saved session bookmark
type ProxyBookmark struct {
	ID        string    `gorm:"primaryKey;type:text"`
	SessionID string    `gorm:"index"`
	CreatedAt time.Time `gorm:"autoCreateTime"`

	Note string
	Tags string

	// Full copy of ProxySessionRow fields
	Timestamp               time.Time `gorm:"index"`
	DurationMs              int64
	ClientAddr              string
	ClientIP                string
	RequestMethod           string `gorm:"index"`
	RequestPath             string `gorm:"index"`
	RequestQuery            string
	RequestProto            string
	RequestHost             string
	RequestURLFull          string
	RequestHeaders          datatypes.JSON `gorm:"type:text"`
	QueryParameters         datatypes.JSON `gorm:"type:text"`
	RequestBody             []byte         `gorm:"type:blob"`
	RequestBodySize         int
	RequestContentType      string
	RequestContentEncoding  string
	ResponseStatusCode      int `gorm:"index"`
	ResponseStatusText      string
	ResponseHeaders         datatypes.JSON `gorm:"type:text"`
	ResponseBody            []byte         `gorm:"type:blob"`
	ResponseBodySize        int
	ResponseContentType     string
	ResponseContentEncoding string
	ConfigID                string `gorm:"index"`

	// Full copy of ProxyConfigRow fields (relevant ones)
	ConfigSourcePath string
	ConfigJSON       string
}

// BeforeCreate is a GORM hook to generate bookmark ID
func (b *ProxyBookmark) BeforeCreate(tx *gorm.DB) (err error) {
	if b.ID == "" {
		id, err := gonanoid.New(12)
		if err != nil {
			return err
		}
		b.ID = id
	}
	return nil
}

// TableName overrides default table name
func (ProxyBookmark) TableName() string {
	return "proxy_bookmarks"
}

// CreateBookmark creates a new bookmark from an existing session
func CreateBookmark(db *gorm.DB, sessionID string) (*ProxyBookmark, error) {
	// 1. Fetch the original session
	var session ProxySessionRow
	if err := db.First(&session, "id = ?", sessionID).Error; err != nil {
		return nil, err
	}

	// 2. Fetch the original config
	var config ProxyConfigRow
	if session.ConfigID != "" {
		if err := db.First(&config, "id = ?", session.ConfigID).Error; err != nil && err != gorm.ErrRecordNotFound {
			return nil, err
		}
	}

	// 3. Create the bookmark object by copying fields
	bookmark := &ProxyBookmark{
		SessionID:               session.ID,
		Timestamp:               session.Timestamp,
		DurationMs:              session.DurationMs,
		ClientAddr:              session.ClientAddr,
		ClientIP:                session.ClientIP,
		RequestMethod:           session.RequestMethod,
		RequestPath:             session.RequestPath,
		RequestQuery:            session.RequestQuery,
		RequestProto:            session.RequestProto,
		RequestHost:             session.RequestHost,
		RequestURLFull:          session.RequestURLFull,
		RequestHeaders:          session.RequestHeaders,
		QueryParameters:         session.QueryParameters,
		RequestBody:             session.RequestBody,
		RequestBodySize:         session.RequestBodySize,
		RequestContentType:      session.RequestContentType,
		RequestContentEncoding:  session.RequestContentEncoding,
		ResponseStatusCode:      session.ResponseStatusCode,
		ResponseStatusText:      session.ResponseStatusText,
		ResponseHeaders:         session.ResponseHeaders,
		ResponseBody:            session.ResponseBody,
		ResponseBodySize:        session.ResponseBodySize,
		ResponseContentType:     session.ResponseContentType,
		ResponseContentEncoding: session.ResponseContentEncoding,
		ConfigID:                session.ConfigID,
		Note:                    "",
		Tags:                    "",
		ConfigSourcePath:        config.SourcePath,
		ConfigJSON:              config.ConfigJSON,
	}

	// 4. Save to database
	if err := db.Create(bookmark).Error; err != nil {
		return nil, err
	}

	return bookmark, nil
}

// GetBookmark retrieves a single bookmark by ID
func GetBookmark(db *gorm.DB, bookmarkID string) (*ProxyBookmark, error) {
	var bookmark ProxyBookmark
	if err := db.First(&bookmark, "id = ?", bookmarkID).Error; err != nil {
		return nil, err
	}
	return &bookmark, nil
}

// UpdateBookmarkMetadata updates the note and tags for a bookmark
func UpdateBookmarkMetadata(db *gorm.DB, bookmarkID string, note string, tags string) (*ProxyBookmark, error) {
	var bookmark ProxyBookmark
	if err := db.First(&bookmark, "id = ?", bookmarkID).Error; err != nil {
		return nil, err
	}

	bookmark.Note = note
	bookmark.Tags = tags

	if err := db.Save(&bookmark).Error; err != nil {
		return nil, err
	}

	return &bookmark, nil
}

// DeleteBookmark deletes a bookmark by ID
func DeleteBookmark(db *gorm.DB, bookmarkID string) error {
	return db.Delete(&ProxyBookmark{}, "id = ?", bookmarkID).Error
}

// IsSessionBookmarked checks if a session has been bookmarked
func IsSessionBookmarked(db *gorm.DB, sessionID string) (bool, string, error) {
	var bookmark ProxyBookmark
	err := db.Select("id").First(&bookmark, "session_id = ?", sessionID).Error
	if err == gorm.ErrRecordNotFound {
		return false, "", nil
	}
	if err != nil {
		return false, "", err
	}
	return true, bookmark.ID, nil
}

// GetBookmarks retrieves bookmarks, optionally filtering by query (FTS)
func GetBookmarks(db *gorm.DB, configID string, query string, limit int, offset int) ([]ProxyBookmark, int64, error) {
	var bookmarks []ProxyBookmark
	var total int64

	tx := db.Model(&ProxyBookmark{})

	if configID != "" {
		tx = tx.Where("config_id = ?", configID)
	}

	if query != "" {
		// Use FTS join
		tx = tx.Where("id IN (SELECT bookmark_id FROM proxy_bookmarks_fts WHERE proxy_bookmarks_fts MATCH ?)", query)
	}

	// Count total before pagination
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Apply pagination and sorting
	// Default sort by created_at desc (newest bookmarks first)
	tx = tx.Order("created_at DESC").Limit(limit).Offset(offset)

	if err := tx.Find(&bookmarks).Error; err != nil {
		return nil, 0, err
	}

	return bookmarks, total, nil
}
