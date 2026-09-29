# Prompt triển khai Từ điển kỹ thuật từ TD00 đến TD12

Sao chép toàn bộ nội dung bên dưới để giao cho AI coding agent thực hiện.

---

## Vai trò

Bạn là Senior Software Architect/Engineer chịu trách nhiệm triển khai Từ điển kỹ thuật trong repository OpenMetadata hiện tại.

Bạn phải **thực hiện thay đổi code thực tế**, không chỉ phân tích hoặc viết thêm kế hoạch. Phạm vi triển khai là các chức năng **TD00 đến TD12** trong kế hoạch đã duyệt.

Từ điển kỹ thuật về bản chất là một **Governed Glossary Profile tương tự Data Quality**, chỉ khác:

- Bộ thuộc tính nghiệp vụ.
- Identity được bootstrap/reconcile từ physical Column.
- Có exact scope binding với Data Dictionary.
- Có projection ngược về Column và survivorship rule.
- Không có trang chi tiết riêng; bảng, modal và version selector phải chứa đủ thông tin.

Không tạo một hệ thống workflow/versioning độc lập nếu có thể mở rộng và tái sử dụng kiến trúc Data Quality hiện có.

## Mục tiêu

Triển khai đầy đủ theo dependency từ:

- TD00 — Baseline, characterization tests, feature flag và safety fixes.
- TD01 — Profile `TECHNICAL_DICTIONARY` và shared contract.
- TD02 — Technical Dictionary schema/adapter/bootstrap.
- TD03 — Scope binding và catalog lifecycle.
- TD04 — Column binding, bootstrap và reconciliation.
- TD05 — DB-backed list/search/filter/stats.
- TD06 — Header, scope selector, toolbar và table.
- TD07 — Same-scope CDE selector và canonical relation.
- TD08 — Modal, Save Draft và optimistic locking.
- TD09 — Workflow và business version của technical record.
- TD10 — Technical Dictionary catalog version/cutover.
- TD11 — Column/survivorship projection và outbox.
- TD12 — Server-side Excel export.

Không triển khai TD13, TD14 hoặc TD15 trong lần này, ngoại trừ thay đổi additive tối thiểu bắt buộc để TD00–TD12 compile về mặt thiết kế.

## Tài liệu authoritative

Đọc đầy đủ các file sau trước khi sửa code:

1. `docs/design/technical-dictionary-feature-implementation-plan.md`
2. `docs/design/technical-dictionary-ui-design.md`
3. `docs/design/dq-glossary-feature-implementation-plan.md`
4. `docs/design/dq-glossary-ui-design.md`
5. `docs/design/cde-glossary-feature-implementation-plan.md`
6. `docs/design/cde-glossary-ui-design.md`
7. `docs/design/openmetadata-1.13.3-upstream-architecture-reference.md`

Thứ tự ưu tiên khi có khác biệt:

1. Yêu cầu trong prompt này.
2. `technical-dictionary-feature-implementation-plan.md`.
3. `technical-dictionary-ui-design.md`.
4. Pattern đã chạy của Data Quality và Data Dictionary.
5. Hiện trạng code.

Nếu design còn điểm chưa chốt, dùng mặc định khuyến nghị trong mục “Các quyết định cần chốt” của implementation plan. Không dừng để hỏi lại trừ khi quyết định đó làm thay đổi public API hoặc có nguy cơ mất dữ liệu.

## Ràng buộc thực thi bắt buộc

### Không chạy build hoặc test

Trong toàn bộ quá trình, tuyệt đối không chạy:

- `yarn build`, `npm run build`, `vite build` hoặc build frontend tương đương.
- `yarn test`, `npm test`, `jest`, `playwright` hoặc bất kỳ test runner nào.
- Maven/Gradle build hoặc test như `mvn test`, `mvn package`, `mvn install`, `gradle test`.
- Type-check/lint toàn dự án như `tsc`, `eslint`, `checkstyle`.
- Docker image build, Docker Compose rebuild hoặc khởi động lại service để kiểm tra.
- Schema/code generation pipeline nếu nó là một phần của build.

