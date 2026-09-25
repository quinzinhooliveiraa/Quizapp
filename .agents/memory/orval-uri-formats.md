---
name: Orval URI formats
description: Compatibility constraint between OpenAPI URI formats and the workspace Zod generator
---

OpenAPI fields that use `format: uri` can make Orval emit `zod.url()`, which is unavailable in the workspace's installed Zod version. Keep the field as a bounded string in the generated contract and validate the URL explicitly at the server boundary.

**Why:** A normal codegen run can otherwise fail the shared library typecheck before application packages are checked.

**How to apply:** When adding URL fields to `lib/api-spec/openapi.yaml`, prefer an explicit handler-level URL validation unless the project's Zod/Orval versions are upgraded together.