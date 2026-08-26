````markdown
---
name: openmetadata-debug-ui
description: Debug frontend/UI issues using a narrow-first, evidence-driven approach. Use for broken interactions, rendering issues, state bugs, API-related UI problems, console errors, regressions, and frontend performance issues.
---

# Debug UI

## Goal

Find the root cause quickly with the smallest possible investigation scope.

Core principle:

> Narrow → Trace → Evidence → Root Cause → Minimal Fix

Do not explore the repository broadly unless current evidence requires it.

## Investigation

Start from the available symptom:

- UI behavior
- Console error
- Stack trace
- Network error
- Reproduction steps
- Expected vs actual behavior

Identify the smallest relevant scope:

```text
Route / Page
→ Component
→ Handler
→ Hook / State
→ API
→ Transformation
→ Render
````

Skip unrelated layers.

If a stack trace points to a file, start there.

## Regression First

If the issue may have appeared after recent changes, inspect first:

```bash
git status
git diff
git diff --stat
```

Prioritize changed files that are part of the failing execution path.

Do not investigate unrelated old code until evidence points there.

## Trace the First Incorrect Value

Do not stop at the line where the error appears.

Trace backward until finding the first incorrect:

* value
* prop
* state
* API response
* transformation
* condition

Example:

```text
Render failure
← invalid props
← incorrect state
← response mapping
← API response
```

The earliest incorrect point is the primary root-cause candidate.

## UI Checks

When relevant, inspect:

* props and state
* conditional rendering
* loading / empty / disabled states
* permissions
* `useEffect`, `useMemo`, `useCallback` dependencies
* stale state / stale closures
* async race conditions
* form state
* routing/query params
* API response mapping
* unexpected remounts

Only inspect checks relevant to the symptom.

## API Checks

For API-related issues verify:

```text
UI
→ API function
→ URL / params / payload
→ response
→ transformation
→ state
→ render
```

Do not assume the backend is wrong without evidence.

## Search Rules

Expand in this order:

1. Stack-trace file
2. Recently changed files
3. Current component
4. Direct imports
5. Related hooks
6. Related API client/utilities
7. Parent/child components
8. Wider repository search

Prefer following imports and execution paths over broad keyword searches.

## Fix Rules

Do not:

* fix by trial and error
* hide errors with unnecessary optional chaining/null checks
* refactor unrelated code
* modify many files unnecessarily
* add dependencies unless required

Before changing code, be able to answer:

1. What is incorrect?
2. Where does it first become incorrect?
3. Why does it become incorrect?
4. Why will the proposed change fix the root cause?

Prefer the smallest fix consistent with existing project conventions.

## OpenMetadata UI

For OpenMetadata UI issues, investigate frontend code first.

Avoid backend Java, ingestion, generated code, unrelated tests, or unrelated pages unless frontend evidence points there.

## Output

Report:

```text
## Root Cause
...

## Execution Path
...

## Evidence
- file:line

## Confidence
High / Medium / Low

## Minimal Fix
...
```

If root cause is not confirmed, continue with the narrowest next investigation instead of guessing.

## Core Rules

> Fewer files, deeper tracing.

> Find where the error begins, not only where it appears.

> Expand scope only when evidence requires it.

```
```
