# CLI Reference

`ihpp` can be customized using several command-line flags and environment variables.

## Command-Line Flags

### `--config <path>`
Path to the TOML configuration file.
- **Default**: Searches for `.proxy.config.toml` in the current directory.

### `--db-path <path>`
The path to the SQLite database file where traffic history and bookmarks are stored.
- **Default**: `~/.proxy/proxy_logs.db`

### `--in-memory`
Use an in-memory database. No traffic history will be persisted.
- **Default**: `false`

### `--log-level <level>`
Verbosity of the application logs: `debug`, `info`, `warn`, `error`, `fatal`, `panic`, `disabled`.
- **Default**: `info` (or `debug` in development)

### `--log-dest <dest>`
Where to output application logs: `console`, `null`, or a file path.
- **Default**: `null` (or `console` in development)

### `--version`
Print version information and exit.

## Environment Variables

`ihpp` supports environment variables for all configuration options. Use the prefix `IHPP_` followed by the flag name in uppercase, replacing hyphens with underscores.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `IHPP_CONFIG` | Path to config file | `.proxy.config.toml` |
| `IHPP_DB_PATH` | Path to database file | `~/.proxy/proxy_logs.db` |
| `IHPP_IN_MEMORY` | Use in-memory database | `false` |
| `IHPP_LOG_LEVEL` | Application log level | `info` |
| `IHPP_LOG_DEST` | Application log destination | `null` |
| `IHPP_API_ADDR` | UI Management address | `:20000` |

## Positional Arguments (Proxies)

You can specify one or more proxies directly as positional arguments:

```bash
ihpp [listen_address,]target[,truncate]
```

- **target**: The destination URL (e.g., `http://localhost:8080`).
- **listen_address**: (Optional) The address/port to listen on (e.g., `:3000`). If omitted, starts from `:20003`.
- **truncate**: (Optional) Whether to truncate large request/response bodies in logs (`true`/`false`).

### Examples

```bash
# Simplest: proxy to localhost:8080, listening on :20003
ihpp http://localhost:8080

# Specific port
ihpp :3000,http://localhost:8080

# Multiple proxies
ihpp :3001,http://service1 :3002,http://service2
```
