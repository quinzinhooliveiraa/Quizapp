---
name: Orval Zod barrel collisions
description: Non-obvious export conflict when Orval generates Zod request schemas and TypeScript body types with the same name.
---

When Orval generates a request-body schema whose name matches a generated TypeScript body type, do not star-export both generated barrels from the package entrypoint. Keep the Zod schemas as the direct exports and expose generated TypeScript types through a namespace.

**Why:** TypeScript reports duplicate exported members during the workspace composite build, even though the generated files themselves are valid.

**How to apply:** After codegen, check the package entrypoint because Orval may append a type star-export; replace it with a namespace export if a new body operation creates a collision.