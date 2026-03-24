---
slug: /
---
# Introduction

**Inspect HTTP Proxy Plus (`ihpp`)** is a powerful, developer-centric reverse HTTP proxy and traffic inspector. It combines a high-performance Go backend with a modern Next.js web interface to provide real-time visibility, persistent history, and request manipulation capabilities for your HTTP traffic.

## Project Origin

`ihpp` is a modernized and enhanced version of the original [inspect-http-proxy](https://github.com/liyu1981/inspect-http-proxy) project. While the original was a robust CLI-focused tool, `ihpp` (the "Plus" version) adds a persistent database, a full web UI dashboard, and multi-proxy management to provide a more comprehensive debugging experience.

Whether you are debugging complex microservices, reverse-engineering APIs, or testing frontend integrations, `ihpp` provides the tools you need in a single, lightweight binary.

## Overview

![ihpp Overview](/img/overview.png)

## Why ihpp?

Traditional tools like `curl` or browser DevTools are great, but they often lack:
- **Persistence**: Re-inspecting a request from yesterday.
- **Searchability**: Finding a request based on a specific JSON field or header.
- **Multi-tasking**: Managing multiple proxy targets from a single interface.
- **Ease of Replay**: Quickly modifying and re-sending a captured request.

`ihpp` was built to fill these gaps, providing a persistent "brain" for your HTTP traffic.

## Key Features

- **Multi-Proxy Management**: Run multiple proxy targets simultaneously.
- **Persistent History**: Searchable SQLite-backed history with FTS5.
- **Real-time Stream**: Watch traffic as it happens.
- **Modern UI**: Polished dashboard for deep inspection.
- **Request Builder**: Modify and replay requests with ease.
- **Zero Configuration**: Sensible defaults that work out of the box.
