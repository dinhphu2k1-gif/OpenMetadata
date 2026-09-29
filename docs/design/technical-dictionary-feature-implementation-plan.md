# Kế hoạch triển khai Từ điển kỹ thuật theo từng chức năng

## 1. Tài liệu nguồn và mục tiêu bàn giao

Kế hoạch này hiện thực [Thiết kế kỹ thuật và UI/UX Từ điển kỹ thuật](./technical-dictionary-ui-design.md) trên nền:

- [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md).
- [Kế hoạch triển khai Chất lượng dữ liệu](./dq-glossary-feature-implementation-plan.md).
- [Thiết kế Từ điển dữ liệu dùng chung](./cde-glossary-ui-design.md).
- [Kế hoạch triển khai Từ điển dữ liệu dùng chung](./cde-glossary-feature-implementation-plan.md).
- [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md).

Về bản chất, **Từ điển kỹ thuật là một Governed Glossary Profile tương tự Chất lượng dữ liệu**:

- Catalog có scope/business version số nguyên `N`.
- Mỗi bản ghi có business version riêng `N.MINOR`.
- Dùng chung trạng thái `Draft → In Review → Approved/Rejected`.
- Dùng chung working row, immutable published snapshot, published head, outbox và capability.
- Chỉ liên kết tới CDE Approved thuộc Data Dictionary scope đã binding.
- Khác biệt chính nằm ở bộ thuộc tính, nguồn sinh identity từ physical Column và projection ngược về Column metadata.

Mục tiêu không phải tạo một hệ thống versioning thứ hai bên cạnh Data Quality. Kết quả bàn giao phải mở rộng Governed Glossary shell hiện có bằng profile `TECHNICAL_DICTIONARY`; phần khác biệt được cô lập trong profile schema, validator, mapper, Column binding và UI adapter.

### 1.1. Definition of Done chung

Một chức năng chỉ hoàn thành khi có đủ:

- Backend contract, validation và authorization.
- Persistence/query/migration tương ứng.
- Frontend API typed, UI state và error handling.
- Unit, integration, component và E2E test phù hợp.
- Audit, metric, log và runbook khi chức năng ảnh hưởng production data.
- Tài liệu contract/migration được cập nhật.

Không nghiệm thu “UI đã hiện” nếu danh sách vẫn lấy OpenSearch làm nguồn sự thật, trạng thái vẫn suy diễn từ tag hoặc same-scope chỉ được kiểm tra ở frontend.

## 2. Quyết định kiến trúc

### 2.1. Tái sử dụng kiến trúc Data Quality

Từ điển kỹ thuật được triển khai như profile thứ ba:

```text
GovernedGlossaryProfile
├── DATA_DICTIONARY
├── DATA_QUALITY
└── TECHNICAL_DICTIONARY
```

Các thành phần phải dùng chung với Data Quality:

- `GovernedGlossaryProfileRegistry` và profile resolver.
- `GlossaryVersioningService` hoặc versioning service profile-neutral kế thừa từ nó.
- Working/published/snapshot/head/outbox persistence.
- `GlossaryFlatListService` và DB-backed search/filter/pagination.
- Capability resolver và backend authorization.
- State machine workflow, optimistic locking và audit.
- Version selector, status badge, header, table primitives và modal/form shell.
- Typed CDE relation có version context.
- Server-side Excel export framework.

Không tạo bản sao `TechnicalDictionaryVersioningService` nếu logic chỉ đổi tên từ Data Quality.

### 2.2. Phần riêng của Từ điển kỹ thuật

| Hạng mục | Data Quality | Từ điển kỹ thuật |
| --- | --- | --- |
| Record identity | DQ Rule/GlossaryTerm | Technical record gắn với một physical Column trong scope |
| Cách tạo record | Người dùng tạo rule | Hệ thống bootstrap/reconcile từ Column |
| Thuộc tính | Rule, dimension, threshold, frequency... | Database, schema, table, column, data type, element/generation/creation type, timeliness, owner... |
| CDE relation | DQ Rule → CDE | Technical record → CDE |
| Scope validation | Cùng Data Dictionary scope | Cùng exact Data Dictionary scope đã binding |
| Trang chi tiết | Có detail page | Không có; bảng, modal và version selector phải đủ thông tin |
| Projection | Relation/search projection | Column tags/extension + survivorship projection |
| Import | Có thể hỗ trợ | Ngoài phạm vi hiện tại |

### 2.3. Mô hình persistence được chọn

Tái sử dụng các bảng business workflow hiện có cho technical record working/published version. Chỉ bổ sung persistence cho phần không có trong Data Quality:

1. **Scope binding** giữa exact Technical Dictionary catalog version và exact Data Dictionary catalog version.
2. **Column binding** giữa technical record identity và physical Column.

Mô hình logic tối thiểu:

