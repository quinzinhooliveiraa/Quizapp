---
name: Quiz tracking event contract
description: The admin quiz funnel relies on explicit quiz-answer events whose screen and answer keys match the catalog.
---

The quiz admin funnel must receive an explicit completion event and a catalog-compatible summary event for compound stages; page-section observation is supplemental and must not be the sole source of quiz completion metrics.

**Why:** Detailed interaction events can be useful for analysis but will not populate a catalog row when their answer key differs from the catalog's summary key.

**How to apply:** When adding or changing a quiz stage, preserve detailed events if needed, then emit one final event using the exact catalog `screenId` and `answerKey` that the admin aggregation filters.