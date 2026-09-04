---
name: Large Unity stash wrappers
description: Runtime constraints for stash games that reconstruct large Unity builds from split CDN archives.
---

Large split-archive Unity wrappers need a visible download, unpacking, and initialization stage. Trusted local stash launchers may also require same-origin iframe permission, while CDN-relative service-worker registration must be removed.

**Why:** These games can download tens of megabytes and unpack substantially more before drawing their first frame. Without an in-page progress surface they appear broken, and a service worker cannot be registered from a different CDN origin.

**How to apply:** Keep the elevated sandbox permission restricted to allowlisted local stash launchers. Preserve normal sandbox restrictions elsewhere, strip invalid cross-origin worker registration, and remove the progress surface only after Unity reports successful initialization.