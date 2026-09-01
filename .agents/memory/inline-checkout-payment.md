---
name: Inline checkout payment
description: The first checkout owns payment method selection, Pix QR state, and card payment fields without a separate payment screen.
---

Payment creation and payment entry must remain inside the first checkout modal. Selecting Pix or card may expand an inline panel, but the final checkout CTA must not transition to a separate Pix-generation or payment page.

**Why:** The intended buyer journey is transparent: after the quiz, the buyer enters their details, chooses Pix or card, sees the corresponding payment UI in place, and completes payment there.

**How to apply:** Preserve the existing payment API, webhook, polling, and Stripe setup, but keep their loading, QR, wallet, and card-field states rendered inside the initial checkout layout.