Được phép:

- Đọc file bằng `rg`, `sed`, `git diff`, `git status` và công cụ read-only tương đương.
- Tạo/sửa production code.
- Tạo/sửa unit/integration/component/E2E test source theo DoD, nhưng **không chạy các test đó**.
- Chạy `git diff --check` vì đây chỉ là kiểm tra whitespace tĩnh.
- Kiểm tra JSON/YAML/XML bằng parser nhẹ chỉ khi không kéo theo build/codegen; nếu không chắc, không chạy.

Không được tuyên bố “build xanh”, “test pass” hoặc “compile thành công”. Báo rõ rằng build/test chưa chạy theo yêu cầu.

### An toàn repository

- Bắt đầu bằng `git status --short` và ghi nhận file đã thay đổi trước đó.
- Mọi thay đổi có sẵn thuộc về người dùng; không reset, checkout, stash hoặc ghi đè chúng.
- Không dùng `git reset --hard`, `git checkout --`, xóa recursive hoặc command phá hủy dữ liệu.
- Dùng `apply_patch` cho chỉnh sửa thủ công.
- Không commit, push, mở PR hoặc thay đổi remote.
- Không sửa file `.env`, secret, token hoặc dữ liệu local database.
- Không chỉnh migration cũ đã phát hành nếu convention yêu cầu migration mới; tạo migration additive đúng version hiện hành cho cả PostgreSQL và MySQL.

### Chất lượng implementation

- Không để placeholder, pseudo-code, mock production, empty handler hoặc `TODO` thay cho logic bắt buộc.
- Không copy nguyên page/service Data Quality rồi đổi tên. Tách abstraction/profile adapter dùng chung khi logic thực sự giống nhau.
- Không refactor ngoài phạm vi nếu không cần thiết cho TD00–TD12.
- Ưu tiên diff nhỏ, có dependency rõ và tương thích ngược.
- Mọi mutation và authorization quan trọng phải nằm ở backend; frontend chỉ phản ánh capabilities.
- Mọi error contract mới phải có mã ổn định, không chỉ message text.
- Preserve unknown-but-valid extension fields theo merge policy server-side.
- Không dùng code, display name hoặc FQN hiển thị làm authoritative identity.

## Invariant kiến trúc không được vi phạm

1. `TECHNICAL_DICTIONARY` là profile thứ ba bên cạnh `DATA_DICTIONARY` và `DATA_QUALITY`.
2. Dùng chung working row, published snapshot, published head, outbox, state machine và capability với Governed Glossary.
3. Catalog/scope dùng business version số nguyên `N`.
4. Technical record dùng business version `N.MINOR`; phần nguyên luôn bằng scope version.
5. Approved snapshot bất biến; sửa Approved phải tạo minor Draft kế tiếp.
6. Save Draft chỉ tăng working revision, không tăng business version.
7. Một physical Column có tối đa một technical record identity trong một scope: `UNIQUE(scopeId, columnId)`.
8. Scope được xác nhận bằng `scopeId` và exact version IDs; chuỗi `N` chỉ là nhãn nghiệp vụ.
9. Một Technical Dictionary scope binding đúng một exact Data Dictionary scope.
10. Chỉ CDE Approved trong exact bound Data Dictionary scope được chọn cho mapping mới.
11. Backend luôn revalidate same-scope khi Save/Submit/Approve; cross-scope trả `409` với mã `SCOPE_MISMATCH`.
12. CDE relation lưu identity và exact version context; không authoritative bằng `cdeCode`, `cdeName` hoặc display FQN.
13. Database là nguồn sự thật cho scope, list, status, workflow và version.
14. OpenSearch, `Column.tags`, `Column.extension` và survivorship rule chỉ là projection/compatibility.
15. Không có trang detail riêng cho technical record.
16. Không lược bỏ thuộc tính hiện có khỏi payload; bảng dùng horizontal scroll/column preference và modal dùng sections.
17. Consumer chỉ thấy published representations được backend cho phép.
18. Building/Archived scope không cho record mutation.
19. Projection chỉ quản lý exact tags/classifications thuộc Technical Dictionary; không xóa glossary tag khác.
20. Export chạy server-side trên exact scope và authorization hiện hành, không dùng rows của page hiện tại.

