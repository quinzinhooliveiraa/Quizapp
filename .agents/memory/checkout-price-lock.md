---
name: Checkout price locking
description: How the checkout keeps a discount stable after payment creation and across abandonment resumption.
---

The server must persist the exact amount selected when a checkout session is created and return it in the creation response. The client must also retain that amount for the active Pix or card state, so an offer timer expiring later cannot change the displayed or charged price. Resume links must reuse the stored amount when reusing or recreating a pending Pix charge.

**Why:** A buyer can generate a discounted charge, leave briefly to complete a bank payment, and return after the offer timer ends. Recomputing the price from the current offer window makes the UI disagree with the already-created provider charge and makes recovery links unsafe.

**How to apply:** Treat the session amount as authoritative after payment creation. Use the live offer window only before a charge exists; after that, derive the checkout summary, provider request, and resume flow from the stored amount.