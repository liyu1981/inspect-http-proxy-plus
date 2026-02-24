# Quick Start

Get your first proxy running in less than 60 seconds.

## 1. Start the Management UI
Run the binary with no arguments to start the dashboard:

```bash
./ihpp
```

By default, the UI will be available at [http://localhost:20000](http://localhost:20000).

## 2. Create your first Proxy
Once in the dashboard:
1. Navigate to the **Proxies** page.
2. Click on **Create New Proxy**.
3. Enter a **Name** (e.g., "JSONPlaceholder").
4. Enter a **Listen Address** (e.g., `:9000`).
5. Enter the **Target URL** (e.g., `https://jsonplaceholder.typicode.com`).
6. Click **Save**.

## 3. Send a Request
Now, send a request to your local proxy:

```bash
curl http://localhost:9000/posts/1
```

## 4. Inspect!
Go back to the **Recent** or **History** tab in the dashboard. You should see your request appear instantly. Click on it to see headers, body, and response details.
