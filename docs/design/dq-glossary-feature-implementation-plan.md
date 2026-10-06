# Kế hoạch triển khai Chất lượng dữ liệu theo từng chức năng

## Trạng thái thực hiện (cập nhật 2026-10-01)

Đối chiếu bằng đọc mã nguồn, chưa build/test. Chi tiết khác biệt ở mục "Hiện trạng triển khai" của [thiết kế DQ](./dq-glossary-ui-design.md).

| Chức năng | Trạng thái |
| --- | --- |
| DQ00 | Một phần: chưa có feature flag; chưa thấy characterization test riêng |
| DQ01 | Đã có profile `DATA_QUALITY` trong `GovernedGlossaryProfileRegistry` |
| DQ02 | Một phần: component UI DQ riêng (`DQGlossary*`) đã có; mức dùng chung shell cần rà lại |
| DQ03 | Đã có `DataQualityBootstrap` |
| DQ04–DQ05 | Một phần: dùng `GlossaryFlatListService` chung, cột DQ ở UI; chưa có read model DQ riêng |
| DQ06 | Một phần: overview/summary UI; ràng buộc đúng 1 CDE ở backend |
| DQ07 | **Chưa làm** (export DQ trả 400) |
| DQ08–DQ09 | Một phần: tạo Draft và workflow dùng chung; bulk cho DQ chưa kiểm chứng |
| DQ10–DQ11 | Chưa kiểm chứng |
| DQ12 | Chưa làm đúng thiết kế: import chạy ở client, không nguyên tử |
| DQ13–DQ16 | Chưa làm |


## 1. Tài liệu nguồn và mục tiêu bàn giao

Kế hoạch này hiện thực [Thiết kế kỹ thuật và UI/UX Chất lượng dữ liệu](./dq-glossary-ui-design.md) trên nền [Thiết kế CDE](./cde-glossary-ui-design.md) và [kế hoạch triển khai CDE](./cde-glossary-feature-implementation-plan.md).

Mục tiêu không phải tạo một bản sao màn hình CDE. Kết quả bàn giao phải có một **Governed Glossary feature shell** dùng chung cho `DATA_DICTIONARY` và `DATA_QUALITY`; khác biệt được cô lập trong profile schema/adapter.

### Definition of Done chung

Một chức năng chỉ hoàn thành khi có đủ:

- Backend contract, validation và authorization.
- Persistence/query/migration nếu cần.
- Frontend API typed, UI state và error handling.
- Unit/integration/E2E tương ứng.
- Audit/metric/log cần thiết.
- Tài liệu contract hoặc migration note được cập nhật.

Không nghiệm thu “UI đã hiện” nếu API vẫn dùng fallback/ES/client-side validation làm nguồn sự thật.

## 2. Chiến lược triển khai

### 2.1. Refactor an toàn trước, bật DQ sau

Implementation hiện tại đã có DQ UI nhưng backend workflow chuyên biệt cho Data Dictionary. Thứ tự bắt buộc:

1. Characterization test khóa hành vi CDE hiện tại.
2. Tổng quát hóa backend/frontend thành profile nhưng giữ CDE không đổi hành vi.
3. Thêm profile DQ và schema.
4. Bật từng capability DQ sau integration test.
5. Migration/cutover và loại bỏ compatibility code.

Không mở feature flag DQ production ngay sau khi chỉ hoàn thành form/table.

### 2.2. Phân kỳ phát hành

| Mốc | Nội dung | Có thể dùng bởi |
| --- | --- | --- |
| M0 | Baseline + profile foundation, CDE regression xanh | Dev nội bộ |
| M1 | DQ read-only Approved: list/filter/detail/version/export | Pilot Consumer |
| M2 | DQ authoring + workflow + bulk action | Proposer/Approver pilot |
| M3 | Import, Assets, migration/cutover, observability | Production |
| M4 | Tối ưu và integration với TestCase (nếu duyệt scope) | Pha sau |

## 3. Danh sách chức năng và phụ thuộc

| ID | Chức năng | Phụ thuộc | Mốc |
| --- | --- | --- | --- |
| DQ00 | Baseline, characterization test và feature flag | Không | M0 |
| DQ01 | Governed Glossary Profile backend | DQ00 | M0 |
| DQ02 | Shared frontend shell/profile registry | DQ00, DQ01 | M0 |
| DQ03 | Bootstrap schema, classifications và Data Quality identity | DQ01 | M0 |
| DQ04 | DB-backed DQ read model, list/search/filter | DQ01, DQ03 | M1 |
| DQ05 | DQ table/toolbar/column preferences | DQ02, DQ04 | M1 |
| DQ06 | DQ detail, CDE link, version/deep link | DQ02–DQ04 | M1 |
| DQ07 | Export theo scope và quyền | DQ04, DQ06 | M1 |
| DQ08 | Create/Save Draft DQ Rule | DQ03, DQ04, DQ06 | M2 |
| DQ09 | Submit/Reject/Reopen/Approve và bulk workflow | DQ08 | M2 |
| DQ10 | Tạo minor version DQ Rule | DQ09 | M2 |
| DQ11 | Version/cutover Data Quality catalog | DQ09, DQ10 | M2 |
| DQ12 | Import template/preview/commit nguyên tử | DQ07–DQ10 | M3 |
| DQ13 | Assets, reverse CDE discovery và audit | DQ06, DQ09 | M3 |
| DQ14 | Migration dữ liệu DQ hiện có và cutover | DQ03–DQ13 | M3 |
| DQ15 | Hardening, hiệu năng, bảo mật và vận hành | DQ04–DQ14 | M3 |
| DQ16 | Dọn code trùng và compatibility | DQ14, DQ15 | M3 |

### 3.1. Ước lượng và tổ chức thực hiện

