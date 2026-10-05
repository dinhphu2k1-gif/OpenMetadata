# Kế hoạch triển khai Kiểm thử theo Quy tắc chất lượng dữ liệu

> **Cập nhật 2026-10-05:** thiết kế đã đổi sang lịch và pipeline theo từng khai báo, tab **Kiểm thử** (không còn "Kết quả kiểm thử"), bỏ API lịch cấp Rule; xem [Thiết kế Kiểm thử theo Quy tắc CLDL](./dq-rule-test-execution-design.md) §5.3, §9 và §14. Các bước trong kế hoạch này về lịch cấp Rule chỉ còn giá trị lịch sử.

## Trạng thái thực hiện (cập nhật 2026-10-04)

Mã nguồn T1–T5 đã được viết trên branch `feat/dq-rule-test-execution`. **Chưa chạy trên môi trường thật**: chưa có
kiểm thử tích hợp, E2E. Đã chạy được: unit test backend (74 test), Jest cho các component mới (13 test) và biên
dịch. Ingestion không sửa: khai báo `SQL` dùng validator gốc (DQT-13, 2026-10-04), nên Airflow dùng image gốc.

| Mốc | Trạng thái |
| --- | --- |
| T0 | Xác minh bằng đọc code xong; spike Oracle hoãn đến khi cần nguồn Oracle/DB2 (DQT-13) |
| T1 | Đã viết: schema, validator, form, card Overview, xem trước, hộp xác nhận Approve |
| T2 | Đã viết: migration, DAO, reconciler, outbox, suite và pipeline riêng của Rule |
| T3 | Đã viết: kích hoạt từ TD và cutover, khóa managed backend và badge UI |
| T4 | Đã viết: kết quả Rule/CDE, lịch, Chạy ngay, bộ lọc danh sách |
| T5 | Đã viết: xu hướng, reconcile và trạng thái reconcile |

Việc còn lại trước khi đưa lên production: kiểm thử tích hợp và E2E,
kiểm tra bản ứng dụng cũ đọc snapshot có `dataQualityTestSpecs`.

## 1. Tài liệu nguồn và mục tiêu bàn giao

Kế hoạch này hiện thực [Thiết kế Kiểm thử theo Quy tắc CLDL](./dq-rule-test-execution-design.md) (gọi tắt DQT). Các
quyết định, schema, API, UI và quy tắc tính kết quả đều nằm trong thiết kế; tài liệu này chỉ mô tả thứ tự làm, phạm vi
từng mốc, file cần sửa, cách kiểm thử và nghiệm thu.

Tài liệu liên quan: [Thiết kế DQ](./dq-glossary-ui-design.md), [Kế hoạch triển khai DQ](./dq-glossary-feature-implementation-plan.md),
[Thiết kế Từ điển kỹ thuật](./technical-dictionary-design.md).

### Definition of Done chung

Một mốc chỉ hoàn thành khi có đủ:

- Backend contract, validation và authorization theo DQT §4.3, §5.6, §10.
- Migration MySQL và PostgreSQL nếu mốc có thay đổi lưu trữ.
- Frontend API typed, UI state, error handling và i18n.
- Unit, integration (`openmetadata-integration-tests`) và E2E tương ứng.
- Log và metric cho reconciler/outbox nếu mốc chạm tới chúng.
- Thiết kế DQT được cập nhật nếu kết quả T0 hoặc quá trình làm thay đổi quyết định.

## 2. Chiến lược triển khai

### 2.1. Thứ tự

1. Xác minh các giả định kỹ thuật (DQT §11) và chốt câu hỏi nghiệp vụ (DQT §12) trước khi viết code.
2. Khai báo kiểm thử trên Rule (chưa có hiệu lực thực thi).
3. Reconciler sinh testcase khi Approve Rule.
4. Mở rộng nguồn kích hoạt sang TD/cutover và khóa testcase managed.
5. Hiển thị kết quả.
6. Xu hướng và công cụ vận hành.

Không dùng feature flag (quyết định 2026-10-03): tính năng luôn hoạt động trên server quản trị và được kiểm thử kỹ ở
môi trường dev trước khi đưa lên production. Portal chỉ đọc không khởi động worker outbox.