```text
governed_scope_binding
- scopeId UUID PK
- sourceProfile TECHNICAL_DICTIONARY
- sourceGlossaryId UUID
- sourceVersionId UUID
- sourceBusinessVersion N
- targetProfile DATA_DICTIONARY
- targetGlossaryId UUID
- targetVersionId UUID
- targetBusinessVersion N
- status Building | Active | Archived
- audit fields

technical_record_column_binding
- recordId UUID
- scopeId UUID
- columnId UUID
- columnFqnSnapshot string
- createdAt/createdBy
- UNIQUE(scopeId, columnId)
```

`GlossaryTerm.id` hoặc identity ID profile-neutral được dùng làm `recordId`. Không lưu một technical record authoritative chỉ trong `Column.extension`.

`scopeId` và exact version ID là khóa xác nhận cùng scope. `parentBusinessVersion = N` tiếp tục được lưu để tương thích versioning/list hiện có nhưng không thay thế exact binding.

### 2.4. API strategy

- Workflow/version/capability dùng endpoint profile-neutral đang phục vụ Data Quality.
- Các endpoint `/v1/technical-dictionary/scopes/...` trong design là facade mỏng cho list, stats, CDE options, bootstrap status và export.
- Facade không sở hữu state machine riêng; nó gọi cùng application service/repository với Governed Glossary.
- Frontend standalone route `/technical-dictionary` chỉ dùng typed API; không tự patch Table/GlossaryTerm.

## 3. Schema thuộc tính Từ điển kỹ thuật

### 3.1. Nhóm định danh và source snapshot

Các field nguồn không cho người dùng sửa:

- `databaseId`, `databaseName`, `databaseFqn`.
- `schemaId`, `schemaName`, `schemaFqn`.
- `tableId`, `tableName`, `tableFqn`.
- `columnId`, `columnName`, `columnFqn`.
- `serviceId`, `serviceName`.
- `dataType`, `dataTypeDisplay`, `dataLength`, `precision`, `scale`.

Giá trị được snapshot vào working/published payload để lịch sử vẫn hiển thị khi Column đổi tên hoặc bị xóa. `columnId` là identity chính; FQN chỉ là locator/snapshot, không dùng để tự nối mù.

### 3.2. Nhóm thuộc tính nghiệp vụ có thể chỉnh sửa

- CDE reference canonical: `cdeTermId`, `cdeSnapshotId`, `cdeBusinessVersion`, `dataDictionaryVersionId`.
- Snapshot hiển thị: `cdeCodeSnapshot`, `cdeNameSnapshot`.
- `survivorshipRank`, `survivorshipNote`.
- `elementType`, `elementTypeName`.
- `generationType`, `generationTypeName`.
- `creationMethod`, `creationMethodName`.
- `timeliness`.
- `systemOwner`.
- `description`.

### 3.3. Nhóm field hệ thống

- `recordId`, `scopeId`, `businessVersion`, `workingRevision`, `entityStatus`.
- `createdAt`, `createdBy`, `updatedAt`, `updatedBy`.
- Submit/review/reject/approve/revoke audit metadata.
- Row capabilities do backend tính.

Client không được tự gửi hoặc sửa identity, scope, version, status, revision hay audit ngoài contract transition tương ứng.

### 3.4. Schema hiển thị

Bảng giữ toàn bộ thuộc tính hiện có, bổ sung version nhưng không tạo trang detail riêng:

1. Tên cơ sở dữ liệu.
2. Tên schema.
3. Tên bảng.
4. Tên cột.
5. Nguồn.
6. Mã CDE quy chiếu.
7. Tên thành tố CDE.
8. Phiên bản CDE.
9. Thứ hạng sinh tồn.
10. Loại dữ liệu.
11. Loại thành tố.
12. Loại trường dữ liệu.
13. Phương thức tạo.
14. Thời gian.
15. Chủ sở hữu hệ thống.
16. Mô tả.
17. Phiên bản bản ghi.
18. Trạng thái.
19. Thao tác.

`dataLength`, `precision`, `scale` vẫn nằm trong payload và modal/context; có thể hiển thị qua `dataTypeDisplay` hoặc column preference, không bị loại khỏi model.

## 4. Chiến lược triển khai

### 4.1. Nguyên tắc triển khai an toàn

1. Khóa hiện trạng bằng characterization tests.
2. Sửa ngay các mutation có nguy cơ xóa nhầm glossary tag.
3. Mở rộng profile/versioning dùng chung, giữ CDE và Data Quality không đổi hành vi.
4. Thêm scope binding và Column binding.
5. Bật read-only DB-backed trước.
6. Bật authoring/workflow sau khi same-scope và authorization test xanh.
7. Chạy migration, dual-read và reconciliation trước cutover.
8. Xóa direct OpenSearch/direct patch compatibility sau thời gian quan sát.

### 4.2. Phân kỳ phát hành

| Mốc | Nội dung | Có thể dùng bởi |
| --- | --- | --- |
| M0 | Baseline, safety fixes, profile và contract foundation | Dev nội bộ |
| M1 | Scope + Column binding + DB read-only list/stats/export | Pilot Consumer |
| M2 | Draft/workflow/business version/same-scope CDE | Proposer/Steward pilot |
| M3 | Projection, migration, cutover và reconciliation | Production pilot |
| M4 | Hardening, performance và bỏ compatibility | Production |

