# Plan triển khai lịch sử — Từ điển kỹ thuật: bản ghi theo khai báo, đọc qua index riêng

> **Cảnh báo:** Tài liệu này ghi lại một hướng triển khai cũ và không còn là kế hoạch đích. Quyết định
> ngày 2026-10-05 yêu cầu mọi bản ghi mới phải qua phê duyệt maker-checker; nhiều phần bên dưới vẫn mô tả
> mô hình Draft/published hoặc luồng không phiên bản cũ. Khi triển khai tiếp, phải lập plan mới từ
> [technical-dictionary-design.md](./technical-dictionary-design.md), đặc biệt §7.3, §10, §13 và §15.

> Trạng thái tài liệu: **Phase 1–5 đã code (chưa build/test); Phase 6 (tài liệu) đang cập nhật.** Cập nhật 2026-10-01. Chưa có phần nào được kiểm chứng trên MySQL/PostgreSQL/OpenSearch thật.
>
> Thiết kế đích: [Thiết kế Từ điển kỹ thuật](./technical-dictionary-design.md) (Đã chốt).
>
> **Lưu ý:** Thiết kế đích vẫn bỏ catalog version và bảng governed của TD nhưng có state machine phê duyệt
> bản ghi mới riêng tại §7.3. Các bước bên dưới có đụng tới generic workflow, bulk hoặc hai view
> `current`/`published` cần lập lại theo thiết kế mới trước khi triển khai.
>
> Ràng buộc: **không build, không chạy test** trong phiên làm việc; mọi bước kiểm chứng ở cuối do bạn chạy.

## Context

- Bootstrap sinh sẵn record Draft cho mọi Column (≈66k/service) → chậm (~18 phút ước tính), rác dữ liệu.
- `/glossaryTerms/search` và `/stats` nạp toàn bộ record vào RAM → `OutOfMemoryError` ở ~25k record (heap 384 MB).
- Quyết định: chỉ lưu Column **đã khai báo**; mọi thao tác đọc dùng index riêng
  `technical_dictionary_search_index`; ghi vào Postgres rồi đồng bộ sang index; không ghi record TD
  vào index glossary chung; bỏ "Tất cả phiên bản"; người có `canEditWorking` được xóa Draft chưa từng duyệt.

## Hiện trạng code (nhánh làm việc, chưa build)

Giữ lại (đúng thiết kế):
- Đã gỡ bootstrap: `TechnicalBootstrapJobService/View/DAO`, `TechnicalColumnScope`, `TechnicalDictionaryConfiguration`,
  endpoint `bootstrap-jobs`, mục `technicalDictionary:` trong `conf/openmetadata.yaml`,
  bảng `technical_bootstrap_job` (migration 1.13.3 → `DROP TABLE IF EXISTS`, bỏ khỏi `bootstrap/sql/schema/*.sql`).
- `TechnicalColumnSync` chỉ cập nhật source state của record đã khai báo.
- `TechnicalColumnSource.sourceExtension(...)` suy service/database/schema/table từ Column FQN.
- Import: `CREATE_RECORD`, `TechnicalImportLookups.columns(...)`, `TechnicalRecordWriter.createDraft(..., declaredValues, ...)`, `findRecord(...)`.
- UI: toolbar gọn (`TechnicalDictionaryToolbar`), banner bootstrap thu gọn (sẽ xóa hẳn ở Phase 5).

Sẽ thay/bỏ:
- `TechnicalColumnIndex.page()/counts()/Query/Page/Counts` (hướng ghép danh sách) → xóa; giữ `columnsOfTable()` + `ColumnDocument.toSource()` và thêm tìm kiếm cho màn "Thêm cột".
- Sửa đổi dở trong `TechnicalBootstrapJobService` (đã xóa file) — không còn liên quan.

