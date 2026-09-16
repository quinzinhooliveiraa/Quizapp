---
name: Image preloading in preview
description: Browser image preloading behavior in the app preview runtime.
---

Use `document.createElement("img")` for client-side image preloading instead of relying on the global `Image` constructor.

**Why:** The preview runtime raised an opaque error inside the error boundary when a climate-card preloader instantiated `new Image()`. Using a DOM image element removed the failure while preserving the preload behavior.

**How to apply:** When a UI transition depends on an image being ready, preload with a cached `img` element and wait for its load/error promise before committing the visual state change.