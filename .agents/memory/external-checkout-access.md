---
name: External checkout access
description: The product uses one-time transparent Pix checkout and package-based invite access.
---

Abacate Pay is the selected one-time checkout provider. The buyer purchases the Casal package through the site's transparent Pix flow, and access is granted only after an authenticated, idempotent completion webhook.

**Why:** The product needs a real payment flow without sending buyers to a hosted checkout page, and the owner supplied Abacate Pay/Railway as the production direction.

**How to apply:** Keep the access model intact: one-time Pix payment grants the buyer access, each package defines its invite limit, guests can participate but cannot invite others, and webhook events must be authenticated and idempotent. Persist sessions, invites, and processed webhook IDs in PostgreSQL so an API restart cannot erase paid access. Keep provider credentials in Railway secrets, never in source.

For transparent Pix creation, Abacate Pay expects the session identifier as `data.externalId`; retaining it in `data.metadata.externalId` is useful for the existing webhook compatibility path but does not replace the top-level field.

**Why:** The current provider documentation lists `externalId` directly in the transparent-charge payload, and omitting it can cause Pix generation to be rejected.

**How to apply:** Send both fields from the server-side transparent Pix adapter, using the internal checkout session ID for each.