Đã làm — Phase 1 (chưa build/test):
- Index riêng: `openmetadata-service/src/main/resources/elasticsearch/technical_dictionary_index_mapping.json`
  (không đăng ký trong `indexMapping.json`); package `glossary.technical.search`:
  `TechnicalSearchIndex` (alias + index vật lý `…_<timestamp>`, `_bulk` với `require_alias=true`,
  `refresh=wait_for`, `_aliases`, `_meta.mappingHash` để phát hiện đổi mapping — tất cả qua
  `SearchClient.rawSearchRequest`), `TechnicalIndexFields`, `TechnicalRepresentation`,
  `TechnicalDocumentAssembler` (thuần), `TechnicalDocumentBuilder` (đọc Postgres theo termId; scope
  Archived đọc manifest snapshot của catalog), `TechnicalSearchQueries` (duyệt bằng `search_after`),
  `TechnicalIndexSync` (ghi sau commit, outbox, worker định kỳ 60 giây), `TechnicalIndexRebuilder`.
- `TechnicalCdeInfo` dùng chung (`TechnicalRowDecorator` gọi lại nó).
- Outbox: `jdbi3/TechnicalIndexOutboxDAO`, bảng `technical_index_outbox` trong migration 1.13.3 và
  `bootstrap/sql/schema/*.sql`. Truy vấn identity theo id/keyset/scope trong `TechnicalSourceStateDAO`;
  manifest snapshot trong `TechnicalRecordQueryDAO`.
- Khởi động: `TechnicalDictionaryBootstrap` tạo/rebuild index khi chưa có hoặc mapping đổi, xử lý outbox,
  bật worker. Admin: `POST /v1/glossaries/{id}/technical-index/rebuild` (`GlossaryResource`).
- Đồng bộ đã gắn: `GlossaryVersioningService` (createWorking/saveWorking/transition/publish/archive/revoke:
  record TD → `TechnicalIndexSync.refresh`, không ghi `glossary_term_search_index`; outbox snapshot: TD bỏ
  `refreshPublishedIndex`, giữ projection; CDE Data Dictionary được duyệt → refresh record tham chiếu;
  catalog TD `N+1` được duyệt → refresh toàn bộ scope `N`; `flushSideEffects` tách record TD),
  `TechnicalImportCommitter`, `TechnicalColumnSync` (chỉ record đổi trạng thái nguồn),
  `GlossaryTermRepository.postCreate` (identity TD không qua lifecycle search index — TDX-11).
- `TechnicalRecordWriter.createDraft` trả về termId (null nếu Column đã khai báo); người gọi tự đồng bộ index.

Đã làm — Phase 2 (chưa build/test):
- `resources/glossary/GovernedScopeAuthorizer`: phần xác định scope + quyền tách từ
  `loadAuthorizedGlossaryFlatRows` (không nạp record); `GlossaryTermResource` dùng lại, hành vi không đổi.
- `resources/glossary/TechnicalDictionaryResource` (`/v1/glossaryTerms/technical`): `GET /search`, `GET /stats`
  (`totalColumns`, `totalTables`, `totalSources`, `approved`), `GET /columns`. Người không có `canViewWorking`
  (kể cả Consumer) đọc view `published` + `hasPublished=true`.
- `TechnicalSearchQueryBuilder` (thuần), `TechnicalSearchCriteria`, `TechnicalSearchParameters` (tái dùng
  `GlossaryBusinessVersionSearchService.validate` và `TechnicalRowMatcher.validate`, bỏ `versionView`),
  `TechnicalRowMapper` (thuần, shape `TechnicalRecordApiRow` + `hasPublished`), `TechnicalSearchService`.
- `TechnicalColumnIndex.search(q, limit)` cho màn "Thêm cột" (chỉ Column cấp cao nhất).
- Test (viết, chưa chạy): `TechnicalSearchQueryBuilderTest`, `TechnicalRowMapperTest`.
- Nhánh TD cũ trong `/glossaryTerms/search` và `/stats` vẫn giữ (gỡ ở Phase 4).

Đã làm — Phase 3 (chưa build/test):
- `POST /v1/glossaryTerms/technical/records` (`TechnicalRecordDeclaration`, `TechnicalRecordDeclarations`):
  Column đọc từ `table_entity`; quyền `EDIT_WORKING` trên scope tạo (`GovernedScopeAuthorizer.resolveCreateScope`,
  dùng chung với `GlossaryTermResource.create`); validate bằng `TechnicalRecordValidator.prepareDraft`,
  `TechnicalCdeReferenceResolver.resolveForDraft`, `TechnicalRankGuard.requireUnique`; CDE không bắt buộc;
  trùng → 409 `TD_COLUMN_ALREADY_DECLARED`; trả row đọc từ Postgres.