## 5. Danh sách chức năng và phụ thuộc

| ID | Chức năng | Phụ thuộc | Mốc |
| --- | --- | --- | --- |
| TD00 | Baseline, characterization tests, feature flag và safety fixes | Không | M0 |
| TD01 | Profile `TECHNICAL_DICTIONARY` và shared contract | TD00 | M0 |
| TD02 | Technical Dictionary schema/adapter/bootstrap | TD01 | M0 |
| TD03 | Scope binding và catalog lifecycle | TD01, TD02 | M1 |
| TD04 | Column binding, bootstrap và reconciliation | TD02, TD03 | M1 |
| TD05 | DB-backed list/search/filter/stats | TD03, TD04 | M1 |
| TD06 | Header, scope selector, toolbar và table | TD01, TD03, TD05 | M1 |
| TD07 | Same-scope CDE selector và canonical relation | TD03, TD05 | M2 |
| TD08 | Modal, Save Draft và optimistic locking | TD04, TD07 | M2 |
| TD09 | Workflow và business version của technical record | TD08 | M2 |
| TD10 | Technical Dictionary catalog version/cutover | TD03, TD09 | M2 |
| TD11 | Column/survivorship projection và outbox | TD07, TD09 | M3 |
| TD12 | Server-side Excel export | TD05, TD06 | M1 |
| TD13 | Migration dữ liệu hiện có và cutover | TD03–TD12 | M3 |
| TD14 | Hardening, hiệu năng, bảo mật và vận hành | TD05–TD13 | M4 |
| TD15 | Dọn compatibility và code trùng | TD13, TD14 | M4 |

### 5.1. Ước lượng tương đối

| Mốc | Phạm vi | Ước lượng | Điều kiện ra mốc |
| --- | --- | --- | --- |
| M0 | TD00–TD02 | 1–2 tuần | CDE/DQ regression xanh; profile/schema ổn định |
| M1 | TD03–TD06, TD12 | 2–3 tuần | Consumer đọc/search/filter/export đúng scope |
| M2 | TD07–TD10 | 2–3 tuần | Workflow/version/same-scope qua E2E |
| M3 | TD11–TD13 | 2 tuần | Projection và migration đối soát thành công |
| M4 | TD14–TD15 | 1–2 tuần | Performance/security/operations sign-off |

Với một backend engineer, một frontend engineer và QA tham gia liên tục, critical path dự kiến **8–12 tuần**. Estimate cần hiệu chỉnh sau TD00 và benchmark dataset thực tế; số lượng khoảng 65.000 Column khiến bootstrap, list index và export phải được đo trước khi cam kết sprint.

## 6. Chi tiết từng chức năng

### TD00 — Baseline, characterization tests, feature flag và safety fixes

**Phạm vi**

- Inventory page, table, modal, metadata parser, constants, styles, tests, REST calls và localStorage compatibility.
- Khóa hành vi hiện tại bằng tests cho list, filter, role actions, save/approve/reject/revoke và export.
- Thêm feature flag `governedGlossary.technicalDictionary.enabled`; read path mới và mutation mới được bật độc lập.
- Sửa logic tag management: chỉ thêm/xóa exact Data Dictionary relation và các classification thuộc profile; không xóa tất cả tag có `source = Glossary`.
- Sửa status filter hiện không tham gia query.
- Không suy diễn `có CDE = Approved`; trong compatibility window ưu tiên explicit extension status và đánh dấu dữ liệu không chắc chắn để migration xử lý.
- Không ép số hệ thống nguồn tối thiểu bằng `1`; mapped count chỉ tính exact Data Dictionary mapping.
- Khóa hoặc rollback optimistic UI khi backend mutation lỗi.

**DoD/Test**

- Test hiện tại xanh; assertion `dataLength = 255` được sửa theo schema hiển thị đã chốt hoặc bổ sung column tương ứng.
- Tag glossary không thuộc Data Dictionary còn nguyên sau Save/Revoke.
- Status filter, mapped count và source count có test.
- Tắt flag giữ nguyên route hiện tại nhưng không gọi API mới.

### TD01 — Profile `TECHNICAL_DICTIONARY` và shared contract

**Phạm vi**

- Thêm `TECHNICAL_DICTIONARY("Technical Dictionary")` vào profile registry.
- Mở rộng profile-neutral validator/mapper/version policy thay vì thêm nhánh hard-code rải rác.
- Khai báo schema version, mutable field allowlist, required fields, transition rules và capability mapping của profile.
- Trả `profileKey`, `schemaVersion`, scope, revision và capabilities trong representation.
- Chạy cùng state-machine contract tests cho Data Dictionary, Data Quality và Technical Dictionary.

**DoD/Test**

- CDE và DQ response/error/authorization không regression.
- Glossary ngoài allowlist không gọi được governed workflow.
- Client không thể giả `profileKey` hoặc status để vượt validator.
- Profile Technical Dictionary được resolve bằng glossary ID, không dựa display name từ request.

### TD02 — Technical Dictionary schema, adapter và bootstrap