### 2.2. Phụ thuộc bên ngoài

| Phụ thuộc | Cần cho |
| --- | --- |
| Workflow DQ dùng chung chạy trọn Draft → Submit → Approve và tạo minor version (DQ08–DQ10 trong kế hoạch DQ). Chủ dự án tự xử lý | T1 |
| Điểm kích hoạt của TD (`TechnicalRecordService`, `TechnicalCutover`, import committer) | T3 |
| Connection pipeline TestSuite dùng tài khoản chỉ đọc trên mọi service có CDE | Đưa lên production |
| Một nguồn Oracle/DB2 dev, khi cần hỗ trợ khai báo `SQL` trên các nguồn này | Sau v1 |

## 3. Danh sách mốc và phụ thuộc

| Mốc | Nội dung | Phụ thuộc |
| --- | --- | --- |
| T0 | Xác minh giả định kỹ thuật DQT §11; chạy thử validator SQL trên Oracle (Q1–Q7 DQT §12 đã chốt) | |
| T1 | Schema `dqTestSpecs.json`, trường `dataQualityTestSpecs` của `GlossaryTerm`, DTO `testSpecs`, validation, form và card Overview | DQ08–DQ10 |
| T2 | Bảng lưu trữ, reconciler, outbox, suite và pipeline riêng của Rule, sinh testcase khi Approve Rule | T1 |
| T3 | Kích hoạt từ TD và cutover, khóa testcase managed | T2; điểm kích hoạt TD |
| T4 | API kết quả, đặt lịch chạy, Chạy ngay, tab Kiểm thử của Rule, tab Chất lượng dữ liệu của CDE, bộ lọc danh sách | T2 |
| T5 | Xu hướng, reconcile status, cảnh báo cutover DD | T4 |

T3 và T4 có thể làm song song sau T2.

### 3.1. Ma trận truy vết yêu cầu

| Yêu cầu (DQT §1) | Mốc hiện thực |
| --- | --- |
| R1 Khai báo testcase trong glossary DQ | T1 |
| R2 Tự áp dụng lên Tài sản của CDE | T2, T3 |
| R3 Kết quả theo mã quy tắc | T4, T5 |
| R4 CDE tổng hợp kết quả và danh sách testcase | T4, T5 |

## 4. Chi tiết từng mốc

### T0 — Xác minh và chốt phạm vi

**Phạm vi**

- Xác minh 5 giả định ở DQT §11. Đã xong bằng đọc code ngày 2026-10-03; kết luận và ảnh hưởng ghi ở bảng DQT §11:
  1. `TestCaseIndex` chứa tag thừa kế từ Column: gần như có; kiểm tra reindex dời sang T3.
  2. `_process_logical_suite` ([test_suite.py](../../ingestion/src/metadata/data_quality/source/test_suite.py)) với
     nhiều Table và service: đúng, có thể tách lô; không cần sửa.
  3. Validator SQL ([columnRuleLibrarySqlExpressionValidator.py](../../ingestion/src/metadata/data_quality/validations/column/sqlalchemy/columnRuleLibrarySqlExpressionValidator.py)):
     chọn theo `validatorClass` đúng; đếm số dòng trả về và ghép tên bảng sai trên Oracle/DB2 → dùng validator gốc,
     chấp nhận giới hạn (DQT-13).
  4. Lưu trong `extension`: không phù hợp; payload governed là JSON của `GlossaryTerm` → thêm trường tùy chọn
     `dataQualityTestSpecs` vào schema `GlossaryTerm` (DQT-14). API gốc PUT/PATCH glossary term đã bị chặn.
  5. Pipeline riêng mỗi Rule: API deploy/trigger/status gốc có sẵn; thử pipeline không lịch dời sang T2.
- Câu hỏi nghiệp vụ Q1–Q7 đã chốt ngày 2026-10-03 (DQT §12).

**DoD**

- Mỗi giả định có kết luận kèm bằng chứng (đoạn mã, log chạy thử) trong DQT §11. Đã có cho cả 5 mục.
- Spike Oracle chạy được câu SQL mẫu ở DQT §4.1 với tên bảng `schema.table` và cho đúng số vi phạm; nếu tên cột hoặc
  tên bảng cần đặt trong ngoặc kép (chữ hoa/thường), cập nhật DQT §4.1 trước khi bắt đầu T2.

