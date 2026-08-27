---
name: Testimonials source
description: Durable rule for keeping LP1 and LP3 testimonials sourced from one official array
---

LP1 and LP3 must consume the same shared official testimonials array. If LP3 needs to preserve a smaller existing presentation, filter that shared array rather than copying testimonial objects or text.

**Why:** The landing page had the canonical testimonials while LP3 contained a duplicated subset, creating a risk that the two pages would drift.

**How to apply:** When testimonial content changes, update only the shared source and preserve any existing LP3 selection as a filter over that source.