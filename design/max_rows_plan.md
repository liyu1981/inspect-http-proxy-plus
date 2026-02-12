# Plan: Database Retention Policy (Max Sessions)

This plan outlines the implementation of a database retention policy to manage disk usage and system performance by limiting the number of stored proxy sessions.

## 1. Database & Model Updates

- **Migration**: Create a new migration `migrations/000007_add_max_sessions_setting.up.sql` to:
    - Add `max_sessions_retain` to `system_settings` table.
    - Set a default value of `10000`.
- **Go Model**: Update `pkg/core/model_system_setting.go` and `pkg/core/sys_config.go` to support this new setting.
- **System Config API**: Update `SysConfig` struct in `pkg/web/api/api_configs.go` to include:
    - `MaxSessionsRetain int`
    - `DbSizeBytes int64`

## 2. Backend Reaper Service

- **Location**: Implement in `pkg/core/db.go` or a new `pkg/core/reaper.go`.
- **Logic**:
    1. Periodically (every 5 minutes) query the count of sessions that are **not bookmarked**.
    2. If `count > max_sessions_retain`:
        - Identify the `IDs` of the oldest sessions exceeding the limit.
        - Delete these sessions from `proxy_sessions`.
        - Note: The FTS table and body logs should be handled via cascading deletes or manual cleanup if not linked.
    3. Trigger a background cleanup on application startup.

## 3. Real-time Notifications (Websocket)

- **Event**: Define a new WS event type `sessions_deleted`.
- **Payload**: `{ "type": "sessions_deleted", "ids": ["uuid1", "uuid2", ...] }`.
- **Broadcast**: The reaper service will broadcast this event via `pkg/web/api/ws.go` after successful deletion.
- **Frontend**: Update Jotai stores or subscription hooks to remove deleted IDs from the UI list without a refresh.

## 4. UI Enhancements (`frontend/src/app/settings/page.tsx`)

- **Editable Setting**:
    - Add a numeric input for "Max Sessions to Retain" in the System tab.
    - Include a description: "Automatically delete oldest sessions when this limit is reached. Bookmarked sessions are never deleted."
- **DB Statistics**:
    - Add "Database Size" to the read-only Bootstrap Information section.
    - Implement a human-readable formatter (e.g., `1.2 MB`).

## 5. Implementation Steps

1. [ ] Create SQL migration for `max_sessions_retain`.
2. [ ] Add `DbSize` utility in `pkg/core/util.go`.
3. [ ] Update Go structs and API handlers.
4. [ ] Implement the background reaper loop.
5. [ ] Integrate reaper with WebSocket broadcasting.
6. [ ] Update Settings UI with the new input and DB size display.
7. [ ] Update frontend WebSocket listeners to handle `sessions_deleted`.
