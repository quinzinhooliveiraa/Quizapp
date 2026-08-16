---
name: Abacate checkout status
description: The provider endpoint used to verify checkout payment status.
---

The direct Abacate Pay status fallback must call `GET /v2/checkouts/get?id=<checkout-id>`, not `GET /v2/billings/<id>`.

**Why:** The billing-shaped route returned 404 for the checkout identifier, which made a paid webhook with an invalid HMAC remain unconfirmed and return 401.

**How to apply:** Keep the checkout identifier returned by checkout creation and use it for both webhook fallback verification and the session status polling path.