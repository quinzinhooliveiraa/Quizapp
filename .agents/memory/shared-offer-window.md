---
name: Shared offer window
description: How the five-minute discount stays consistent between the personalized sale page and checkout.
---

The personalized sale page and the checkout must resolve the offer through the same visitor-key-backed offer window, rather than starting separate client timers.

**Why:** Buyers should not see one countdown on the offer page and a different price or deadline after opening checkout; the server also owns the BR/PT full and discounted prices.

**How to apply:** Reuse the offer-state endpoint and visitor identity for both surfaces. Include the selected `regiao` query in every offer-state request so BR/PT cannot drift between the sale page and checkout. Let the server determine the amounts; the client should only render the returned deadline and active price.