- `DELETE /v1/glossaryTerms/technical/records/{termId}` (`TechnicalRecordDeletion`): `canEditWorking`, working Draft,
  không có snapshot ở scope nào; xóa working + relationship + identity + source state trong một transaction.
  `DELETE /glossaryTerms/{id}` với TD vẫn bị chặn.
- `GlossaryTermResource`: bulk TD lấy termId từ index (`search_after`), trạng thái/revision đọc lại từ Postgres;
  export TD duyệt index và ghi streaming (`TechnicalExcelExporter.write(RowSource, …)`); import preview TD đọc
  record đã khai báo theo từng bảng trong file (`TechnicalImportTables`) qua index.
- Mã lỗi: thêm `TD_COLUMN_NOT_FOUND`, `TD_COLUMN_ALREADY_DECLARED`, `TD_DRAFT_NOT_DELETABLE`,
  `TD_INDEX_UNAVAILABLE`, `TD_NOT_INITIALIZED`; bỏ `TD_BOOTSTRAP_NOT_READY`.
- Duyệt toàn bộ index dùng `search_after` (sort `columnFqn`/`termId`), không dùng PIT (API PIT khác nhau giữa
  OpenSearch và Elasticsearch).

Đã làm — Phase 4 (chưa build/test):
- `GlossaryTermResource`: `/glossaryTerms/search` (có `parentBusinessVersion` hoặc glossary TD) và
  `loadFlatRows` từ chối TD bằng 400 chỉ sang `/v1/glossaryTerms/technical/*`; `/glossaryTerms/stats` cũ chỉ còn trả 400 đó;
  bỏ các tham số lọc TD, decorator và cache quyền theo dòng.
- `GlossaryBusinessVersionSearchService`: bỏ `applyVersionView`, `matchesText`, `profileFilters` (Criteria còn 12 trường).
- Xóa: `TechnicalStats`, `TechnicalRowDecorator`, `GovernedRowAuthorizationCache`, `TechnicalColumnIndex.page/counts/Query/Page/Counts`,
  `TechnicalRowMatcher.matches/keepLatest/wantsLatest/matchesText/versionView` (giữ `validate`), `TechnicalRowFields.SEARCH_TEXT/SORT_KEY`.
- Test: xóa `TechnicalStatsTest`, `TechnicalRowDecoratorTest`; viết lại `TechnicalRowMatcherTest` (chỉ `validate`); thêm
  `TechnicalDocumentAssemblerTest`; integration test `openmetadata-integration-tests/.../TechnicalDictionaryIT`.

Đã làm — Phase 5 (chưa build/test; UI):
- `rest/technicalDictionaryAPI.ts`: search/stats sang `/glossaryTerms/technical/*`, thêm `searchTechnicalColumns`,
  `declareTechnicalColumn`, `deleteTechnicalDraft`; bỏ `versionView` và toàn bộ type/hàm bootstrap; row có `hasPublished`.
- `useTechnicalDictionaryRecords`, `technicalDictionary.interface`, `TechnicalDictionaryRows` (`hasPublished`,
  `candidateToRow`, `canDeleteRow`): bỏ `versionView`.
- Page: bỏ polling và `TechnicalBootstrapStatus` (xóa file + style); nút **Thêm cột** (toolbar và trạng thái trống,
  khi catalog mở và `canEditWorking`); xóa Draft có `Modal.confirm`; trạng thái trống kèm Thêm cột/Import.
- Header 4 thẻ TDX-10 (`approved`); toolbar bỏ switch "Tất cả phiên bản"; table thêm action Xóa.
- Mới: `TechnicalAddColumnModal` (bước 1 chọn Column, bước 2 `TechnicalRecordModal` mode `create`),
  `TechnicalVersionHistory` (nhóm **Lịch sử phiên bản** trong modal xem/sửa, chỉ đọc).