Ước lượng dưới đây là khoảng tương đối cho repository hiện tại, gồm implementation và automated test nhưng chưa gồm thời gian chờ duyệt nghiệp vụ/UAT:

| Mốc | Phạm vi | Ước lượng | Điều kiện ra mốc |
| --- | --- | --- | --- |
| M0 | DQ00–DQ03 | 2–3 tuần | CDE regression xanh; profile/schema bootstrap ổn định |
| M1 | DQ04–DQ07 | 2 tuần | Consumer pilot đọc/search/filter/detail/export Approved |
| M2 | DQ08–DQ11 | 2–3 tuần | Authoring/workflow/version/cutover qua E2E |
| M3 | DQ12–DQ16 | 3–4 tuần | Import/migration/security/performance/operations sign-off |

Với một backend engineer, một frontend engineer và QA tham gia liên tục, critical path dự kiến **9–12 tuần**. Có thể rút ngắn bằng hai workstream sau khi DQ01 contract ổn định:

- Backend/data: DQ03 → DQ04 → DQ07/DQ08 → DQ09–DQ14.
- Frontend: DQ02 → DQ05/DQ06 → form/workflow/import UI.
- QA/automation chạy song song từ DQ00, không dồn toàn bộ E2E về cuối.

Đây là estimate để lập kế hoạch, không phải cam kết sprint; cần hiệu chỉnh sau DQ00 inventory và benchmark.

### 3.2. Ma trận truy vết yêu cầu

| Yêu cầu | Chức năng hiện thực |
| --- | --- |
| Kế thừa layout/UX CDE, không copy code | DQ00–DQ02, DQ05, DQ16 |
| Bộ thuộc tính DQ riêng | DQ03, DQ05, DQ06, DQ08 |
| Cây/danh mục và bảng chi tiết | DQ02, DQ05; DQ profile dùng flat direct-child list |
| Tìm kiếm/bộ lọc | DQ04–DQ05 |
| Form thêm/sửa | DQ08 |
| Phân quyền và workflow | DQ01, DQ08–DQ11 |
| Liên kết CDE/metadata Assets | DQ06, DQ13 |
| Import/export | DQ07, DQ12 |
| Version/history/deep link | DQ06, DQ10–DQ11 |
| Production migration và vận hành | DQ14–DQ16 |

**Schema UI đã chốt:** `Mã quy tắc`, `Mã CDE`, `Tên thành tố`, `Tiêu chí chất lượng dữ liệu`, `Quy tắc nghiệp vụ`, `Diễn giải quy tắc nghiệp vụ`, `Ràng buộc / Yêu cầu khác`, `Các tiêu chí cơ sở`, `Hình thức kiểm tra`, `Tần suất`, `Ngưỡng chất lượng dữ liệu`, `Văn bản quy định liên quan`, `Phiên bản`, `Loại phiên bản phát hành`, `Cấp phát hành`, `Ngày hiệu lực`, `Ngày hết hiệu lực`, `Trạng thái`. Checkbox và cột thao tác không tính vào 18 trường. `Loại phiên bản phát hành` chỉ có `Bản chính`/`Bản phụ` và `Trạng thái` luôn ở cuối.

## 4. Chi tiết từng chức năng

### DQ00 — Baseline, characterization test và feature flag

**Phạm vi**

- Inventory các file DQ hiện có: constants, form, columns, filters, detail, XLSX utilities, styles, test và seed script.
- Ghi lại API call thực tế của create/edit/workflow/version/import/export; chỉ ra call nào hiện bị backend Data Dictionary từ chối.
- Thêm characterization test cho CDE trước refactor: Consumer visibility, working lifecycle, scope isolation, list/search, import/export và optimistic locking.
- Thêm feature flag `governedGlossary.dataQuality.enabled`, mặc định tắt ngoài dev cho đến DQ14.
- Chụp baseline bundle size, list latency và test coverage của vùng Glossary.

**DoD/Test**

- Có inventory + gap report được review bởi frontend/backend/QA.
- Toàn bộ CDE regression suite xanh trước khi refactor.
- Tắt flag không xuất hiện menu/route/action DQ mới và không thay response CDE.
- Không thay dữ liệu production ở bước này.

### DQ01 — Governed Glossary Profile backend

**Phạm vi**

- Tạo `GovernedGlossaryProfileRegistry` allowlist `DATA_DICTIONARY` và `DATA_QUALITY`.
- Refactor `DataDictionaryResolver` thành resolver/profile validator dùng chung; giữ facade tạm nếu giảm phạm vi diff.
- Đổi tên/tách logic generic trong `GlossaryVersioningService`, flat list, search, import/export để nhận profile; logic CDE đặc thù nằm trong validator/mapper CDE.
- Mọi endpoint working/published/permissions resolve glossary bằng ID rồi lấy profile; không dựa display name.
- Trả `profileKey`, `schemaVersion`, capabilities trong representation cần thiết.
- Giữ route hiện tại để không phá frontend; route profile-neutral mới chỉ thêm khi cần list/import/export.

**DoD/Test**

- Contract test chạy cùng một bộ state machine cho cả hai profile.
- CDE response/status/error không đổi ngoài field additive.
- Glossary không thuộc registry không thể gọi Business Workflow endpoint.
- Payload giả `profileKey`, đổi display name hoặc FQN alias không vượt resolver.
- Authorization test cho mọi transition và published/working read.

### DQ02 — Shared frontend shell/profile registry

**Phạm vi**

- Tạo typed profile registry và shared shell cho header, toolbar, table state, modal, detail section, version selector và bulk action.
- Chuyển nhận diện từ `isDataQualityGlossary(alias...)` sang `profileKey`; alias còn fallback có telemetry trong migration window.
- Tách state/search/filter/pagination khỏi `GlossaryTermTab.component.tsx` thành hook dùng chung, ví dụ `useGovernedGlossaryList`.
- Tách common cell renderer hiện có; giữ renderer DQ/CDE chuyên biệt dưới adapter.
- Preference key có profile + schema version.

