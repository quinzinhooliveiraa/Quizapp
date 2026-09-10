---
name: LP1 diagnosis narrative guard
description: Shared narrative personalization rules when the LP1 quiz reuses the LP3 narrative engine
---

Positive LP1 outcomes such as beginning and healthy must not receive negative personalization tails about accumulated problems or conversations that only resolve logistics.

**Why:** LP1 translates its three answers into the shared LP3 answer shape. Without passing the selected narrative type into personalization generation, a positive diagnosis can contradict itself.

**How to apply:** Whenever LP1 or another funnel reuses `selectLp3Narrative`, keep the narrative type available while generating personalizations and gate negative tails against positive narrative types.