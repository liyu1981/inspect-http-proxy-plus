package core

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

// LogEntry represents a complete HTTP request/response cycle
type LogEntry struct {
	ConfigID        string
	Timestamp       time.Time
	ClientAddr      string
	RequestMethod   string
	RequestURL      *url.URL
	RequestProto    string
	RequestHost     string
	RequestHeaders  http.Header
	RequestBody     []byte
	StatusCode      int
	ResponseHeaders http.Header
	ResponseBody    []byte
	Duration        time.Duration
}

// ProxyConfig holds the configuration for the proxy handler
type ProxyConfig struct {
	ConfigID        string
	ListenAddr      string
	TargetURL       *url.URL
	TruncateLogBody bool
	DB              *gorm.DB
	HeadersToOmit   map[string]struct{}
	WsPublishFn     func(topic string, v any)
}

// NewProxyHandler creates a new HTTP handler for proxying requests
func NewProxyHandler(config *ProxyConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("\n%s[Config: %s | Listen: %s | Target: %s]%s\n",
			ColorBold+ColorGray, config.ConfigID, config.ListenAddr, config.TargetURL.String(), ColorReset)

		startTime := time.Now()
		entry := &LogEntry{
			ConfigID:       config.ConfigID,
			Timestamp:      startTime,
			ClientAddr:     r.RemoteAddr,
			RequestMethod:  r.Method,
			RequestURL:     r.URL,
			RequestProto:   r.Proto,
			RequestHost:    r.Host,
			RequestHeaders: r.Header.Clone(),
		}

		// --- Read Request Body ---
		var requestBodyBytes []byte
		if r.Body != nil && r.Body != http.NoBody {
			maxBytes := int64(10 * 1024 * 1024)
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			var err error
			requestBodyBytes, err = io.ReadAll(r.Body)
			if err != nil {
				if err.Error() == "http: request body too large" {
					log.Error().Err(err).Msg("Request body exceeds limit")
					http.Error(w, "Request Entity Too Large", http.StatusRequestEntityTooLarge)
					return
				} else if err != io.EOF {
					log.Error().Err(err).Msg("Failed reading request body")
					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
					return
				}
			}
			if rc, ok := r.Body.(io.ReadCloser); ok {
				rc.Close()
			}
			r.Body = io.NopCloser(bytes.NewBuffer(requestBodyBytes))
			entry.RequestBody = requestBodyBytes
		} else {
			r.Body = nil
		}

		// --- Print Incoming Request ---
		printIncomingRequest(entry)

		// --- Start Session in DB and Notify ---
		var session *ProxySessionRow
		if config.DB != nil {
			var err error
			// Pass config.ConfigID to link this session to the configuration row
			session, err = StartProxySession(config.DB, entry)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to start session in database")
			} else {
				log.Debug().Str("session_id", session.ID).Str("config_id", session.ConfigID).Msg("Started new proxy session")
				m := FormatSessionStub(session)
				config.WsPublishFn("sessions", m)
			}
		}

		// --- Prepare & Send Forwarded Request ---
		targetReqURL := *config.TargetURL
		targetReqURL.Path = singleJoiningSlash(config.TargetURL.Path, entry.RequestURL.Path)
		targetReqURL.RawQuery = entry.RequestURL.RawQuery

		proxyReq, err := http.NewRequest(entry.RequestMethod, targetReqURL.String(), r.Body)
		if err != nil {
			log.Error().Err(err).Msg("Failed to create new request")
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		copyHeaders(entry.RequestHeaders, proxyReq.Header)
		proxyReq.Host = config.TargetURL.Host
		proxyReq.Header.Set("X-Forwarded-Host", entry.RequestHost)
		proxyReq.Header.Set("X-Forwarded-For", getClientIP(r))
		if r.TLS != nil {
			proxyReq.Header.Set("X-Forwarded-Proto", "https")
		} else {
			proxyReq.Header.Set("X-Forwarded-Proto", "http")
		}

		removeHopByHopHeaders(proxyReq.Header)

		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.DisableCompression = true
		client := &http.Client{Transport: transport}

		// --- Send Request to Target ---
		resp, err := client.Do(proxyReq)
		if err != nil {
			log.Error().Err(err).Str("target_url", config.TargetURL.String()).Msg("Failed to reach target")
			if urlErr, ok := err.(*url.Error); ok {
				if _, ok := urlErr.Err.(*net.OpError); ok {
					http.Error(w, "Bad Gateway", http.StatusBadGateway)
					return
				}
			}
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		// --- Read Response Body ---
		var responseBodyBytes []byte
		if resp.Body != nil {
			responseBodyBytes, err = io.ReadAll(resp.Body)
			if err != nil {
				log.Warn().Err(err).Msg("Error reading full response body")
			}
			entry.ResponseBody = responseBodyBytes
		}

		// --- Log Response Details ---
		entry.StatusCode = resp.StatusCode
		entry.ResponseHeaders = resp.Header.Clone()
		entry.Duration = time.Since(startTime)

		printTargetResponse(entry, resp.Status, config.TruncateLogBody)

		// --- Send Response Back to Client ---
		destHeaders := w.Header()
		copyHeaders(entry.ResponseHeaders, destHeaders)
		removeHopByHopHeaders(destHeaders)

		w.WriteHeader(resp.StatusCode)

		if len(responseBodyBytes) > 0 {
			_, err = w.Write(responseBodyBytes)
			if err != nil {
				log.Warn().Err(err).Msg("Failed writing response body to client")
			}
		}

		// --- Finish Session in DB and Notify (Asynchronously) ---
		if config.DB != nil && session != nil {
			go func(s *ProxySessionRow, e *LogEntry) {
				if err := FinishProxySession(config.DB, s, e); err != nil {
					log.Warn().Err(err).Msg("Failed to finish session in database")
					return
				}
				m := FormatSessionStub(s)
				config.WsPublishFn("sessions", m)
			}(session, entry)
		}

		fmt.Printf("%s=======================%s\n", ColorBold+ColorGray, ColorReset)
	}
}

