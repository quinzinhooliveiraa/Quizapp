---
name: Buyer access history
description: How to interpret the paid-buyer access marker for records created before access-use tracking existed.
---

The admin “paid without access used” view must not classify legacy buyers with completed onboarding as unused when their access timestamp is null.

**Why:** the access-use timestamp was introduced after older sessions already existed, so those records have no reliable login/open event. Completed onboarding is the durable historical signal available for excluding known-used buyers.

**How to apply:** for new sessions, use the access-use timestamp set on login or access opening; for legacy rows with a null timestamp, exclude rows whose onboarding is already complete from the unused-access filter.