**DoD/Test**

- Không tạo bản copy `DQGlossaryPage` từ CDE page.
- Shared contract tests chạy với fixture CDE và DQ.
- CDE visual/regression test không đổi hành vi.
- Request race, IME search, pagination reset và permission-loading state có test.

### DQ03 — Bootstrap schema, classifications và identity

**Phạm vi**

- Bootstrap nguyên tử glossary `Data Quality`, profile `DATA_QUALITY` và working catalog Draft `1` ở môi trường mới.
- Tạo/kiểm tra Custom Properties: `ruleCode`, `ruleExplanation`, `otherConstraints`, `qualityThreshold`, `relatedRegulatoryDocuments`, `releaseVersionType`, `releaseLevel`, `effectiveDate`, `expirationDate`.
- `relatedRegulatoryDocuments`, `releaseLevel`, `effectiveDate` và `expirationDate` là Custom Properties dùng chung đã có từ CDE: DQ chỉ tái sử dụng đúng type/enum, không tạo property trùng. `releaseVersionType` là property mới và phải qua drift check như các field DQ khác.
- Tạo/kiểm tra classifications/tags: `DataQualityDimension`, `DataQualityTargetPopulation`, `DataQualityMethod`, `DataQualityFrequency`. `DataQualityTargetPopulation` tiếp tục là technical classification phía dưới của trường UI `Các tiêu chí cơ sở`.
- `exceptions` và tag `DataSource` legacy không còn thuộc schema DQ mới; migration phải inventory/report dữ liệu cũ, không tự ánh xạ hoặc xóa.
- Tái sử dụng enum `releaseLevel` của CDE: `CEO`/`TTQLDL`. Khóa `releaseVersionType` thành enum server-owned hai giá trị `Bản chính`/`Bản phụ`; `N.0` được gán `Bản chính`, mọi `N.MINOR` với `MINOR >= 1` được gán `Bản phụ`. Bootstrap fail-fast nếu property hiện hữu lệch type hoặc tập giá trị ở môi trường bật feature.
- Khóa cardinality/required rule trong backend profile validator, không chỉ trong Tag UI.
- Bootstrap server-side theo marker, idempotent và fail-fast nếu property cùng name khác type.
- Giữ Python seed script cho dev/demo nhưng sửa để dùng cùng manifest/schema version và không tự approve trong production mode.

**DoD/Test**

- Restart không tạo trùng glossary/property/tag/working row.
- Trạng thái nửa bootstrap làm startup/health check báo lỗi rõ, không tự sửa ngầm.
- Catalog Draft `1` không lộ cho Consumer và không tạo published snapshot giả.
- Custom Property không tự xuất hiện trên glossary profile khác.
- Manifest drift test phát hiện Java/Python/frontend schema không đồng nhất.

### DQ04 — DB-backed read model, list/search/filter

**Phạm vi**

- Mở rộng flat list/search service nhận profile và query DQ từ DB.
- Projection row bao gồm đủ 18 field UI, trong đó `businessVersion` được chiếu read-only thành `Phiên bản`; kèm CDE reference, các technical identity/revision field không hiển thị và capability cần cho row action.
- Filter backend: status, dimension, base criteria (`DataQualityTargetPopulation`), method, frequency, CDE, release version type, release level và khoảng effective/expiration date; full-text-lite trên các field allowlist, gồm `relatedRegulatoryDocuments`.
- Pagination offset/cursor thống nhất; whitelist sort; default `ruleCode asc`.
- Index DB cho scope/status/code và relation CDE; `ruleCode` được index nhưng không unique.
- Consumer query bắt buộc published-only tại repository/service layer.

**DoD/Test**

- Row vừa transition xuất hiện đúng ngay khi transaction commit, không chờ ES.
- Kết quả, total và export nhất quán với cùng filter.
- Filter kết hợp, ký tự tiếng Việt, wildcard-like input và invalid sort có integration test MySQL/PostgreSQL.
- Consumer không lấy được working row bằng đổi query param.
- p95 đạt mục tiêu với dataset benchmark 50.000 row.

### DQ05 — Bảng, toolbar và column preferences

**Phạm vi**

- Kết nối table DQ với DQ04, bỏ nhánh search ES nghiệp vụ.
- Dùng `extension.ruleCode`; bỏ `name.split('_')[0]`.
- DQ là flat table: bỏ expand/collapse, child loader và tree indentation.
- Cài đúng 18 cột nghiệp vụ theo thứ tự đã chốt; mặc định hiển thị đủ 18, sticky code/CDE/status, ellipsis markdown, horizontal scroll và resizable columns. `Loại phiên bản phát hành` đứng ngay sau `Phiên bản`; `Trạng thái` đứng cuối. Checkbox/action là utility columns ngoài schema.
- Filter state đồng bộ URL; có clear-all; preference key `governedGlossary.DATA_QUALITY.v1`.
- Bulk checkbox chỉ dựa row capability đã backend tính.

**DoD/Test**

- Search/filter/back/forward/refresh khôi phục đúng state.
- Empty/error/loading/permission-loading không hiển thị dữ liệu hoặc action cũ.
- Cột dài không làm table tăng chiều cao mất kiểm soát; responsive test ở breakpoint chuẩn.
- Snapshot/visual test khóa đúng nhãn, thứ tự và đủ 18 cột, trong đó hai cột liền nhau là `Phiên bản` → `Loại phiên bản phát hành` và cột cuối là `Trạng thái`.
- Không còn request child terms khi ở profile DQ.

### DQ06 — Detail, CDE link, version và deep link

**Phạm vi**