**Phạm vi**

- Bootstrap identity `Technical Dictionary` và working catalog version đầu theo marker idempotent.
- Định nghĩa typed payload/profile adapter cho đầy đủ source snapshot, editable metadata, version và audit fields tại Mục 3.
- Tái sử dụng classification hiện có: `DataElementType`, `FieldGenerationType`, `DataCreationMethod`; fail-fast nếu schema drift.
- Khai báo canonical Column relation/binding, không encode Column chỉ bằng FQN string.
- Frontend profile registry khai báo columns, filters, cell renderers, form sections và preference key `governedGlossary.TECHNICAL_DICTIONARY.v1`.

**DoD/Test**

- Restart không tạo glossary/property/classification trùng.
- Bootstrap nửa chừng được phát hiện và báo health error rõ.
- Schema manifest backend/frontend đồng nhất.
- Không field hiện có nào bị mất khi payload round-trip.

### TD03 — Scope binding và catalog lifecycle

**Phạm vi**

- Tạo persistence/repository/service cho exact scope binding.
- Tạo Technical Dictionary scope `N` chỉ khi chọn được Data Dictionary scope hợp lệ chưa binding.
- Backend sinh `scopeId`; client không tự cung cấp hoặc đổi target binding.
- Lifecycle `Building → Active → Archived`.
- Data Dictionary scope Archived làm Technical Dictionary scope khóa mutation ngay; archive đồng bộ qua transaction/outbox theo policy đã chốt.
- URL canonical mang `scopeId`, `scopeVersion`, page và filter.
- Consumer chỉ thấy scope Active/Archived được phép; working roles thấy Building theo capability.

**DoD/Test**

- Một Technical Dictionary scope binding đúng một exact Data Dictionary version.
- Không đổi target sau khi scope có technical record.
- `scopeId`/version mismatch trả lỗi ổn định, không fallback.
- Building và Archived chặn mọi record mutation ở backend.
- Concurrent create scope không tạo binding trùng.

### TD04 — Column binding, bootstrap và reconciliation

**Phạm vi**

- Khi scope ở Building, job snapshot tập Column đủ điều kiện và tạo technical record identity `N.0`.
- Enforce `UNIQUE(scopeId, columnId)`.
- Job idempotent, checkpoint được và có progress/count/error report.
- Column mới ingest trong scope Active tạo identity + `N.0 Draft` qua event/outbox theo policy TD-R07.
- Column đổi FQN cập nhật active locator/source snapshot nhưng không sửa published snapshot cũ.
- Column bị xóa giữ historical record; active row hiển thị trạng thái source unavailable.
- Không tự nối lại record chỉ vì FQN trùng.

**DoD/Test**

- Chạy bootstrap/retry không nhân record.
- Hai Column cùng tên ở table/schema khác không bị gộp.
- Re-ingestion giữ identity khi column ID còn ổn định.
- Orphan/rename/conflict có report và metric.
- Scope chỉ chuyển Active sau khi bootstrap đạt completion policy.

### TD05 — DB-backed list, search, filter và stats

**Phạm vi**

- Dùng flat list/read model chung với Data Quality và Technical profile row projection.
- Scope, permission và status visibility được áp dụng trước total/sort/pagination.
- Search trên allowlist: database, schema, table, column, CDE code/name snapshot.
- Filter: status, source, mapped/unmapped hoặc exact CDE, element type, generation type và version view.
- Default mỗi `recordId` trả version mới nhất actor được phép xem; hỗ trợ `ALL_VERSIONS`.
- Stats trong exact scope: technical identities, distinct tables, mapped records và distinct services.
- Index DB cho scope/status/column/source/CDE/version; ES chỉ phục vụ discovery, không quyết định workflow list.

**DoD/Test**

- Row vừa commit xuất hiện ngay, không chờ reindex.
- Total, list, stats và export thống nhất với cùng authorization/filter.
- Consumer không lấy working row bằng cách đổi query parameter.
- Search tiếng Việt, combined filters, invalid sort và request race có test.
- Benchmark với ít nhất dataset hiện tại và 2x headroom.

### TD06 — Header, scope selector, toolbar và table

**Phạm vi**

- Header dùng shared governed shell: title, description, scope status, scope selector, binding `Data Dictionary vN` và action `Tạo phiên bản mới` theo capability.
- Stats cards lấy TD05; có Building/loading/empty/error state.
- Toolbar giữ search và filter hiện có, bổ sung version view; state đồng bộ URL.
- Không có Reload riêng; `Xuất Excel` nằm trong menu ba chấm trước `Tùy chỉnh`.
- Bảng đủ columns tại Mục 3.4; record version và CDE version là column bắt buộc theo design.
- Historical/Approved/Archived rows read-only; action lấy từ row capabilities.
- Horizontal scroll, resizable columns, responsive stats và accessible action tooltip/name.

**DoD/Test**

- Chuyển scope reset page/filter/CDE cache và không hiển thị response cũ.
- Back/forward/refresh khôi phục đúng scope/filter/version view.
- Column preference mới không kế thừa sai layout `v5`.
- Visual/component tests khóa header, card, columns và read-only states.
- Không có action nhấp nháy trước khi capability load xong.

