---
name: Checkout UI reuse
description: The landing pages share one checkout controller and presentation to avoid divergent payment journeys.
---

Use the existing checkout controller and modal for every landing-page entry point, including LP3. The landing page should only provide its source and CTA tracking; it must not navigate to another landing page to begin payment.

**Why:** A duplicated or partially wired checkout view can break compilation, lose attribution, or create a visibly separate purchase journey.

**How to apply:** When changing checkout UX, update the shared modal/controller and verify the LP-specific entry point calls it with the correct source (`lp3` for LP3).