- Dùng overview adapter DQ trong shared detail shell.
- Tái sử dụng visual structure của trang chi tiết CDE: breadcrumb, entity header, tab `Tổng quan`, card mô tả và các section card có cùng spacing, border, typography và responsive behavior; không copy nguyên component CDE nếu shared primitive/renderer có thể tách dùng chung.
- Header hiển thị `Mã quy tắc`, `Phiên bản`, `Loại phiên bản phát hành`, `Trạng thái`; kèm action workflow theo capability. Technical name/UUID/revision không hiển thị.
- Card `Liên kết CDE` hiển thị `Mã CDE` và `Tên thành tố`. Mã CDE là selector canonical đơn trị có thể sửa trong Draft theo capability; Tên thành tố read-only và tự resolve từ cùng reference. Navigation dùng term ID/FQN scoped, không lookup bằng chuỗi mã.
- Selector dùng component/design system chuẩn của OpenMetadata. Nó resolve Data Dictionary business version cao nhất đang `Approved` và chưa Archived bằng numeric comparison, rồi query option bằng `glossaryId` + `parentBusinessVersion` + status CDE `Approved`; không phụ thuộc thứ tự response và không fallback sang Draft/Archived.
- Mỗi CDE identity một option, hiển thị `Mã CDE · Tên thành tố`, không hiển thị version; không hiển thị badge `Approved` lặp lại trên từng option. Header dropdown hiển thị tên/version Data Dictionary. Placeholder là `Tìm theo mã hoặc tên CDE`; UUID không xuất hiện trên UI.
- Server trả mỗi CDE identity một dòng đã scope/filter, nội dung resolve theo UI design §5.4; client lọc phòng vệ và dùng `termId` làm khóa option. Search có debounce, request sequence/cancellation để response cũ không ghi đè response mới, cùng loading/empty/error state rõ ràng.
- Relation chỉ lưu `termId` của CDE, không lưu `versionContext`; request tạo/sửa không bắt buộc và không nhận context từ client. Scope kiểm tra bằng scope của chính CDE identity so với `parentBusinessVersion` của DQ Rule.
- Liên kết bao trùm mọi version `N.x` của CDE: khi CDE version mới được duyệt, DQ Rule hiển thị theo bản mới mà không cần sửa relation. Relation chỉ thay đổi khi người dùng đổi sang CDE khác.
- Relation cũ còn `versionContext` được bỏ qua khi đọc và không ghi lại ở lần lưu tiếp theo.
- Nếu không có Data Dictionary `Approved` còn hiệu lực, disable liên kết mới và hiển thị `Chưa có phiên bản Data Dictionary được phê duyệt và còn hiệu lực.`
- Relation hiện có nằm ngoài active scope vẫn được render theo bản `Approved` cuối cùng của scope đó kèm badge `Archived`, không có trong lựa chọn mới và không bị xóa/migrate khi Save Draft nếu người dùng không đổi. Người dùng chỉ có thể giữ nguyên hoặc chủ động thay bằng CDE hợp lệ.
- Card `Quy tắc nghiệp vụ` hiển thị `description` markdown toàn chiều rộng.
- Card `Thông tin quản trị` chỉ hiển thị `Cấp phát hành`, `Ngày hiệu lực`, `Ngày hết hiệu lực`.
- Card `Phân loại & kiểm soát` hiển thị `Tiêu chí chất lượng dữ liệu`, `Các tiêu chí cơ sở`, `Hình thức kiểm tra`, `Tần suất`, `Ngưỡng chất lượng dữ liệu`.
- Card `Ngữ cảnh nghiệp vụ` hiển thị dọc, toàn chiều rộng: `Diễn giải quy tắc nghiệp vụ`, `Ràng buộc / Yêu cầu khác`, `Văn bản quy định liên quan`.
- Không lặp field header trong các card Overview. Header + 5 card phải phủ đủ đúng 18 field nghiệp vụ, mỗi field xuất hiện một lần.
- Deep link DQ Rule bắt buộc `businessVersion` và `parentBusinessVersion` khi mở snapshot; route mặc định resolve working/published theo capability giống CDE.
- Version selector sắp xếp số, không lexicographic; Archived/read-only invariant.
- Loại reviewer/owner editor khỏi 18 trường; ownership/audit kỹ thuật chỉ xuất hiện ở vùng quản trị nếu policy yêu cầu và không được tính là field DQ.
- Asset count/tab không làm detail fail nếu search projection đang chậm.

**DoD/Test**

- F5/bookmark/back-forward giữ đúng snapshot.
- Link không mở nhầm CDE cùng code ở scope khác.
- Nhiều Data Dictionary snapshot được trả không theo thứ tự vẫn chọn đúng business version `Approved` chưa Archived lớn nhất; snapshot mới nhất Archived thì fallback về snapshot hợp lệ kế tiếp.
- Không có active Approved scope thì selector disabled và có đúng empty message; Draft/Rejected/Archived không xuất hiện trong option.
- Hai Approved snapshot cùng `termId` nhưng khác business version tạo hai option với value khác nhau; chọn, lưu và tải lại khôi phục đúng version. UUID không hiển thị ở input hoặc option.
- Search response đến sai thứ tự không làm kết quả cũ ghi đè query mới.
- Archive Data Dictionary/CDE sau khi DQ đã liên kết không làm mất relation; view/edit cũ hiển thị `Archived`, Save Draft không đổi CDE vẫn giữ nguyên ID/scope.
- Actor không có quyền CDE không nhận label/payload nhạy cảm qua DQ response.
- Approved/Archived không render edit affordance; direct PATCH vẫn bị backend chặn.
- Detail render đủ 18 field không trùng: 4 field ở header và 14 field trong 5 card đúng nhóm đã chốt; Tên thành tố là derived, version/release type/status read-only và giá trị thiếu hiển thị `--`.
- Header không hiển thị technical name; card `Liên kết CDE` là nơi duy nhất hiển thị/chỉnh Mã CDE và hiển thị Tên thành tố.
- Desktop giữ density/column alignment của CDE; dưới 992 px các field chuyển về một cột, markdown không tràn và action header vẫn thao tác được bằng bàn phím.