### TD07 — Same-scope CDE selector và canonical relation

**Phạm vi**

- Tái sử dụng typed CDE relation/version context từ Data Quality.
- Selector gọi backend với `scopeId`; backend tự resolve exact `dataDictionaryVersionId` từ binding.
- Chỉ trả CDE Approved trong exact bound scope, có search debounce, pagination, cancellation và loading/empty/error state.
- Option dùng `snapshotId` hoặc composite version key; hiển thị `Mã CDE · Tên thành tố · vN.MINOR`.
- Save/submit/approve revalidate relation; cross-scope trả `409 SCOPE_MISMATCH`.
- Historical relation render từ snapshot đã lưu; không tự nâng khi CDE có minor version mới.
- Không lookup authoritative bằng `Data Dictionary.${cdeCode}`, code, name hoặc display FQN.

**DoD/Test**

- Hai CDE cùng code ở hai scope không thể bị chọn nhầm.
- Hai Approved versions cùng identity được phân biệt và round-trip chính xác.
- Đổi query nhanh không để response cũ ghi đè.
- Archived CDE relation lịch sử vẫn render nhưng không xuất hiện trong option mutation mới.
- Direct API request với CDE scope khác bị backend từ chối dù frontend bị bypass.

### TD08 — Modal, Save Draft và optimistic locking

**Phạm vi**

- Dùng form/modal shell giống Data Quality, nhưng không tạo detail page.
- Section 1 read-only: Technical scope, Data Dictionary binding, record version và status.
- Section 2 read-only: database/schema/table/column/source/data type/length/precision/scale.
- Section 3 editable: CDE, rank/note, element type, generation type, creation method, timeliness, system owner và description.
- Save Draft gửi typed payload + `expectedWorkingRevision`; không nhận status/version/audit từ client.
- Double-click chỉ phát một request; `409` giữ dữ liệu form và yêu cầu reload/merge.
- Mở Approved tạo hành động “Tạo phiên bản mới”, không patch snapshot.

**DoD/Test**

- Hai writer cùng revision: một thành công, một conflict và không lost update.
- Invalid enum/rank/CDE relation trả lỗi field ổn định.
- Không tải cứng 1.000 CDE.
- Modal historical/Approved/Archived không có edit affordance.
- Toàn bộ thuộc tính hiện có round-trip mà không bị lược bỏ.

### TD09 — Workflow và business version của technical record

**Phạm vi**

- Áp dụng state machine dùng chung: Draft → In Review → Approved/Rejected; Rejected → Draft.
- Save Draft chỉ tăng revision; submit/reject không tăng business version.
- Approve tạo immutable snapshot và published head.
- Từ Approved `N.x`, tạo Draft `N.(x+1)` trong cùng record/scope.
- Technical minor version mới copy payload Approved gần nhất theo thiết kế Từ điển kỹ thuật, sau đó cập nhật source snapshot hiện hành có kiểm soát; snapshot cũ không đổi.
- Consumer tiếp tục thấy Approved head cũ khi minor mới đang Draft/In Review/Rejected.
- Revoke theo capability/policy, không xóa lịch sử.

**DoD/Test**

- Version tăng numeric `1.9 → 1.10`; phần nguyên luôn bằng scope version.
- Không tồn tại hai working versions của cùng record/scope.
- Transition sai trạng thái/quyền không thay data, audit hoặc outbox.
- Approve concurrent không tạo hai snapshot.
- Consumer không đọc được working qua list, export hoặc direct URL.

### TD10 — Technical Dictionary catalog version và cutover

**Phạm vi**

- Tạo scope/catalog `N+1` qua shared governed catalog workflow.
- Mặc định không tự copy CDE mapping từ `N`; chỉ copy khi có chức năng explicit, preview và exact CDE identity mapping được duyệt.
- Bootstrap Column identities trong scope mới; initial record status mặc định Draft trừ migration có bằng chứng Approved hợp lệ.
- Activate `N+1` và archive `N` theo transaction/outbox policy.
- Archived manifest bất biến, deep link/version selector vẫn đọc được.

**DoD/Test**

- Record/mapping của scope cũ không tự xuất hiện trong scope mới.
- Cutover fail giữa chừng rollback hoặc hội tụ qua outbox có trạng thái quan sát được.
- Archived scope không nhận Column reconciliation mutation mới.
- Deep link scope cũ không resolve sang record scope mới.

### TD11 — Column/survivorship projection và outbox

**Phạm vi**

- DB working/snapshot là nguồn sự thật; `Column.tags`, `Column.extension`, search index và CDE survivorship chỉ là projection.
- Approve/revoke phát outbox event idempotent để cập nhật:
  - Exact Data Dictionary tag/relation trên Column.
  - Technical classifications do profile quản lý.
  - Compatibility extension fields nếu còn trong migration window.
  - Survivorship rule chứa `recordId`, record business version, `scopeId`, `columnId/FQN snapshot` và rank.
  - Search reindex/audit.
