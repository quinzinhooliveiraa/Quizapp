---
name: Checkout attribution context
description: Where the landing visitor identity lives when a buyer starts checkout.
---

The landing-page visitor identity is kept in browser session storage, so checkout creation must read that storage context rather than assuming the identity is in local storage.

**Why:** The payment session needs the same visitor identity used by landing-page tracking to preserve attribution from CTA through purchase.

**How to apply:** When changing checkout initiation or attribution, verify the visitor identity source and keep the stored `sourceLp` aligned with the session that is created.