### DQ07 — Export theo scope và quyền

**Phạm vi**

- Backend stream XLSX theo profile DQ, scope/version/filter và authorization.
- Sheet dữ liệu có đúng 18 header theo schema UI và đúng thứ tự; `Phiên bản` đứng ngay trước `Loại phiên bản phát hành`, `Trạng thái` đứng cuối. Sheet `_metadata` ẩn chứa schema version, catalog version, row identity/revision, export time, filter và actor nếu policy cho phép.
- Export Consumer chỉ chứa published rows; manager chứa row theo quyền và lựa chọn filter/status.
- Neutralize spreadsheet formula; giới hạn độ dài cell; markdown xuất plain text hoặc format được đặc tả.
- Frontend chỉ gọi endpoint và tải stream, không dùng rows của trang hiện tại để tạo file authoritative.

**DoD/Test**

- Export 0, 1, nhiều trang và dataset lớn đúng count/order.
- Không lộ row/field trái quyền.
- Vietnamese/Unicode, `%`, markdown, newline và formula injection round-trip an toàn.
- Hai trường ngày xuất `dd/MM/yyyy`; `CEO` xuất `Tổng Giám đốc`; `releaseVersionType` xuất `Bản chính` cho `N.0` và `Bản phụ` cho `N.MINOR` với `MINOR >= 1`.
- Filename chứa catalog business version và timestamp; schema version đọc được từ workbook.

### DQ08 — Create và Save Draft DQ Rule

**Phạm vi**

- `POST /v1/glossaryTerms/governed` nhận typed business payload và scope; server resolve profile từ glossary ID, sinh technical name/FQN và business version đầu `N.0`. Giữ create route cũ làm compatibility facade trong migration window.
- Cùng transaction create `N.0`, backend gán `releaseVersionType = "Bản chính"`; typed request không nhận `businessVersion`, `releaseVersionType` hoặc `entityStatus` từ client.
- Form DQ dùng field renderer chung; CDE selector dùng chung với Detail, async search có pagination/debounce và cùng active-scope contract của DQ06.
- Form có đúng 18 field nghiệp vụ: `Tên thành tố` tự điền read-only; `Phiên bản`, `Loại phiên bản phát hành` và `Trạng thái` do hệ thống quản lý, read-only; 14 field còn lại edit theo trạng thái/capability tương ứng.
- Backend validate required/cardinality/threshold/extension allowlist/CDE reference, release level, hai trường ngày và technical unique key; `ruleCode` được phép lặp. `releaseVersionType` nằm ngoài mutable allowlist và được backend bảo toàn theo `businessVersion`.
- Save Draft cập nhật working row in-place với `expectedRevision`; không tạo snapshot hoặc business version mới.
- Không nhận status/version/audit/reviewer/identity do client gửi.
- Preserve extension key hợp lệ không hiện trên form theo merge policy server-side, tránh mất dữ liệu.

**DoD/Test**

- Create thành công trả Draft + revision + capabilities.
- Hai record cùng `ruleCode` vẫn tạo được và có `termId`/technical name khác nhau; exact-content duplicate trả warning có thể xác nhận, không bị gộp ngầm.
- Hai writer cùng revision: đúng một thành công, một `409` và không ghi đè.
- Invalid tag/CDE/threshold/extension trả lỗi field ổn định.
- `expirationDate < effectiveDate`, date sai format hoặc release level ngoài `CEO`/`TTQLDL` bị từ chối; request create/save/import tự gửi hay sửa `releaseVersionType` cũng bị từ chối.
- Form không tải 1.000 CDE một lần và không cho tự nhập `cdeName` lệch reference.
- Form chỉ cho chọn CDE từ Data Dictionary `Approved` chưa Archived mới nhất; không có scope hợp lệ thì field disabled với empty message chuẩn. Edit record cũ không làm rơi relation Archived nếu người dùng không thay đổi.

### DQ09 — Workflow và bulk action

**Phạm vi**

- Áp dụng state machine Draft → InReview → Approved/Rejected; Rejected → Draft.
- Publish tạo immutable snapshot và outbox event trong cùng transaction.
- Bulk submit/approve/reject dùng service chung (không có revoke), kiểm tra capability + revision từng row.
- UI preview row hợp lệ/không hợp lệ; trả result per row với mã lỗi.
- Consumer giữ Approved head cũ khi minor working đang Draft/InReview/Rejected.

**DoD/Test**

- Transition sai trạng thái hoặc thiếu quyền không thay dữ liệu/audit/outbox.
- Consumer không thấy working qua list, detail, search, export hoặc relation.
- Approve concurrent idempotent theo request/revision; không tạo hai snapshot/outbox.
- Bulk partial failure được báo chính xác; retry không transition lại row đã thành công.

### DQ10 — Tạo minor version DQ Rule

**Phạm vi**

- Từ Approved `N.x`, tạo working Draft `N.(x+1)` trong cùng identity/scope.
- Giống CDE, working minor version mới bắt đầu với business payload mutable trắng; không clone nội dung Approved, không fallback ngầm. Payload chỉ có identity/scope/version và các field hệ thống, gồm `releaseVersionType` được gán mới. Form có thể hỗ trợ người dùng tham chiếu bản cũ ở chế độ chỉ đọc nhưng không tự điền payload mutable.
- Backend gán `releaseVersionType = "Bản phụ"` cho mọi minor version `N.MINOR` với `MINOR >= 1`. Field này không có trong request tạo version và không được client override ở bước Save Draft/import.
- Snapshot cũ bất biến; Consumer tiếp tục thấy Approved head.
- Không cho tạo working thứ hai hoặc tạo version ở catalog Archived.

