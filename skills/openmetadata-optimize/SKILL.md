---
name: openmetadata-optimize
description: >
  Diagnose and optimize OpenMetadata UI, API, PostgreSQL, and OpenSearch
  performance. Use for laggy pages, slow search/filter, slow entity views,
  lineage, tables, glossaries, domains, custom UI, slow APIs, expensive SQL or
  OpenSearch queries, duplicate requests, N+1 patterns, large payloads, or
  performance regressions. Trace UI -> API -> PostgreSQL/OpenSearch, measure
  first, fix the real bottleneck, and verify before/after.
---

# OpenMetadata Performance

## Target

- OpenMetadata frontend
- OpenMetadata API/server
- PostgreSQL
- OpenSearch

## Main Rule

Never optimize the layer that only shows the symptom.

Trace:

```text
UI
→ Network
→ OpenMetadata API
→ Repository / Service
→ PostgreSQL or OpenSearch
→ Response
→ Render
```

Measure first. Change one thing. Measure again.

## Modes

### UI
Use for laggy pages, repeated requests, typing lag, large tables, or excessive renders.

### QUERY
Use for slow API, SQL, OpenSearch, filtering, aggregation, or high backend latency.

### FULLSTACK
Default when the bottleneck is unclear.

# Workflow

## 1. Reproduce

Identify:

- page/component
- user action
- endpoint
- response time
- response size
- request count
- whether it repeats

Do not change code before reproducing.

## 2. Baseline

Capture when possible:

- page load time
- API latency
- request count
- payload size
- render count
- PostgreSQL execution time
- OpenSearch `took`
- p50/p95 under load

## 3. Classify

Choose one primary bottleneck:

- `FRONTEND`
- `API_FANOUT`
- `POSTGRESQL`
- `OPENSEARCH`
- `PAYLOAD`
- `RESOURCE_CONTENTION`

Do not optimize every layer at once.

# UI

## Network First

Before changing React code, inspect Network.

Look for:

- duplicate requests
- sequential requests that could be parallel
- calls on every render
- calls on every keystroke
- hidden-tab loading
- unnecessary refetch
- oversized JSON
- full entity fetches for summary views

Fix request behavior before memoization.

## Search

For interactive search:

- debounce input
- cancel/ignore stale requests
- avoid empty searches unless needed
- keep newest result authoritative

Typical debounce: `200–400 ms`.

## Lazy Data

Load expensive secondary data only when needed:

- lineage
- profiler
- sample data
- usage
- joins
- tests
- followers
- custom properties

Use API field selection when available.

## Tables

- use server-side pagination
- avoid thousands of rows in client memory
- keep stable keys
- virtualize only when DOM size is proven to be the problem

## React

Profile before using `useMemo`, `useCallback`, or component memoization.

Check first:

- unstable props
- large context updates
- repeated sorting/filtering
- duplicated state
- effect chains
- parent renders affecting large subtrees

Do not memoize everything.

# OpenMetadata API

For each slow endpoint, determine whether it uses:

- PostgreSQL
- OpenSearch
- both

Use this model:

```text
PostgreSQL = authoritative metadata/entity state
OpenSearch = search/discovery
```

Do not bypass OpenMetadata APIs from the UI.

Check for:

- unnecessary fields
- large page sizes
- per-item relationship lookups
- repeated owner/tag/domain resolution
- list endpoint followed by many detail calls

Treat repeated per-item work as possible N+1.

# PostgreSQL

## Capture Real SQL

Use the SQL actually executed by OpenMetadata.

For safe SELECT statements:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Be careful with `ANALYZE` on mutating statements.

## Read the Plan

Look for:

- large sequential scans
- bad row estimates
- nested loops over large inputs
- repeated subqueries
- expensive sorts/spills
- large hash operations
- many rows removed by filter
- high buffer reads
- functions preventing index use

A sequential scan is not automatically bad.

## Indexes

Before adding an index, check:

- predicate
- join key
- sort
- selectivity
- table size
- existing indexes
- write cost

Do not index every column used in `WHERE`.

For composite indexes, match the actual query pattern.

## JSON / JSONB

For slow JSON queries:

- inspect the exact operator
- inspect index compatibility
- avoid repeated extraction of large documents
- add expression/GIN indexes only for proven patterns

## N+1

Bad:

```text
list entities
→ query owner per entity
→ query tags per entity
→ query domain per entity
```

Prefer:

- bulk fetch
- batched relationship retrieval
- existing OpenMetadata bulk-field methods
- joins only when they do not explode row counts

## Pool

Treat connection-pool tuning as a capacity issue, not query tuning.

Investigate only when requests wait for connections under concurrency.

Do not increase pool size blindly.

# OpenSearch

## Capture Real Query DSL

Inspect:

- query type
- filters
- aggregations
- `_source`
- `size`
- sort
- pagination
- wildcard/regexp usage

Do not optimize only from the search text visible in UI.

## Filter vs Score

Use filter context for exact constraints where scoring is unnecessary.

Typical filters:

- entity type
- service
- domain
- owner
- tags
- tier
- deleted flag
- keyword fields

## Expensive Patterns

Investigate:

- leading wildcard
- broad regexp
- scripts
- large `size`
- deep `from + size`
- high-cardinality aggregations
- large nested queries
- oversized `_source`

## Pagination

For deep result sets, prefer stable cursor/search-after patterns when compatible
with OpenMetadata.

## Mapping

Before changing mappings:

1. inspect current mapping
2. inspect field type
3. determine `text` vs `keyword`
4. inspect OpenMetadata search-index code
5. decide whether reindex is required

Never patch production mappings blindly.

## Reindex

After mapping/search-document changes:

- identify affected indexes
- use OpenMetadata-supported reindex flow
- verify index/document state
- rerun representative searches

# OpenMetadata Guardrails

## Version First

Before modifying performance-sensitive code:

- identify exact OpenMetadata version/branch
- inspect that version's code
- inspect deployment configuration

Do not assume `main` matches the deployed system.

## Preserve Framework Behavior

When editing backend code:

- follow existing repository/service patterns
- preserve authorization
- preserve entity relationships
- preserve search indexing
- use bulk retrieval where available
- avoid direct DB shortcuts unless justified

Performance must not break metadata consistency or security.

## Search Indexes

Before changing search behavior:

1. identify the entity search index
2. inspect indexed fields
3. inspect mapping
4. inspect query construction
5. determine whether reindex is required

# Typical Cases

## Slow Search UI

```text
many requests while typing
→ fix debounce/stale requests
→ retest
```

If one request is still slow:

```text
API slow
→ OpenSearch dominates
→ inspect Query DSL/profile
→ targeted query fix
→ retest
```

## Slow Entity Page

```text
main entity API fast
+ many relationship calls
→ API fan-out / N+1
→ bulk or lazy retrieval
→ retest
```

## Slow List API

```text
API slow
→ PostgreSQL dominates
→ capture SQL
→ EXPLAIN (ANALYZE, BUFFERS)
→ targeted SQL/index/bulk fix
→ retest
```

# Patch Rules

When changing code:

1. Read relevant code first.
2. Identify measured bottleneck.
3. Make smallest patch.
4. Do not refactor unrelated code.
5. Preserve API contracts and authorization.
6. Preserve loading/error/empty states.
7. Add tests when practical.
8. Explain why the patch helps.
9. Show how to verify before/after.

# Never Default To

- `useMemo` everywhere
- `useCallback` everywhere
- increasing DB pool immediately
- increasing OpenSearch heap immediately
- indexes on every filter column
- more shards without evidence
- loading everything and caching forever
- direct OpenSearch calls from UI
- removing auth checks
- disabling reindex/refresh blindly
- increasing timeout to hide slowness

Timeout increases are not performance fixes.

# Output

For a concrete issue, return:

## Bottleneck
What is slow.

## Evidence
Request timing, SQL plan, OpenSearch query/profile, or render evidence.

## Fix
Smallest targeted change.

## Why
Why it addresses the measured cause.

## Verification
Exact before/after test.

Avoid generic checklists when a concrete bottleneck exists.

# Default Instruction

Diagnose this OpenMetadata performance issue end to end.

The deployment uses PostgreSQL as the metadata database and OpenSearch for search.

Start from the UI symptom, identify the exact API request, and determine whether
the bottleneck is frontend rendering, API fan-out, PostgreSQL, OpenSearch,
payload size, or resource contention.

Measure before changing code.

For PostgreSQL, inspect the real SQL and execution plan before recommending
indexes or query changes.

For OpenSearch, inspect the real Query DSL, mapping, filters, aggregation,
pagination, and returned fields before changing search behavior.

For UI, inspect network and render behavior before adding memoization.

Make the smallest evidence-based fix and verify the same scenario before and after.