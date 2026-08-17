---
name: Drizzle non-TTY schema conflicts
description: Drizzle Kit behavior when development schema changes remove or rename PostgreSQL columns.
---

Drizzle Kit can require an interactive confirmation for column drops or renames even when the configured `push-force` script is used from a non-TTY workflow.

**Why:** Managed shell commands in this environment do not provide a TTY, so a schema push can fail before applying an explicitly requested column change.

**How to apply:** Treat the push output as a schema-diff confirmation requirement; verify the development schema before applying the intended change, and keep production schema changes on the platform's publish flow.