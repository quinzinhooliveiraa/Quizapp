---
name: Quiz-lead discount deadlines
description: Keep abandoned-email deadline copy and resumed quiz-lead checkout aligned.
---

When resuming a quiz lead, calculate the five-day discount deadline from the lead’s creation time, even if a linked checkout session was created later. Use the same duration constant for email copy and `/retomar`.

**Why:** Starting the clock from the later session would extend the offer beyond the deadline promised in the email.

**How to apply:** Keep the lead’s original deadline through session creation or reuse. Do not restart the separate 10-minute offer window or change payment-price locking.
