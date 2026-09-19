---
name: Payment reconciliation fallback
description: Payment access must recover when provider webhooks are delayed or absent.
---

Treat authenticated webhooks as the primary confirmation path, but periodically reconcile recent pending sessions directly with the configured payment providers. Reconciliation must be bounded, idempotent, and run before admin payment and landing-page reports are served.

**Why:** A buyer can complete payment while a webhook is delayed or lost, leaving the database and Admin UI showing "aguardando pagamento" even though provider status is already paid.

**How to apply:** Keep the server's `accessGranted` flag authoritative, poll only recent non-internal sessions with provider identifiers, and refresh open Admin views so confirmed access appears without a manual reload.