---
name: Anonymous Motif chat context
description: How to preserve reliable multi-turn context when using Motif's anonymous streaming chat.
---

Motif's anonymous chat stream accepts conversation and parent-message IDs, but those IDs alone may not reliably reproduce earlier turns. Retain the identifiers and include a bounded recent transcript with follow-up prompts.

**Why:** Anonymous upstream conversation state may be incomplete or unavailable between requests.

**How to apply:** Keep transcript serialization below both the client request budget and server body limit; prefer the most recent user/assistant turns.