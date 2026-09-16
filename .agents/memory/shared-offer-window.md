---
name: Shared offer window
description: How the five-minute discount stays consistent between the personalized sale page and checkout.
---

The personalized sale page and the checkout must resolve the offer through the same visitor-key-backed offer window, rather than starting separate client timers. State reads must never create or restart it; only the completed-quiz offer screen may start it.

**Why:** Buyers should not see one countdown on the offer page and a different price or deadline after opening checkout; the server also owns the BR/PT full and discounted prices.

**How to apply:** Use an explicit offer-start request only when the completed-quiz offer screen renders, then reuse the read-only offer-state endpoint and visitor identity for checkout. Include the selected `regiao` query in every request so BR/PT cannot drift. Keep the server's canonical offer table aligned with public pricing, let the server determine amounts, and let the client only render the returned deadline and active price.