---
name: Modal overlay stacking
description: Responsive CSS ordering constraints for full-screen modal backdrops.
---

Full-screen modal backdrops need their final positioning and stacking rules after all legacy breakpoint blocks. Earlier desktop rules may intentionally narrow an overlay to the content workspace, which leaves the navigation rail and outer cards sharp and clickable.

**Why:** The app has accumulated multiple responsive layout passes; a correct-looking overlay rule can still be overwritten later in the stylesheet.

**How to apply:** For any modal that should block the whole app, finalize `position`, viewport insets, size, transform, stacking, and pointer-events in the last CSS block.