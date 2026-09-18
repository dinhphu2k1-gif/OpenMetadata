---
name: openmetadata-debug-ui
description: OpenMetadata UI debugging guide. Use when explicitly invoked via /openmetadata-debug-ui to investigate UI bugs and rendering errors.
---

# OpenMetadata UI Debugging Guide

## 1. Targeted Investigation Path
- **Follow Execution Path**:
  ```text
  Route / Page (`src/pages/`)
  → Component (`src/components/`)
  → API Client (`src/rest/`)
  → State / Hook / DTO Mapping
  ```
- **Inspect Narrowly**: Open only files directly on the stack trace or execution path. Avoid repo-wide grep searches.

## 2. Common OpenMetadata UI Issues
- **Permissions & RBAC**: Check if user role/persona restricts the entity or state (e.g., Draft vs Approved terms). Inspect policy conditions when data is unexpectedly hidden.
- **Async State & Null Checks**: Verify loading states and API response data mapping before rendering properties.
- **DTO Mapping**: Verify data contracts against TypeScript models in `src/generated/`.

## 3. Fix Discipline
- Find the earliest point where state or data becomes incorrect, rather than patching symptoms with random optional chaining (`?.`).
- Apply the minimal viable fix consistent with existing project code. Avoid modifying unrelated files.