- Import modal: nhãn `CREATE_RECORD`. i18n: `en-us.json`/`vi-vn.json` (đã xóa key bootstrap, `all-versions`).
- Test: cập nhật `TechnicalDictionaryPage.test.tsx`, `TechnicalDictionaryHeader.test.ts`, `TechnicalDictionaryRows.test.ts`;
  thêm `TechnicalAddColumnModal.test.tsx`.

---

## Phase 1 — Index riêng và đồng bộ (backend)

**1.1 Mapping + quản lý index** — package mới `org.openmetadata.service.glossary.technical.search`
- `resources/elasticsearch/technical_dictionary_index_mapping.json` (trong `openmetadata-service/src/main/resources`, không đăng ký trong `indexMapping.json` để Reindex của OpenMetadata không đụng vào).
  Tái dùng analyzer/normalizer của `openmetadata-spec/.../en/column_index_mapping.json`: `om_ngram`, `om_analyzer`, `lowercase_normalizer`.
  Trường theo design §4.2: identity, vị trí Column (keyword lowercase + text ngram), `sourceStatus`, `hasPublished`, object `current`/`published` (recordType, entityStatus, businessVersion, releaseVersionType, workingRevision, cde{id,code,name,businessVersion}, dataOwners, rank, 4 tag FQN + label, systemOwner, updatedAt/By).
- `TechnicalSearchIndex` (final, static): tên index vật lý + alias theo `SearchRepository.getClusterAlias()`; `ensureExists()`; `upsert(docs, waitForRefresh)`, `delete(termIds)`, `search(body)`, `swapAlias(...)`.
  Dùng **`SearchClient.rawSearchRequest`** (đã có cho cả OpenSearch và Elasticsearch — `OpenSearchClient.java:205`, `ElasticSearchClient.java:216`) cho PUT index, `_bulk`, `_search`, `_aliases`, `_doc` DELETE → không phụ thuộc engine.
- Gọi `ensureExists()` trong `TechnicalDictionaryBootstrap.initialize()`; nếu index vừa được tạo mới → chạy rebuild (1.4).

**1.2 Dựng document từ Postgres** — `TechnicalDocumentBuilder`
- Input `termId` → đọc identity (`glossary_term_entity`), working trong scope (`GlossaryVersioningService.getWorking`), published mới nhất trong scope (`getLatestPublishedInScope`), source state (`TechnicalSourceStates.statusOf`), CDE (tái dùng logic `TechnicalRowDecorator.resolveCde` → tách thành `TechnicalCdeInfo` dùng chung).
- Không có working và không có published → trả `Optional.empty()` (xóa document).
- Batch: `build(List<UUID>)` dùng `getLatestPublishedBatch` để giảm truy vấn.

**1.3 Đồng bộ + outbox** — `TechnicalIndexSync`
- `refresh(Collection<UUID> termIds)`: build → `_bulk` với `refresh=wait_for`; lỗi → ghi `technical_index_outbox`, log WARN kèm termIds, **không** ném lỗi ra request.
- `processPending()`: đọc outbox theo lô, refresh, xóa dòng thành công, tăng `attempts`/`lastError` khi lỗi. Gọi khi khởi động, đầu mỗi request đọc TD (1 query rỗng nếu không có việc), và cuối rebuild.
- DAO mới `jdbi3/TechnicalIndexOutboxDAO` (upsert theo `termId`, list, delete, markFailed; hai dialect như `TechnicalSourceStateDAO`).
- Migration: thêm `technical_index_outbox` vào `bootstrap/sql/migrations/native/1.13.3/{mysql,postgres}/schemaChanges.sql` và `bootstrap/sql/schema/{mysql,postgres}.sql`.

**1.4 Rebuild** — `TechnicalIndexRebuilder`
- Tạo index vật lý mới `…_<timestamp>`, duyệt identity TD theo keyset `termId` (query mới trong `TechnicalSourceStateDAO` hoặc DAO mới, dùng `TechnicalCatalog.recordHashPrefix`), build lô 500 → `_bulk`, `swapAlias`, xóa index cũ.
- Endpoint Admin `POST /v1/glossaries/{id}/technical-index/rebuild` trong `GlossaryResource` (`authorizer.authorizeAdmin`, kiểm tra profile TD).

