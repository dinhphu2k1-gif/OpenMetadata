# Kế hoạch triển khai Kiểm thử theo Quy tắc chất lượng dữ liệu

## Trạng thái thực hiện (cập nhật 2026-10-02)

Chưa bắt đầu. Mọi mốc ở trạng thái **Chưa làm**.

| Mốc | Trạng thái |
| --- | --- |
| T0 | Chưa làm |
| T1 | Chưa làm |
| T2 | Chưa làm |
| T3 | Chưa làm |
| T4 | Chưa làm |
| T5 | Chưa làm |

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

Feature flag đề xuất `governedGlossary.dataQuality.testExecution.enabled`, mặc định tắt. Khi tắt: không hiển thị section
**Khai báo kiểm thử**, outbox không được xử lý, tab kết quả giữ nội dung cũ. Flag chỉ bật production sau T3.

### 2.2. Phụ thuộc bên ngoài

| Phụ thuộc | Cần cho |
| --- | --- |
| Workflow DQ dùng chung ổn định (DQ07–DQ09 trong kế hoạch DQ) | T1 |
| Điểm kích hoạt của TD (`TechnicalRecordService`, `TechnicalCutover`, import committer) | T3 |
| Connection pipeline TestSuite dùng tài khoản chỉ đọc trên mọi service có CDE | Bật flag production |

## 3. Danh sách mốc và phụ thuộc

| Mốc | Nội dung | Phụ thuộc |
| --- | --- | --- |
| T0 | Xác minh 4 mục DQT §11; chốt Q1–Q5 DQT §12 | |
| T1 | Schema `dqTestSpec.json`, DTO `testSpec`, validation, form và card Overview | DQ07–DQ09 |
| T2 | Bảng lưu trữ, reconciler, outbox, bootstrap suite và pipeline, sinh testcase khi Approve Rule | T1 |
| T3 | Kích hoạt từ TD và cutover, khóa testcase managed | T2; điểm kích hoạt TD |
| T4 | API kết quả, tab Kết quả kiểm thử của Rule, tab Chất lượng dữ liệu của CDE, bộ lọc danh sách | T2 |
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

- Xác minh 4 mục ở DQT §11:
  1. `TestCaseIndex` có chứa tag thừa kế từ Column không.
  2. Hành vi `_process_logical_suite` ([test_suite.py](../../ingestion/src/metadata/data_quality/source/test_suite.py)) với
     testcase thuộc nhiều service và nhiều Table không sắp xếp.
  3. `TestDefinition` có `sqlExpression` được ingestion chọn đúng
     [columnRuleLibrarySqlExpressionValidator.py](../../ingestion/src/metadata/data_quality/validations/column/sqlalchemy/columnRuleLibrarySqlExpressionValidator.py).
  4. Lưu `extension.dqTestSpec` dạng object qua validate extension hiện có.
- Chốt Q1–Q5 với nghiệp vụ.

**DoD**

- Mỗi mục có kết luận kèm bằng chứng (test spike, đoạn mã, log chạy thử).
- Thiết kế DQT được cập nhật nếu kết luận khác giả định, đặc biệt mục 4 (nơi lưu `testSpec`) và mục 3 (cách tạo
  definition managed).
- Q1–Q5 có câu trả lời ghi vào DQT §12.

### T1 — Khai báo kiểm thử trên DQ Rule

**Phạm vi**

- Schema `dqTestSpec.json` trong `openmetadata-spec` (DQT §4.2); generate model Java/TypeScript.
- DTO create/patch DQ Rule thêm trường typed `testSpec`; server map vào `extension.dqTestSpec` (hoặc trường riêng theo
  kết luận T0 mục 4).
- `GovernedGlossaryProfileRegistry`: system key `dqTestSpec` cho profile `DATA_QUALITY`; Custom Properties chung không
  hiển thị khóa này.
- Validator theo DQT §4.3: method mismatch, `LIBRARY` definition và tham số, `SQL` chỉ một câu `SELECT` (parse bằng SQL
  parser), ngưỡng hỗ trợ, bất biến loại kiểm tra giữa version minor. Lưu Draft chạy kiểm tra cú pháp; Submit/Approve chạy
  đầy đủ.
- `testSpec` có trong snapshot, `contentHash` và lịch sử phiên bản; luồng Sửa phiên bản ghi đè và lưu bản cũ.
- Endpoint `GET .../governed/dataQuality/testDefinitions` và `POST .../{ruleId}/dataQuality/preview` (DQT §8).
- UI: section **Khai báo kiểm thử** trong `DQGlossaryTermForm`, dùng lại component tham số của `TestCaseFormV1` và SQL
  editor gốc; khối **Áp dụng cho** gọi preview; card chỉ đọc trong `DQGlossaryTermOverview` (DQT §9.1).
