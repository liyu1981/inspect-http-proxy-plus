package core

import (
	"net"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"
)

// copyHeaders performs a deep copy of headers from src to dst
func copyHeaders(src, dst http.Header) {
	for k, vv := range src {
		dst[k] = append([]string(nil), vv...)
	}
}

// isPrintableContentType checks if a MIME type is likely to contain printable text
func isPrintableContentType(contentType string) bool {
	contentType = strings.ToLower(contentType)
	return strings.HasPrefix(contentType, "text/") ||
		strings.Contains(contentType, "json") ||
		strings.Contains(contentType, "xml") ||
		strings.Contains(contentType, "javascript") ||
		strings.Contains(contentType, "yaml") ||
		strings.Contains(contentType, "toml") ||
		contentType == "application/x-www-form-urlencoded"
}

// looksLikePrintableText checks if a byte slice seems to be mostly printable UTF-8 characters
func looksLikePrintableText(data []byte) bool {
	if len(data) == 0 {
		return true
	}
	checkLen := 1024
	if len(data) < checkLen {
		checkLen = len(data)
	}
	sample := data[:checkLen]
	controlChars := 0
	totalChars := 0
	for i := 0; i < len(sample); {
		r, size := utf8.DecodeRune(sample[i:])
		totalChars++
		if r == utf8.RuneError && size == 1 {
			return false
		}
		if !unicode.IsPrint(r) && r != '\n' && r != '\t' && r != '\r' {
			controlChars++
		}
		i += size
	}
	if totalChars == 0 {
		return true
	}
	return float64(controlChars)/float64(totalChars) < 0.1
}

// removeHopByHopHeaders removes headers defined in hopHeaders and any listed in the Connection header
func removeHopByHopHeaders(header http.Header) {
	connectionHeaders := []string{}
	if connHdrs := header.Get("Connection"); connHdrs != "" {
		for _, h := range strings.Split(connHdrs, ",") {
			connectionHeaders = append(connectionHeaders, strings.TrimSpace(http.CanonicalHeaderKey(h)))
		}
	}

	for _, h := range hopHeaders {
		header.Del(h)
	}

	for _, h := range connectionHeaders {
		header.Del(h)
	}
}

// getClientIP extracts the client IP address from request headers or RemoteAddr
func getClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ips := strings.Split(fwd, ",")
		clientIP := strings.TrimSpace(ips[0])
		if clientIP != "" {
			return clientIP
		}
	}
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return ip
	}
	return r.RemoteAddr
}

// singleJoiningSlash ensures exactly one slash joins two path components
func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		if b == "" {
			return a
		}
		if a == "" {
			if strings.HasPrefix(b, "/") {
				return b
			}
			return "/" + b
		}
		return a + "/" + b
	default:
		return a + b
	}
}
