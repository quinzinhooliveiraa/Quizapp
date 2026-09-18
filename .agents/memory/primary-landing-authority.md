---
name: Primary landing authority
description: Client-side routing rule for the configured public landing page.
---

The server-side primary landing page setting is authoritative; browser storage must never decide which landing page `/` renders. Hidden landing links redirect to that primary page.

**Why:** A visitor can retain an old local value after the administrator changes the primary page, causing `/` to open a retired landing page and distort the funnel. Direct campaign or experiment links can also outlive a page, so they need the same protection.

**How to apply:** Resolve `/` from the current API response with the safe LP1 default while loading. Keep `/lp1`, `/lp2`, `/lp3`, and experiment links as explicit routes, but check visibility before rendering and replace hidden destinations with the configured primary path. Never allow the configured primary page to be hidden.