- Hộp xác nhận Approve hiển thị số cột sẽ áp dụng (DQT §4.4).

**DoD/Test**

- Rule không khai báo `testSpec` vẫn tạo, duyệt và export như trước; Import/Export giữ 19 trường.
- Mỗi mã lỗi `DQ_TEST_SPEC_*`, `DQ_THRESHOLD_UNSUPPORTED` có integration test cho cả Lưu và Approve.
- SQL chứa DDL/DML, nhiều câu, `;` thừa, comment chứa lệnh, thiếu biến bắt buộc đều bị từ chối.
- Version minor đổi `kind` hoặc `testDefinitionFqn` bị từ chối; đổi tham số/SQL được chấp nhận.
- Snapshot và lịch sử phiên bản hiển thị đúng `testSpec` của từng version.
- In Review/Approved/Archived không sửa được `testSpec` qua API.
- Chưa có testcase nào được tạo ở mốc này.

### T2 — Reconciler và sinh testcase khi Approve

**Phạm vi**

- Migration `1.13.3` MySQL và PostgreSQL ([bootstrap/sql/migrations/native/1.13.3](../../bootstrap/sql/migrations/native/1.13.3)):
  `dq_rule_exec`, `dq_rule_test_binding`, `dq_test_outbox` kèm index (DQT §7).
- DAO jdbi3 cho ba bảng.
- Bot hệ thống `dq-governance-bot` (bootstrap idempotent).
- Bootstrap logical suite `DQR-Exec-Daily`, `DQR-Exec-Monthly`, `DQR-Exec-Quarterly` và pipeline TestSuite với lịch mặc
  định (DQT §5.3).
- Reconciler tính tập mong muốn (DQT §5.1) cho một Rule, diff với binding và: tạo/sửa/soft-delete/restore testcase,
  tạo/sửa definition managed cho loại `SQL`, chuyển suite khi đổi Tần suất, đánh dấu `NOT_APPLICABLE` theo
  `supportedDataTypes`, ghi `ERROR` khi thất bại. Khóa `FOR UPDATE` trên `dq_rule_exec`.
- Outbox: `GlossaryVersioningService` ghi `RECONCILE_RULE` trong cùng transaction với Approve; xử lý sau commit; worker
  thử lại.

**DoD/Test**

- Rule Approved có `testSpec` sinh đúng một testcase `ACTIVE` trên mỗi Column `Available` của CDE; Draft/In Review/Rejected
  không sinh testcase.
- Chạy reconcile nhiều lần liên tiếp và đồng thời không tạo trùng.
- Approve version minor đổi tham số/SQL cập nhật testcase hiện có, lịch sử kết quả giữ nguyên.
- Version mới đổi CDE retire testcase trên Column cũ và tạo trên Column mới.
- Đổi Tần suất chuyển testcase sang đúng logical suite.
- Lỗi reconcile không rollback phê duyệt; binding `ERROR` được worker xử lý lại.
- Testcase bị hard-delete ngoài luồng được tạo lại và ghi audit.
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

- Gán, đổi, bỏ CDE trên TD và đổi `sourceStatus` đưa tập testcase về đúng DQT §5.1.
- Đổi kiểu dữ liệu Column chuyển `ACTIVE` ↔ `NOT_APPLICABLE`.
- Cutover DD/DQ retire toàn bộ binding của scope cũ; kết quả cũ vẫn đọc được.
- Lỗi reconcile không rollback lưu TD hay cutover.
- Testcase managed không sửa/xóa được qua API và UI gốc; ghi kết quả và incident vẫn hoạt động; testcase thường không bị
  ảnh hưởng.

### T4 — Kết quả Rule và CDE

**Phạm vi**

- Service tính Kết quả theo ngưỡng (DQT §6.1), kết quả Rule (§6.2), kết quả CDE (§6.3), badge Quá hạn; đọc time-series
  gốc theo `testCaseId` trong binding.
- Endpoint `GET .../{ruleId}/dataQuality/results` và `GET .../{cdeId}/dataQuality/results`, phân trang, ẩn dòng thiếu
  quyền `ViewTests`/`ViewAll` trên Table (DQT §10).
- UI `GlossaryTermsV1`: tab `data_observability` của Rule thành **Kết quả kiểm thử**, của CDE thành **Chất lượng dữ liệu**
  (DQT §9.2, §9.3); gộp tab Quy tắc CLDL hiện có của CDE vào bảng Quy tắc (`CDEGlossaryTermOverview`).
