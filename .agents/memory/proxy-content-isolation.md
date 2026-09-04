---
name: Proxy frame compatibility
description: Required iframe and worker behavior for reliable proxied site rendering.
---

Proxied pages must use the historically working iframe policy with `allow-same-origin` and must receive the proxy worker response without an injected CSP sandbox. Direct local game launchers should keep the stricter iframe policy without `allow-same-origin`.

**Why:** An opaque iframe sandbox prevents the scoped proxy worker from intercepting navigation and produces the server's plain `Error` fallback. Injecting an opaque CSP sandbox after interception lets pages load but breaks origin-dependent scripts and layouts, causing distorted or partially functional websites. The same-origin iframe policy was the last known normal configuration.

**How to apply:** Whenever browser-overlay, game-launch, popup, worker, or about:blank behavior changes, test multiple proxied sites inside the actual Void toolbar—not only as top-level `/service/` URLs. Do not inject CSP sandbox headers into worker responses. Verify local game frames retain their strict HTML sandbox. A worker-side security filter must decode the `/service/` URL with UV before checking the destination; proxied fetches arrive encoded, so checking only the raw pathname misses them.

**Why:** UV rewrites a proxied request to the scoped `/service/` path before the service worker sees it. A raw `/api/friends` pathname check therefore protects direct requests but not a proxied page explicitly targeting the app origin.