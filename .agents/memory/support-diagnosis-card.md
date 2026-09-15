---
name: Support diagnosis rules
description: Durable rules for keeping support-card explanations and push notification titles consistent.
---

The support card and support push title must derive their translation/action from the same deterministic topic and access-status mapping. Unknown access status always gets the manual-check explanation, while legacy suggestions without a topic stay as raw messages.

**Why:** Support is triaged from the admin panel and push notifications; different wording between those surfaces creates conflicting next actions.

**How to apply:** When adding or changing a support topic or access status, update both artifact-local pure diagnosis modules together because the API and frontend have independent TypeScript `rootDir` boundaries.