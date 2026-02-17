# Inspect HTTP Proxy Plus (ihpp)

[![Go Report Card](https://goreportcard.com/badge/github.com/liyu1981/inspect-http-proxy-plus)](https://goreportcard.com/report/github.com/liyu1981/inspect-http-proxy-plus)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

**Inspect HTTP Proxy Plus (`ihpp`)** is a powerful, developer-centric reverse HTTP proxy and traffic inspector. It combines a high-performance Go backend with a modern Next.js web interface to provide real-time visibility, persistent history, and request manipulation capabilities for your HTTP traffic.

Whether you are debugging complex microservices, reverse-engineering APIs, or testing frontend integrations, `ihpp` provides the tools you need in a single, lightweight binary.

## 📖 Documentation

For detailed guides, installation instructions, and feature overviews, visit our [Documentation](https://liyu1981.github.io/inspect-http-proxy-plus/).

## 🚀 Key Features

-   **Multi-Proxy Management:** Run and manage multiple proxy configurations simultaneously from a single dashboard.
-   **Real-time Inspection:** Watch HTTP requests and responses flow through in real-time via WebSockets.
-   **Persistent History:** All proxied traffic is stored in a local SQLite database with Full-Text Search (FTS5) support, allowing you to find that one specific request from days ago.
-   **Modern Web UI:** A polished, responsive dashboard built with React (Next.js) and Tailwind CSS, featuring:
    -   Detailed request/response body viewers with syntax highlighting (JSON, HTML, XML, etc.).
    -   Header inspection and filtering.
    -   Response time tracking.
-   **HTTP Request Builder:** Replay, modify, and compose new HTTP requests directly from the UI.
-   **Traffic Analysis:** Automatic decompression (`gzip`, `br`, `deflate`) and pretty-printing of common content types.
-   **CURL Export:** Quickly copy any captured request as a `curl` command for terminal reproduction.
-   **Bookmarks:** Save important requests for quick access later.

## 🛠 Tech Stack

-   **Backend:** Go, Echo (Web Framework), SQLite (with FTS5), Mattn Go-SQLite3.
-   **Frontend:** Next.js (TypeScript), Tailwind CSS, Shadcn UI, Jotai (State Management).
-   **Persistence:** Local SQLite database for settings, bookmarks, and traffic logs.

## 📦 Installation

### Recommended: Pre-built Binaries
Download the latest version for your platform from the [Releases](https://github.com/liyu1981/inspect-http-proxy-plus/releases) page.

### Recommended: Go Install
You can install `ihpp` directly using Go:

```bash
go install github.com/liyu1981/inspect-http-proxy-plus@latest
```

### From Source
If you want to build from source, you will need Go 1.22+ and pnpm (for frontend assets).

```bash
# Clone the repository
git clone https://github.com/liyu1981/inspect-http-proxy-plus.git
cd inspect-http-proxy-plus

# Build the frontend (requires pnpm)
./scripts/build_and_copy_frontend.sh

# Build the binary
./scripts/build.sh
```

## 📖 Usage

Start the proxy server:

```bash
./ihpp
```

By default, the web interface will be available at `http://localhost:20003`. From there, you can create new proxy configurations to forward traffic to your target services.

### CLI Flags

-   `-db <path>`: Path to the SQLite database file (default: `~/.proxy/proxy_logs.db`).
-   `-listen <addr>`: Address for the management UI to listen on (default: `:20003`).

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