### T1 — Khai báo kiểm thử trên DQ Rule

**Phạm vi**

- Schema `dqTestSpecs.json` trong `openmetadata-spec` (DQT §4.2); thêm trường tùy chọn `dataQualityTestSpecs` vào
  `glossaryTerm.json` (DQT-14); generate model Java, TypeScript và Python (`make generate`).
- DTO create/patch DQ Rule thêm trường typed `testSpecs` (mảng); server ghi vào `dataQualityTestSpecs` của payload
  working. Glossary term ngoài profile `DATA_QUALITY` gửi giá trị khác `null` bị từ chối.
- `GlossaryTermIndex` bỏ `dataQualityTestSpecs` khỏi tài liệu search.
- Cấp `key` cho khai báo mới khi Lưu Draft: `t<n>`, `n` = lớn nhất từng xuất hiện trong working và snapshot history + 1;
  không tái sử dụng key đã xóa (DQT §4.2).
- `GovernedGlossaryProfileRegistry`: profile `DATA_QUALITY` cho phép trường `dataQualityTestSpecs`.
- Validator theo DQT §4.3 cho từng khai báo: tên trùng, key không tồn tại, `LIBRARY` definition và tham
  số, `SQL` chỉ một câu `SELECT` (parse bằng SQL parser) và không chỉ select hàm gộp, ngưỡng hiệu lực (riêng hoặc của Rule) được hỗ trợ, bất biến
  `kind`/`testDefinitionFqn` theo `key`. Lưu Draft chạy kiểm tra cú pháp; Submit/Approve chạy đầy đủ. Lỗi trả kèm
  `specKey` hoặc chỉ số phần tử.
- `testSpecs` có trong snapshot, `contentHash` và lịch sử phiên bản; luồng Sửa phiên bản ghi đè và lưu bản cũ.
- Endpoint `GET .../governed/dataQuality/testDefinitions` và `POST .../{ruleId}/dataQuality/preview` (DQT §8), preview
  trả kết quả theo từng khai báo và tổng số testcase.
- UI: section **Khai báo kiểm thử** dạng danh sách card trong `DQGlossaryTermForm` (thêm, xóa, kéo thả, ngưỡng riêng,
  khóa definition của khai báo đã Approved), dùng lại component tham số của `TestCaseFormV1` và SQL editor gốc; khối
  **Áp dụng cho** gọi preview; card chỉ đọc dạng bảng trong `DQGlossaryTermOverview` (DQT §9.1).
- Hộp xác nhận Approve hiển thị số khai báo, số cột, số testcase sẽ sinh và số khai báo bị ngừng (DQT §4.4).

**DoD/Test**

- Rule có `testSpecs` rỗng vẫn tạo, duyệt và export như trước; Import/Export giữ 19 trường.
- Rule lưu và duyệt được với nhiều khai báo (kiểm thử với ít nhất 10 khai báo); không có giới hạn số lượng.
- Rule trộn khai báo `LIBRARY` và `SQL` lưu và duyệt được với mọi giá trị tag Hình thức kiểm tra.
- Mỗi mã lỗi `DQ_TEST_SPEC_*`, `DQ_THRESHOLD_UNSUPPORTED` có integration test cho cả Lưu và Approve, và lỗi chỉ đúng
  khai báo.
- SQL chứa DDL/DML, nhiều câu, `;` thừa, comment chứa lệnh, thiếu biến bắt buộc, hoặc chỉ select `COUNT(*)` đều bị từ
  chối.
- Ngưỡng phần trăm trên khai báo `SQL` được chấp nhận khi bật `computePassedFailedRowCount`, bị từ chối khi tắt.
- `testSpecs` không xuất hiện trong `extension`, Custom Properties hay search index của glossary term; snapshot đọc
  lại bằng `GlossaryTerm.class` vẫn chạy; đổi `testSpecs` làm đổi `contentHash`.
- Glossary term của profile khác gửi `dataQualityTestSpecs` bị từ chối; PUT/PATCH gốc vẫn bị chặn.
- Khai báo giữ `key` mà đổi `kind` hoặc `testDefinitionFqn` bị từ chối; đổi tên/tham số/SQL/ngưỡng được chấp nhận; thêm
  và xóa khai báo ở version minor được chấp nhận.
