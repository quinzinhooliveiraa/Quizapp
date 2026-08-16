---
name: OpenAPI query parameter generation
description: Orval naming behavior when path and query parameters share an operation.
---

When an operation already generates a path-parameter type named after its operation, adding query parameters can make Orval emit a second type with the same exported name and break the shared Zod package. Keep the query parameter handled manually when the caller is a direct fetch, or explicitly customize the generator naming before documenting it.

**Why:** The checkout status lookup needs an optional billing identifier, but the generated `GetQuestionSessionParams` name collided with the existing generated validator during codegen.

**How to apply:** Before adding query parameters to an existing operation, run codegen and inspect exports. If the generated names collide, preserve the runtime query handling while avoiding a conflicting generated type or configure a distinct name.