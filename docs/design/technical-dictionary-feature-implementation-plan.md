# Kế hoạch triển khai Từ điển kỹ thuật theo profile Governed Glossary

> Kế hoạch triển khai của [Thiết kế Từ điển kỹ thuật](./technical-dictionary-ui-design.md).
> Khi có khác biệt, tài liệu thiết kế là nguồn yêu cầu. TD là profile
> `TECHNICAL_DICTIONARY` kế thừa [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md);
> kế hoạch này chỉ gồm việc cần làm thêm hoặc cần gỡ bỏ so với DQ.

## 1. Mục tiêu bàn giao

- Technical Dictionary chạy trên cùng engine, endpoint, UI shell, workflow và
  capability với Data Quality.
- Phần riêng chỉ gồm: schema 19 trường, sinh record từ Column, import gán CDE,
  bulk theo kết quả lọc, bảng/modal không có trang chi tiết, projection về Column.
- Gỡ toàn bộ mô hình scope: `technical_dictionary_scope`,
  `technical_record_column_binding`, `/v1/technical-dictionary/*`, UI scope.

## 2. Nguyên tắc

1. Việc DQ đã làm thì dùng lại; thiếu ở shared layer thì bổ sung vào shared layer,
   không viết nhánh riêng cho TD.
2. Môi trường được xóa dữ liệu và khởi tạo lại. Không có data migration, dual-read,
   compatibility path hoặc rollback dữ liệu scope cũ.
3. Mọi rẽ nhánh theo profile dùng `GovernedGlossaryProfileRegistry.Profile`, không so sánh tên glossary.
4. Backend thực thi quyền và scope; frontend chỉ phản ánh capability.

## 3. Hiện trạng code liên quan

| Hạng mục | Hiện trạng | Hướng xử lý |
| --- | --- | --- |
| Profile registry | Đã có `TECHNICAL_DICTIONARY` trong `GovernedGlossaryProfileRegistry` | Giữ; bổ sung frontend registry |
| Record workflow | `GlossaryTermResource` đã rẽ nhánh profile ở create/save (`requireDirectTechnicalDictionaryCreate`, `requireTechnicalDictionaryRelation`) | Chặn create từ người dùng; chuẩn hóa validation theo §4 thiết kế |
| Resource riêng | `TechnicalDictionaryResource` (`/v1/technical-dictionary`, gồm `/scopes`) | Xóa sau khi shared endpoint phục vụ đủ |
| Service/DAO | `TechnicalDictionaryService`, `TechnicalDictionaryDAO` dựa trên scope | Viết lại thành bootstrap job; xóa phần scope |
| Column identity | `nameUUIDFromBytes("column:" + fqn)` và recordId dẫn xuất | Chuyển sang `columnKey = nameUUIDFromBytes(fqn)` (khớp `ColumnSearchIndex`); `name = columnKey` |
| Export | `TechnicalDictionaryExcelExporter` riêng; export chung đang cố định `DATA_DICTIONARY` | Tổng quát hóa export chung theo profile; exporter TD chỉ còn là column mapping |
| Schema DB | Bảng `technical_dictionary_scope`, `technical_record_column_binding` | Xóa; thêm `technical_bootstrap_job` |
| Column loader | `loadColumns()` đọc mọi Table, gồm cả view và Table đã soft-delete | Lọc theo phạm vi Column (thiết kế §5.4) |
| Trường phân loại | Seed tạo Classification `DataElementType`, `FieldGenerationType`, `DataCreationMethod`; service đang lọc theo `extension` | Lưu và lọc theo tag; thêm Classification `DataTimeliness` |
| Chủ sở hữu | UI chỉ có `systemOwner` (text); không có `dataOwner` | `systemOwner` thành `entityReference` Team; Chủ sở hữu dữ liệu suy ra từ CDE |

## 4. Danh sách chức năng

