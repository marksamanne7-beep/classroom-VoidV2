---
name: School-network game thumbnails
description: Network constraint and delivery rule for game poster images.
---

Game thumbnails must be delivered through the app's own origin rather than redirecting the browser to RocketGames image hosts. Prefer imported local JPEG files for the catalog, with server-side lookup only as a fallback.

**Why:** School networks may block the upstream image domain even when the Void app itself is available, leaving otherwise valid exact-game posters blank.

**How to apply:** Keep exact-game poster files in the app's static assets and point catalog entries directly to them. Retain server-side exact-image discovery only as a fallback, use broadly supported JPEG output, and allow transient failures to retry.