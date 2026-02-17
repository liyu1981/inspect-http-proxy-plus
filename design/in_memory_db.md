# Design: In-Memory Database Mode

## Goal
Provide a way to run `ihpp` without persistent storage. This is useful for:
- One-time proxy runs where history isn't needed.
- Quick trials/demos without affecting the default database file.
- Automated testing.

## Requirements
- Support an `--in-memory` (or `-m`) CLI flag.
- When active, use SQLite's `:memory:` mode.
- Set the session reaper threshold to **100 sessions** (overriding any persistent settings).
- Skip database backups and file system operations related to the DB path.
- Still run migrations to ensure the schema is up-to-date in memory.

## Implementation Details

### 1. Configuration Changes (`pkg/core/sys_config.go`)
- Add `InMemory bool` to the `SysConfig` struct.

### 2. CLI Flag (`cmd/proxy/main.go`)
- Add `pflag.Bool("in-memory", false, "Use in-memory database (no persistence)")`.
- Add shorthand `-m`.

### 3. Database Initialization (`pkg/core/db.go`)
- Modify `InitDatabase(dbPath string)`:
    - If `dbPath` is `:memory:`, skip:
        - Path resolution and directory creation.
        - Backup creation.
        - Backup removal.
        - PRAGMA journal_mode=WAL (not needed/supported for in-memory DBs in the same way).
    - Ensure migrations still run on the in-memory connection.

### 4. Logic in `main.go`
- After loading configuration:
    - If `--in-memory` is set:
        - Set `sysConfig.DBPath = ":memory:"`.
        - Set `sysConfig.InMemory = true`.
    - During setting resolution:
        - If `sysConfig.InMemory` is true, force `sysConfig.MaxSessionsRetain = 100`.
        - Skip loading/saving `max_sessions_retain` from/to the DB when in-memory mode is active to avoid confusion (though it's a new DB anyway).

### 5. Reaper Integration (`pkg/core/reaper.go`)
- The reaper already uses `sysConfig.MaxSessionsRetain`, so no changes are needed there as long as the value is correctly overridden in `main.go`.

## User Experience
- Command: `ihpp --in-memory --proxy :3000,http://localhost:8080`
- Output: `Database file: :memory:`
- Behavior: All captured traffic is lost when the process exits. Only the most recent 100 sessions are kept in the web UI.