- Key mới không trùng key của khai báo đã xóa ở version trước; client gửi key lạ bị từ chối.
- Snapshot và lịch sử phiên bản hiển thị đúng `testSpecs` của từng version.
- In Review/Approved/Archived không sửa được `testSpecs` qua API.
- Chưa có testcase nào được tạo ở mốc này.

### T2 — Reconciler và sinh testcase khi Approve

**Phạm vi**

- Migration `1.13.3` MySQL và PostgreSQL ([bootstrap/sql/migrations/native/1.13.3](../../bootstrap/sql/migrations/native/1.13.3)):
  `dq_rule_exec`, `dq_rule_test_spec_exec`, `dq_rule_test_binding`, `dq_test_outbox` kèm index (DQT §7).
- DAO jdbi3 cho bốn bảng.
- Bot hệ thống `dq-governance-bot` (bootstrap idempotent).
- Reconciler tạo logical suite `DQR__<N>__<mã>` và pipeline TestSuite riêng cho Rule ở lần áp dụng đầu, chưa có lịch
  (DQT §5.3); disable pipeline khi Rule bị retire toàn bộ, bật lại khi Rule quay lại.
- Reconciler tính tập mong muốn (DQT §5.1) theo bộ (Rule, khai báo, Column) cho một Rule, diff với binding theo `key`
  và: tạo/sửa/soft-delete/restore testcase, retire mọi testcase của khai báo bị xóa (`SPEC_REMOVED`), tạo/sửa/retire
  definition managed cho từng khai báo `SQL`, đánh dấu `NOT_APPLICABLE` theo
  `supportedDataTypes` của từng khai báo, ghi `ERROR` khi thất bại. Khóa `FOR UPDATE` trên `dq_rule_exec`.
- Outbox: `GlossaryVersioningService` ghi `RECONCILE_RULE` trong cùng transaction với Approve; xử lý sau commit; worker
  thử lại.
- Definition managed loại `SQL` đặt `validatorClass = ColumnRuleLibrarySqlExpressionValidator` (validator gốc, DQT-13).
- Thử deploy pipeline TestSuite không có `scheduleInterval` và trigger thủ công (DQT §11 mục 5).

**DoD/Test**

- Rule Approved có `k` khai báo sinh đúng `k` testcase `ACTIVE` trên mỗi Column `Available` của CDE (trừ cặp không áp
  dụng); Draft/In Review/Rejected không sinh testcase.
- Chạy reconcile nhiều lần liên tiếp và đồng thời không tạo trùng.
- Approve version minor đổi tham số/SQL cập nhật testcase hiện có, lịch sử kết quả giữ nguyên.
- Approve version minor thêm khai báo tạo testcase mới; xóa khai báo retire testcase của khai báo đó, kết quả cũ vẫn đọc
  được; khai báo khác không bị ảnh hưởng.
- Version mới đổi CDE retire testcase trên Column cũ và tạo trên Column mới.
- Mỗi Rule áp dụng có đúng một suite và một pipeline riêng, chứa mọi testcase `ACTIVE` của mọi khai báo; đổi tag Tần
  suất không ảnh hưởng suite hay lịch.
- Rule retire toàn bộ thì pipeline bị disable, không bị xóa.
- Lỗi reconcile không rollback phê duyệt; binding `ERROR` được worker xử lý lại.
- Testcase bị hard-delete ngoài luồng được tạo lại và ghi audit.
- Khai báo `SQL` chạy thật qua pipeline trên nguồn MySQL dev (`deploy/dev/dq-sandbox`) cho kết quả đúng.
- Pipeline không lịch deploy được và chạy được bằng trigger.
- Pipeline logical suite chạy thật trên môi trường dev cho ít nhất hai service và ghi kết quả vào time-series.

### T3 — Kích hoạt từ TD, cutover và khóa managed

**Phạm vi**

- `TechnicalRecordService`, import committer của TD, `TechnicalColumnSync` (đổi kiểu dữ liệu khi ingest) ghi
  `RECONCILE_COLUMN` trong cùng transaction (DQT §5.5).