| ID | Chức năng | Phụ thuộc | Mốc |
| --- | --- | --- | --- |
| TD00 | Gỡ mô hình scope, reset schema | Không | M0 |
| TD01 | Profile manifest, custom properties, classifications | TD00 | M0 |
| TD02 | Bootstrap glossary identity và catalog Draft `1` | TD01 | M0 |
| TD03 | Record schema, validation, chặn create/delete thủ công | TD01 | M1 |
| TD04 | Bootstrap job sinh record từ Column | TD02, TD03 | M1 |
| TD05 | Sự kiện Column mới/không còn tồn tại | TD04 | M1 |
| TD06 | List/search/stats DB-backed theo profile | TD03 | M2 |
| TD07 | Route, header, stats, toolbar, bảng | TD06 | M2 |
| TD08 | Modal xem/sửa và row workflow actions | TD07 | M2 |
| TD09 | CDE selector cùng số version | TD08 | M2 |
| TD10 | Export theo profile | TD06 | M2 |
| TD11 | Bulk workflow theo kết quả lọc | TD08 | M3 |
| TD12 | Import gán CDE | TD09, TD10 | M3 |
| TD13 | Catalog version kế tiếp và cutover | TD04, TD11 | M3 |
| TD14 | Projection qua outbox | TD13 | M4 |
| TD15 | Hiệu năng, bảo mật, vận hành | TD14 | M4 |

## 5. Chi tiết chức năng

### TD00 — Gỡ mô hình scope, reset schema

**Phạm vi**

- Xóa bảng `technical_dictionary_scope`, `technical_record_column_binding` khỏi schema
  PostgreSQL/MySQL; thêm `technical_bootstrap_job`.
- Tắt startup tạo scope; xóa endpoint `/scopes` và mọi query param `scopeId`/`scopeVersion`.
- Inventory caller frontend của `/v1/technical-dictionary/*` để thay ở TD06–TD12.
- Khóa hành vi Data Dictionary/DQ bằng contract test trước khi sửa shared code.

**DoD**

- Database sạch không có bảng hoặc record scope.
- Contract test Data Dictionary/DQ xanh trước và sau thay đổi.

### TD01 — Profile manifest, custom properties, classifications

**Phạm vi**

- Manifest `TECHNICAL_DICTIONARY` `schemaVersion = 1`: trường editable, trường
  server-owned, enum, allowlist extension key, allowlist classification.
- Đăng ký custom properties idempotent (kiểm tra name, type, displayName; cùng name
  khác type là lỗi vận hành), gồm `survivorshipRank`, `systemOwner` (`entityReference` Team)
  và các trường source snapshot server-owned.
- Bootstrap server-side, idempotent bốn Classification `DataElementType`, `FieldGenerationType`,
  `DataCreationMethod` (giá trị theo seed hiện có) và `DataTimeliness`.
- Chuẩn hóa danh sách tag `DataTimeliness` từ tập giá trị distinct của file nguồn hiện có,
  lập báo cáo giá trị không map được; nghiệp vụ duyệt danh sách trước khi merge PR.
- Cấu hình phạm vi Column trong manifest: include service/database/schema, exclude pattern,
  allowlist loại Table.
- Frontend registry: `fields`, `columns`, `filters`, `importExport`; `detailSections` rỗng.

**DoD**

- Restart không tạo property/classification trùng.
- Frontend và backend cùng đọc một `schemaVersion`.
- Danh sách `DataTimeliness` đã được nghiệp vụ duyệt.

### TD02 — Bootstrap glossary identity và catalog Draft `1`

**Phạm vi**

- Tạo nguyên tử identity `Technical Dictionary` / `Từ điển kỹ thuật` và working Draft `1`,
  theo cùng cơ chế F00/F07 của CDE và `DataQualityBootstrap`.
- Trạng thái chỉ có identity hoặc chỉ có working → fail-fast, không tự sửa.

**DoD**

- Database sạch tạo đúng một identity và một working Draft `1`; restart không tạo trùng.

### TD03 — Record schema, validation, chặn create/delete thủ công

**Phạm vi**

- `POST /v1/glossaryTerms` cho glossary TD từ người dùng → `403 TD_MANUAL_CREATE_NOT_ALLOWED`.
  Service tạo record nội bộ chỉ nhận system principal.
- Capability `canCreate`, `canDelete` luôn `false` với người dùng TD.
- Save Draft chỉ nhận trường editable; trường server-owned trong payload → `400`.
- Validation: tag đơn trị trong đúng classification; `systemOwner` là Team tồn tại;
  Thứ hạng `1..999`, bắt buộc khi có CDE và trống khi không có CDE (bắt buộc ở Submit);
  CDE theo TD09.
- Kiểm tra trùng Thứ hạng: cảnh báo ở Save Draft, lỗi `TD_RANK_DUPLICATE` ở Submit và Approve.
  Approve khóa theo `(glossaryId, parentBusinessVersion, cdeTermId)` trước khi kiểm tra.
