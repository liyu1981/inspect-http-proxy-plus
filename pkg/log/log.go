package log

import (
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/liyu1981/inspect-http-proxy-plus/pkg/core"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
	"gopkg.in/natefinch/lumberjack.v2"
)

const (
	RotateLogMaxSize    = 20
	RoateeLogMaxBackups = 3
)

func ResolveLogSettings() (string, string) {
	level := viper.GetString("log-level")
	dest := viper.GetString("log-dest")

	if dest == "" {
		if core.IsDev() {
			dest = "console"
		} else {
			dest = "default"
		}
	}

	if level == "" {
		if core.IsDev() {
			level = "debug"
		} else {
			level = core.LogLevelDisabled
		}
	}

	return level, dest
}

func getLogFilePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatal().Err(err).Msg("Error getting home directory")
	}
	logDir := filepath.Join(home, ".ihpp", "logs")
	_ = os.MkdirAll(logDir, 0700)
	return filepath.Join(logDir, "ihpp.log")
}

func SetupLogger(logLevel string, logDest string) {
	if logLevel == core.LogLevelDisabled {
		zerolog.SetGlobalLevel(zerolog.Disabled)
		return
	}
	level, err := zerolog.ParseLevel(logLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	// shortcut for dev mode
	if core.IsDev() {
		out := zerolog.ConsoleWriter{
			Out:        os.Stderr,
			TimeFormat: time.RFC3339,
		}
		log.Logger = log.Output(out).With().Caller().Logger()
		return
	}

	// otherwise, setup file based logging with rotating
	var out io.Writer
	switch logDest {
	case "console":
		out = zerolog.ConsoleWriter{
			Out:        os.Stderr,
			TimeFormat: time.RFC3339,
		}
	default:
		logFile := getLogFilePath()
		out = &lumberjack.Logger{
			Filename:   logFile,
			MaxSize:    20,
			MaxBackups: 3,
			LocalTime:  true,
			Compress:   true,
		}
	}

	log.Logger = log.Output(out).With().Caller().Logger()
}
