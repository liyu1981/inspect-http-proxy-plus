package core

import (
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// MaxSessionRowsReaper manages the background deletion of old sessions
type MaxSessionRowsReaper struct {
	db      *gorm.DB
	publish func(topic string, v any)
}

// NewMaxSessionRowsReaper creates a new MaxSessionRowsReaper instance
func NewMaxSessionRowsReaper(db *gorm.DB, publish func(topic string, v any)) *MaxSessionRowsReaper {
	return &MaxSessionRowsReaper{
		db:      db,
		publish: publish,
	}
}

// Start runs the reaper loop
func (r *MaxSessionRowsReaper) Start(interval time.Duration) {
	ticker := time.NewTicker(interval)
	
	// Run once immediately on startup
	r.reap()

	go func() {
		for range ticker.C {
			r.reap()
		}
	}()
}

func (r *MaxSessionRowsReaper) reap() {
	sysConfig := GlobalVar.GetSysConfig()
	if sysConfig == nil || sysConfig.MaxSessionsRetain <= 0 {
		return
	}

	maxRetain := sysConfig.MaxSessionsRetain

	// 1. Count all sessions
	var count int64
	err := r.db.Model(&ProxySessionRow{}).Count(&count).Error
	if err != nil {
		log.Error().Err(err).Msg("MaxSessionRowsReaper: failed to count sessions")
		return
	}

	if count <= int64(maxRetain) {
		return
	}

	overLimit := count - int64(maxRetain)
	log.Info().Int64("count", count).Int("limit", maxRetain).Int64("over", overLimit).Msg("MaxSessionRowsReaper: cleaning up old sessions")

	// 2. Identify oldest IDs to delete
	var idsToDelete []string
	err = r.db.Model(&ProxySessionRow{}).
		Select("id").
		Order("timestamp ASC").
		Limit(int(overLimit)).
		Find(&idsToDelete).Error
	if err != nil {
		log.Error().Err(err).Msg("MaxSessionRowsReaper: failed to identify sessions to delete")
		return
	}

	if len(idsToDelete) == 0 {
		return
	}

	// 3. Delete sessions
	err = r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id IN ?", idsToDelete).Delete(&ProxySessionRow{}).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		log.Error().Err(err).Msg("MaxSessionRowsReaper: failed to delete sessions")
		return
	}

	log.Info().Int("deleted", len(idsToDelete)).Msg("MaxSessionRowsReaper: cleanup complete")

	// 4. Notify via WebSocket
	if r.publish != nil {
		r.publish("sessions", map[string]any{
			"type": "delete_session",
			"ids":  idsToDelete,
		})
	}
}