- Chủ sở hữu dữ liệu không nằm trong payload; response resolve từ `owners` của CDE.
- Capability Proposer theo policy, không theo ownership.

**DoD**

- Không có đường API nào để người dùng tạo/xóa record TD.
- Round-trip Save Draft không làm mất source snapshot hoặc `releaseVersionType`.
- Hai writer cùng revision: một thành công, một `409`.
- Hai Approve đồng thời cùng CDE và cùng Thứ hạng: đúng một thành công.

### TD04 — Bootstrap job sinh record từ Column

**Phạm vi**

- Bảng `technical_bootstrap_job` và repository.
- Preflight manifest một lần; thiếu thì `Failed` với lỗi cụ thể trước vòng lặp.
- Chụp cấu hình phạm vi Column vào job (`columnScopeSnapshot`); allowlist rỗng →
  `Failed` với `TD_COLUMN_SCOPE_EMPTY`.
- Duyệt Column theo batch/checkpoint: chỉ Table loại `Regular`, `Partitioned`, `External`,
  `Iceberg`, chưa soft-delete, không khớp exclude pattern, chỉ Column cấp cao nhất; tạo `N.0 Draft`
  với `name = columnKey` qua service tạo governed record dùng chung.
- Unique key `(glossaryId, parentBusinessVersion, normalizedName)` chống trùng; constraint
  race coi là `skipped`.
- Lưu error summary và mẫu lỗi; không nuốt exception.
- Endpoint trạng thái/retry job (thiết kế §10).

**DoD**

- Chạy lại hoặc chạy đồng thời không tạo trùng record.
- Job chỉ `Succeeded` khi mọi Column được xử lý; lỗi có nguyên nhân và retry được.
- UI/API phân biệt được bảng rỗng thật và bootstrap lỗi.

### TD05 — Sự kiện Column mới/không còn tồn tại

**Phạm vi**

- Consumer outbox cho Column create/delete/update từ lifecycle Table.
- Column mới → tạo `N.0 Draft` trong mọi TD scope chưa Archived, nếu Column thuộc
  `columnScopeSnapshot` của scope đó.
- Table soft-delete → mọi record của Table có trạng thái nguồn `Unavailable` (bảng
  `technical_source_state`); restore đặt lại `Available`.
- Column không còn → `Unavailable`; chặn Submit/Approve (`TD_SOURCE_UNAVAILABLE`).
- Column thay đổi thuộc tính → làm mới source snapshot của working Draft; Approved chỉ
  hiển thị badge **Nguồn đã thay đổi**.
- Đổi tên Column/Table xử lý như cặp delete + create.

**DoD**

- Sự kiện lặp lại không tạo trùng.
- Published snapshot không đổi khi Column đổi.

### TD06 — List/search/stats DB-backed theo profile

**Phạm vi**

- Dùng flat read model F11/F12 chung; thêm filter profile: nguồn, CDE (gồm chưa quy chiếu),
  loại thành tố, loại trường, phương thức tạo, tình trạng nguồn.
- Search trên database/schema/table/column và mã/tên CDE.
- Chế độ mặc định (representation mới nhất) và chế độ tất cả phiên bản.
- Endpoint stats theo profile.

**DoD**

- Authorization áp trước count/sort/pagination; Consumer không thấy working qua query tampering.
- Filter `In Review` trả đúng row.
- List, stats và export dùng cùng scope resolution.
- p95 list/filter dưới 1 giây với 65k record trên PostgreSQL và MySQL.

### TD07 — Route, header, stats, toolbar, bảng

**Phạm vi**

- Route `/technical-dictionary` và `?businessVersion=N`; xóa state/effect scope.
- Header shared: status, version selector, catalog actions; không có Thêm thuật ngữ.
- Stats cards, trạng thái bootstrap Running/Failed.
- Bảng 19 trường đúng thứ tự, bốn cột trái và cột Hành động cố định, scrollbar ngang
  nằm trong khung bảng, column preference `governedGlossary.TECHNICAL_DICTIONARY.v1`.

**DoD**

- Mở route không tự thay URL; F5/back/forward giữ đúng version và filter.
- Không có UUID hoặc thuật ngữ scope trên UI/i18n.

### TD08 — Modal xem/sửa và row workflow actions

**Phạm vi**

- Modal shell chung DQ, chế độ Xem/Sửa, ba nhóm trường (thiết kế §7.5).
- Row actions và footer actions hoàn toàn theo capability; không render action trước
  khi capability load.
