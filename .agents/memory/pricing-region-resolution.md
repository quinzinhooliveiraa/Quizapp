---
name: Pricing region resolution
description: The API proxy does not expose a usable country header in the tested environment.
---

Use `Accept-Language` as the automatic region signal until the deployment provides a trusted country header; keep BR as the safe default and allow only fixed BR/PT query overrides.

**Why:** Requests through both the local API and the Replit proxy exposed no country/geolocation header, while `pt-PT` reliably identified the Portugal variant.

**How to apply:** Keep region selection server-owned for checkout amounts and currencies. Do not trust a client-supplied price, currency, or arbitrary region value.