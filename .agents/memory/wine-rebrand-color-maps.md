---
name: Wine rebrand color maps
description: Applying the Perguntas de Conexão purple-to-wine identity change safely.
---

The supplied purple-to-wine reference is primarily a hex map, but the complete visual rebrand also needs the extra dark PWA theme value, semantic color names, and translucent `rgba` effects checked separately.

**Why:** Those non-hex forms are easy to miss in a bulk replacement and can leave internal menus, modals, or the installed PWA carrying the old violet identity.

**How to apply:** After using the supplied map, search for old semantic names and inspect saturated violet-family `rgba` colors; preserve alpha, lightness, and contrast when shifting those effects to wine.