- Save Draft gửi trường editable + `expectedRevision`.

**DoD**

- Double-click chỉ phát một request; `409` giữ dữ liệu form.
- Approved/Archived/historical không có affordance sửa.
- Modal không bị che, không tạo scrollbar ngoài thứ hai.

### TD09 — CDE selector cùng số version

**Phạm vi**

- Backend validate: CDE thuộc Data Dictionary scope cùng số `N`, trạng thái `Approved`,
  Data Dictionary `N` đang active, actor có quyền xem.
- Selector async dùng component DQ; disable và thông báo khi Data Dictionary `N`
  chưa Approved hoặc đã Archived.
- Relation `termId` + `versionContext`, chuẩn hóa như DQ §5.4.

**DoD**

- Request chéo scope bị từ chối (`TD_CDE_SCOPE_MISMATCH`) dù bỏ qua frontend.
- Mapping lịch sử tới CDE Archived vẫn hiển thị read-only.

### TD10 — Export theo profile

**Phạm vi**

- Tổng quát hóa endpoint export chung để rẽ nhánh theo profile (hiện cố định Data Dictionary).
- Column mapping TD, tên file, sheet theo thiết kế §12; xóa `TechnicalDictionaryExcelExporter`
  riêng hoặc chuyển thành mapping.

**DoD**

- Export khớp count/thứ tự với list; Consumer chỉ nhận published rows.
- File export import lại được ở TD12.

### TD11 — Bulk workflow theo kết quả lọc

**Phạm vi**

- Bulk Submit/Approve/Reject theo DQ §8.6, trong shared bulk service.
- Bổ sung chế độ **Áp dụng cho toàn bộ kết quả lọc**: request gửi filter criteria,
  backend resolve lại tập row theo quyền, xử lý batch, trả báo cáo theo row.
- Preview số row hợp lệ/không hợp lệ và lý do.
- Bulk Approve kiểm tra trùng Thứ hạng trên trạng thái cuối của toàn bộ tập đang duyệt,
  để đổi chỗ Thứ hạng giữa hai record trong một lần duyệt là hợp lệ.

**DoD**

- Bulk 65k record hoàn tất trong giới hạn transaction theo batch, không khóa bảng lâu.
- Thành công một phần được báo đúng; row lỗi không làm rollback row khác trong batch đã commit.
- DQ dùng được cùng tính năng.

### TD12 — Import gán CDE

**Phạm vi**

- Session import riêng của TD (`TechnicalImportService`), endpoint `/glossaryTerms/import/technical/*`, giao diện là modal trong trang danh sách.
- Match theo vị trí Column; không match/match nhiều → lỗi dòng; không tạo record.
- Chỉ cập nhật cột editable có mặt trong file; ô trống xóa giá trị.
- Chính sách `DRAFT_ONLY` (mặc định) và `ALL_EDITABLE`; action preview theo thiết kế §8.3.
- Mã CDE resolve trong Data Dictionary scope cùng số `N`, chỉ `Approved`.
- Tag resolve theo `displayName` trong đúng classification; Chủ sở hữu hệ thống resolve theo
  `displayName` Team; không tìm thấy/trùng là lỗi dòng, không tự tạo.
- Cột suy ra/server-owned trong file bị bỏ qua; trùng Thứ hạng là cảnh báo ở preview.

**DoD**

- Commit nguyên tử; stale preview trả `409`.
- Export TD `N` → Import TD `N+1` gán được mapping cho Column còn tồn tại.
- File chỉ gồm bốn cột vị trí + Mã CDE được chấp nhận.

### TD13 — Catalog version kế tiếp và cutover

**Phạm vi**

- Dùng flow F09/F10 chung; sau khi tạo catalog `N+1` tự kích hoạt bootstrap job scope `N+1`.
- Publish-preview hiển thị số record `N+1.x` đã Approved và số record `N.x` sẽ Archive/xóa.
- Cutover theo DQ/CDE.

**DoD**

- Lỗi giữa tạo catalog và bootstrap để lại trạng thái retry rõ ràng, không tạo scope nửa vời.
- Deep link version cũ read-only và không resolve sang version mới.

### TD14 — Projection qua outbox

**Phạm vi**

- Approve/Revoke/Archive phát outbox idempotent: tag CDE scoped FQN và bốn tag phân loại
  trên Column, search reindex, audit.