## Mô hình tái sử dụng bắt buộc

Trước khi tạo class/component mới, tìm và đánh giá các thành phần tương ứng của Data Quality:

- `GovernedGlossaryProfileRegistry`.
- `GlossaryVersioningService`.
- `GlossaryFlatListService`.
- `GlossaryAuthorizationResolver`.
- `GlossaryVersionDAO` và các working/snapshot/head/outbox tables.
- Data Quality profile validator/mapper/bootstrap.
- Typed relation/version context giữa Data Quality và CDE.
- Governed glossary header, version selector, workflow actions, form sections và table/list state.
- Server-side glossary Excel exporter.

Quy tắc quyết định:

- Logic state machine/version/auth giống nhau → đưa vào shared/profile-neutral layer.
- Khác field/label/validator/rendering → đặt trong `TECHNICAL_DICTIONARY` profile adapter.
- Khác vì gắn với physical Column → đặt trong Column binding/bootstrap/reconciliation/projection service.
- Endpoint Technical Dictionary chỉ là facade khi service dùng chung đã tồn tại.

## Schema bắt buộc

### Source snapshot read-only

- Database ID/name/FQN.
- Schema ID/name/FQN.
- Table ID/name/FQN.
- Column ID/name/FQN.
- Service ID/name.
- Data type, display type, length, precision và scale.

### Business fields

- Exact CDE relation/version context.
- CDE code/name snapshot chỉ phục vụ hiển thị lịch sử.
- Survivorship rank/note.
- Element type/name.
- Generation type/name.
- Creation method/name.
- Timeliness.
- System owner.
- Description.

### System fields

- Record ID, scope ID, business version, working revision, entity status.
- Created/updated/submitted/reviewed/rejected/approved/revoked audit metadata.
- Scope- và row-level capabilities do backend tính.

Không nhận identity, version, status, revision hoặc audit từ mutable business payload của client.

## Trình tự triển khai bắt buộc

Thực hiện theo các batch dưới đây. Không triển khai UI workflow trước khi backend contract/persistence tương ứng tồn tại.

### Batch A — TD00: khóa baseline và sửa lỗi an toàn

1. Inventory toàn bộ Technical Dictionary code hiện tại.
2. Bổ sung characterization test source cho list, filters, roles và metadata mutations.
3. Thêm feature flags cho read path và mutation path mới theo convention hiện có.
4. Sửa tag filtering để không xóa toàn bộ `TagSource.Glossary`.
5. Sửa status filter để thực sự tham gia query/state.
6. Bỏ `Math.max(1, sources.length)` và đếm mapped CDE bằng exact Data Dictionary relation.
7. Ngừng suy diễn authoritative status bằng `có CDE = Approved` trong đường code mới.
8. Đảm bảo optimistic UI rollback hoặc refetch khi mutation compatibility lỗi.
9. Sửa test source đang kỳ vọng `dataLength = 255` theo schema thực tế đã chốt.

Không xóa UI hiện tại ở batch này.

### Batch B — TD01–TD02: profile, schema và bootstrap

