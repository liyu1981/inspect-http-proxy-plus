package web

import (
	"embed"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/liyu1981/inspect-http-proxy/pkg/core"
	"github.com/liyu1981/inspect-http-proxy/pkg/web/api"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

//go:embed all:ui/out
var frontendFS embed.FS

// UIServer represents the UI server
type UIServer struct {
	db          *gorm.DB
	listenAddr  string
	server      *http.Server
	staticFS    fs.FS
	SessionChan chan *core.ProxySessionRow
	ApiHandler  *api.ApiHandler
}

// Config holds the UI server configuration
type Config struct {
	DB         *gorm.DB
	ListenAddr string
}

// NewUIServer creates a new UI server instance
func NewUIServer(config *Config) *UIServer {
	// Sub-folder "ui/out" from the embedded FS
	staticFS, err := fs.Sub(frontendFS, "ui/out")
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to get sub-filesystem for frontend")
	}

	sessionChan := make(chan *core.ProxySessionRow, 100)
	apiHandler := api.NewHandler(&api.ApiConfig{
		DB: config.DB,
	})

	// Start a goroutine to forward sessions from channel to apiHandler
	go func() {
		for session := range sessionChan {
			apiHandler.Publish("sessions", session)
		}
	}()

	return &UIServer{
		db:          config.DB,
		listenAddr:  config.ListenAddr,
		staticFS:    staticFS,
		SessionChan: sessionChan,
		ApiHandler:  apiHandler,
	}
}

func getFSAllFilenames(efs fs.FS) (files []string, err error) {
	if err := fs.WalkDir(efs, ".", func(path string, d fs.DirEntry, err error) error {
		if d.IsDir() {
			return nil
		}

		files = append(files, path)

		return nil
	}); err != nil {
		return nil, err
	}

	return files, nil
}

// SetupRoutes configures all UI routes
func (s *UIServer) SetupRoutes() http.Handler {
	mux := http.NewServeMux()

	// Install API routes FIRST (so they take precedence)
	s.ApiHandler.RegisterRoutes(mux)

	// Debug: Print embedded files (only in debug mode)
	if os.Getenv("DEBUG") != "" {
		files, err := getFSAllFilenames(s.staticFS)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to list embedded files")
		} else {
			prettyJSON, err := json.MarshalIndent(files, "", "  ")
			if err != nil {
				log.Warn().Err(err).Msg("Failed to marshal file list")
			} else {
				log.Debug().RawJSON("files", prettyJSON).Msg("Embedded files")
			}
		}
	}

	// Create custom file server handler for SPA routing
	fileServer := http.FileServer(http.FS(s.staticFS))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// 1. If requesting root, just serve it (will find index.html)
		if path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// 2. Check if the file exists exactly as requested
		_, err := s.staticFS.Open(strings.TrimPrefix(path, "/"))
		if err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		// 3. If not found, try appending ".html" (e.g., /inspect -> /inspect.html)
		htmlPath := strings.TrimPrefix(path, "/") + ".html"
		if _, err := s.staticFS.Open(htmlPath); err == nil {
			r.URL.Path += ".html"
			fileServer.ServeHTTP(w, r)
			return
		}

		// 4. Fallback: Serve the standard file server (handles 404s)
		fileServer.ServeHTTP(w, r)
	})

	// Wrap with middleware
	return corsMiddleware(loggingMiddleware(mux))
}

// Start starts the UI server
func (s *UIServer) Start() error {
	s.server = &http.Server{
		Addr:         s.listenAddr,
		Handler:      s.SetupRoutes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Info().Str("address", s.listenAddr).Msg("UI server listening")
	log.Info().Msg("Serving embedded frontend")
	log.Info().Str("url", "http://localhost"+s.listenAddr+"/").Msg("Try accessing UI")

	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the UI server
func (s *UIServer) Shutdown() error {
	if s.server != nil {
		return s.server.Close()
	}
	return nil
}

// Middleware

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		// Don't log static assets to reduce noise
		if !strings.HasPrefix(r.URL.Path, "/_next") && !strings.HasPrefix(r.URL.Path, "/static") {
			log.Debug().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Dur("duration", time.Since(start)).
				Msg("Web request")
		}
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
