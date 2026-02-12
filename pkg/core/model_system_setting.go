package core

import (
	"time"

	"gorm.io/gorm"
)

// SystemSettingRow represents a persistent system configuration setting
type SystemSettingRow struct {
	Key       string    `gorm:"primaryKey"`
	Value     string    `gorm:"not null"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// TableName overrides the default tablename
func (SystemSettingRow) TableName() string {
	return "system_settings"
}

// GetSystemSetting retrieves a setting from the database, or returns the default value if not found
func GetSystemSetting(db *gorm.DB, key string, defaultVal string) string {
	var setting SystemSettingRow
	if err := db.Where("key = ?", key).First(&setting).Error; err != nil {
		return defaultVal
	}
	return setting.Value
}

// SetSystemSetting persists a setting to the database
func SetSystemSetting(db *gorm.DB, key string, value string) error {
	setting := SystemSettingRow{
		Key:   key,
		Value: value,
	}
	return db.Save(&setting).Error
}

// GetAllSystemSettings retrieves all settings as a map
func GetAllSystemSettings(db *gorm.DB) (map[string]string, error) {
	var settings []SystemSettingRow
	if err := db.Find(&settings).Error; err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	return result, nil
}