1. Thêm `TECHNICAL_DICTIONARY("Technical Dictionary")` vào profile registry.
2. Tổng quát hóa resolver/validator/mapper/version policy nếu đang hard-code hai profile.
3. Thêm Technical Dictionary profile manifest/schema version/mutable allowlist/required rules.
4. Tạo typed backend/frontend models cần thiết tại nguồn authoritative.
5. Bootstrap Technical Dictionary identity và working catalog đầu tiên theo pattern Data Quality.
6. Tái sử dụng và drift-check classifications:
   - `DataElementType`.
   - `FieldGenerationType`.
   - `DataCreationMethod`.
7. Thêm frontend profile adapter cho columns, filters, form sections và renderers.
8. Dùng preference key mới `governedGlossary.TECHNICAL_DICTIONARY.v1`.
9. Thêm contract test source dùng cùng state machine cho cả ba profiles.

Nếu generated artifacts cần codegen, sửa source schema/manifest trước, không chạy codegen; ghi rõ artifacts/command còn cần chạy trong báo cáo cuối.

### Batch C — TD03: exact scope binding và catalog lifecycle

1. Tạo migration additive PostgreSQL và MySQL cho scope binding.
2. Tạo DAO/repository/service/resource models.
3. Backend sinh `scopeId`; client không cung cấp ID tùy ý.
4. Enforce one-to-one binding theo design.
5. Lifecycle `Building → Active → Archived`.
6. Chặn mutation khi Building/Archived hoặc bound Data Dictionary scope không còn hợp lệ.
7. Trả scope metadata và capabilities.
8. Thêm source test cho duplicate/concurrent binding, mismatch và authorization.

Scope binding tối thiểu phải giữ exact source/target version IDs, business version labels, status và audit.

### Batch D — TD04: Column binding, bootstrap và reconciliation

1. Tạo migration additive cho authoritative Column binding và `UNIQUE(scopeId, columnId)`.
2. Tạo batch bootstrap từ physical Columns khi scope Building.
3. Job phải idempotent, checkpoint/retry được và có progress/error counts.
4. Tạo technical record identity + `N.0 Draft` từ source snapshot.
5. Column mới trong Active scope tạo record qua event/outbox idempotent.
6. Rename/FQN change không đổi identity nếu column ID còn ổn định.
7. Deleted/missing Column giữ historical snapshots và được đánh dấu source unavailable.
8. Không auto-match chỉ bằng FQN.
9. Chỉ activate scope khi bootstrap completion policy đạt yêu cầu.

### Batch E — TD05 và TD12 backend: read model, stats và export

1. Mở rộng flat-list/read-model service theo Technical profile.
2. Query DB, không page OpenSearch rồi hydrate/filter ở application.
3. Áp dụng scope, authorization, status visibility trước total/sort/pagination.
4. Hỗ trợ search database/schema/table/column/CDE code/CDE name.
5. Hỗ trợ filters status/source/CDE mapping/element type/generation type/version view.
6. Default trả latest visible version; có `ALL_VERSIONS`.
7. Tạo scope-aware stats.
8. Tạo indexes cần thiết cho dataset hiện tại.
9. Tạo server-side streaming XLSX exporter theo scope/filter/quyền.
10. Neutralize formula injection và không lộ internal UUID trong sheet người dùng.
11. Thêm source tests cho list/total/stats/export consistency và Consumer visibility.

### Batch F — TD06 frontend: read-only scope UI

1. Tạo typed REST client/hook cho scopes, records, stats và export.
2. Chuyển page sang DB-backed API mới khi feature flag bật.
3. Header hiển thị scope status, selector, Data Dictionary binding và create-version action theo capability.
4. Stats lấy từ scope API.
5. Search/filter/version view đồng bộ URL; scope switch reset page/filter/CDE cache.
6. Bổ sung record business version và CDE business version vào table.
7. Historical/Archived rows read-only.
8. Giữ menu ba chấm `Xuất Excel`; không thêm Reload riêng.
9. Frontend export chỉ tải stream từ server.
10. Bổ sung loading/empty/error/Building/Archived/permission-loading states.
11. Bổ sung component test source nhưng không chạy.

