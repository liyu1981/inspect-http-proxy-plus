# Plan: Migrating System Configuration to Database

This plan outlines the steps to move system-wide configuration (currently handled by command-line flags and TOML configuration) into a persistent database table.

## Goals
- Remove `--log-level` and `--api-addr` from command-line flags.
- Store these settings in a new `system_settings` table in the database.
- Allow updating these settings via the UI without restarting the proxy (where feasible).
- Maintain `db-path` and `config` as bootstrap flags.

## 1. Database Schema
Create a new migration `000006_add_system_settings.up.sql`:
- Table: `system_settings`
  - `key` (TEXT, PRIMARY KEY): The setting name (e.g., 'log_level', 'api_addr').
  - `value` (TEXT, NOT NULL): The setting value.
  - `updated_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP).

Initial seed values:
- `log_level`: 'debug'
- `api_addr`: ':8080'

## 2. Backend Changes

### Core Package (`pkg/core`)
- **New Model**: `pkg/core/model_system_setting.go`
  - Define `SystemSettingRow` struct.
  - Implement `GetSystemSetting(db, key, defaultVal)` and `SetSystemSetting(db, key, value)`.
- **System Config**: `pkg/core/sys_config.go`
  - Update `SysConfig` to distinguish between bootstrap-only fields and DB-backed fields.
- **Database Init**: `pkg/core/db.go`
  - Ensure migrations run before any settings are read.

### Startup Logic (`cmd/proxy/main.go`)
- Remove `log-level` and `api-addr` from `initFlags()`.
- Refactor `main()`:
  1. Load bootstrap config (Viper + Flags for `db-path`, `config`, `proxy`).
  2. Initialize Database.
  3. Load `log_level` and `api_addr` from `system_settings` table.
     - If not present in DB, fallback to Viper (config file) then to hardcoded defaults.
     - Seed the DB with these values if it's the first run.
  4. Setup logger using the resolved `log_level`.
  5. Start UI Server using the resolved `api_addr`.

### API Handler (`pkg/web/api`)
- **Update SysConfig**: Update `handleSysConfig` in `pkg/web/api/api_configs.go` to support `POST`.
- **Persistence Only**:
  - When settings (like `log_level` or `api_addr`) are updated via `POST`, they are saved to the `system_settings` table in the database.
  - **IMPORTANT**: These changes will NOT be applied to the current running process. No live updates to logger or listener addresses will occur.

## 3. Frontend Changes

### Settings Page (`frontend/src/app/settings/page.tsx`)
- Change `Log Level` and `API Address` fields from `readOnly` to editable.
- Use a Select component for `Log Level` (trace, debug, info, warn, error, fatal, panic).
- Add a "Save" button to persist changes to the backend.
- **User Notification**: On successful save, display a notification/toast: "Settings saved successfully. Changes will take effect after the next restart."

## 4. Verification Plan
- Run migrations and verify the `system_settings` table is created and seeded.
- Start the proxy without `--log-level` or `--api-addr` flags and verify it uses defaults/DB values.
- Change the log level in the UI and verify the console output verbosity changes immediately.
- Change the API address in the UI, restart the proxy, and verify it binds to the new address.
