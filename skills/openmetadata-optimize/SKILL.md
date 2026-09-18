---
name: openmetadata-optimize
description: OpenMetadata performance guide. Use when explicitly invoked via /openmetadata-optimize to fix UI lag, heavy queries, and pagination.
---

# OpenMetadata Performance Guide

## 1. Frontend & Table Optimization
- **Server-side Pagination**: Always use server-side pagination with standard page sizes (15, 25, 50). Never load thousands of records into client memory.
- **API Field Projection**: Pass explicit `fields=` query parameter to fetch only required attributes instead of full entity payloads.
- **Lazy Loading**: Only load heavy secondary data (Lineage, Profiler, Test Cases, Sample Data) when the user switches to that specific tab, not on page mount.
- **Search Debounce**: Debounce search and filter inputs by 250–400ms to eliminate rapid duplicate requests.
- **Selective Memoization**: Fix request cascades and props instability first before adding `useMemo` or `useCallback`.

## 2. API & Backend Discipline
- **PostgreSQL vs OpenSearch**:
  - PostgreSQL = authoritative metadata and entity CRUD.
  - OpenSearch = search, discovery, and aggregations.
- **Eliminate N+1 Calls**: Avoid looping over items to fetch individual details; use batch APIs or projection fields.
- **Avoid Bypassing APIs**: Never query backend stores directly from the frontend; use standard OpenMetadata REST clients in `src/rest/`.

## 3. Execution Discipline
- Identify the exact slow component or endpoint first before proposing changes.
- Apply surgical, minimal fixes. Avoid sweeping architectural rewrites.