**1.5 Gắn đồng bộ vào điểm ghi** (design §5.2)

| Điểm | Vị trí | Việc |
| --- | --- | --- |
| Save/Submit/Reject/Reopen/Approve/Create version/Revoke | `GlossaryVersioningService` — các chỗ đang gọi `refreshManagerIndexSafely` (dòng ~256, 320, 432, 596, 746) | Nếu glossary là TD (`TechnicalCatalog.isTechnicalGlossary`): gọi `TechnicalIndexSync.refresh`, **bỏ qua** `refreshManagerIndexSafely` (TDX-11) |
| Outbox snapshot | `processPendingOutbox` (dòng ~857) | TD: bỏ `refreshPublishedIndex`; giữ `projectTechnicalDictionary`; thêm refresh doc. CDE của Data Dictionary: `TechnicalIndexSync.refreshByCde(cdeId, scope)` (tìm termId qua index theo `current.cde.id`/`published.cde.id`) |
| Bulk | `flushSideEffects` + `GovernedBulkWorkflowService` | refresh cả chunk một lần |
| Import commit | `TechnicalImportCommitter.commit` | refresh các termId đã ghi/tạo |
| Source state | `TechnicalColumnSync.refresh/markUnavailable` | refresh termId liên quan |
| Cutover catalog | nơi publish glossary gọi `archivePredecessor` (`GlossaryVersioningService` ~1380) | sau commit, nếu TD: refresh toàn bộ termId scope cũ (lấy từ index theo `parentBusinessVersion`) |
| Khai báo / Xóa Draft | endpoint mới (Phase 3) | refresh / delete |

## Phase 2 — API đọc (backend)

- `TechnicalSearchQueryBuilder` (thuần, dễ unit test): tham số → body OpenSearch. Luôn thêm `glossaryId`, `parentBusinessVersion`, và theo quyền: Consumer → `hasPublished=true` + filter trên `published.*`; người có `canViewWorking` → `current.*`. Search `q` multi_match ngram trên database/schema/table/column/cde.code/cde.name. Sort `columnFqn`. Tái dùng validate của `TechnicalRowMatcher.validate` (bỏ `versionView`) và `GlossaryBusinessVersionSearchService` (limit 10/15/25/50, statuses).
- `TechnicalRowMapper`: document → row cùng shape `TechnicalRecordApiRow` UI đang dùng (thêm `hasPublished`), để UI đổi tối thiểu.
- Endpoint mới trong **resource mới** `resources/glossary/TechnicalDictionaryResource.java` (giữ `GlossaryTermResource` gọn), path `/v1/glossaryTerms/technical`:
  - `GET /search`, `GET /stats` (aggregation: count, cardinality bảng/service, count `hasPublished`).
  - `GET /columns?q=&limit=` cho màn "Thêm cột": `column_search_index` (mở rộng `TechnicalColumnIndex` với tìm theo `q`) + lookup index TD theo `columnKey` trong scope để đánh dấu `declared`.
- Xác định scope & quyền: tách phần kiểm tra scope/quyền của `loadAuthorizedGlossaryFlatRows` (`GlossaryTermResource` ~2501) thành helper dùng chung **không** nạp candidates.
- Gỡ nhánh TD khỏi `searchGlossaryBusinessVersions` / `getTechnicalDictionaryStats` cũ (trả 404/redirect không cần — UI đổi endpoint).

## Phase 3 — API ghi mới và chuyển các luồng đọc còn lại (backend)

- `POST /v1/glossaryTerms/technical/records?glossary=&parentBusinessVersion=` body `{columnFqn, cde, rank, elementType, generationType, creationMethod, timeliness, systemOwnerId}`:
  `resolveGovernedCreateScope` + authorize `EDIT_WORKING` (như `GlossaryTermResource.create` ~2385); đọc Column từ `table_entity` (`Entity.getEntityByName(TABLE, parentFqn, "columns")`), 404 `TD_COLUMN_NOT_FOUND`; `TechnicalRecordWriter.createDraft(..., declaredValues)`; trùng → 409 `TD_COLUMN_ALREADY_DECLARED`; validate bằng `TechnicalRecordValidator`, CDE qua `TechnicalCdeReferenceResolver`, Thứ hạng qua `TechnicalRankGuard`; refresh index; trả row.
  Giá trị form áp dụng bằng cùng hàm UI đang gửi cho PATCH working (tái dùng mapping trong `TechnicalImportPatch` nếu phù hợp).
