---
name: AbacatePay description charset
description: AbacatePay rejects non-ASCII punctuation in transparent Pix descriptions.
---

Transparent Pix descriptions sent to AbacatePay must use provider-safe ASCII punctuation; an em dash (`—`, U+2014) causes the API to reject the charge.

**Why:** The provider returned a 400-style validation error for the em dash even though the amount, endpoint, authentication, and response contract were valid.

**How to apply:** Keep payment descriptions in plain ASCII (for example, use `-` instead of `—`) and sanitize any future user- or content-derived description before sending it.