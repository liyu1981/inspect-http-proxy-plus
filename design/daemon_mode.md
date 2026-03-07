# Design: Daemon Mode for IHPP

This document outlines the design for adding a daemon mode to `ihpp` (Inspect HTTP Proxy Plus).

## Goals
1. Provide a `--daemon` flag to run `ihpp` in the background.
2. Standardize configuration and database storage in `~/.ihpp`.
3. Implement a Unix socket for inter-process communication (IPC).
4. Support instance detection and configuration merging.
5. Provide a `stop` subcommand to terminate the daemon gracefully.

## 1. Configuration & Defaults

### Directory Structure
All `ihpp` related data will be stored in `~/.ihpp`:
- **Database**: `~/.ihpp/proxy_logs.db` (Default)
- **Unix Socket**: `~/.ihpp/ihpp.sock`
- **PID File**: `~/.ihpp/ihpp.pid`
- **Config File**: `.proxy.config.toml` (Search path includes `~/.ihpp` and current directory)

### Database Path Change
Update `pkg/core/db.go`: `DefaultDbPath` will return `~/.ihpp/proxy_logs.db` instead of `~/.proxy/proxy_logs.db`.

## 2. CLI Changes

### Flags
- `--daemon`: If provided, `ihpp` will run in the background.

### Subcommands
`ihpp` will now support subcommands by checking the first non-flag argument:
- `ihpp stop`: Connects to the daemon via Unix socket and sends a shutdown command.
- `ihpp status`: Connects to the daemon via Unix socket and retrieves current status (uptime, database path, active proxies, etc.).

### Startup Logic Refactor
1. **Instance Detection**:
   - Check `~/.ihpp/ihpp.pid` for a running PID.
   - If PID file is missing, fallback to checking the system process list for an `ihpp` process.
   - If a potential process is found (via PID or name):
     - Try to connect to `~/.ihpp/ihpp.sock` and send a `status` command.
     - If the socket responds: The daemon is confirmed running.
       - If the subcommand is `stop` or `status`: Execute the command via socket and exit.
       - If new configs are provided (via flags or positional args):
         - Offer user to **merge** configs into the running instance.
         - Or **exit**.
       - If no subcommand and no new configs: Inform user that `ihpp` is already running and exit.
     - If the socket does NOT respond: The process is considered stale.
       - Clean up the stale socket and PID file.
       - Proceed with startup.
   - If no process is found: Proceed with startup.
2. **Daemonization**:
   - If `--daemon` is set:
     - Start the process in the background (using `os/exec` to fork or a similar mechanism).
     - The background process will:
       - Write its PID to `~/.ihpp/ihpp.pid`.
       - Create the Unix socket and start listeners.
       - Ensure the PID file is removed on graceful shutdown.

## 3. Inter-process Communication (IPC)

### Unix Socket
A Unix domain socket will be created at `~/.ihpp/ihpp.sock`.

### Protocol
Communication will use JSON-encoded messages over the socket.

#### Client to Daemon:
```json
{
  "command": "stop"
}
```
```json
{
  "command": "status"
}
```
```json
{
  "command": "merge",
  "proxies": [
    {
      "listen": ":3000",
      "target": "http://localhost:8000",
      "truncate-log-body": true
    }
  ]
}
```

#### Daemon to Client (Response):
**For `stop`:**
```json
{
  "status": "success",
  "message": "Daemon shutting down."
}
```

**For `status`:**
```json
{
  "status": "success",
  "data": {
    "pid": 1234,
    "uptime": "2h 15m",
    "db_path": "/home/user/.ihpp/proxy_logs.db",
    "api_addr": ":20000",
    "proxies": [
      {
        "config_id": "cfg_abc123",
        "listen": ":3000",
        "target": "http://localhost:8000",
        "active": true
      },
      {
        "config_id": "cfg_xyz789",
        "listen": ":4000",
        "target": "http://localhost:9000",
        "active": false,
        "error": "address already in use"
      }
    ]
  }
}
```

**For `merge`:**
```json
{
  "status": "success",
  "message": "Merged 2 proxies, 1 conflict reported.",
  "details": [
    {"proxy": ":3000", "result": "ignored", "reason": "identical config exists"},
    {"proxy": ":4000", "result": "conflict", "reason": "port already in use by another target"}
  ]
}
```

## 4. Config Merging Logic

When the daemon receives a `merge` command:
1. **Identical Check**: If a proxy with the same `listen` port AND `target` exists, ignore it.
2. **Conflict Check**: If a proxy with the same `listen` port but DIFFERENT `target` exists, report a conflict to the user.
3. **Activation**:
   - For new, non-conflicting proxies:
     - Attempt to start the proxy server.
     - If `ListenAndServe` fails (e.g., port taken by another application):
       - Add the config to the database/state.
       - Mark as **inactive**.
       - Report failure to the client.
     - If successful, report success.

## 5. Implementation Details

### `pkg/core/daemon.go` (New)
- `StartDaemonListener()`: Sets up the Unix socket and handles incoming commands.
- `SendDaemonCommand(cmd any) (any, error)`: Helper for clients to talk to the daemon.
- `Daemonize()`: Helper to restart the process in the background.

### `pkg/core/sys_config.go`
- Add `Active` (bool) field to `SysConfigProxyEntry` to track whether a proxy is currently running.

### `cmd/proxy/main.go`
- Add subcommand handling logic.
- Integrate daemon startup/detection.

## 6. Implementation Plan

1. **Phase 1: Foundation**
   - Update `DefaultDbPath`.
   - Add `Active` field to `SysConfigProxyEntry`.
2. **Phase 2: IPC & Subcommands**
   - Implement Unix socket listener and client.
   - Implement `ihpp stop` subcommand.
3. **Phase 3: Daemonization**
   - Implement background process logic for `--daemon`.
4. **Phase 4: Merging & Conflict Resolution**
   - Implement the `merge` command logic in the daemon.
   - Implement the interactive "merge or exit" prompt in the client.
5. **Phase 5: Validation**
   - Add tests for config merging and IPC.
   - Manual verification of daemon start/stop/merge.
