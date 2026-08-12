---
name: Perguntas preview workflow
description: Preview workflow behavior for the Perguntas de Conexão web artifact.
---

The root Perguntas de Conexão preview is served by the existing named workflow. A second artifact-managed web workflow for the same frontend can fail because both processes claim the same port.

**Why:** The workspace contains both a legacy named workflow and an artifact-registered workflow for this product.

**How to apply:** Restart the existing `Perguntas de Conexão` workflow when validating this app; do not create another service for the same frontend.