- Projection handler không xóa glossary/classification ngoài allowlist.
- Retry có backoff, dead-letter/metric và reconciliation job.

**DoD/Test**

- Workflow commit thành công ngay cả khi projection tạm lỗi; outbox retry hội tụ.
- Retry không tạo duplicate tag/rule/event.
- Revoke xóa/đóng đúng projection hiện hành nhưng giữ historical snapshot.
- Projection lag không làm list/status nghiệp vụ sai.
- Reconciliation phát hiện và sửa projection drift theo policy.

### TD12 — Server-side Excel export

**Phạm vi**

- Backend stream XLSX theo exact scope, version view, filter và authorization.
- Frontend chỉ gọi endpoint và tải stream; không export rows của page hiện tại.
- File có các cột UI cùng Technical scope version, record business version, status, Data Dictionary version và CDE business version.
- Filename `TuDienKyThuat_Agribank_v{scopeVersion}_yyyy-MM-dd.xlsx`.
- Neutralize spreadsheet formula, giới hạn cell và chuyển markdown theo policy.

**DoD/Test**

- Export 0, 1, nhiều page và dataset lớn đúng count/order.
- Consumer chỉ nhận published rows được phép.
- Unicode/tiếng Việt/newline/markdown/formula injection được xử lý an toàn.
- Export Archived scope đúng historical CDE/version snapshots.

### TD13 — Migration dữ liệu hiện có và cutover

**Phạm vi**

- Có dry-run và apply mode idempotent.
- Resolve Data Dictionary Active scope và tạo exact Technical Dictionary binding đầu tiên.
- Tạo record identity/version `N.0` cho từng Column.
- Copy đầy đủ source snapshot và thuộc tính hiện có.
- Resolve existing CDE tag tới exact identity/version trong bound scope; ambiguous/cross-scope/unresolved đưa vào conflict report, không remap theo code.
- Không mặc định `có CDE = Approved`; status theo evidence/migration rule đã duyệt.
- Đối soát counts, mapping, rank, status, checksum và orphan trước/sau.
- Dual-read một giai đoạn; new writes chỉ đi model mới.
- Bật feature theo environment/tenant sau pilot sign-off.

**DoD/Test**

- Dry-run không ghi data và cho kết quả ổn định khi chạy lại.
- Apply lại không đổi ID/version hoặc nhân snapshot/outbox.
- Không mất glossary tag không thuộc profile.
- Cross-scope data không được tự sửa im lặng.
- Rollback/abort runbook được diễn tập trên bản sao production.

### TD14 — Hardening, hiệu năng, bảo mật và vận hành

**Phạm vi**

- Load test list/filter/stats/export/bootstrap/reconciliation ở quy mô hiện tại và 2x headroom.
- Security test IDOR, scope tampering, hidden working data, privilege escalation, XSS markdown, formula injection và query abuse.
- Metric/alert: latency, error, conflict, scope mismatch, bootstrap progress, outbox lag, projection drift và orphan Column/CDE.
- Accessibility audit, keyboard navigation và responsive test.
- Runbook cho failed bootstrap, stuck outbox, scope cutover, migration conflict, projection reconciliation và reindex.

**DoD/Test**

- Không còn Critical/High issue; Medium có owner/decision.
- SLO và alert threshold được vận hành duyệt.
- Backup/restore/reindex không làm thay đổi business snapshot.
- Log không lộ payload nhạy cảm hoặc token.

### TD15 — Dọn compatibility và code trùng

**Phạm vi**

- Xóa direct OpenSearch business list sau cutover.
- Xóa direct `patchTableDetails`/`patchGlossaryTerm` khỏi page.
- Xóa localStorage override và status inference từ CDE tag.
- Xóa client-side authoritative XLSX.
- Xóa `technicalDictionaryTableColumns_v5` sau preference migration.
- Tách/xóa code table/modal/header trùng với Data Quality; giữ profile adapter riêng cho fields/renderers.
- Compatibility extension/tag read chỉ giữ theo deprecation window đã duyệt.

**DoD/Test**

- Không còn page-level workflow/state machine riêng của Technical Dictionary.
- Shared contract tests chạy cho cả ba profiles.
- CDE, DQ và Technical Dictionary full regression xanh.
- Architecture map/API docs/ownership được cập nhật.

## 7. Work breakdown theo tầng

### 7.1. Backend Java

- `service/glossary`: thêm Technical profile, schema/validator/mapper.
- `service/glossary/versioning`: dùng chung version policy, working/snapshot/head/outbox và flat list.
- `resources/glossary`: workflow/capability profile-neutral.
- Module/facade `technical-dictionary`: scope/list/stats/CDE options/export/bootstrap status.
- `jdbi3`: scope binding, Column binding, DB filters/index và transaction.
- Projection worker: Column/CDE/search outbox consumers.
- `openmetadata-spec`: additive typed models và generated Java/TypeScript clients.

### 7.2. Frontend React/TypeScript