- `TechnicalCutover` và cutover Data Quality ghi `RETIRE_SCOPE`.
- Import TD commit reconcile theo lô.
- `TestCaseRepository`, `TestDefinitionRepository`: từ chối PUT/PATCH/DELETE từ actor khác bot với `409
  DQ_MANAGED_TEST_CASE`; vẫn cho ghi kết quả, incident/resolution, follow (DQT §5.6).
- UI trang testcase gốc: badge **Quản lý bởi quy tắc {mã}**, ẩn nút Sửa/Xóa.

**DoD/Test**

- Gán, đổi, bỏ CDE trên TD và đổi `sourceStatus` đưa tập testcase về đúng DQT §5.1, cho mọi khai báo của mọi Rule.
- Đổi kiểu dữ liệu Column chuyển `ACTIVE` ↔ `NOT_APPLICABLE` theo từng khai báo.
- Cutover DD/DQ retire toàn bộ binding của scope cũ; kết quả cũ vẫn đọc được.
- Lỗi reconcile không rollback lưu TD hay cutover.
- Testcase managed không sửa/xóa được qua API và UI gốc; ghi kết quả và incident vẫn hoạt động; testcase thường không bị
  ảnh hưởng.

### T4 — Kết quả Rule và CDE

**Phạm vi**

- Endpoint `GET`/`PUT .../{ruleId}/dataQuality/schedule`, `POST .../{ruleId}/dataQuality/run`,
  `GET .../{ruleId}/dataQuality/run/latest` (DQT §8); outbox `SYNC_PIPELINE` đồng bộ lịch sang
  `airflowConfig.scheduleInterval`; audit đổi lịch và Chạy ngay.
- Service tính Kết quả theo ngưỡng hiệu lực của khai báo (DQT §6.1), kết quả khai báo và kết quả Rule (§6.2), kết quả
  CDE (§6.3), badge Quá hạn; đọc time-series gốc theo `testCaseId` trong binding.
- Endpoint `GET .../{ruleId}/dataQuality/results` và `GET .../{cdeId}/dataQuality/results`, phân trang, ẩn dòng thiếu
  quyền `ViewTests`/`ViewAll` trên Table (DQT §10).
- UI `GlossaryTermsV1`: tab `data_observability` của Rule thành **Kiểm thử**, của CDE thành **Chất lượng dữ liệu**
  (DQT §9.2, §9.3); gộp tab Quy tắc CLDL hiện có của CDE vào bảng Quy tắc (`CDEGlossaryTermOverview`).
- Nút **Chạy ngay** và dòng **Lịch chạy** với modal Đổi lịch (chọn nhanh, cron, xem trước 5 lần chạy, Không đặt lịch) ở
  tab Kiểm thử; **Chạy ngay** trong menu dòng của bảng Quy tắc ở tab CDE (DQT §9.2, §9.3).
- Chip lọc theo khai báo trong tab Kiểm thử, bộ lọc **Đã ngừng** cho khai báo đã xóa; cột Kiểm thử trong bảng
  testcase của Rule và CDE.
- Empty state cho Rule chưa Approved, Rule chưa khai báo kiểm thử, banner cho Rule đã lưu trữ.
- Bộ lọc **Kiểm thử** ở danh sách DQ (DQT §9.4).

**DoD/Test**

- Unit test đủ mọi dạng ngưỡng (`count = 0`, `count <= n`, `>= x%`, `> x%`, `= x%`, trống), ngưỡng riêng của khai báo
  và ngưỡng mặc định của Rule, và các trạng thái gốc `Success`/`Failed`/`Aborted`/chưa có kết quả.
- Rule nhiều khai báo: Rule Không đạt khi chỉ một khai báo Không đạt; kết quả từng khai báo đúng.
- Kết quả Rule và CDE khớp kết quả gốc của từng testcase.
- Người dùng thiếu quyền Table không thấy dòng testcase, thẻ tổng ghi số dòng bị ẩn.
- Consumer chỉ thấy Rule Approved trong tab CDE.
- Kết quả Rule/CDE đã lưu trữ vẫn tra cứu được sau cutover.
- URL tab không đổi so với trước.
- Đặt, đổi, bỏ lịch cập nhật đúng lịch của pipeline; cron sai bị từ chối (`DQ_SCHEDULE_INVALID`); lịch giữ nguyên khi
  Rule lên version mới.
