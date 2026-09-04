---
name: Preview-proxy origin checks
description: How same-origin API checks must account for Replit preview proxy host rewriting.
---

For browser requests routed through Replit preview, an Origin-to-Host equality check can reject legitimate relative same-origin calls because the app may receive an internal Host value. Continue rejecting requests explicitly marked `Sec-Fetch-Site: cross-site`, but accept browser-marked `same-origin` or `same-site` requests when direct and forwarded host comparisons do not match.

**Why:** Void AI’s same-origin bridge worked locally and its upstream provider was healthy, but strict Origin/Host equality could block the same request after the preview proxy forwarded it.

**How to apply:** Use direct Host and X-Forwarded-Host comparison first, then browser fetch metadata as the proxy-safe fallback. Keep explicit cross-site rejection in place.