- `TechnicalDictionaryPage.component.tsx`: chỉ orchestration scope/query/action; bỏ authoritative mapping/mutation logic.
- `TechnicalDictionaryTable.component.tsx`: dùng row model có record/CDE version và capabilities.
- `TechnicalDictionaryEditModal.component.tsx`: dùng shared governed form shell + Technical fields adapter.
- `TechnicalDictionary.constants.ts`: schema/profile preference mới.
- REST client mới hoặc profile-neutral glossary client mở rộng.
- Shared scope selector, version selector, workflow actions, status badge và async CDE selector với Data Quality.
- i18n đầy đủ; không rải fallback tiếng Việt trong production code.

### 7.3. Database/migration

- Additive scope/Column binding tables và indexes cho cả PostgreSQL/MySQL.
- Tái sử dụng working/snapshot/head/outbox hiện có.
- Migration có dry-run report, apply marker, idempotency và rollback/abort procedure.
- Không phụ thuộc Python seed script thủ công để tạo production data.

## 8. Chiến lược kiểm thử

| Tầng | Nội dung bắt buộc |
| --- | --- |
| Unit backend | profile resolution, schema validator, version parser, state machine, same-scope validator, projection mapper |
| Repository integration | scope/Column uniqueness, working/snapshot isolation, filter/sort/paging, optimistic locking trên PostgreSQL/MySQL |
| Resource integration | capability matrix, HTTP/error codes, scope tampering, published/working leakage, export |
| Unit frontend | profile adapter, URL state, columns, form mapping, conflict/error rendering |
| Component | header, cards, scope selector, table, modal, CDE selector, historical/read-only states |
| E2E | Consumer/Proposer/Steward/Admin happy path và forbidden direct URL/API |
| Migration | unresolved/ambiguous/cross-scope CDE, duplicate Column, missing Column, idempotency và rollback |
| Performance | 65k+ records, combined filters, scope switch, export, bootstrap và reconciliation |
| Security | IDOR, cross-scope injection, XSS, formula injection, query abuse và privilege escalation |

Critical E2E journey:

1. Admin tạo Technical scope binding với Data Dictionary scope Approved.
2. Bootstrap tạo record `N.0 Draft` từ Column và activate scope.
3. Consumer không thấy Draft.
4. Proposer mở modal, chọn CDE Approved cùng scope, lưu Draft và submit.
5. Steward approve; Consumer thấy Approved ngay từ DB list.
6. Proposer tạo `N.1`, Consumer vẫn thấy `N.0` Approved.
7. Cross-scope CDE request bị trả `SCOPE_MISMATCH`.
8. Approve `N.1`; projection Column/survivorship hội tụ qua outbox.
9. Export chứa đúng scope, record version và CDE version.
10. Tạo scope `N+1`, kiểm tra không tự copy mapping và archived scope chỉ đọc.

## 9. Kế hoạch PR đề xuất

| PR | Nội dung | Điều kiện merge |
| --- | --- | --- |
| 1 | TD00 characterization tests và safety fixes | Không đổi business architecture; test hiện tại xanh |
| 2 | TD01 Technical profile + shared contracts | CDE/DQ regression bắt buộc |
| 3 | TD02 schema/bootstrap/frontend adapter | Feature flag vẫn tắt |
| 4 | TD03 scope binding/catalog lifecycle | Transaction/concurrency tests |
| 5 | TD04 Column binding/bootstrap/reconciliation | Idempotency + benchmark |
| 6 | TD05 read model/list/stats APIs | Auth + DB integration tests |
| 7 | TD06 + TD12 read-only UI/export | M1 Consumer pilot |
| 8 | TD07 canonical same-scope CDE relation | Cross-scope security tests |
| 9 | TD08–TD09 modal/workflow/record version | M2 E2E + optimistic locking |
| 10 | TD10 catalog version/cutover | Failure/rollback tests |
| 11 | TD11 projection/outbox | Retry/idempotency/reconciliation tests |
| 12 | TD13 migration/cutover | Dry-run report + runbook + approval |
| 13 | TD14–TD15 hardening/cleanup | Production readiness sign-off |

Backend và frontend có thể tách PR nhỏ hơn, nhưng không bật capability production cho đến khi integration/E2E của cùng chức năng hoàn tất.

## 10. Rủi ro và biện pháp

| Rủi ro | Mức | Biện pháp |
| --- | --- | --- |
| Refactor shared workflow làm hỏng CDE/DQ | Cao | Characterization/contract tests trước refactor; feature flag; merge nhỏ |
| Dùng code/name/FQN để map CDE sai scope | Cao | Exact ID + typed version context + backend `SCOPE_MISMATCH` |
| Xóa nhầm glossary tag khi Save/Revoke | Cao | Allowlist exact profile tags; safety test TD00 |
| Column và survivorship lệch do hai patch độc lập | Cao | DB commit + transactional outbox + reconciliation |
| Migration suy diễn `có CDE = Approved` | Cao | Evidence-based status; conflict report; default Draft |
| Column rename/delete/re-ingest làm mất identity | Cao | Bind bằng Column ID; historical snapshot; controlled mapping |
| Scope mới tự mang mapping scope cũ | Cao | Mặc định không copy; explicit preview/mapping only |
| OpenSearch lag làm sai list/status | Cao | DB authoritative list; ES chỉ discovery |
| Dataset lớn làm bootstrap/list/export chậm | Trung bình | Batch/checkpoint/index/streaming/benchmark gate |
| Capability UI và backend lệch nhau | Cao | Backend trả row/scope capabilities; direct API auth tests |
| Duplicated Technical/DQ code khó bảo trì | Trung bình | Shared profile shell/service; dependency rule; TD15 cleanup |