- Chạy ngay ghi kết quả vào time-series; bấm khi đang chạy bị chặn (`DQ_TEST_RUN_IN_PROGRESS`); Rule chưa có testcase
  `ACTIVE` bị chặn (`DQ_TEST_RUN_NOT_AVAILABLE`); người không có `canEdit` không thấy nút và bị từ chối qua API.
- Badge Quá hạn tính theo lịch của Rule; Rule chưa đặt lịch không có badge.

### T5 — Xu hướng và vận hành

**Phạm vi**

- Endpoint `trend` cho Rule (lọc theo khai báo) và CDE (30/90 ngày), tính từ time-series kể cả binding `RETIRED` trong
  khoảng còn active; mốc `publishedAt` của version (DQT §6.4).
- Biểu đồ xu hướng trong hai tab ở T4.
- `POST .../governed/dataQuality/reconcile` và `GET .../reconcile/status` (outbox lag, binding `ERROR`, Table có pipeline
  basic suite chứa testcase managed, số pipeline của Rule, số Rule chạy cùng khung giờ).
- Modal Đổi lịch hiển thị số Rule khác đặt cùng khung giờ trên cùng service (DQT §11).
- Hộp xác nhận cutover DD (TD §9.4) thêm “{n} testcase của {m} quy tắc sẽ ngừng chạy”.

**DoD/Test**

- Xu hướng đúng khi Rule đổi version, thêm/xóa khai báo, đổi CDE và sau cutover.
- Benchmark trend trên dữ liệu thử nghiệm lớn; nếu vượt ngưỡng chấp nhận thì mở việc bảng rollup theo ngày.
- Reconcile toàn bộ chỉ Admin gọi được và idempotent.

## 5. Work breakdown theo tầng

### Backend Java

| Nơi | Thay đổi | Mốc |
| --- | --- | --- |
| `openmetadata-spec` | `dqTestSpecs.json`, DTO `testSpecs`, response kết quả/trend | T1, T4 |
| `service/glossary/GovernedGlossaryProfileRegistry` | Trường `testSpecs` trong payload governed của profile `DATA_QUALITY` | T1 |
| `service/glossary` (mới) | Cấp key và validator `testSpecs`, reconciler, outbox worker, tính kết quả | T1, T2, T4 |
| `service/glossary/versioning/GlossaryVersioningService` | Ghi outbox khi Approve | T2 |
| `service/glossary/technical/TechnicalRecordService`, `TechnicalImportCommitter`, `TechnicalColumnSync`, `TechnicalCutover` | Ghi outbox | T3 |
| `jdbi3/TestCaseRepository`, `jdbi3/TestDefinitionRepository` | Khóa managed | T3 |
| `resources/glossary` | Endpoint DQT §8 | T1, T4, T5 |

### Ingestion Python

Không sửa (DQT-13).

### Frontend React/TypeScript

| Nơi | Thay đổi | Mốc |
| --- | --- | --- |
| `components/Glossary/AddGlossaryTermForm/DQGlossaryTermForm` | Section Khai báo kiểm thử | T1 |
| `components/Glossary/GlossaryTerms/DQGlossaryTermOverview` | Card Khai báo kiểm thử | T1 |
| `components/Glossary/GlossaryTerms/GlossaryTermsV1` | Tab Kết quả kiểm thử / Chất lượng dữ liệu | T4 |
| `components/Glossary/GlossaryTerms/CDEGlossaryTermOverview` | Gộp tab Quy tắc CLDL | T4 |
| Trang testcase gốc | Badge managed, ẩn Sửa/Xóa | T3 |
| `rest/glossaryAPI.ts` | API typed cho endpoint mới | T1, T4, T5 |
| Locale | Key i18n mới, `yarn i18n` | Mọi mốc UI |

### Bootstrap/migration

- Migration `1.13.3` MySQL và PostgreSQL cho bốn bảng (T2).
- Bootstrap idempotent bot hệ thống (T2). Suite và pipeline do reconciler tạo theo từng Rule, không bootstrap sẵn.

### Tài liệu

