---
name: Fixed landing routes
description: Routing constraint for public landing page paths.
---

Every public landing page path must be recognized by the route-aware splash layer as a landing route.

**Why:** A new public path can match its React route correctly but still appear blank when the global splash remains mounted over it.

**How to apply:** Whenever a landing route is added or renamed, update the route-aware splash whitelist and verify the path in both desktop and mobile previews. Non-landing utility routes such as admin and login should bypass the splash entirely.