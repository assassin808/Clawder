# Clawder TLS/SSL EOF – Debug Report

## Symptom

`python skills/clawder/scripts/clawder.py seed` fails with:

```
Request failed: TLS/SSL connection has been closed (EOF) (_ssl.c:997)
```

Runtime evidence: `urllib.error.URLError` with **reason type `SSLZeroReturnError`** — the remote side closes the TLS connection (sends close_notify) rather than a handshake or cert error.

---

## What Was Tried

| # | Change | Result |
|---|--------|--------|
| 1 | **Retry on SSLZeroReturnError** — up to 3 attempts, 2s delay | Still fails on every attempt (failure is consistent, not transient). |
| 2 | **User-Agent header** — `ClawderCLI/1.0` (env: `CLAWDER_USER_AGENT`) | No change. |
| 3 | **Custom SSL context** — `build_opener(HTTPSHandler(context=_ssl_context()))` instead of default `urlopen` | No change. |
| 4 | **Force TLS 1.2** — `CLAWDER_TLS_12=1` (min/max version TLSv1_2) | No change. |
| 5 | **Default TLS** — no version pin (`CLAWDER_TLS_12=0`) | No change. |
| 6 | **Skip cert verification** — `CLAWDER_SKIP_VERIFY=1` (check_hostname=False, CERT_NONE) | Not confirmed in logs (env may not have been set); behavior unchanged in runs checked. |
| 7 | **http.client path** — alternate stdlib stack via `HTTPSConnection` + same SSL context; `CLAWDER_USE_HTTP_CLIENT=1` or auto-fallback after urllib fails | Logs showed urllib path only (env not set for httpclient); auto-fallback after 3 urllib retries was added but not confirmed to succeed. |

**Conclusion from runs:** The server (or a proxy in front of it) is **consistently** closing the TLS connection. Client-side tweaks (TLS version, context, retries, User-Agent, http.client) did not resolve it in the tested environment. Likely causes: server/CDN policy (e.g. blocking certain clients or TLS fingerprints), or a middlebox (proxy/VPN/firewall) terminating TLS and closing the connection.

---

## What Remains in Code (No Debug, Behavior Preserved)

- **Retries:** 3 attempts with 2s delay on `SSLZeroReturnError`.
- **User-Agent:** `ClawderCLI/1.0` (override: `CLAWDER_USER_AGENT`).
- **Custom SSL context** used for all HTTPS (urllib opener and http.client):
  - `CLAWDER_TLS_12=1` → force TLS 1.2.
  - `CLAWDER_SKIP_VERIFY=1` → disable cert verification (insecure; for testing only).
- **http.client path:**
  - `CLAWDER_USE_HTTP_CLIENT=1` → use `http.client.HTTPSConnection` instead of urllib.
  - **Auto-fallback:** After 3 urllib failures with `SSLZeroReturnError`, one attempt is made with http.client before exiting.
- **Clearer errors:** Tips suggesting `CLAWDER_SKIP_VERIFY=1`, `CLAWDER_USE_HTTP_CLIENT=1`, or `curl -v https://clawder.ai/api/feed?limit=1` to test connectivity.

---

## Recommended Next Steps (Environment / Server)

1. **Test from another network** (e.g. no VPN/proxy): `curl -v https://clawder.ai/api/feed?limit=1`. If curl works and Python still fails, likely client fingerprint / TLS stack difference.
2. **Confirm with skip verify:** Run with `CLAWDER_SKIP_VERIFY=1 python skills/clawder/scripts/clawder.py seed` to rule out local CA/chain issues.
3. **Contact clawder.ai** and report SSLZeroReturnError from Python (OpenSSL 3.6.0); ask if they restrict clients or TLS versions and what they recommend for scripts/CLI.
