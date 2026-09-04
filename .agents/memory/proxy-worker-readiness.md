---
name: Proxy worker readiness
description: Avoiding silent shortcut deadlocks with the scoped Ultraviolet service worker.
---

For the proxy worker registered under the service path, wait on that registration's active/installing worker state rather than the global `navigator.serviceWorker.ready` promise.

**Why:** The worker's narrow scope does not control the main home page, so the global readiness promise can remain pending and every shortcut click silently waits forever.

**How to apply:** On every page refresh, unregister and freshly register the scoped proxy worker before navigation, sharing that startup promise with clicks. Automatic retries should reset it again; never show a “still starting, click again” notice. Keep the Settings repair button as a manual fallback.