**DoD/Test**

- Version tăng numeric (`1.9 → 1.10`), không dùng số thực.
- Working mới chỉ có identity/scope/version và các default hệ thống; không copy business payload, status/revision/audit/capabilities từ snapshot cũ.
- Concurrent create version chỉ một request thành công.
- Không fallback hoặc di chuyển identity sang parent scope khác.

### DQ11 — Version và cutover Data Quality catalog

**Phạm vi**

- Catalog version `N+1` là Draft mới; policy mặc định không tự kế thừa rule từ `N` để đồng nhất CDE. Nếu nghiệp vụ cần clone, phải là chức năng explicit có preview, không fallback ngầm.
- Approve `N+1` atomically đóng băng manifest Approved `N.x`, archive `N`, xử lý non-Approved predecessor theo retention policy và activate `N+1`.
- Active catalog có membership động theo Approved DQ Rule cùng scope; archive manifest bất biến.
- Approve phiên bản `N+1` của Data Dictionary (không phải của catalog DQ) archive trong cùng transaction mọi Rule DQ thuộc scope `N` (snapshot chuyển Archived, bỏ published head, xóa working) để Rule không còn hiện Approved khi đã hết hiệu lực; `N+1` bắt đầu không có Rule. Cùng transaction đó, catalog DQ `N` được archive và catalog DQ `N+1` được mở ở trạng thái Draft rỗng (chỉ khi `N+1` đúng bằng version catalog DQ hiện tại + 1); duyệt catalog `N+1` mới kích hoạt các Rule của scope mới.
- Header/version selector và Consumer default route dùng shared behavior CDE.

**DoD/Test**

- Catalog `N+1` không hiển thị rule `N.x` nếu chưa explicit migrate/create.
- Cutover transaction rollback toàn bộ khi một bước fail.
- Archived `N` giữ đúng final manifest và không nhận mutation.
- Deep link cũ vẫn đọc được theo quyền.

### DQ12 — Import template/preview/commit nguyên tử

**Phạm vi**

- Di chuyển `DQImportExport.utils.ts` từ authoritative logic thành presentation/helper; validation chính ở backend.
- Template/header/mapping sinh từ schema version 1 và khóa đúng 18 cột nghiệp vụ theo thứ tự UI; `Phiên bản`, `Loại phiên bản phát hành` và `Trạng thái` chỉ đọc, trong đó `Trạng thái` là cột cuối.
- Preview resolve tag/CDE bằng ID/FQN chính xác; label mapping chỉ là input convenience và báo ambiguous.
- Export lưu `termId`, `businessVersion` và `workingRevision` trong sheet `_metadata` ẩn thay vì chèn cột technical identity/revision vào 18 cột người dùng. Có metadata hợp lệ thì update đúng identity bằng optimistic lock; không có thì create. Không match update bằng `ruleCode` vì mã được phép lặp.
- Policy theo identity: `ERROR`, `SKIP`, `UPDATE_DRAFT`; không update Approved trực tiếp. Exact-content duplicate mới không có ID được cảnh báo trong preview.
- Import parse ngày nghiêm ngặt theo `dd/MM/yyyy`, normalize ISO và kiểm tra `Ngày hết hiệu lực >= Ngày hiệu lực`; `Cấp phát hành` normalize từ nhãn tiếng Việt sang mã ổn định. Import không được gán `Phiên bản`, `Loại phiên bản phát hành` hoặc `Trạng thái`; backend đối soát các cột read-only khi xử lý file Export và tự gán loại theo version đích.
- Commit kiểm tra session actor/scope/TTL/file hash, re-authorize, revalidate revision và transaction toàn lô.
- Có progress notification nhưng commit không phụ thuộc websocket thành công.

**DoD/Test**

- File sai MIME, quá size/row, zip bomb, formula và header/schema version sai bị chặn.
- Một row lỗi làm commit atomic rollback theo policy đã chọn.
- Retry cùng session không tạo duplicate; session người khác không dùng được.
- Import cùng lúc với edit tạo conflict rõ, không lost update.
- Header thiếu/thừa/đổi thứ tự trái schema được báo rõ; `Tên thành tố` không khớp CDE, version/status/release version type bị sửa hoặc lệch quy tắc, date range sai và enum không hợp lệ đều có lỗi đúng dòng/cột.
- Kết quả sau commit hiện ngay ở DB list dù reindex chưa xong.

### DQ13 — Assets, reverse CDE discovery và audit

**Phạm vi**

- Giữ Assets tab/attach-detach theo framework và permission OpenMetadata.
- Relation DQ→CDE dùng ID; đồng bộ reverse read model để CDE detail liệt kê DQ Rule liên quan.
- Snapshot/history hiển thị reference label đóng băng, active view resolve reference hiện tại.
- Audit log cho create/edit/transition/import/relation/assets và version cutover.
- Không để xóa/archive CDE làm DQ snapshot lịch sử mất render; active orphan được cảnh báo.

**DoD/Test**

- Gắn/bỏ asset và relation đều kiểm tra hai phía theo policy.
- Reverse lookup không trả DQ Draft cho Consumer.
- Xóa/rename CDE không làm archived DQ detail 500/blank.
- Audit có correlation ID, actor, revision, version và before/after phù hợp.

### DQ14 — Migration và cutover

**Phạm vi**