- Empty state cho Rule chưa Approved, Rule chưa khai báo kiểm thử, banner cho Rule đã lưu trữ.
- Bộ lọc **Kiểm thử** ở danh sách DQ (DQT §9.4).

**DoD/Test**

- Unit test đủ mọi dạng ngưỡng (`count = 0`, `count <= n`, `>= x%`, `> x%`, `= x%`, trống) và các trạng thái gốc
  `Success`/`Failed`/`Aborted`/chưa có kết quả.
- Kết quả Rule và CDE khớp kết quả gốc của từng testcase.
- Người dùng thiếu quyền Table không thấy dòng testcase, thẻ tổng ghi số dòng bị ẩn.
- Consumer chỉ thấy Rule Approved trong tab CDE.
- Kết quả Rule/CDE đã lưu trữ vẫn tra cứu được sau cutover.
- URL tab không đổi so với trước.

### T5 — Xu hướng và vận hành

**Phạm vi**

- Endpoint `trend` cho Rule và CDE (30/90 ngày), tính từ time-series kể cả binding `RETIRED` trong khoảng còn active;
  mốc `publishedAt` của version (DQT §6.4).
- Biểu đồ xu hướng trong hai tab ở T4.
- `POST .../governed/dataQuality/reconcile` và `GET .../reconcile/status` (outbox lag, binding `ERROR`, Table có pipeline
  basic suite chứa testcase managed).
- Hộp xác nhận cutover DD (TD §9.4) thêm “{n} testcase của {m} quy tắc sẽ ngừng chạy”.

**DoD/Test**

- Xu hướng đúng khi Rule đổi version, đổi CDE và sau cutover.
- Benchmark trend trên dữ liệu thử nghiệm lớn; nếu vượt ngưỡng chấp nhận thì mở việc bảng rollup theo ngày.
- Reconcile toàn bộ chỉ Admin gọi được và idempotent.

## 5. Work breakdown theo tầng

### Backend Java

| Nơi | Thay đổi | Mốc |
| --- | --- | --- |
| `openmetadata-spec` | `dqTestSpec.json`, DTO `testSpec`, response kết quả/trend | T1, T4 |
| `service/glossary/GovernedGlossaryProfileRegistry` | System key `dqTestSpec` | T1 |
| `service/glossary` (mới) | Validator `testSpec`, reconciler, outbox worker, tính kết quả | T1, T2, T4 |
| `service/glossary/versioning/GlossaryVersioningService` | Ghi outbox khi Approve | T2 |
| `service/glossary/technical/TechnicalRecordService`, `TechnicalImportCommitter`, `TechnicalColumnSync`, `TechnicalCutover` | Ghi outbox | T3 |
| `jdbi3/TestCaseRepository`, `jdbi3/TestDefinitionRepository` | Khóa managed | T3 |
| `resources/glossary` | Endpoint DQT §8 | T1, T4, T5 |

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

- Migration `1.13.3` MySQL và PostgreSQL cho ba bảng (T2).
- Bootstrap idempotent bot, logical suite và pipeline (T2).

### Tài liệu

| Tài liệu | Thay đổi | Mốc |
| --- | --- | --- |
| [Thiết kế DQ](./dq-glossary-ui-design.md) §2.2 | Bỏ “Không tự động tạo `TestCase`…”, “Không thực thi SQL…” khỏi ngoài phạm vi | T1 |
| Thiết kế DQ §6.1, §8.4, §8.5 | DTO có `testSpec`; form và Overview | T1 |
| [Thiết kế CDE](./cde-glossary-ui-design.md) §7.1 mục 3 | Tab Quy tắc CLDL gộp vào tab Chất lượng dữ liệu | T4 |
| [Thiết kế TD](./technical-dictionary-design.md) §6.2, §9.4 | Kích hoạt reconcile; số testcase bị ngừng khi cutover | T3, T5 |

## 6. Chiến lược kiểm thử

| Tầng | Nội dung bắt buộc |
| --- | --- |
| Unit backend | Validator `testSpec` và SQL, tính tập mong muốn, diff binding, tính kết quả theo ngưỡng |
| Repository integration | Ba bảng mới, unique/index, `FOR UPDATE`, outbox trên MySQL và PostgreSQL |
| Resource integration | Mã lỗi, khóa managed, quyền xem dòng testcase, endpoint Admin |
| Ingestion | Definition managed loại `SQL` chạy đúng validator; logical suite nhiều service |
| Unit frontend | Map `testSpec` ↔ form, hiển thị kết quả, empty state |
| E2E | Hành trình chính bên dưới |

Hành trình E2E chính:

