---
name: External checkout access
description: The product uses one-time transparent Pix checkout and package-based invite access.
---

Abacate Pay is the selected one-time checkout provider. The buyer purchases the Casal package through the site's transparent Pix flow, and access is granted only after an authenticated, idempotent completion webhook.

**Why:** The product needs a real payment flow without sending buyers to a hosted checkout page, and the owner supplied Abacate Pay/Railway as the production direction.

**How to apply:** Keep the access model intact: one-time Pix payment grants the buyer access, each package defines its invite limit, guests can participate but cannot invite others, and webhook events must be authenticated and idempotent. Persist sessions, invites, and processed webhook IDs in PostgreSQL so an API restart cannot erase paid access. Keep provider credentials in Railway secrets, never in source.