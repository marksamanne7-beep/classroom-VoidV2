---
name: Large stash launchers
description: How to import very large linked HTML game collections without bloating the project.
---

Store approved source identifiers in a local manifest and serve their HTML through a same-origin, allowlisted endpoint only when a game launches.

**Why:** Large game documents can contain thousands of launchers, including individual single-file games tens of megabytes in size. Copying the whole collection locally would create unnecessary project bloat.

**How to apply:** For future large linked collections, deduplicate source identifiers, keep ordering and metadata locally, reject identifiers outside the manifest, and fetch launcher HTML on demand. Small curated emulator collections can remain fully local.