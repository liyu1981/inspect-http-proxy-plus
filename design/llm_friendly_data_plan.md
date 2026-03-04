# Design Plan: LLM-Friendly Data Generation

## Goal
Provide a way to generate and export HTTP session data in a format that is highly readable and structured for Large Language Models (LLMs), supporting both single and multiple sessions.

## 1. Data Format (Markdown)
The data will be formatted as Markdown for optimal LLM processing:

```markdown
# Session: [ID]
- **Time:** [Timestamp]
- **Duration:** [DurationMs]ms
- **Status:** [StatusCode] [StatusText]

## Request
- **Method:** [Method]
- **URL:** [URLFull]
- **Headers:**
```http
[Header-Key]: [Header-Value]
```
- **Body ([ContentType]):**
```[json/xml/text]
[Formatted/Prettified Body]
```

## Response
- **Headers:**
```http
[Headers]
```
- **Body ([ContentType]):**
```[Formatted/Prettified Body]
```
---
```

### Body Handling
- **Prettify:** JSON/XML bodies will be prettified if possible.
- **Truncation:** Bodies exceeding a configurable size (e.g., 10KB) will be truncated with a "Body truncated..." message.
- **Binary Data:** Non-textual binary data will be represented as `[Binary Data: N bytes]`.

## 2. Backend Enhancements
- **Core:** Implement `GetSessionsByIDs(db, ids []string) ([]ProxySessionRow, error)` in `pkg/core/model_proxy_session.go`.
- **API:** Implement `POST /api/sessions/batch` in `pkg/web/api/api_sessions.go` to retrieve full session data (including bodies) for a list of session IDs.

## 3. Frontend Enhancements
- **Utility:** Create `frontend/src/lib/llm-data-gen-util.ts` to transform session objects into the Markdown format.
- **Session List (Multi-Selection):**
    - Add checkboxes to `SessionList` rows.
    - Implement a "Selection Bar" that appears when one or more sessions are selected.
    - "Copy [N] for LLM" button in the Selection Bar.
- **Session Details:**
    - Add a "Copy for LLM" button to the `FloatToolbar`.

## 4. Implementation Steps
1.  **Phase 1: Single Session (Copy for LLM)**
    - Implement the Markdown utility.
    - Add the "Copy for LLM" button to the session detail view.
2.  **Phase 2: Backend Batch API**
    - Implement the core and API logic to fetch multiple sessions.
3.  **Phase 3: Multi-Selection UI**
    - Update `SessionList` to support selection.
    - Implement the bulk copy action.

## 5. Verification
- Verify that the Markdown output is valid and follows the designed structure.
- Test with various content types (JSON, HTML, Form-Data, Binary).
- Test with multiple sessions and ensure clear separation between them.
