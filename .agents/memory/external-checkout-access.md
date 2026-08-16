---
name: External checkout access
description: The product uses one-time external checkout and package-based invite access.
---

Abacate Pay is the selected one-time checkout provider. The buyer purchases the Casal package through an external checkout, and access is granted only after an authenticated, idempotent `checkout.completed` webhook.

**Why:** The product now needs a real Pix/card payment flow, and the owner supplied Abacate Pay/Railway as the production direction.

**How to apply:** Keep the access model intact: one-time purchase grants the buyer access, each package defines its invite limit, guests can participate but cannot invite others, and webhook events must be authenticated and idempotent. Keep provider credentials in Railway secrets, never in source.