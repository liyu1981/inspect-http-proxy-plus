package core

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/rs/zerolog/log"
)

// printIncomingRequest prints the incoming request details
func printIncomingRequest(entry *LogEntry) {
	fmt.Printf("\n%s--- Incoming Request ---%s\n", ColorBold+ColorCyan, ColorReset)
	fmt.Printf("%sTime:%s %s\n", ColorGray, ColorReset, entry.Timestamp.Format(time.RFC3339))
	fmt.Printf("%sFrom:%s %s\n", ColorGray, ColorReset, entry.ClientAddr)
	fmt.Printf("%sRequest:%s %s%s%s %s%s%s %s%s%s\n",
		ColorGray, ColorReset,
		ColorBold+ColorGreen, entry.RequestMethod, ColorReset,
		ColorBold+ColorBlue, entry.RequestURL.Path, ColorReset,
		ColorGray, entry.RequestProto, ColorReset,
	)
	fmt.Printf("%sHost:%s %s\n", ColorGray, ColorReset, entry.RequestHost)
	printQueryParams(entry.RequestURL.Query())
	printHeaders("Request Headers:", entry.RequestHeaders)
	printBody("Request Body:", entry.RequestHeaders, entry.RequestBody, false)
	fmt.Printf("%s------------------------%s\n", ColorBold+ColorCyan, ColorReset)
}

// printTargetResponse prints the target response details
func printTargetResponse(entry *LogEntry, status string, truncate bool) {
	statusColor := ColorGreen
	if entry.StatusCode >= 500 {
		statusColor = ColorRed
	} else if entry.StatusCode >= 400 {
		statusColor = ColorYellow
	}

	fmt.Printf("%s--- Target Response ----%s\n", ColorBold+ColorCyan, ColorReset)
	fmt.Printf("%sStatus:%s %s%s (%d)%s\n",
		ColorGray, ColorReset,
		ColorBold+statusColor, status, entry.StatusCode, ColorReset,
	)
	printHeaders("Response Headers:", entry.ResponseHeaders)
	printBody("Response Body:", entry.ResponseHeaders, entry.ResponseBody, truncate)
	fmt.Printf("%sDuration:%s %v%s\n", ColorGray, ColorReset, entry.Duration, ColorReset)
	fmt.Printf("%s-----------------------%s\n", ColorBold+ColorCyan, ColorReset)
}

// printHeaders prints headers to the console with formatting and redaction
func printHeaders(title string, h http.Header) {
	fmt.Printf("%s%s:%s\n", ColorCyan, title, ColorReset)
	headerCount := 0
	keys := make([]string, 0, len(h))
	for k := range h {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		vv := h[k]
		lowerK := strings.ToLower(k)
		if _, exists := HeadersToOmit[lowerK]; exists {
			continue
		}

		headerCount++
		if strings.EqualFold(k, authorizationHeader) {
			var redactedValues []string
			for _, v := range vv {
				redacted := "[REDACTED SHORT]"
				if len(v) > 20 {
					redacted = fmt.Sprintf("%s...%s", v[:10], v[len(v)-10:])
				} else if len(v) > 10 {
					redacted = fmt.Sprintf("%s...", v[:10])
				} else if len(v) > 0 {
					redacted = "[REDACTED]"
				}
				redactedValues = append(redactedValues, redacted)
			}
			fmt.Printf("  %s%s%s%s:%s %s%s%s\n", ColorBold, ColorWhite, k, ColorReset, ColorGray, ColorRed, strings.Join(redactedValues, ", "), ColorReset)
		} else {
			fmt.Printf("  %s%s%s%s:%s %s\n", ColorBold, ColorWhite, k, ColorReset, ColorGray, strings.Join(vv, ", "))
		}
	}
	if headerCount == 0 {
		fmt.Printf("  %s(No headers to display)%s\n", ColorGray, ColorReset)
	}
}