Không loại bỏ compatibility read path cho đến TD13; đặt sau feature flag rõ ràng.

### Batch G — TD07: same-scope CDE relation

1. Tái sử dụng typed CDE version context của Data Quality.
2. API CDE options chỉ nhận `scopeId`; backend tự resolve bound Data Dictionary version.
3. Chỉ trả Approved CDE trong exact bound scope.
4. Async search, pagination, cancellation/request sequence, loading/empty/error.
5. Option key dùng snapshot ID/composite exact version key.
6. Lưu term identity + CDE snapshot/version + Data Dictionary version ID.
7. Revalidate ở Save/Submit/Approve.
8. Cross-scope trả HTTP `409` và code `SCOPE_MISMATCH`.
9. Historical relation render exact snapshot; version mới không tự nâng relation.
10. Không fallback theo code/name/FQN.
11. Bổ sung backend/frontend/security test source.

### Batch H — TD08–TD09: modal, Draft, workflow và record version

1. Refactor modal dùng shared governed form shell nếu phù hợp.
2. Hiển thị read-only scope, Data Dictionary binding, record version và status.
3. Hiển thị đủ source snapshot fields, không cho sửa.
4. Giữ đủ business fields hiện có.
5. Save Draft gửi typed payload và expected revision.
6. Implement Submit/Approve/Reject/Reopen/Revoke bằng shared workflow service.
7. Approved snapshot immutable.
8. Create next version từ `N.x` thành `N.(x+1) Draft` trong cùng scope.
9. Minor Technical version copy payload Approved gần nhất theo Technical design; không copy audit/status/revision/capabilities.
10. Consumer tiếp tục thấy Approved head khi working minor tồn tại.
11. Prevent duplicate submit/double click.
12. Conflict giữ dữ liệu form và hiện reload/merge guidance.
13. Thêm source tests cho transition, concurrency, visibility và numeric version increment.

### Batch I — TD10: catalog version và cutover

1. Tạo Technical Dictionary scope/catalog `N+1` qua shared governed catalog workflow.
2. Mặc định không copy CDE mappings từ scope cũ.
3. Bootstrap Column identities `N.0 Draft` trong scope mới.
4. Activation/archive phải transaction-safe hoặc outbox-convergent theo pattern hiện có.
5. Archived manifest immutable và deep link cũ vẫn đọc đúng.
6. Không cho record/version vượt scope.
7. Bổ sung failure/concurrency/deep-link test source.

### Batch J — TD11: projection và outbox

1. Workflow DB commit phát outbox event trong cùng transaction.
2. Projection cập nhật exact Data Dictionary Column tag/relation.
3. Projection cập nhật Technical classifications theo allowlist.
4. Projection cập nhật compatibility extension fields nếu feature flag yêu cầu.
5. Projection cập nhật survivorship rule có record/version/scope/Column identity.
6. Projection phát reindex/audit event.
7. Handler phải idempotent, retry/backoff được và có trạng thái failure.
8. Revoke đóng/xóa current projection đúng policy nhưng không sửa historical snapshot.
9. Không swallow lỗi projection mà không metric/audit.
10. Thêm source tests cho retry, duplicate delivery, revoke và preservation of unrelated tags.

### Batch K — Hoàn thiện TD12 frontend và contract

1. Kết nối menu `Xuất Excel` với server endpoint.
2. Filename gồm Technical scope version và ngày.
3. Export query tường minh về filter/version view; không phụ thuộc state ngầm.
4. UI xử lý loading/error/download cleanup.
5. Bổ sung contract/component test source.

## REST contract tối thiểu

Giữ contract trong design hoặc facade tương đương:

