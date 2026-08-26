````markdown
---
name: openmetadata-ui-feature
description: Develop or modify OpenMetadata frontend features using existing project patterns. Use for new UI features, pages, components, forms, actions, API integrations, and frontend behavior changes in the OpenMetadata codebase.
---

# OpenMetadata UI Feature Development

## Goal

Implement UI features correctly with minimal changes while preserving existing OpenMetadata architecture, conventions, and user experience.

Core principle:

> Understand → Find Existing Pattern → Plan → Implement → Verify

Do not invent a new pattern when the project already has one.

---

## 1. Understand the Request

Before modifying code, identify:

- What the user wants
- Expected UI behavior
- Entry page/route
- User interactions
- Data required
- API interaction
- Permissions or states involved
- Acceptance criteria

Resolve obvious details from the codebase instead of asking unnecessary questions.

---

## 2. Inspect Before Implementing

Find the smallest relevant area of the repository.

Start from:

```text
Route / Page
→ Existing Component
→ Related Components
→ Hook / State
→ API Client
→ Types / Utilities
````

Inspect only enough code to understand the existing pattern.

Prefer following imports and references over broad repository searches.

Do not explore unrelated backend, ingestion, generated code, or tests unless required.

---

## 3. Find an Existing Pattern

Before creating new code, search for the closest existing OpenMetadata feature.

Look for examples with similar:

* page layout
* modal/drawer
* form
* table/list
* dropdown/select
* API interaction
* loading state
* permission handling
* error handling
* empty state
* confirmation flow

Reuse the project's existing:

* components
* hooks
* utilities
* constants
* types
* API clients
* styling patterns
* localization patterns

Avoid duplicating existing functionality.

---

## 4. Create a Minimal Plan

Before coding, determine:

```text
Files to modify
Files to create
Data flow
Component boundaries
API flow
State ownership
```

Prefer the fewest files necessary.

Do not refactor unrelated code as part of feature development.

---

## 5. Implementation Rules

Follow existing OpenMetadata conventions exactly.

### Components

* Keep components focused
* Reuse existing components before creating new ones
* Keep business/data logic separate from presentation when practical
* Avoid unnecessary component abstraction
* Avoid deeply coupled components

### State

Use the existing state pattern of the surrounding feature.

Do not introduce new state-management approaches unless necessary.

Keep state as close as possible to where it is used.

Avoid duplicated or derived state when it can be computed.

### API

Reuse existing API clients and types.

Follow:

```text
User Action
→ Handler
→ API Client
→ Response
→ State
→ Render
```

Handle relevant:

* loading
* success
* error
* empty state

Do not call APIs directly from presentation code if the existing area uses another pattern.

### Styling

Reuse the existing OpenMetadata design system and styling conventions.

Do not introduce:

* new design systems
* unnecessary custom CSS
* inconsistent spacing
* duplicated UI primitives

Match nearby UI behavior and visual patterns.

### Types

Prefer existing types.

Avoid:

* `any`
* unnecessary type assertions
* duplicate interfaces
* loosely typed API responses

### Localization

Do not hardcode user-facing text when the surrounding OpenMetadata code uses localization.

Reuse existing translation keys when appropriate.

### Permissions

If the feature modifies data or exposes restricted actions, inspect and follow the existing permission pattern.

Do not invent new permission logic.

---

## 6. Keep Scope Tight

Do not:

* refactor unrelated files
* upgrade dependencies
* introduce libraries without necessity
* rewrite working components
* modify backend code without evidence it is required
* change existing behavior outside the requested feature
* perform broad cleanup while implementing the feature

If an unrelated issue is discovered, mention it separately instead of fixing it.

---

## 7. Regression Awareness

Before editing an existing feature, understand its current behavior.

When useful, inspect:

```bash
git status
git diff
```

After implementation, verify that existing behavior remains unchanged except for the requested feature.

---

## 8. Verification

Before considering the task complete, verify:

* requested behavior works
* loading/error/empty states still behave correctly
* existing interactions are preserved
* API parameters and payloads are correct
* types are valid
* no obvious unused code/imports remain
* no unrelated files were modified

Run the narrowest relevant checks available in the project.

Prefer targeted validation over expensive repository-wide checks unless necessary.

---

## Working Style

During implementation:

1. Inspect first
2. Identify the nearest existing pattern
3. Make the smallest viable change
4. Verify immediately
5. Expand scope only when evidence requires it

Do not repeatedly analyze the whole repository.

---

## Output

Before implementation, briefly report:

```text
## Existing Pattern
<closest reusable implementation>

## Files
<files likely to change>

## Plan
1. ...
2. ...
3. ...
```

After implementation, report:

```text
## Changed
- file — change

## Behavior
<what now works>

## Verification
<checks performed>

## Notes
<any remaining risk or limitation>
```

Keep reports concise.

---

## Core Rules

> Reuse before creating.

> Follow the surrounding code, not personal preference.

> Make the smallest change that fully implements the feature.

> Do not modify unrelated code.

> Explore narrowly and expand only when necessary.

```
```
