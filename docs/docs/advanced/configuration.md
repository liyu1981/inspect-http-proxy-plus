# Custom Configuration

For persistent and complex setups, `ihpp` uses a TOML configuration file named
`.proxy.config.toml` in the current working directory (use `--config <path>` to point
at another file).

## Generating a Config File

The easiest way to get started is to let `ihpp` generate a fully commented file:

```bash
ihpp config
```

This creates `./.proxy.config.toml` with every supported setting and an example proxy.
Use `--force` to overwrite an existing file, or `--dry-run` to print the file to stdout
without writing it.

## Upgrading a Config File

New `ihpp` releases can add, rename or remove configuration keys. The
`config-version` key at the top of the file records the format version it was written
for. When `ihpp` loads a file with an older version it prints a warning:

```text
WARNING: config file ./.proxy.config.toml uses format version 0, latest is 1.
         Run 'ihpp config --upgrade' to migrate it while keeping your values.
```

`ihpp config --upgrade` migrates the file in place:

- **Configured values are preserved** – nothing you set is changed or dropped.
- **Unknown keys are kept** – custom/local settings survive the upgrade.
- **Removed keys are dropped** – only keys that are no longer supported disappear.
- **New keys are added commented** – unconfigured settings keep using the built-in
  defaults until you uncomment and change them.
- **Comments are regenerated** – the file is rewritten with the documentation of the
  current version.

```bash
# preview the result without writing anything
ihpp config --upgrade --dry-run

# migrate the file
ihpp config --upgrade

# regenerate the comments of an up-to-date file
ihpp config --upgrade --force
```

## File Structure

A typical configuration looks like this:

```toml
config-version = 1

log-level = "info"
log-dest = "default"
db-path = "~/.ihpp/proxy_logs.db"
in-memory = false
api-addr = ":20000"
max-sessions-retain = 10000

[[proxies]]
listen = ":8081"
target = "https://api.myapp.com"
truncate-log-body = true
```

### Top-level settings

| Key | Type | Description |
| :--- | :--- | :--- |
| `config-version` | Integer | Format version of the file. Managed by `ihpp`; use `ihpp config --upgrade`. |
| `log-level` | String | `debug`, `info`, `warn`, `error`, `fatal`, `panic` or `disabled`. |
| `log-dest` | String | `console`, `null`, `default` or a file path. |
| `db-path` | String | Absolute path to the SQLite database. Default: `~/.ihpp/proxy_logs.db`. |
| `in-memory` | Boolean | Keep captured traffic in memory only. Overrides `db-path`. |
| `api-addr` | String | Address of the web UI and management API. Default: `:20000`. |
| `max-sessions-retain` | Integer | Number of sessions kept before the oldest are reaped. Default: `10000`. |

### `[[proxies]]`

This is an array of tables. You can define multiple proxies.

- `listen`: (String) The address/port to listen on (e.g., `:8081`).
- `target`: (String) The destination server URL.
- `truncate-log-body`: (Boolean) Whether to truncate large request/response bodies.

## Redaction
`ihpp` automatically redacts sensitive headers in logs:
- `Authorization`
- `Proxy-Authorization`
- `Cookie` (Optional configuration planned)