```http
GET  /v1/technical-dictionary/scopes
GET  /v1/technical-dictionary/scopes/{scopeId}
POST /v1/technical-dictionary/scopes
POST /v1/technical-dictionary/scopes/{scopeId}/archive

GET  /v1/technical-dictionary/scopes/{scopeId}/records
GET  /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}
GET  /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/versions
POST /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/versions
PATCH /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/working
POST /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/submit
POST /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/approve
POST /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/reject
POST /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/reopen
POST /v1/technical-dictionary/scopes/{scopeId}/records/{recordId}/revoke

GET /v1/technical-dictionary/scopes/{scopeId}/cde-options
GET /v1/technical-dictionary/scopes/{scopeId}/stats
GET /v1/technical-dictionary/scopes/{scopeId}/export?format=xlsx
```

Nếu repository đã có profile-neutral route phù hợp cho workflow/version, tái sử dụng route đó và chỉ giữ facade Technical Dictionary cho read/stats/options/export. Không tạo hai implementation state machine.

Mọi mutation working phải nhận `expectedWorkingRevision` hoặc `If-Match`.

## Error contract tối thiểu

Định nghĩa và dùng nhất quán các mã lỗi, tối thiểu:

- `SCOPE_MISMATCH`.
- `SCOPE_NOT_ACTIVE`.
- `SCOPE_VERSION_MISMATCH`.
- `CDE_NOT_APPROVED`.
- `CDE_VERSION_NOT_FOUND`.
- `WORKING_REVISION_CONFLICT`.
- `WORKING_VERSION_ALREADY_EXISTS`.
- `INVALID_STATE_TRANSITION`.
- `COLUMN_BINDING_CONFLICT`.
- `COLUMN_NOT_FOUND`.
- `FORBIDDEN` theo error framework hiện có.

Không dựa vào việc frontend parse message tự do.

## Yêu cầu migration/schema source

- Có migration tương đương cho PostgreSQL và MySQL.
- DDL additive và idempotent theo convention repository.
- Index/unique constraints nằm ở database, không chỉ service validation.
- Không sửa published snapshot cũ.
- Nếu exact foreign key không khả thi vì entity version store dùng JSON, service validation + unique/index vẫn phải đầy đủ và được ghi chú.
- Không triển khai data backfill production của TD13 trong lần này; chỉ tạo schema/contract cần cho TD00–TD12.

## Yêu cầu frontend

- Giữ route `/technical-dictionary`.
- Canonical URL chứa `scopeId`, `scopeVersion`, page size/page và filter cần thiết.
- Scope ID là authoritative; version mismatch không fallback.
- Không suy diễn quyền từ tên role/persona khi API mới bật.
- Không load cứng 1.000 CDE.
- Không export client-side từ `filteredData`.
- Không direct patch Table/GlossaryTerm trong API mới.
- Không tạo detail page.
- Preference key mới; không làm mất column preference của feature khác.
- Action icon có accessible name/tooltip; badge có text, không chỉ màu.

## Yêu cầu source tests dù không được chạy

Phải tạo/cập nhật test source tương ứng với code đã thay đổi:

- Profile contract tests cho ba profiles.
- Scope binding DAO/service/resource tests.
- Column binding/bootstrap idempotency tests.
- DB list/filter/stats tests trên fixtures.
- Same-scope and cross-scope CDE tests.
- Optimistic locking/workflow/version tests.
- Projection/outbox idempotency tests.
- Export authorization/count/formula tests.
- Frontend hook/component tests cho scope switch, URL state, modal, capabilities và async CDE race.

Không chạy bất kỳ test nào. Trong final report, liệt kê chính xác test files đã thêm/sửa và commands đề xuất cho người dùng chạy sau.

## Quy trình làm việc và cập nhật tiến độ

1. Đọc instructions/`AGENTS.md` áp dụng cho repository nếu file tồn tại và đọc được.
2. Kiểm tra working tree; bảo toàn mọi thay đổi có sẵn.
3. Đọc đầy đủ tài liệu authoritative.
4. Inventory code Data Dictionary, Data Quality và Technical Dictionary.
5. Lập checklist nội bộ TD00–TD12 theo dependency.
6. Thực hiện lần lượt từng batch; không chỉ trả lại kế hoạch.
7. Sau mỗi batch, kiểm tra diff tĩnh và tìm references/imports bằng `rg`.
8. Nếu phát hiện blocker thực sự:
   - Tiếp tục các hạng mục độc lập còn lại.
   - Ghi rõ blocker, file/contract liên quan và giải pháp đề xuất.
   - Không tạo workaround phá invariant.
