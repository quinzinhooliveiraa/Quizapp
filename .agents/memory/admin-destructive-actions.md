---
name: Admin destructive actions
description: Safety pattern for irreversible admin data operations.
---

Destructive admin operations should be scoped by the same filters visible in the affected report and require an explicit confirmation phrase before the mutation.

**Why:** A broad cleanup action can remove real customer history along with test traffic, and a visual confirmation alone is too easy to trigger accidentally.

**How to apply:** Keep authorization on the server, use a transaction, preserve the active admin identity, report deleted counts, and clearly state provider-side payments are not canceled or refunded.