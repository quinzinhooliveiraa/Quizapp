---
name: LP3 CSS formatting
description: Formatting constraint for narrow LP3 style changes.
---

When making narrow LP3 CSS changes, preserve unrelated legacy formatting and review the diff after running a formatter.

**Why:** The large LP3 stylesheet contains intentionally preserved formatting; automatic CSS reflow can create unrelated changes that obscure a typography-only request.

**How to apply:** Format the requested declarations, then revert any formatter-only reflow outside the approved selectors before verifying the final diff.