1. Proposer tạo Rule loại `LIBRARY` liên kết CDE có 3 Column trong TD, xem preview.
2. Approver duyệt; hệ thống sinh 3 testcase trong suite đúng Tần suất.
3. Chạy pipeline; tab Kết quả kiểm thử của Rule và tab Chất lượng dữ liệu của CDE hiển thị đúng.
4. Gỡ CDE khỏi 1 Column trên TD; testcase tương ứng bị retire, kết quả cũ còn trong xu hướng.
5. Tạo version minor đổi tham số; testcase cập nhật, lịch sử liên tục.
6. Thử sửa/xóa testcase managed qua UI gốc; bị chặn.
7. Lặp lại với Rule loại `SQL`.
8. Cutover DD; mọi testcase của scope cũ bị retire, kết quả vẫn tra cứu được.

## 7. Kế hoạch PR đề xuất

| PR | Nội dung | Ghi chú merge |
| --- | --- | --- |
| 1 | T0 spike và cập nhật thiết kế | Không đổi behavior |
| 2 | T1 schema, DTO, validation, endpoint testDefinitions/preview | Flag tắt |
| 3 | T1 UI form và card Overview | Flag tắt |
| 4 | T2 migration, DAO, bootstrap suite/pipeline/bot | Flag tắt |
| 5 | T2 reconciler và outbox khi Approve | Test idempotent bắt buộc |
| 6 | T3 kích hoạt TD/cutover | Phụ thuộc điểm kích hoạt TD |
| 7 | T3 khóa managed backend và UI | |
| 8 | T4 API kết quả | Test quyền |
| 9 | T4 UI tab và bộ lọc | |
| 10 | T5 xu hướng, reconcile status, cảnh báo cutover | |

## 8. Rủi ro triển khai

Rủi ro sản phẩm và vận hành nằm ở DQT §11. Rủi ro riêng của việc triển khai:

| Rủi ro | Biện pháp |
| --- | --- |
| Kết luận T0 thay đổi nơi lưu `testSpec` hoặc cách tạo definition `SQL` | Không bắt đầu T1 trước khi T0 xong |
| Điểm kích hoạt TD chưa ổn định làm chậm T3 | T4 làm song song với T3; flag chưa bật production |
| Reconciler tạo trùng testcase khi chạy song song | Test đồng thời ở T2 là điều kiện merge PR 5 |

## 9. Rollout và rollback

### Rollout

1. Deploy T1–T2 với flag tắt; chạy bootstrap suite/pipeline.
2. Bật flag ở môi trường kiểm thử, duyệt vài Rule thật và đối chiếu kết quả với chạy tay.
3. Xác nhận connection pipeline TestSuite dùng tài khoản chỉ đọc trên mọi service.
4. Bật production sau khi T3 hoàn tất (khóa managed và kích hoạt TD).
5. Theo dõi outbox lag và binding `ERROR` ít nhất một chu kỳ Tần suất Daily.

### Rollback

- Tắt flag: outbox ngừng xử lý, testcase managed không bị xóa.
- Nếu cần dừng chạy testcase: tạm dừng pipeline `DQR-Exec-*` trong trang pipeline gốc.
- Migration chỉ thêm bảng, không đổi bảng hiện có; rollback ứng dụng không cần rollback schema.

## 10. Checklist nghiệm thu cuối

Theo tiêu chí chấp nhận của thiết kế:

- [ ] Rule Approved có `testSpec` sinh đúng một testcase `ACTIVE` trên mỗi Column `Available` của CDE trong TD; Column
  không hợp kiểu được đánh dấu Không áp dụng; Draft/In Review/Rejected không sinh testcase.
- [ ] Gán, đổi, bỏ CDE trên TD, đổi CDE của Rule, approve version mới và cutover DD/DQ đều đưa tập testcase về đúng
  DQT §5.1 mà không tạo trùng, kể cả khi chạy lại reconcile nhiều lần.
- [ ] Version minor đổi tham số hoặc SQL thì cập nhật testcase hiện có, giữ lịch sử kết quả; đổi loại kiểm tra bị từ chối.
- [ ] Testcase managed không sửa/xóa được qua API/UI gốc; ghi kết quả và incident vẫn hoạt động.
- [ ] Kết quả Rule và CDE khớp với kết quả gốc của từng testcase và ngưỡng DQT §6.1–6.3; dòng testcase tôn trọng quyền
  xem Table.
- [ ] SQL không phải `SELECT` đơn bị từ chối ở Lưu và ở Approve.
- [ ] Kết quả của Rule/CDE đã lưu trữ vẫn tra cứu được sau cutover.
- [ ] Tài liệu ở §5 Tài liệu đã cập nhật.