- Survivorship rule (`recordId`, record version, `columnKey`, CDE snapshot, rank) **chưa được
  projection**: chưa có đích lưu ở backend; UI đọc `extension.survivorshipRules` của CDE.
- Record có trạng thái nguồn `Unavailable` không được projection.
- Allowlist tag/rule profile quản lý; retry/backoff, dead-letter, metric, reconciliation.

**DoD**

- Workflow commit không phụ thuộc projection.
- Retry không tạo trùng tag/rule; không xóa metadata ngoài allowlist.

### TD15 — Hiệu năng, bảo mật, vận hành

**Phạm vi**

- Load test 65k và 2x headroom: bootstrap, list/filter, bulk, import, export.
- Security test: IDOR, query tampering, create/delete thủ công, chéo scope CDE.
- Metric/alert: bootstrap progress, list latency, conflict, bulk/import lỗi, outbox lag,
  projection drift, record có nguồn không còn.
- Runbook: bootstrap lỗi, outbox kẹt, reindex, reset môi trường.
- Xóa code TD riêng còn sót sau khi shared path phục vụ đủ.

**DoD**

- Không còn `scopeId`/`scopeVersion`, resource `/v1/technical-dictionary` hoặc
  page-level state machine riêng.
- Regression Data Dictionary/DQ đạt.

## 6. Mốc phát hành

| Mốc | Nội dung | Điều kiện ra mốc |
| --- | --- | --- |
| M0 | Gỡ scope, manifest, identity catalog | Data Dictionary/DQ không regression |
| M1 | Record schema, bootstrap job, sự kiện Column | Bootstrap 65k idempotent, quan sát được |
| M2 | List, bảng, modal, CDE selector, export | Proposer sửa/Submit, Steward Approve từng record |
| M3 | Bulk, import, catalog version kế tiếp | Gán CDE hàng loạt và cutover `N → N+1` end-to-end |
| M4 | Projection, hardening | Production sign-off |

## 7. Kế hoạch PR

| PR | Nội dung | Điều kiện merge |
| --- | --- | --- |
| 1 | TD00 gỡ scope, schema mới | Contract test Data Dictionary/DQ xanh |
| 2 | TD01–TD02 manifest, identity catalog | Bootstrap idempotent |
| 3 | TD03 record schema/validation | Không có đường create/delete thủ công |
| 4 | TD04–TD05 bootstrap job, sự kiện Column | Idempotency + error observability |
| 5 | TD06 list/search/stats | Authorization trước pagination, benchmark 65k |
| 6 | TD07–TD08 page, bảng, modal | Component + E2E Proposer/Steward |
| 7 | TD09 CDE selector | Test chéo scope |
| 8 | TD10 export theo profile | Parity list/export, regression export Data Dictionary |
| 9 | TD11 bulk | Bulk 65k, báo cáo theo row |
| 10 | TD12 import | Atomic commit, round-trip export → import |
| 11 | TD13 catalog version kế tiếp | Cutover end-to-end |
| 12 | TD14 projection | Idempotency/reconciliation |
| 13 | TD15 hardening/cleanup | Production readiness |

## 8. Kiểm thử bắt buộc

| Tầng | Nội dung |
| --- | --- |
| Unit backend | columnKey, manifest validation, capability TD, resolve CDE cùng số version |
| Repository | unique record theo scope, bootstrap checkpoint, filter/paging, optimistic lock |
| Resource | chặn create/delete, server-owned fields, chéo scope CDE, IDOR, export, import |
| Unit frontend | route state, profile descriptor, cột, form mapping, status label |
| Component | bảng cố định cột/scrollbar, modal xem/sửa, selector, bulk preview |
| E2E | Consumer/Proposer/Steward/Admin; bulk; import gán CDE; cutover `N → N+1` |
| Performance | 65k record: bootstrap, list/filter, bulk, import, export |

Critical journey:

1. Môi trường sạch → bootstrap sinh record `1.0 Draft` cho mọi Column.
2. Proposer import file bốn cột vị trí + Mã CDE → preview → commit.
3. Proposer bulk Submit toàn bộ kết quả lọc; Steward bulk Approve.
4. Consumer thấy record Approved ngay từ DB list; Column được gắn tag CDE qua outbox.
5. Data Dictionary cutover sang `2` → TD `1` khóa gán CDE mới.
6. Tạo TD `2` → bootstrap `2.0` → Export TD `1` → Import vào TD `2` → bulk Submit/Approve
   → Approve catalog `2` → TD `1` Archived.

