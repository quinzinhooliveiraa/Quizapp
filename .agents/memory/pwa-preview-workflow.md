---
name: Perguntas preview workflow
description: Preview workflow behavior for the Perguntas de Conexão web artifact.
---

The Perguntas de Conexão preview is served by the artifact-managed web workflow. A duplicate legacy workflow for the same frontend can fail because both processes claim the same port.

**Why:** The workspace previously contained both a legacy named workflow and an artifact-registered workflow for this product; the duplicate legacy workflow was removed.

**How to apply:** Restart `artifacts/perguntas-de-conexao: web` when validating this app; do not create another service for the same frontend. Screenshot captures may use a fresh browser context, so a separate wait before taking a screenshot does not advance the splash timer; validate the loaded route with the capture itself.