- Viết migration dry-run + apply cho glossary/terms DQ hiện có.
- Chuẩn hóa parent version, `ruleCode`, scoped FQN, unique key, CDE relation, `relatedRegulatoryDocuments` và các field phát hành; backfill working row `releaseVersionType` theo quy tắc `N.0 = Bản chính`, `N.MINOR (MINOR >= 1) = Bản phụ`. Không rewrite snapshot bất biến; read projection suy ra giá trị cho snapshot legacy còn thiếu key. Lập conflict/orphan/report giá trị ngày hoặc enum không hợp lệ; inventory `exceptions` và tag `DataSource` legacy mà không tự ánh xạ hoặc xóa.
- `cdeCode/cdeName` dual-read một release, new writes chỉ dùng relation canonical.
- Đối soát identity/working/published/manifests/count/checksum trước và sau.
- Reindex qua outbox; bật feature flag theo environment/tenant sau smoke test.
- Có runbook backup, rollback marker và tiêu chí abort.

**DoD/Test**

- Dry-run không ghi dữ liệu và cho kết quả lặp lại ổn định.
- Apply chạy lại không cấp ID/FQN mới, không nhân relation/outbox.
- Dữ liệu mơ hồ không tự sửa; cutover dừng với report hành động.
- Rollback đã diễn tập trên bản sao production.
- Pilot sign-off đủ Consumer, Proposer, Approver và Admin.

### DQ15 — Hardening, hiệu năng, bảo mật và vận hành

**Phạm vi**

- Load test list/filter/export/import/bulk workflow ở quy mô dự kiến và gấp 2 headroom.
- Security test IDOR, privilege escalation, hidden working data, file upload, formula injection, XSS markdown và query abuse.
- Dashboard metric/alert: latency/error/conflict/import/outbox/reindex/orphan.
- Runbook: bootstrap drift, failed migration, stuck outbox, import session cleanup, reindex và permission incident.
- Accessibility audit và cross-browser responsive test.

**DoD/Test**

- Không còn issue severity Critical/High; Medium có owner/decision.
- SLO và alert threshold được thống nhất với vận hành.
- Backup/restore và reindex drill không làm thay đổi business snapshot.
- Không log token, raw upload hoặc nội dung nhạy cảm ngoài policy.

### DQ16 — Dọn code trùng và compatibility

**Phạm vi**

- Xóa nhánh alias recognition sau khi mọi response có `profileKey`.
- Xóa client-side authoritative import/export và `name.split('_')`.
- Xóa write/read fallback `extension.cdeCode/cdeName` sau retention window và migration verification.
- Xóa layout preference DQ cũ hoặc migrate sang preference key schema 18 cột để không làm ẩn `Phiên bản`, `Văn bản quy định liên quan` và các field phát hành.
- Đổi tên service/class CDE đã trở thành generic; giữ adapter CDE thực sự đặc thù.
- Cập nhật architecture map, API docs và ownership.

**DoD/Test**

- Không còn page-level/form workflow code copy-paste giữa CDE và DQ.
- Dependency rule/lint ngăn generic shell import ngược adapter DQ/CDE cụ thể.
- CDE + DQ full regression xanh sau xóa compatibility.

## 5. Work breakdown theo tầng

### Backend Java

- `service/glossary`: profile registry/resolver/validators.
- `service/glossary/versioning`: generalize workflow, flat list, search, import/export; profile strategy cho version initialization.
- `resources/glossary`: endpoint contract và capability response.
- `jdbi3`: query/index/transaction/outbox, không nhúng display label.
- `openmetadata-spec`: additive schema/API models; generate TypeScript/Java models bằng pipeline hiện có.

### Frontend React/TypeScript

- `constants/Glossary.contant.ts`: giảm hard-code, chỉ giữ migration fallback.
- `components/Glossary`: shared profile shell, typed adapters, DQ renderer.
- `rest/glossaryAPI.ts`: API typed, không đọc parent scope từ location ngầm nếu caller có thể truyền rõ.
- `DQImportExport`: chỉ UI mapping/preview; authoritative validation ở server.
- i18n: mọi nhãn/lỗi/action có key; không dùng fallback tiếng Việt rải rác khi production.

### Bootstrap/migration

- Manifest schema/profile là nguồn chung; script Python không tự định nghĩa một bản khác.
- Production migration chạy theo migration framework/server startup được kiểm soát, không phụ thuộc thao tác thủ công bằng token.

## 6. Chiến lược kiểm thử

| Tầng | Nội dung bắt buộc |
| --- | --- |
| Unit backend | profile resolution, version parser, validator, threshold grammar, mapper, state machine |
| Repository integration | scope isolation, unique/index, pagination/filter/sort, transaction/locking trên MySQL và PostgreSQL |
| Resource integration | auth matrix, HTTP status/error code, working/published leakage, import/export |
| Unit frontend | profile adapter, form mapping, columns, URL filter state, conflict/error rendering |
| Component | table/modal/detail/version selector, permission loading, responsive/a11y |
| E2E | Consumer/Proposer/Approver/Admin happy path và forbidden direct URL |
| Migration | legacy suffix, missing relation, duplicate code, parent `1.0`, idempotency/rollback |
| Performance | 50k rules, combined filters, export/import lớn, bulk transition |
| Security | IDOR, XSS, formula injection, malicious XLSX, query abuse |

Critical E2E journey:

1. Proposer tạo Draft DQ Rule liên kết CDE.
2. Consumer không tìm/xem/export được Draft.
3. Proposer sửa và submit; Approver approve.
4. Consumer thấy Approved ngay trong list DB và mở đúng detail/CDE.
5. Proposer tạo minor version; Consumer vẫn thấy head cũ.
6. Reject/reopen/edit/approve minor; Consumer chuyển sang head mới.
7. Export/Import giữ đúng fields/tags/relation/version.
8. Tạo catalog `N+1`, cutover, kiểm tra archive/deep link.

## 7. Kế hoạch PR đề xuất

