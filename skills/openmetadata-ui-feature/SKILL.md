---
name: openmetadata-ui-feature
description: OpenMetadata UI feature guide. Use when explicitly invoked via /openmetadata-ui-feature to build new components, forms, and pages.
---

# OpenMetadata UI Feature Guide

## 1. Project Conventions & Architecture
- **UI Components**: Use existing Ant Design (AntD) primitives (`Button`, `Table`, `Modal`, `Form`, `Typography`, `Card`).
- **Styling**: Use existing Less stylesheets (`.less`) located in component directories; follow project naming and spacing tokens.
- **Routing**: Register new routes in `src/components/AppRouter/AuthenticatedAppRouter.tsx` and `src/constants/routes.ts`.
- **API Calls**: Implement API methods in `src/rest/` using standard Axios patterns. Do not fetch directly in components without client functions.
- **Localization**: Use `react-i18next` with existing translation keys. Avoid hardcoding English or Vietnamese strings directly into UI markup.

## 2. Implementation Discipline
- **Find Existing Patterns**: Look for similar existing tables, modals, or forms before writing new patterns.
- **Keep Scope Minimal**: Modify only the necessary feature files. Never refactor unrelated files or install unnecessary packages.
- **State & Permissions**: Follow existing permission checks (`usePermissionProvider`) before rendering actions or buttons.