| Tài liệu | Thay đổi | Mốc |
| --- | --- | --- |
| [Thiết kế DQ](./dq-glossary-ui-design.md) §2.2 | Bỏ “Không tự động tạo `TestCase`…”, “Không thực thi SQL…” khỏi ngoài phạm vi | T1 |
| Thiết kế DQ §6.1, §8.4, §8.5 | DTO có `testSpecs`; form và Overview | T1 |
| [Thiết kế CDE](./cde-glossary-ui-design.md) §7.1 mục 3 | Tab Quy tắc CLDL gộp vào tab Chất lượng dữ liệu | T4 |
| [Thiết kế TD](./technical-dictionary-design.md) §6.2, §9.4 | Kích hoạt reconcile; số testcase bị ngừng khi cutover | T3, T5 |

## 6. Chiến lược kiểm thử

| Tầng | Nội dung bắt buộc |
| --- | --- |
| Unit backend | Cấp key, validator `testSpecs` và SQL, tính tập mong muốn, diff binding theo `key`, tính kết quả theo ngưỡng |
| Repository integration | Bốn bảng mới, unique/index, `FOR UPDATE`, outbox trên MySQL và PostgreSQL |
| Resource integration | Mã lỗi, khóa managed, quyền xem dòng testcase, endpoint Admin |
| Ingestion | Không có test riêng; khai báo `SQL` chạy thật qua pipeline trên nguồn MySQL dev |
| Unit frontend | Map `testSpecs` ↔ danh sách card, thêm/xóa/sắp xếp, hiển thị kết quả theo khai báo, empty state |
| E2E | Hành trình chính bên dưới |

Hành trình E2E chính:

1. Proposer tạo Rule loại `LIBRARY` có 2 khai báo, liên kết CDE có 3 Column trong TD, xem preview.
2. Approver duyệt; hệ thống sinh 6 testcase trong suite và pipeline riêng của Rule; tab Kiểm thử cảnh báo chưa
   có lịch.
3. Đặt lịch hằng ngày; pipeline nhận đúng lịch. Bấm Chạy ngay; kết quả hiện sau khi lần chạy kết thúc.
4. Tab Kết quả kiểm thử của Rule (cả lọc theo khai báo) và tab Chất lượng dữ liệu của CDE hiển thị đúng.
5. Gỡ CDE khỏi 1 Column trên TD; testcase của mọi khai báo trên cột đó bị retire, kết quả cũ còn trong xu hướng.
6. Tạo version minor đổi tham số một khai báo, xóa một khai báo, thêm một khai báo mới; testcase của khai báo giữ lại
   cập nhật và lịch sử liên tục, khai báo bị xóa ngừng chạy, khai báo mới sinh testcase; lịch chạy giữ nguyên.
7. Thử sửa/xóa testcase managed qua UI gốc; bị chặn.
8. Lặp lại với Rule trộn khai báo `LIBRARY` và `SQL`; chỉ khai báo `SQL` sinh definition managed.
9. Cutover DD; mọi testcase của scope cũ bị retire, pipeline của Rule bị disable, kết quả vẫn tra cứu được.

## 7. Kế hoạch PR đề xuất

| PR | Nội dung | Ghi chú merge |
| --- | --- | --- |
| 1 | T0 spike và cập nhật thiết kế | Không đổi behavior |
| 2 | T1 schema, DTO, validation, endpoint testDefinitions/preview | Flag tắt |
| 3 | T1 UI form và card Overview | Flag tắt |
| 4 | T2 migration, DAO, bootstrap bot | Flag tắt |
| 5 | T2 reconciler (gồm suite/pipeline riêng của Rule) và outbox khi Approve | Test idempotent bắt buộc |
| 6 | T3 kích hoạt TD/cutover | Phụ thuộc điểm kích hoạt TD |
| 7 | T3 khóa managed backend và UI | |
| 8 | T4 API kết quả, lịch chạy, Chạy ngay | Test quyền |
| 9 | T4 UI tab và bộ lọc | |
| 10 | T5 xu hướng, reconcile status, cảnh báo cutover | |

## 8. Rủi ro triển khai

Rủi ro sản phẩm và vận hành nằm ở DQT §11. Rủi ro riêng của việc triển khai:

| Rủi ro | Biện pháp |
| --- | --- |
| Thêm trường vào schema `GlossaryTerm` gốc làm khó nâng cấp OpenMetadata | Trường tùy chọn, tên riêng `dataQualityTestSpecs`, không đổi trường có sẵn; thêm vào danh mục kiểm tra khi nâng cấp |
| Người dùng khai báo `SQL` cho Column trên Oracle/DB2 | Testcase ra Lỗi thực thi (DQT-13); hướng dẫn dùng `LIBRARY` cho các nguồn này |
| Điểm kích hoạt TD chưa ổn định làm chậm T3 | T4 làm song song với T3; chưa đưa lên production trước khi T3 xong |
| Reconciler tạo trùng testcase khi chạy song song | Test đồng thời ở T2 là điều kiện merge PR 5 |

## 9. Rollout và rollback

### Rollout

1. Deploy lên môi trường dev (Airflow dùng image ingestion gốc).
2. Duyệt vài Rule thật và đối chiếu kết quả với chạy tay.
3. Xác nhận connection pipeline TestSuite dùng tài khoản chỉ đọc trên mọi service.
4. Đưa lên production sau khi T3 hoàn tất (khóa managed và kích hoạt TD) và các bước trên đạt.
5. Theo dõi outbox lag, binding `ERROR` và tải Airflow (số DAG chạy đồng thời) ít nhất một tuần.

### Rollback

- Quay lại bản ứng dụng cũ: testcase managed và pipeline đã tạo không bị xóa, nhưng khóa managed không còn.
- Nếu cần dừng chạy testcase: tạm dừng pipeline `DQR__*` trong trang pipeline gốc (từng Rule), hoặc Admin bỏ lịch hàng
  loạt qua `PUT .../schedule`.
- Migration chỉ thêm bảng, không đổi bảng hiện có; rollback ứng dụng không cần rollback schema.
- Trường `dataQualityTestSpecs` là tùy chọn; bản ứng dụng cũ đọc snapshot có trường này phải bỏ qua được trường lạ,
  hoặc rollback kèm xóa trường khỏi payload. Kiểm tra trước khi bật production.

## 10. Checklist nghiệm thu cuối

Theo tiêu chí chấp nhận của thiết kế:

- [ ] Rule Approved sinh đúng một testcase `ACTIVE` cho mỗi khai báo trên mỗi Column `Available` của CDE trong TD, không
  giới hạn số khai báo; Column không hợp kiểu được đánh dấu Không áp dụng cho khai báo đó; Draft/In Review/Rejected
  không sinh testcase.
- [ ] Gán, đổi, bỏ CDE trên TD, đổi CDE của Rule, approve version mới và cutover DD/DQ đều đưa tập testcase về đúng
  DQT §5.1 mà không tạo trùng, kể cả khi chạy lại reconcile nhiều lần.
- [ ] Version minor đổi tham số hoặc SQL thì cập nhật testcase hiện có, giữ lịch sử kết quả; thêm/xóa khai báo sinh/retire
  đúng testcase; đổi loại kiểm tra của khai báo đã có bị từ chối.
- [ ] Testcase managed không sửa/xóa được qua API/UI gốc; ghi kết quả và incident vẫn hoạt động.
- [ ] Kết quả khai báo, Rule và CDE khớp với kết quả gốc của từng testcase và ngưỡng DQT §6.1–6.3; dòng testcase tôn trọng quyền
  xem Table.
- [ ] SQL không phải `SELECT` đơn, hoặc chỉ select `COUNT(*)`, bị từ chối ở Lưu và ở Approve.
- [ ] Khai báo `SQL` cho đúng số vi phạm trên Oracle, DB2 (nếu có) và PostgreSQL mà không kéo bản ghi về ingestion.
- [ ] Mỗi Rule áp dụng có suite và pipeline riêng; lịch chạy do người dùng đặt (hoặc không đặt) được đồng bộ đúng sang
  pipeline và giữ qua các version; Chạy ngay chạy toàn bộ testcase của Rule và bị chặn khi đang chạy.
- [ ] Kết quả của Rule/CDE đã lưu trữ vẫn tra cứu được sau cutover.
- [ ] Tài liệu ở §5 Tài liệu đã cập nhật.
