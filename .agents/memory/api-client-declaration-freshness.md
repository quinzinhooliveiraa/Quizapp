---
name: API client declaration freshness
description: Stale project-reference declarations can hide fields already present in generated source types.
---

When a shared generated API type appears to be missing a field that is present in its source declaration, rebuild the referenced package declarations before changing the consumer or contract.

**Why:** The web app typecheck can resolve the compiled declaration output of `@workspace/api-client-react`, which may lag behind the generated source after an API contract update.

**How to apply:** Run the package project-reference build with force before diagnosing the app code; only change the API schema or consumer if the rebuilt declaration still disagrees.