---
name: External checkout access
description: The product uses one-time external checkout and package-based invite access.
---

The checkout provider is intentionally undecided for now. Keep the sales page and webhook integration provider-agnostic until the user selects a platform.

**Why:** The owner wants an external checkout, but postponed connecting Stripe or Whop. Coupling the product to a provider before that choice would create avoidable rework.

**How to apply:** When connecting payments, preserve the access model: one-time purchase grants the buyer access, each package defines its invite limit, guests can participate but cannot invite others, and webhook events must be authenticated and idempotent.