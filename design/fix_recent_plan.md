# Plan: Fix Recent Traffic Live Update Gap (Simplified)

## Problem
When a user switches away from the "Recent Traffic" page, the WebSocket subscription stops. New requests are stored in the database but missed by the frontend. Upon returning to the page, the frontend only shows what was cached in `localStorage`, missing the gap.

## Proposed Solution
Extend `handleRecentSessions` to support a `since` parameter. Upon mounting, the "Recent Traffic" page will fetch all sessions from the database that occurred after the recording's `startTime`.

### 1. Backend Changes

#### `pkg/core/model_proxy_session.go`
- Update `GetRecentSessions(db *gorm.DB, configID string, limit int, offset int, since time.Time)`:
    - If `since` is not zero, add `db.Where("timestamp > ?", since)`.
    - If `limit` is 0 and `since` is provided, do not apply a limit (fetch all).

#### `pkg/web/api/api_sessions.go`
- Update `handleRecentSessions`:
    - Parse optional `since` query parameter (support RFC3339 or Unix milliseconds).
    - If `since` is provided and `limit` is not explicitly set in the query, default `limit` to 0 (or a very large number) to fetch all matching sessions.
    - Call updated `core.GetRecentSessions`.

### 2. Frontend Changes

#### `frontend/src/app/recent/page.tsx`
- Update `initLoadSessions`:
    - Ignore `localStorage` for the initial load if we want to be fully accurate from the DB, or use it and just "fill the gap". 
    - Per user instruction: "just use the startTime to query recent... no need to set limit".
    - Call `/api/sessions/recent/{configId}?since={startTimeIso}`.
    - This will return all sessions for this config since the recording started.
    - Return these sessions to the component.

### 3. Verification Plan
1. Open "Recent Traffic", start recording.
2. Switch to "Settings".
3. Perform several requests.
4. Switch back to "Recent Traffic".
5. Verify all requests since the start time are displayed.
