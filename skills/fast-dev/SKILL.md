---
name: fast-dev
description: Surgical Fast-Track Execution Engine for editing, debugging, refactoring, and fixing code across Backend (Java), Frontend (React/TS), Ingestion (Python), and Docker/DevOps without slow monorepo scans or unsolicited planning.
---

# Fast Dev & Surgical Execution Engine

Use this skill whenever the user invokes `/fast-dev`, asks for fast execution, bug fixes, debugging, or code updates across the OpenMetadata codebase.

## 1. Zero Planning & Anti-Overhead Protocol
- **Planning by Demand Only**: By default, bypass planning and jump straight to execution. Create planning artifacts (`implementation_plan.md`, `walkthrough.md`) ONLY when the user explicitly requests a plan (e.g., "lập kế hoạch", "tạo plan").
- **Do NOT engage in long speculative reasoning**. Move directly to targeted inspection and execution.
- **Avoid repo-wide operations**: Never run `list_dir` or `grep_search` at the workspace root.

## 2. Pinpoint Targeting & Narrow-Scope Search
Always route queries directly to the target module to prevent scanning hundreds of thousands of files:
- **Backend / Java / API**:
  `OpenMetadata/openmetadata-service/src/main/java/...`
- **Frontend / React / UI**:
  `OpenMetadata/openmetadata-ui/src/main/resources/ui/src/...`
- **Ingestion / Python / Connectors**:
  `ingestion/src/metadata/...` or `openmetadata-python-client/...`
- **DevOps / Deployment / Compose**:
  `OpenMetadata/deploy/...` or root compose files
- **Spec / Schemas**:
  `OpenMetadata/openmetadata-spec/src/main/resources/json/schema/...`

**Search Rules:**
- Check user's `Active Document` first; if it matches the context, act on it directly.
- When searching, always supply `SearchPath` with a targeted subdirectory and restrict `Includes` (e.g., `*.java`, `*.tsx`, `*.py`, `*.json`).

## 3. Surgical Read & Edit Discipline
- **Locate line numbers first** with `grep_search` (using `MatchPerLine: true`).
- **Never view entire large files**. Inspect only the exact slice (40-80 lines) around the target symbol with `StartLine` and `EndLine`.
- **Single-shot patch**: Apply modifications immediately using `replace_file_content` (or `multi_replace_file_content` for non-contiguous changes).
- Maintain existing architecture, interfaces, and coding style; avoid unnecessary refactoring outside the requested scope.

## 4. Debugging & Verification Strategy
- **Debug fast**: Inspect specific error lines or log traces directly without reviewing unrelated modules.
- **NO Automatic Test Execution**: Do NOT automatically execute tests, test suites, or long compilation processes. The user will run tests and verification manually.
- **Zero Heavy Builds**: Never run automated builds or multi-module rebuilds unless the user explicitly tells you to do so.

## 5. Output Format
- Keep user communication concise, direct, and in Vietnamese (while preserving exact technical terms, symbols, and paths).
- Report only:
  1. What was identified / fixed.
  2. Clickable link to the modified file and line range.