## 9. Rủi ro và biện pháp

| Rủi ro | Mức | Biện pháp |
| --- | --- | --- |
| Sửa shared layer làm hỏng Data Dictionary/DQ | Cao | Contract test trước khi sửa; PR nhỏ |
| Phê duyệt 65k record thủ công không khả thi | Cao | Bulk theo kết quả lọc (TD11) và import gán CDE (TD12) |
| Data Dictionary cutover làm TD mất khả năng gán CDE | Trung bình | Runbook tạo TD `N+1` ngay sau DD cutover; export/import mapping |
| Đổi tên Column làm mất mapping | Trung bình | Chấp nhận ở v1 (TD-D14); badge nguồn không còn + import lại |
| Giá trị Thời gian/Chủ sở hữu hệ thống trong dữ liệu nguồn không khớp tag/Team | Trung bình | Báo cáo chuẩn hóa ở TD01; Import báo lỗi theo dòng, không tự tạo |
| Allowlist phạm vi Column cấu hình sai | Trung bình | Preflight fail-fast khi rỗng; job báo số Column theo service trước khi xử lý |
| Bootstrap lỗi hàng loạt do schema thiếu | Cao | Preflight fail-fast trước vòng lặp |
| Projection xóa nhầm metadata | Cao | Allowlist + outbox idempotent + reconciliation |

## 10. Checklist nghiệm thu cuối

- [ ] TD là profile `TECHNICAL_DICTIONARY`, dùng endpoint/shell/workflow của DQ.
- [ ] Không còn bảng, endpoint, route hoặc UI scope.
- [ ] Người dùng không tạo/xóa được record.
- [ ] Mỗi Column tối đa một record trong một scope; `name = columnKey`.
- [ ] Bootstrap chỉ lấy Column cấp cao nhất của Table lưu dữ liệu vật lý thuộc allowlist.
- [ ] Thứ hạng duy nhất trong cùng CDE trên record `Approved` còn nguồn, kể cả khi duyệt đồng thời.
- [ ] Chủ sở hữu dữ liệu suy ra từ CDE; Chủ sở hữu hệ thống là Team; bốn trường phân loại là tag.
- [ ] Bootstrap idempotent, có checkpoint, lỗi có nguyên nhân và retry được.
- [ ] CDE chỉ gán được từ Data Dictionary scope cùng số `N`, trạng thái Approved.
- [ ] Import chỉ cập nhật record có sẵn, chỉ cột có trong file, commit nguyên tử.
- [ ] Bulk áp dụng được cho toàn bộ kết quả lọc.
- [ ] Bảng đúng 19 trường, cột cố định và scrollbar đúng thiết kế.
- [ ] Modal thay trang chi tiết với chế độ xem/sửa đúng capability.
- [ ] Export đúng catalog version, quyền, và import lại được.
- [ ] Catalog `N+1` bootstrap lại record; cutover đúng DQ/CDE.
- [ ] Projection qua outbox, không xóa metadata ngoài allowlist.
- [ ] Data Dictionary và Data Quality không regression.

## 11. Trạng thái triển khai

Đã triển khai trên nhánh `feature/technical-dictionary-governed-profile` (C0–C10).

**Đã kiểm chứng**

- Unit test backend cho scope Column, validator, source snapshot, rank guard, projection,
  row matcher/decorator, stats, export, import (sheet/planner/patch/service), bulk workflow.
- 35 test Jest (7 suite) cho constants, rows, catalog, bulk runner, table, modal.
- SQL của các DAO mới chạy thật trên PostgreSQL 15 (row lock, upsert, cast jsonb, ràng buộc unique, JSON path).

**Chưa kiểm chứng / còn thiếu**

- Integration test `TechnicalDictionaryResourceIT` và E2E Playwright chưa chạy (cần OpenSearch image và mạng).
- Biến thể MySQL của SQL mới đã biên dịch nhưng chưa chạy.
- Benchmark 65k Column (bootstrap, list p95, bulk, export) chưa đo.
- 15 locale ngoài `en-us` và `vi-vn` chưa đồng bộ (`yarn i18n`).
- Survivorship rule chưa projection lên Column (xem thiết kế §11).
- Danh sách `DataTimeliness` (T0..T3) là seed tạm, cần nghiệp vụ duyệt.
- Vòng xử lý outbox có thể bị nghẽn bởi event luôn lỗi (chưa có dead-letter).
