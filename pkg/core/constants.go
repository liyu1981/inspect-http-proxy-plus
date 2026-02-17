package core

const Version = "dev"

// Constants
const (
	MaxBodyPrintSize = 1024 * 10 // Max size if truncation is enabled
	LogLevelDisabled = "disabled"
)

// ANSI Color Codes
const (
	ColorReset   = "\033[0m"
	ColorRed     = "\033[31m"
	ColorGreen   = "\033[32m"
	ColorYellow  = "\033[33m"
	ColorBlue    = "\033[34m"
	ColorMagenta = "\033[35m"
	ColorCyan    = "\033[36m"
	ColorWhite   = "\033[37m"
	ColorGray    = "\033[90m"
	ColorBold    = "\033[1m"
)

const authorizationHeader = "Authorization"

// Configuration for Header Omission during Logging
var HeadersToOmit = map[string]struct{}{
	"x-forwarded-proto": {},
	"cf-ipcountry":      {},
	"cf-ray":            {},
	"x-real-ip":         {},
	"cf-visitor":        {},
	"cf-connecting-ip":  {},
	"cdn-loop":          {},
	"x-forwarded-for":   {},
}

// Hop-by-hop headers that should not be forwarded between connections
var hopHeaders = []string{
	"Connection",
	"Proxy-Connection",
	"Keep-Alive",
	"Proxy-Authenticate",
	"Proxy-Authorization",
	"Te",
	"Trailers",
	"Transfer-Encoding",
	"Upgrade",
}