9. Kết thúc bằng `git diff --check` và `git status --short`; không chạy build/test/lint/type-check.

Trong lúc làm, cập nhật ngắn gọn cho người dùng sau mỗi milestone lớn, nêu:

- TD IDs vừa hoàn thành.
- Các file/module chính đã thay đổi.
- Quyết định kiến trúc quan trọng.
- Blocker nếu có.

## Điều kiện hoàn thành

Chỉ đánh dấu TD00–TD12 hoàn thành khi source code đã có đầy đủ contract và đường thực thi tương ứng. Không đánh dấu hoàn thành nếu chỉ có:

- Interface nhưng không có implementation.
- UI nhưng backend chưa authorize/validate.
- Migration nhưng service chưa dùng.
- Endpoint trả mock/empty data.
- Client fallback sang direct OpenSearch/direct patch trong read-write mode mới.
- Test source duy nhất nhưng production code chưa triển khai.

Nếu một hạng mục chưa thể hoàn tất vì generated artifacts hoặc dependency ngoài repository, đánh dấu **Pending**, không đánh dấu Done, và chỉ rõ bước còn thiếu.

## Báo cáo cuối bắt buộc

Trả lời bằng tiếng Việt, gồm:

1. **Kết quả tổng quan**: TD nào Done/Partial/Pending.
2. **Thay đổi kiến trúc**: shared components/services nào được mở rộng.
3. **Backend**: resource/service/DAO/schema/migration/outbox/export đã thay đổi.
4. **Frontend**: API/hooks/page/table/modal/scope/version/CDE selector đã thay đổi.
5. **Tests source**: file đã thêm/sửa, nhưng xác nhận chưa chạy.
6. **Compatibility**: code cũ nào còn giữ sau feature flag và lý do.
7. **Blocker/rủi ro còn lại**.
8. **Danh sách file chính** với đường dẫn clickable nếu môi trường hỗ trợ.
9. **Các command đề xuất để người dùng tự chạy sau**, nhưng không được chạy chúng trong phiên này.
10. Xác nhận rõ: **Không build code và không chạy test theo yêu cầu**.

Không che giấu trạng thái chưa xác minh và không suy đoán rằng code compile nếu chưa build.

---

## Checklist nhanh cho AI coding agent

- [ ] Đã đọc toàn bộ tài liệu authoritative.
- [ ] Đã bảo toàn working tree hiện có.
- [ ] Không chạy build/test/lint/type-check/codegen.
- [ ] TD00 safety fixes hoàn tất.
- [ ] TD01 Technical profile dùng shared workflow.
- [ ] TD02 schema/bootstrap/adapter hoàn tất.
- [ ] TD03 exact scope binding hoàn tất.
- [ ] TD04 Column binding/bootstrap/reconciliation hoàn tất.
- [ ] TD05 DB list/search/filter/stats hoàn tất.
- [ ] TD06 scope-aware UI hoàn tất.
- [ ] TD07 same-scope canonical CDE relation hoàn tất.
- [ ] TD08 modal/Save Draft/optimistic locking hoàn tất.
- [ ] TD09 workflow/record business version hoàn tất.
- [ ] TD10 catalog version/cutover hoàn tất.
- [ ] TD11 projection/outbox hoàn tất.
- [ ] TD12 server-side export hoàn tất.
- [ ] Test source đã thêm/sửa nhưng chưa chạy.
- [ ] `git diff --check` đã chạy.
- [ ] Final report không tuyên bố build/test pass.