## 11. Rollout và rollback

### 11.1. Rollout

1. Deploy Technical profile/schema với feature flag tắt.
2. Chạy scope/Column bootstrap và migration dry-run.
3. Xử lý conflict CDE/Column; apply migration và đối soát.
4. Bật read-only DB list cho nhóm Consumer pilot.
5. Bật Draft/Submit cho Proposer pilot.
6. Bật Approve/Reject/Revoke cho Steward pilot.
7. Bật projection/outbox và theo dõi convergence.
8. Cutover toàn bộ; bắt đầu compatibility deprecation window.
9. Xóa direct ES/direct patch/client export sau khi metric ổn định.

### 11.2. Điều kiện abort/rollback

- Sai scope/version hoặc có cross-scope mapping.
- Consumer nhìn thấy working data.
- Count/checksum/mapping/rank lệch ngoài ngưỡng đã duyệt.
- Outbox không hội tụ hoặc projection xóa nhầm tag.
- Bootstrap tạo duplicate/mất Column identity.

Tắt feature flag/read-write capability trước. Không rollback published snapshot bằng sửa tay. Application rollback phải tương thích schema additive; data rollback chỉ chạy bằng script/runbook đã diễn tập và backup xác nhận.

## 12. Các quyết định cần chốt trước khi bắt đầu TD03

| ID | Quyết định | Mặc định khuyến nghị |
| --- | --- | --- |
| TD-R01 | Scope mới copy mapping cũ? | Không; chỉ copy qua chức năng explicit có exact identity mapping |
| TD-R02 | Nhãn Technical scope có cùng số Data Dictionary scope? | Có để dễ hiểu, nhưng exact binding ID vẫn authoritative |
| TD-R03 | Data Dictionary Archived xử lý Technical scope thế nào? | Khóa mutation/Archive đồng bộ qua outbox |
| TD-R04 | Trạng thái `N.0` ban đầu? | Draft; migration chỉ Approved khi có evidence |
| TD-R05 | Export áp dụng filter? | Mặc định toàn scope được phép; filter phải là query explicit |
| TD-R06 | Rank có duy nhất trong cùng CDE? | Chốt invariant backend trước Approve |
| TD-R07 | Column mới trong Active scope? | Tạo `N.0 Draft` bằng event/outbox idempotent |
| TD-R08 | Column đổi/xóa? | Giữ history; resolve bằng ID/mapping có kiểm soát |
| TD-R09 | Chọn CDE Approved cũ hay chỉ latest? | Lưu exact version; selector mặc định latest, historical theo policy |

## 13. Checklist nghiệm thu cuối

- [ ] Technical Dictionary là profile `TECHNICAL_DICTIONARY`, không có state machine/version store riêng trùng Data Quality.
- [ ] CDE và Data Quality regression xanh sau mọi refactor shared code.
- [ ] Mỗi scope có `scopeId` và exact binding tới Data Dictionary version.
- [ ] Mỗi physical Column có tối đa một technical record identity trong một scope.
- [ ] Catalog version `N`, record version `N.MINOR`, working revision và immutable snapshot hoạt động đúng.
- [ ] Header hiển thị status, scope selector và Data Dictionary binding.
- [ ] Stats/list/search/filter/total/pagination đều DB-backed, scope-aware và permission-aware.
- [ ] Bảng/modal giữ đầy đủ thuộc tính hiện có và bổ sung record/CDE version.
- [ ] Không có trang detail riêng; version/history xem được từ bảng/modal.
- [ ] CDE selector chỉ trả Approved CDE cùng exact scope, có async search/pagination/race handling.
- [ ] Direct API cross-scope trả `SCOPE_MISMATCH`; không fallback theo code/name/FQN.
- [ ] Save Draft/Submit/Approve/Reject/Reopen/Revoke/Create next version dùng capability backend và optimistic locking.
- [ ] Consumer chỉ thấy published representation được phép.
- [ ] Approved/Archived snapshots bất biến và deep link lịch sử đúng scope/version.
- [ ] Column/survivorship/search là projection qua outbox, không phải nguồn sự thật.
- [ ] Projection không xóa glossary/classification ngoài allowlist.
- [ ] Excel export server-side, đúng scope/quyền và không phụ thuộc page hiện tại.
- [ ] Migration idempotent, có dry-run/conflict report/dual-read/rollback rehearsal.
- [ ] Performance, security, accessibility, metric, alert và runbook đã được nghiệm thu.
- [ ] Direct OpenSearch/direct patch/localStorage/status inference compatibility đã được loại bỏ đúng deprecation window.
