---
name: Artifact build environment
description: Environment variables required when validating this monorepo outside its managed workflows
---

Manual builds of artifact Vite apps require both `PORT` and `BASE_PATH`; managed workflows provide them automatically.

**Why:** Without those variables, a valid frontend build fails while loading the Vite config. The workspace-wide build can also stop in an unrelated artifact whose config requires `PORT`.

**How to apply:** For targeted web validation, provide the artifact's port and base path. Treat an aggregate build failure in another artifact separately from the API or web package being changed.