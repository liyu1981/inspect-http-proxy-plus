# Design Plan: Docusaurus Documentation for ihpp

## 1. Objective
Establish a professional, searchable, and structured documentation site using Docusaurus in the `docs/` folder. This will serve as the central source of truth for users (how to use `ihpp`) and developers (how `ihpp` works).

## 2. Information Architecture
The documentation will be split into several logical sections:

### A. Getting Started (User Focus)
- **Introduction**: What is `ihpp`? Why use it over other tools?
- **Installation**: Detailed steps for Binary, `go install`, and Building from Source.
- **Quick Start**: Running your first proxy in 60 seconds.

### B. Features Guide (User Focus)
- **Multi-Proxy Management**: How to create and manage multiple targets.
- **Web UI Dashboard**: Navigating the real-time stream, history, and bookmarks.
- **Traffic Inspection**: Decompression, pretty-printing, and header filtering.
- **Request Builder**: Composing and replaying requests (including multipart/form-data).
- **Search & Filtering**: Utilizing FTS5 for deep traffic analysis.
- **Exporting**: `curl` export and TOML configuration management.

### C. Advanced Usage (Power User Focus)
- **CLI Reference**: Exhaustive list of flags and environment variables.
- **Persistence**: Understanding the SQLite database (`~/.proxy/proxy_logs.db`).
- **Custom Configuration**: Deep dive into `.proxy.config.toml`.

### D. Architecture & Internals (Developer Focus)
- **System Overview**: High-level interaction between Go backend and Next.js frontend.
- **Database Schema**: Explanation of tables (sessions, configs, bookmarks, settings).
- **API Reference**: Internal REST and WebSocket endpoints.
- **Background Tasks**: The Reaper (cleanup) and Proxy Server management.

### E. Community & Contribution
- **Development Setup**: How to run in dev mode (`start_dev.sh`).
- **Coding Standards**: Go and React conventions used in the project.
- **Migration Guide**: How to add new DB migrations.

## 3. Implementation Strategy

### Step 1: Docusaurus Initialization
- Initialize Docusaurus in the `docs/` directory (using the classic template with TypeScript).
- Configure `docusaurus.config.ts` with the project name, branding, and GitHub links.

### Step 2: Content Migration & Expansion
- Migrate the high-level content from `README.md`.
- Extract technical details from `design/*.md` files into the "Architecture" section.
- Create new screenshots and GIFs for the Features section.

### Step 3: Integration
- Add a script `scripts/build_docs.sh` to handle documentation builds.
- (Optional) Update `README.md` to link to the deployed documentation site.

## 4. Documentation Structure (`docs/`)
```text
docs/
├── sidebars.ts          # Sidebar configuration
├── docusaurus.config.ts # Site config
├── docs/                # Markdown files
│   ├── intro.md
│   ├── getting-started/
│   │   ├── installation.md
│   │   └── quick-start.md
│   ├── features/
│   │   ├── proxy-management.md
│   │   ├── traffic-inspector.md
│   │   └── request-builder.md
│   ├── advanced/
│   │   ├── cli-reference.md
│   │   └── configuration.md
│   └── architecture/
│       ├── overview.md
│       ├── database.md
│       └── api-reference.md
└── src/                 # Custom React components/pages
```

## 5. Visual Style
- **Theme**: Respect system preference (light/dark mode) by default.
- **Code Blocks**: Syntax highlighting for Go, TypeScript, JSON, and TOML.
- **Admonitions**: Use "Tips" and "Warnings" for proxy configuration gotchas.

## 6. Next Steps (Actionable Items)
1. Initialize Docusaurus.
2. Draft the "Getting Started" and "Core Features" pages.
3. Consolidate design docs into the "Architecture" section.