- `DELETE /v1/glossaryTerms/technical/records/{termId}?parentBusinessVersion=`: yêu cầu `canEditWorking`, working `Draft`, không có snapshot nào (kể cả scope khác) → 409 `TD_DRAFT_NOT_DELETABLE`; xóa trong một transaction: working (`GlossaryVersionDAO.deleteWorking`), relationship, identity `glossary_term_entity`, `technical_source_state`; delete document.
  `rejectTechnicalRecordDeletion` giữ cho `DELETE /glossaryTerms/{id}` chung.
- Bulk theo filter (`GlossaryTermResource` `/bulk/{action}` ~569, `bulkRows` ~598): với TD, lấy termId từ index (point-in-time/search_after, cùng query builder) thay vì `loadAuthorizedGlossaryFlatRows`; phần ghi giữ `GovernedBulkWorkflowService`.
- Export TD (`exportWorkbook` ~494): duyệt index bằng PIT → rows → `TechnicalExcelExporter.write` (giữ exporter).
- Import preview (~297): khớp record đã khai báo qua index theo từng bảng (terms database/schema/table), Column chưa khai báo qua `TechnicalColumnIndex.columnsOfTable` (đã có). `TechnicalImportPlanner.indexRows` giữ nguyên, chỉ đổi nguồn rows.
- Mã lỗi trong `TechnicalDictionaryErrors`: thêm `COLUMN_NOT_FOUND`, `COLUMN_ALREADY_DECLARED`, `DRAFT_NOT_DELETABLE`, `INDEX_UNAVAILABLE`; bỏ `BOOTSTRAP_NOT_READY` (đổi `TechnicalCatalog.requireGlossary` sang mã khác, ví dụ `TD_NOT_INITIALIZED`).

## Phase 4 — Dọn backend

- Xóa: `TechnicalColumnIndex.page/counts` và các record liên quan, `TechnicalStats` (thay bằng aggregation), phần TD trong `TechnicalRowMatcher.keepLatest/matches`, `TechnicalRowDecorator` (logic CDE chuyển sang `TechnicalCdeInfo`), `GlossaryBusinessVersionSearchService.applyVersionView` phần TD, `technicalRowDecorator` trong `loadAuthorizedGlossaryFlatRows`.
- Tests Java cập nhật/xóa theo class bị bỏ: `TechnicalStatsTest`, `TechnicalRowMatcherTest`, `TechnicalRowDecoratorTest`; thêm test cho `TechnicalSearchQueryBuilder`, `TechnicalRowMapper`, `TechnicalDocumentBuilder` (không mock Postgres nội bộ — theo CLAUDE.md, ưu tiên test thuần + integration test).
- Integration test mới trong `openmetadata-integration-tests`: khai báo → search thấy → sửa → approve → consumer thấy → xóa Draft → không thấy; rebuild.
- Áp dụng quy tắc Java trong `CLAUDE.md` (method ≤15 dòng, một return, cache bounded, `nullOrEmpty`, không magic string) và `mvn spotless:apply` khi bạn build.

## Phase 5 — UI

