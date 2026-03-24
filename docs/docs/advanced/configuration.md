# Custom Configuration

For persistent and complex setups, `ihpp` uses a TOML configuration file.

## The `.proxy.config.toml` File

A typical configuration looks like this:

```toml
[server]
api-addr = ":20000"
db-path = "~/.ihpp/proxy_logs.db"
daemon = false
log-level = "info"
log-dest = "console"

[[proxies]]
name = "Production API"
listen = ":8081"
target = "https://api.myapp.com"
```

## Structure

### [server]
- `api-addr`: (String) The UI management address (default `:20000`).
- `db-path`: (String) Absolute path to the SQLite database. Default: `~/.ihpp/proxy_logs.db`.
- `daemon`: (Boolean) Whether to start in background mode.
- `log-level`: (String) `debug`, `info`, `warn`, `error`, `fatal`, `panic`, `disabled`.
- `log-dest`: (String) `console`, `null`, or a file path.

### [[proxies]]
This is an array of tables. You can define multiple proxies.
- `name`: (String) Unique name for the proxy.
- `listen`: (String) The address/port to listen on (e.g., `:8081`).
- `target`: (String) The destination server URL.
- `truncate-log-body`: (Boolean) Whether to truncate large request/reponse bodies.

## Redaction
`ihpp` automatically redacts sensitive headers in logs:
- `Authorization`
- `Proxy-Authorization`
- `Cookie` (Optional configuration planned)