| PR | Nội dung | Ghi chú merge |
| --- | --- | --- |
| 1 | DQ00 tests + flag + inventory | Không đổi behavior |
| 2 | DQ01 profile registry backend | CDE regression bắt buộc |
| 3 | DQ02 shared frontend shell | Có visual regression |
| 4 | DQ03 bootstrap/schema | Flag vẫn tắt |
| 5 | DQ04 DB read model/API | Benchmark + auth tests |
| 6 | DQ05–DQ06 read-only UI/detail | M1 pilot |
| 7 | DQ07 export | Server-side only |
| 8 | DQ08 authoring | Chưa bật Approve production |
| 9 | DQ09–DQ10 workflow/version | M2 pilot |
| 10 | DQ11 catalog cutover | Transaction/failure tests |
| 11 | DQ12 import | Security review |
| 12 | DQ13 relation/assets/audit | Reverse visibility tests |
| 13 | DQ14 migration/cutover | Runbook + approval |
| 14 | DQ15–DQ16 hardening/cleanup | M3 production |

PR có thể tách backend/frontend nhưng không bật flag capability cho đến khi cả hai phần và integration test hoàn tất.

## 8. Rủi ro và biện pháp

| Rủi ro | Mức | Biện pháp |
| --- | --- | --- |
| Refactor làm hỏng CDE đã hoàn thiện | Cao | Characterization/contract test trước refactor; merge nhỏ; feature flag |
| Backend hiện chỉ hỗ trợ Data Dictionary | Cao | DQ01 là dependency bắt buộc, không workaround bằng client |
| Dữ liệu DQ `1.0` không khớp parent `N` | Cao | Dry-run migration/rebuild non-prod trước bootstrap production |
| `name` suffix gây sai mã nghiệp vụ | Cao | `extension.ruleCode` để hiển thị, `termId` để định danh/update, conflict report, không parse tự động mù |
| Dual source CDE relation và text | Cao | ID relation canonical, compatibility read có thời hạn |
| Archive Data Dictionary/CDE làm mất hoặc trỏ sai liên kết lịch sử | Cao | Relation lưu identity + scope/snapshot; không auto-migrate; active selector tách khỏi historical renderer |
| Dropdown hiển thị trùng CDE theo từng version | Cao | Server trả mỗi CDE identity một dòng, option khóa theo `termId`; relation không lưu version |
| ES lag làm row biến mất/sai status | Cao | DB read model; ES chỉ discovery |
| Client-side XLSX lộ dữ liệu/commit một phần | Cao | Backend authorize + preview session + atomic commit + streaming export |
| Custom Property global đụng schema khác | Trung bình | Prefix/allowlist/manifest drift check và fail-fast |
| Dataset lớn làm UI/API chậm | Trung bình | Server pagination/index/bulk hydration/benchmark gate |
| Nhầm với module DQ TestCase | Trung bình | Naming/navigation rõ và ngoài scope integration |

## 9. Rollout và rollback

### Rollout

1. Deploy profile foundation với DQ flag tắt.
2. Chạy bootstrap/migration dry-run và xử lý conflict.
3. Apply migration, reindex, đối soát count/checksum.
4. Bật read-only cho nhóm pilot Consumer.
5. Bật authoring cho Proposer, sau đó Approver.
6. Bật import cuối cùng; theo dõi SLO/outbox/conflict tối thiểu một chu kỳ nghiệp vụ.
7. Bật toàn bộ và bắt đầu compatibility deprecation window.

### Điều kiện abort/rollback

- Sai scope/version, lộ working data, sai quyền, count/checksum lệch, orphan relation vượt ngưỡng hoặc outbox không hội tụ.
- Tắt feature flag trước; không rollback snapshot đã publish bằng sửa tay.
- Rollback application phải tương thích schema additive. Migration dữ liệu chỉ rollback bằng script/runbook đã diễn tập và backup xác nhận.

## 10. Checklist nghiệm thu cuối

- [ ] DQ dùng profile/shell/workflow chung, không copy page CDE.
- [ ] Backend không còn khóa Business Workflow chỉ vào Data Dictionary.
- [ ] Table/form/detail/export có đúng 18 trường theo schema đã chốt; `Loại phiên bản phát hành` đứng ngay sau `Phiên bản`, chỉ có `Bản chính`/`Bản phụ`, và trường cuối là `Trạng thái`; detail phân bổ 4 field header + 14 field trong năm card và không lặp field.
- [ ] Catalog `N`, rule `N.MINOR`, URL/snapshot/sort nhất quán.
- [ ] `ruleCode` canonical; không parse technical name.
- [ ] CDE link canonical bằng ID, đúng scope và quyền.
- [ ] CDE selector hiển thị từng CDE version Approved của Data Dictionary Approved chưa Archived mới nhất; không có badge Approved lặp lại, không lộ UUID và có loading/empty/error/race handling.
- [ ] Gán CDE khi đang ở v2.1; sau khi v2.2 được duyệt, DQ Rule hiển thị theo v2.2 mà relation không đổi; thu hồi v2.2 thì hiển thị quay về v2.1.
- [ ] Archive không xóa hoặc tự chuyển relation DQ lịch sử; liên kết cũ hiển thị version + `Archived` và không thể dùng cho liên kết mới.
- [ ] DB là nguồn list/search nghiệp vụ; ES lag không ảnh hưởng workflow UI.
- [ ] Consumer chỉ thấy Approved/Archived được phép.
- [ ] Form, filter, table, detail, bulk, version và Assets đạt UX/a11y yêu cầu.
- [ ] `releaseVersionType`, `releaseLevel`, `effectiveDate`, `expirationDate` được bootstrap, validate, snapshot, audit và import/export đầy đủ; date range hợp lệ.
- [ ] Import/export server-side, atomic/streaming, chống file/formula attack.
- [ ] Migration idempotent, có dry-run/conflict report/rollback rehearsal.
- [ ] CDE regression, DQ E2E, performance và security gate đều xanh.
- [ ] Dashboard, alert, runbook và ownership đã bàn giao vận hành.
