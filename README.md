# Inspect HTTP Proxy Plus (ihpp)

[![Go Report Card](https://goreportcard.com/badge/github.com/liyu1981/inspect-http-proxy-plus)](https://goreportcard.com/report/github.com/liyu1981/inspect-http-proxy-plus)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

**Inspect HTTP Proxy Plus (`ihpp`)** is a powerful, developer-centric reverse HTTP proxy and traffic inspector. It combines a high-performance Go backend with a modern Next.js web interface to provide real-time visibility, persistent history, and request manipulation capabilities for your HTTP traffic.

> This project is based on the original [project by @signeen](https://github.com/signeen/inspect-http-proxy) (see `README.origin.md`) but has undergone significant improvements and evolved in a different direction, focusing on multi-proxy management, a rich web UI, and persistent SQLite storage with full-text search.

## 🚀 Quick Start

The fastest way to run `ihpp` is using `npx`:

```bash
npx @liyu1981/ihpp
```

or 
```bash
# in-memory db mode, best for demo or one time usage
npx @liyu1981/ihpp --in-memory
```

By default, the web interface will be available at `http://localhost:20000`.

## 📖 Documentation

For detailed guides, installation instructions, and feature overviews, visit our [Documentation](https://liyu1981.github.io/inspect-http-proxy-plus/).

## ✨ Key Features

-   **Multi-Proxy Management:** Run and manage multiple proxy configurations simultaneously from a single dashboard.
-   **Real-time Inspection:** Watch HTTP requests and responses flow through in real-time via WebSockets.
-   **Persistent History:** All proxied traffic is stored in a local SQLite database with Full-Text Search (FTS5) support.
-   **Modern Web UI:** A polished, responsive dashboard built with React (Next.js) and Tailwind CSS.
-   **HTTP Request Builder:** Replay, modify, and compose new HTTP requests directly from the UI.
-   **Traffic Analysis:** Automatic decompression and pretty-printing of common content types.
-   **CURL Export:** Quickly copy any captured request as a `curl` command.
-   **Bookmarks:** Save important requests for quick access later.

## 📦 Installation

### Pre-built Binaries
Download the latest version for your platform from the [Releases](https://github.com/liyu1981/inspect-http-proxy-plus/releases) page.

### Go Install
```bash
go install github.com/liyu1981/inspect-http-proxy-plus@latest
```

### From Source
```bash
# Clone the repository
git clone https://github.com/liyu1981/inspect-http-proxy-plus.git
cd inspect-http-proxy-plus

# Build the frontend (requires pnpm)
./scripts/build_and_copy_frontend.sh

# Build the binary
./scripts/build.sh
```

## 🛠️ Development

To start the development environment (backend and frontend with hot-reload):

```bash
./start_dev.sh
```

This script will concurrently run the Go backend and the Next.js frontend, allowing for a seamless development experience.

## 📖 Usage

### CLI Flags

-   `--db-path <path>`: Path to the SQLite database file (default: `~/.proxy/proxy_logs.db`).
-   `--in-memory`: Use an in-memory database (no persistence, best for one-time usage).
-   `--log-level <level>`: Set log level (debug, info, warn, error, fatal, panic, disabled).
-   `--config <path>`: Path to a `.toml` configuration file.

### Proxy Specifications

Specify one or more proxies as positional arguments:

```bash
# Basic target only (starts at :20003)
ihpp http://localhost:8080

# Specific listen port and target
ihpp :3000,http://localhost:8080

# Multiple proxies
ihpp http://localhost:8080 :3001,http://localhost:9000
```

By default, the management UI is available at `http://localhost:20000`.

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
