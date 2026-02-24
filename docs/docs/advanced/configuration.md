# Custom Configuration

For persistent and complex setups, `ihpp` uses a TOML configuration file.

## The `.proxy.config.toml` File

A typical configuration looks like this:

```toml
[server]
api-addr = ":20000"
db-path = "~/.proxy/proxy_logs.db"

[[proxies]]
name = "Production API"
listen = ":8081"
target = "https://api.myapp.com"

[[proxies]]
name = "Local Mock"
listen = ":8082"
target = "http://localhost:3000"
```

## Structure

### [server]
- `api-addr`: (String) The UI management address.
- `db-path`: (String) Absolute path to the SQLite database.

### [[proxies]]
This is an array of tables. You can define multiple proxies.
- `name`: (String) Unique name for the proxy.
- `listen`: (String) The port to proxy traffic through.
- `target`: (String) The destination server.

## Redaction
`ihpp` automatically redacts sensitive headers in logs:
- `Authorization`
- `Proxy-Authorization`
- `Cookie` (Optional configuration planned)
