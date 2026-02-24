# Usage Scenarios

Explore common ways to use `ihpp` to fit your development workflow.

## 1. Quick Debugging (In-Memory)

When you just need to inspect a few requests and don't care about saving the history for later, use the `--in-memory` flag. This is ideal for quick demos or debugging a transient issue.

```bash
ihpp --in-memory http://localhost:8080
```

- **Persistence**: None. All data is lost when the process exits.
- **Port**: The proxy will listen on `:20003` (default) and forward to `localhost:8080`.
- **Management UI**: Available at `http://localhost:20000`.

## 2. Managing Multiple Microservices

If your application consists of multiple microservices, you can manage them all with a single `ihpp` instance. You can specify multiple proxies as positional arguments.

```bash
ihpp :3001,http://localhost:5001 :3002,http://localhost:5002 :3003,http://localhost:5003
```

Each service gets its own entry in the **Proxies** list in the dashboard, and you can see all traffic interleaved in the **Recent** tab or filter by specific proxy.

## 3. Persistent Workspace (Config File)

For long-term projects, it's best to use a configuration file. This allows you to name your proxies and keep your settings consistent across sessions.

Create a file named `ihpp.toml`:

```toml
[server]
api-addr = ":20000"
db-path = "./project_traffic.db"

[[proxies]]
name = "Identity API"
listen = ":8001"
target = "https://identity.dev.local"

[[proxies]]
name = "Product Catalog"
listen = ":8002"
target = "http://localhost:9000"
```

Start `ihpp` with the config:

```bash
ihpp --config ihpp.toml
```

## 4. Reverse Proxying with Path Stripping

If you need to proxy to a specific subpath, `ihpp` handles it simply by including the path in the target URL.

```bash
ihpp :8000,http://api.example.com/v1
```

Requests to `http://localhost:8000/users` will be proxied to `http://api.example.com/v1/users`.

## 5. Mobile App Debugging

To inspect traffic from a mobile device or another machine on your network:

1. Start `ihpp` listening on all interfaces (or your machine's IP).
2. Configure your mobile app or device to use your machine's IP and the proxy port.

```bash
ihpp :3000,http://your-dev-server:8080
```

Point your mobile app to `http://<your-machine-ip>:3000`.