// SetupProxyConfig creates a ProxyConfig from viper settings
func SetupProxyConfig(
	configID string,
	listenAddr string,
	targetURL *url.URL,
	db *gorm.DB,
	truncateLogBody bool,
	wsPublishFn func(topic string, v any),
) *ProxyConfig {
	// Normalize headers to omit
	normalizedHeadersToOmit := make(map[string]struct{})
	for header := range HeadersToOmit {
		normalizedHeadersToOmit[strings.ToLower(header)] = struct{}{}
	}

	return &ProxyConfig{
		ConfigID:        configID,
		ListenAddr:      listenAddr,
		TargetURL:       targetURL,
		TruncateLogBody: viper.GetBool("truncate-log-body"),
		DB:              db,
		HeadersToOmit:   normalizedHeadersToOmit,
		WsPublishFn:     wsPublishFn,
	}
}

// StartProxyServer creates and starts a proxy server from a SysConfigProxyEntry
func StartProxyServer(
	index int,
	proxyEntry SysConfigProxyEntry,
	db *gorm.DB,
	wsPublishFn func(topic string, v any),
) error {
	// Validate target URL
	targetURLParsed, err := url.Parse(proxyEntry.Target)
	if err != nil || targetURLParsed.Scheme == "" {
		return fmt.Errorf("invalid target URL: %s", proxyEntry.Target)
	}

	// Validate listen address
	if proxyEntry.Listen == "" {
		return fmt.Errorf("missing 'listen' address")
	}

	// Register configuration with database
	configID, err := RegisterConfiguration(db, proxyEntry)
	if err != nil {
		return fmt.Errorf("failed to register configuration: %w", err)
	}

	// Add config ID to GlobalVarStore
	if configID != "" {
		GlobalVar.ConfigAdd(configID)
	}

	// Setup proxy configuration
	proxyConfig := SetupProxyConfig(
		configID,
		proxyEntry.Listen,
		targetURLParsed,
		db,
		proxyEntry.TruncateLogBody,
		wsPublishFn,
	)

	// Store ProxyConfig in GlobalVarStore's id_to_config map
	if configID != "" {
		GlobalVar.AddProxyConfig(configID, proxyConfig)
	}

	fmt.Printf("%sProxy server:%s  %s%s%s -> %s%s%s (ID: %s)\n",
		ColorCyan, ColorReset,
		ColorBold, proxyEntry.Listen, ColorReset,
		ColorBold, proxyEntry.Target, ColorReset,
		configID,
	)

	// Create HTTP server for this proxy entry
	proxyServer := &http.Server{
		Addr:         proxyEntry.Listen,
		Handler:      http.HandlerFunc(NewProxyHandler(proxyConfig)),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Store ProxyServer in GlobalVarStore's id_to_proxyserver map
	if configID != "" {
		GlobalVar.AddProxyServer(configID, proxyServer)
	}

	log.Info().
		Int("index", index).
		Str("listen", proxyEntry.Listen).
		Str("target", proxyEntry.Target).
		Str("config_id", configID).
		Bool("truncate_log_body", proxyEntry.TruncateLogBody).
		Msg("Proxy server active")

	// Start proxy server in its own goroutine
	go func(srv *http.Server, idx int) {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error().
				Int("index", idx).
				Err(err).
				Msg("Proxy server failed")
		}
	}(proxyServer, index)

	return nil
}

// StopProxyServer stops a running proxy server by config ID
func StopProxyServer(configID string) error {
	// Retrieve the server from GlobalVarStore
	proxyServer := GlobalVar.GetProxyServer(configID)
	if proxyServer == nil {
		log.Warn().
			Str("config_id", configID).
			Msg("Proxy server not found in GlobalVarStore")
		return nil
	}

	log.Info().
		Str("config_id", configID).
		Str("addr", proxyServer.Addr).
		Msg("Stopping proxy server")

	// Create a context with timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Attempt graceful shutdown first
	if err := proxyServer.Shutdown(ctx); err != nil {
		// If graceful shutdown fails, force close
		log.Warn().
			Err(err).
			Str("config_id", configID).
			Msg("Graceful shutdown failed, forcing close")

		if closeErr := proxyServer.Close(); closeErr != nil {
			log.Error().
				Err(closeErr).
				Str("config_id", configID).
				Msg("Failed to force close proxy server")
			return closeErr
		}
	}

	// Remove the server from GlobalVarStore
	GlobalVar.RemoveProxyServer(configID)

	log.Info().
		Str("config_id", configID).
		Msg("Proxy server stopped successfully")

	return nil
}