- `rest/technicalDictionaryAPI.ts`: `searchTechnicalRecords` → `/glossaryTerms/technical/search` (bỏ `versionView`); `getTechnicalStats` → `/technical/stats` với `{totalColumns,totalTables,totalSources,approved}`; thêm `searchTechnicalColumns`, `declareTechnicalColumn`, `deleteTechnicalDraft`; xóa type/func bootstrap.
- `hooks/useTechnicalDictionaryRecords.ts`: bỏ `versionView` (URL param, filter state).
- `TechnicalDictionaryPage.component.tsx`: bỏ polling job + `TechnicalBootstrapStatus` (xóa file), thêm nút **Thêm cột** và handler xóa; trạng thái trống.
- `TechnicalDictionaryHeader.component.tsx`: 4 thẻ TDX-10 (`mappedCde` → `approved`).
- `TechnicalDictionaryToolbar.component.tsx`: bỏ switch "Tất cả phiên bản".
- `TechnicalDictionaryTable.component.tsx`: action **Xóa** khi `status==='Draft' && !hasPublished && canEditWorking`, có `Modal.confirm`.
- Modal "Thêm cột": component mới `TechnicalAddColumnModal.component.tsx` — bước 1 chọn Column (Select search gọi `searchTechnicalColumns`, disable Column đã khai báo), bước 2 dùng lại form trong `TechnicalRecordModal` (thêm mode `'create'`).
- `TechnicalRecordModal.component.tsx`: thêm nhóm **Lịch sử phiên bản** (gọi `GET /glossaryTerms/{id}/published?parentBusinessVersion=` có sẵn trong `rest/glossaryAPI.ts` nếu có hàm, nếu không thêm).
- `TechnicalImportModal.component.tsx`: nhãn cho action `CREATE_RECORD`.
- `TechnicalDictionaryRows.ts`: map thêm `hasPublished`.
- i18n `en-us.json`/`vi-vn.json`: nhãn mới (Thêm cột, Xóa khai báo, Đã phê duyệt, Lịch sử phiên bản, Chưa có cột nào…, CREATE_RECORD), xóa key bootstrap; `yarn i18n` khi bạn build.
- Tests UI cập nhật: `TechnicalDictionaryPage.test.tsx`, `TechnicalDictionaryHeader.test.ts`, `TechnicalDictionaryRows.test.ts`.

## Phase 6 — Tài liệu

- `docs/api/openmetadata-governed-api-specification.md`: phần TD theo endpoint mới, bỏ bootstrap-jobs.
- `docs/design/technical-dictionary-feature-implementation-plan.md`: đánh dấu các bước bootstrap đã bị thay.

---

## Thứ tự và điểm dừng review

1. Phase 1 → bạn review (index + đồng bộ là lõi).
2. Phase 2 + 3 → review API.
3. Phase 4 → dọn.
4. Phase 5 → UI.
5. Phase 6 → tài liệu.

## Kiểm chứng (bạn chạy sau khi code xong)

1. Reset DB như bạn định; `run.sh` option 3 (build FE + BE + migrate).
2. Log khởi động: không có `bootstrap`; có tạo index `technical_dictionary_search_index`.
3. `curl localhost:8086/_cat/indices | grep technical` → index tồn tại, 0 document.
4. UI Từ điển kỹ thuật: trạng thái trống; 4 thẻ = 0; không có banner.
5. **Thêm cột** `MIS.MISDB.aml.TBMS_CTR.brcd` + CDE → xuất hiện ngay trong bảng; document có trong index; `glossary_term_search_index` **không** có termId này.
6. Search `tbms`, lọc Trạng thái Draft, lọc CDE Chưa quy chiếu → kết quả đúng; log server không có `Slow request` cho `/technical/search`.
7. Gửi duyệt → Phê duyệt → thẻ "Đã phê duyệt" = 1; đăng nhập Consumer thấy bản ghi; Column trên trang bảng có tag CDE.
8. Tạo bản ghi Draft khác → Xóa → biến mất khỏi bảng và index; thử xóa bản đã duyệt → 409.
9. Import file 5 dòng (2 cột đã khai báo, 3 chưa) → preview `UPDATE_DRAFT`×2, `CREATE_RECORD`×3 → commit → 5 dòng trong bảng.
10. Tắt OpenSearch, sửa một Draft → lưu thành công; `technical_index_outbox` có 1 dòng; bật lại OpenSearch, mở trang → outbox rỗng, dữ liệu đúng.
11. Xóa index bằng curl → khởi động lại server hoặc gọi `POST /glossaries/{id}/technical-index/rebuild` → dữ liệu trở lại.
12. `mvn test -pl openmetadata-service -Dtest='Technical*Test'`, `yarn test TechnicalDictionary`, integration test mới.
