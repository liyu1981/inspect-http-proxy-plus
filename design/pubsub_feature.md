# Global Pub/Sub Feature Plan (Hybrid Approach)

## Goal
Upgrade the current single-page WebSocket connection to a global Pub/Sub system. This allows any component to subscribe to specific topics and receive real-time updates while maintaining a single, robust WebSocket connection managed at the application root.

## Architecture

### Backend (Go - Custom)
- **Hub (`WsHub`):** Manages a mapping of `topic -> subscribed clients`.
- **Client (`WsClient`):** Handles incoming `subscribe` and `unsubscribe` messages.
- **Protocol:**
  - **Subscribe:** `{ "type": "subscribe", "topic": "string" }`
  - **Unsubscribe:** `{ "type": "unsubscribe", "topic": "string" }`
  - **Server Broadcast:** `{ "type": "broadcast", "topic": "string", "payload": any }`
- **API:**
  - `Publish(topic string, payload any)`: Server-side method to broadcast to all subscribers of a topic.

### Frontend (React - `react-use-websocket`)
- **Library:** Use `react-use-websocket` for robust connection management (heartbeats, exponential backoff reconnection).
- **Context (`WebSocketProvider`):**
  - Wraps the app and initializes `useWebSocket` with `share: true`.
  - Maintains a local registry of `topic -> callbacks[]`.
  - Dispatches incoming server messages to the correct subscribers.
- **Hook (`useSubscription`):**
  - High-level hook for components: `useSubscription(topic, (data) => { ... })`.
  - Automatically handles subscribing/unsubscribing on mount/unmount.

## Implementation Steps

### 1. Backend: Update `pkg/web/api/ws.go`
- **Modify `WsHub`:**
  - Add `subscriptions map[string]map[*WsClient]bool`.
  - Add `subscribe` and `unsubscribe` channels for thread-safe updates.
- **Update `WsHub.run()`:**
  - Process subscription/unsubscription events.
  - Route broadcast messages to specific topic subscribers.
- **Update `WsClient.handleTextMessage()`:**
  - Handle `subscribe` and `unsubscribe` JSON types.
- **Add `Publish` method:**
  - Expose `Publish(topic string, payload any)` on `ApiHandler`.

### 2. Frontend: Setup & Provider
- **Install:** `pnpm add react-use-websocket` in the `frontend` directory.
- **Create `frontend/src/app/_components/websocket-provider.tsx`:**
  - Use `useWebSocket` to manage the singleton connection.
  - Implement `subscribe`/`unsubscribe` logic to bridge the hook and the server.
- **Update `frontend/src/app/layout.tsx`:**
  - Wrap `BaseLayout` or `children` with `WebSocketProvider`.

### 3. Frontend: Create `useSubscription` Hook
- **Create `frontend/src/app/_hooks/use-subscription.ts`:**
  - Use `useEffect` to register/unregister with the `WebSocketProvider`.

### 4. Integration & Refactoring
- **Refactor `frontend/src/app/inspect/page.tsx`:**
  - Replace manual `useWebSocket` with `useSubscription("sessions")`.
- **Update Broadcast Calls:**
  - Identify existing `WsBroadcast` calls in `pkg/core/proxy.go` and `pkg/web/web.go`.
  - Transition them to `Publish("sessions", session)`.

## Verification
- Connection establishes automatically on app load.
- Reconnection works after server restart (verified via library logs).
- Messages are only received by components subscribed to the relevant topic.
- No memory leaks (subscriptions are cleaned up on component unmount).