// printQueryParams prints query parameters with formatting
func printQueryParams(queryParams url.Values) {
	if len(queryParams) == 0 {
		return
	}
	fmt.Printf("%sQuery Parameters:%s\n", ColorCyan, ColorReset)
	keys := make([]string, 0, len(queryParams))
	for k := range queryParams {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		values := queryParams[key]
		fmt.Printf("  %s%s%s%s:%s %s%s%s\n", ColorBold, ColorBlue, key, ColorReset, ColorGray, ColorWhite, strings.Join(values, ", "), ColorReset)
	}
}

// printBody attempts to decompress, format, and print the body for logging
func printBody(title string, headers http.Header, originalCompleteBody []byte, truncate bool) {
	fmt.Printf("%s%s:%s", ColorCyan, title, ColorReset)
	if len(originalCompleteBody) == 0 {
		fmt.Printf(" %s(empty)%s\n", ColorGray, ColorReset)
		return
	}

	bodyToProcess := originalCompleteBody
	decompressed := false
	encoding := headers.Get("Content-Encoding")
	encoding = strings.ToLower(strings.TrimSpace(encoding))

	var decompErr error
	if encoding != "" && len(originalCompleteBody) > 0 {
		bodyReader := bytes.NewReader(originalCompleteBody)
		var reader io.Reader = bodyReader
		switch encoding {
		case "gzip":
			gzipReader, err := gzip.NewReader(bodyReader)
			if err == nil {
				defer gzipReader.Close()
				reader = gzipReader
			} else {
				decompErr = fmt.Errorf("gzip reader init failed: %w", err)
			}
		case "br":
			reader = brotli.NewReader(bodyReader)
		case "deflate":
			flateReader := flate.NewReader(bodyReader)
			defer flateReader.Close()
			reader = flateReader
		default:
			reader = nil
			decompErr = fmt.Errorf("unsupported encoding for logging: %s", encoding)
		}

		if reader != bodyReader && decompErr == nil {
			var decompressedBuf bytes.Buffer
			_, err := io.Copy(&decompressedBuf, reader)
			if err == nil {
				bodyToProcess = decompressedBuf.Bytes()
				decompressed = true
			} else {
				decompErr = fmt.Errorf("decompression read failed (%s): %w", encoding, err)
			}
		}
	}

	// Print status about decompression attempt
	if encoding != "" {
		if decompressed {
			fmt.Printf(" %s(decoded from %s for printing)%s\n", ColorGray, encoding, ColorReset)
		} else if decompErr != nil {
			fmt.Printf(" %s(decoding %s failed: %v - showing original)%s\n", ColorRed, encoding, decompErr, ColorReset)
		} else {
			fmt.Printf(" %s(encoding '%s' present but not decoded for printing)%s\n", ColorGray, encoding, ColorReset)
		}
	} else {
		fmt.Println()
	}

	contentType := headers.Get("Content-Type")
	baseContentType := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	originalLength := len(bodyToProcess)

	var outputString string
	formatted := false

	switch baseContentType {
	case "application/json":
		var v interface{}
		decoder := json.NewDecoder(bytes.NewReader(bodyToProcess))
		decoder.UseNumber()
		err := decoder.Decode(&v)
		if err == nil && v != nil {
			var sb strings.Builder
			if err := formatJSONToStringBuilder(&sb, v, "  "); err == nil {
				outputString = sb.String()
				formatted = true
			} else {
				log.Debug().Err(err).Msg("JSON formatting to string failed")
			}
		} else if err != nil {
			log.Debug().Err(err).Msg("JSON decoding failed")
		}

	case "application/x-www-form-urlencoded":
		if values, err := url.ParseQuery(string(bodyToProcess)); err == nil && len(values) > 0 {
			var sb strings.Builder
			keys := make([]string, 0, len(values))
			for k := range values {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			for i, key := range keys {
				if i > 0 {
					sb.WriteString("\n")
				}
				vals := values[key]
				sb.WriteString(fmt.Sprintf("  %s%s%s%s:%s %s%s%s", ColorBold, ColorBlue, key, ColorReset, ColorGray, ColorWhite, strings.Join(vals, ", "), ColorReset))
			}
			outputString = sb.String()
			formatted = true
		}
	}

	// Handle raw text or fallback cases
	if !formatted {
		if isPrintableContentType(baseContentType) || (baseContentType == "" && looksLikePrintableText(bodyToProcess)) {
			var sb strings.Builder
			sb.WriteString(fmt.Sprintf("  %s```%s\n", ColorGray, ColorReset))
			sb.WriteString(fmt.Sprintf("%s%s%s", ColorWhite, string(bodyToProcess), ColorReset))
			sb.WriteString(fmt.Sprintf("\n%s```%s", ColorGray, ColorReset))
			outputString = sb.String()
		} else {
			outputString = fmt.Sprintf("  %s[Content type '%s' (%d bytes), not displayed as text]%s", ColorGray, baseContentType, originalLength, ColorReset)
		}
	}

	// Apply truncation based on the flag
	displayString := outputString
	outputTruncated := false

	if truncate && len(outputString) > MaxBodyPrintSize {
		displayString = outputString[:MaxBodyPrintSize]
		outputTruncated = true
	}

	fmt.Println(displayString)

	if outputTruncated {
		fmt.Printf("  %s... (Output truncated for display, original data size %d bytes)%s\n", ColorRed, originalLength, ColorReset)
	}
}

// formatJSONToStringBuilder recursively formats JSON data into a strings.Builder
func formatJSONToStringBuilder(sb *strings.Builder, data any, indent string) error {
	switch v := data.(type) {
	case map[string]any:
		if len(v) == 0 {
			sb.WriteString(fmt.Sprintf("%s{}%s", ColorGray, ColorReset))
			return nil
		}
		sb.WriteString(fmt.Sprintf("%s{%s", ColorGray, ColorReset))
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		first := true
		for _, k := range keys {
			if !first {
				sb.WriteString(fmt.Sprintf("%s,%s", ColorGray, ColorReset))
			}
			sb.WriteString(fmt.Sprintf("\n%s%s%s%s%s%s:%s ", indent, ColorBold, ColorBlue, k, ColorReset, ColorGray, ColorReset))
			if err := formatJSONToStringBuilder(sb, v[k], indent+"  "); err != nil {
				return err
			}
			first = false
		}
		sb.WriteString(fmt.Sprintf("\n%s%s}%s", indent[:len(indent)-2], ColorGray, ColorReset))
	case []any:
		if len(v) == 0 {
			sb.WriteString(fmt.Sprintf("%s[]%s", ColorGray, ColorReset))
			return nil
		}
		sb.WriteString(fmt.Sprintf("%s[%s", ColorGray, ColorReset))
		first := true
		for _, item := range v {
			if !first {
				sb.WriteString(fmt.Sprintf("%s,%s", ColorGray, ColorReset))
			}
			sb.WriteString(fmt.Sprintf("\n%s", indent))
			if err := formatJSONToStringBuilder(sb, item, indent+"  "); err != nil {
				return err
			}
			first = false
		}
		sb.WriteString(fmt.Sprintf("\n%s%s]%s", indent[:len(indent)-2], ColorGray, ColorReset))
	case string:
		escapedString := strconv.Quote(v)
		sb.WriteString(fmt.Sprintf("%s%s%s", ColorGreen, escapedString, ColorReset))
	case json.Number:
		sb.WriteString(fmt.Sprintf("%s%s%s", ColorMagenta, v.String(), ColorReset))
	case bool:
		sb.WriteString(fmt.Sprintf("%s%t%s", ColorYellow, v, ColorReset))
	case nil:
		sb.WriteString(fmt.Sprintf("%snull%s", ColorGray, ColorReset))
	default:
		sb.WriteString(fmt.Sprintf("%s(Unknown JSON type: %T)%v%s", ColorRed, v, v, ColorReset))
	}
	return nil
}
