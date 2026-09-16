---
name: Image optimization formats
description: Format and compatibility decisions for reducing Perguntas de Conexão image payloads.
---

Large quiz and landing-page raster artwork should use high-quality WebP, while icons, favicon, and Open Graph assets should remain PNG for compatibility. Existing photographic backgrounds can remain JPEG when a WebP conversion produces a larger file.

**Why:** A mixed strategy reduced the public image payload substantially without applying lossy conversion to compatibility-sensitive assets or making already-small photographic backgrounds larger.

**How to apply:** When adding or replacing images, compare encoded byte size and rendered role before choosing a format; update every runtime path when changing an extension.