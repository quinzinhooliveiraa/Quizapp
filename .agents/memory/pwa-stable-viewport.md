---
name: PWA stable viewport
description: Stable viewport behavior for installed mobile PWAs in the Perguntas app.
---

Installed PWAs should size the main experience from the layout viewport rather than `visualViewport` resize events. Browser chrome and keyboard animation can change `visualViewport` during ordinary scrolling, making a fixed-height card deck appear to jump.

**Why:** The app uses a full-height card-deck shell, so transient visual viewport changes are visible as random movement instead of a useful reflow.

**How to apply:** Keep the installed-PWA height stable after initial measurement; update it on orientation changes, and reserve live `visualViewport` resizing for the non-installed browser experience where it is useful.