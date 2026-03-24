# Traffic Inspection

The core of `ihpp` is its powerful traffic inspection engine.

## Real-time Streaming
Requests appear in the dashboard as they happen via WebSockets. No refreshing required.

![Main Dashboard](/img/main_dashboard_with_active_traffic_stream.png)

## Deep Inspection
Clicking on any request opens the detailed viewer, which provides:
- **Headers**: Complete request and response headers (with sensitive ones redacted).
- **Body Viewer**:
  - Automatic decompression (`gzip`, `br`, `deflate`).
  - Syntax highlighting for JSON, HTML, XML, and more.
  - **OpenAI Stream Support**: A dedicated renderer for OpenAI-compatible Server-Sent Events (SSE) streams, specifically optimized for chunked JSON data. It extracts content tokens and supports reasoning fields (for models like DeepSeek).
  - Pretty-printing for minified payloads.
- **Timing**: Precise measurement of how long the target server took to respond.

## Full-Text Search (FTS5)
Leverage the power of SQLite's FTS5 to search through all captured traffic. Search by URL, headers, or even request/response body content with lightning speed.

![Detailed Viewer](/img/detailed_request_response_viewer.png)

## Bookmarks
Save important requests for later by clicking the star icon. These are stored permanently in your history.
