# Thiết kế Từ điển kỹ thuật — bản ghi theo khai báo, đọc qua index riêng

> Trạng thái tài liệu: **Đã chốt**.
>
> Tài liệu này thay thế các phần sinh record tự động và read model trong
> [Thiết kế Từ điển kỹ thuật](./technical-dictionary-ui-design.md). Những gì không
> được nêu ở đây (19 trường hiển thị §4, liên kết CDE cùng số version §6.3,
> Thứ hạng §6.4, state machine, cutover catalog, modal, chính sách import §8.3)
> giữ nguyên tài liệu gốc.

## 1. Bối cảnh

Thiết kế cũ sinh sẵn một record `N.0 Draft` cho **mọi** Column vật lý (bootstrap job)
và đọc danh sách bằng cách nạp toàn bộ record của scope vào bộ nhớ rồi lọc trong Java.
Với một database service (khoảng 66k Column), trên môi trường dev:

- Bootstrap tạo khoảng 60 record/giây, tức ước tính khoảng 18 phút cho 66k Column, và sinh
  hàng chục nghìn record Draft rỗng trong Postgres.
- `GET /glossaryTerms/search` và `/stats` nạp toàn bộ record mỗi request, server
  hết heap (`OutOfMemoryError`) khi mới có khoảng 25k record.
- Tỷ lệ Column thực sự được gán CDE dưới 10%, nên phần lớn record là rỗng.

## 2. Quyết định

| ID | Quyết định | Thay thế |
| --- | --- | --- |
| TDX-01 | Record chỉ được tạo khi người dùng **khai báo** một Column (nút **Thêm cột** hoặc Import). Không có bootstrap job, không tự tạo record khi ingest Column mới. | TD-D02, §5.1, §5.2 |
| TDX-02 | Mã CDE quy chiếu **không bắt buộc**. Một record có thể chỉ khai báo Loại thành tố, Thứ hạng… | — |
| TDX-03 | Danh sách Từ điển kỹ thuật **chỉ gồm các Column đã khai báo**. Column chưa khai báo không xuất hiện. | — |
| TDX-04 | Mọi thao tác đọc danh sách (search, filter, sort, phân trang, thống kê, export, chọn theo filter cho bulk) chạy trên **index riêng** `technical_dictionary_search_index`. Postgres không bị quét toàn bộ trong request đọc. | §7.3, §11 read model |
| TDX-05 | Mọi thao tác ghi thực hiện trên **Postgres** (nguồn sự thật), kiểm tra revision và quyền trên Postgres, rồi đồng bộ sang index. Index không bao giờ được dùng làm căn cứ để ghi. | — |
| TDX-06 | Người có `canEditWorking` trên catalog được xóa record `Draft` **chưa từng có phiên bản Approved** (hủy khai báo nhầm). Record đã từng Approved không xóa được. | TD-D02 (phần cấm xóa) |
| TDX-07 | Import được tạo record cho Column chưa khai báo. | TD-D05, §8.1 |
| TDX-08 | Catalog `N+1` bắt đầu trống; mang khai báo từ `N` sang bằng Export `N` → Import `N+1`. | TD-D07 (phần bootstrap) |
| TDX-09 | Bỏ cấu hình phạm vi Column (`includeServices`, `includeDatabases`, `includeSchemas`, `excludePatterns`). Người dùng chọn Column cụ thể khi khai báo. | TD-D09, §5.4 |
| TDX-10 | Bốn thẻ thống kê: **Tổng cột**, **Bảng dữ liệu**, **Hệ thống nguồn**, **Đã phê duyệt** — đếm trên các Column đã khai báo. | §7.2 bảng Card |
| TDX-11 | Record Từ điển kỹ thuật **không** được ghi vào các index glossary chung (`glossary_term_search_index`, `glossary_term_published_search_index`); chỉ có trong index riêng. | §11 search index |
| TDX-12 | Bỏ chế độ **Tất cả phiên bản** khỏi danh sách. Lịch sử phiên bản của một record xem trong modal, đọc từ Postgres. | §7.3 |

## 3. Lưu trữ trên Postgres

Không đổi các bảng governed dùng chung với CDE/DQ:

| Bảng | Nội dung của Từ điển kỹ thuật |
| --- | --- |
| `glossary_term_entity` | Identity của record: một dòng cho mỗi (Column, catalog `N`). `name` = column key (UUID suy từ Column FQN). |
| `glossary_business_working` | Representation Draft / In Review / Rejected với toàn bộ trường editable và source snapshot. |
| `glossary_business_snapshot`, `glossary_published_head` | Các phiên bản Approved (bất biến) và Archived sau cutover. |
| `glossary_snapshot_outbox` | Sự kiện sau Approve/Archive: projection tag CDE và bốn tag phân loại lên Column (giữ nguyên). |
| `technical_source_state` | Chỉ có dòng khi Column nguồn `Unavailable` hoặc `Changed`. |

Thay đổi:

- **Bỏ** bảng `technical_bootstrap_job`.
- **Thêm** bảng `technical_index_outbox` (§5.3):

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `termId` | `varchar(36)` PK | Record cần đồng bộ lại |
| `enqueuedAt` | `bigint` | |
| `attempts` | `int` | |
| `lastError` | `text` | |

## 4. Index `technical_dictionary_search_index`

### 4.1. Nguyên tắc

- Một document cho mỗi **identity** (một Column đã khai báo trong một catalog `N`),
  `_id = termId`. Không có document cho Column chưa khai báo.
- Index do Từ điển kỹ thuật tự quản lý (tạo khi khởi động nếu chưa có, mapping riêng).
  **Không đăng ký** trong `indexMapping.json` để ứng dụng Reindex của OpenMetadata
  không cố dựng lại nó từ `glossary_term_entity` (bảng này chỉ chứa identity rỗng).
- Document có hai view để phục vụ hai loại người xem mà không cần hai index:
  - `current`: working nếu có, nếu không thì phiên bản Approved mới nhất (hoặc Archived
    với catalog đã lưu trữ). Người soạn/duyệt đọc view này.
  - `published`: phiên bản Approved mới nhất; **không có** nếu record chưa từng được duyệt.
    Consumer chỉ đọc view này.

### 4.2. Trường

| Nhóm | Trường | Kiểu | Dùng cho |
| --- | --- | --- | --- |
| Identity | `termId`, `glossaryId`, `parentBusinessVersion`, `columnKey` | keyword | scope, lookup |
| Vị trí Column | `columnFqn` | keyword (lowercase) | sort mặc định, match chính xác |
| | `service`, `database`, `schema`, `table`, `column` | keyword (lowercase) + text ngram | filter, search |
| | `dataType`, `description` | keyword / text | hiển thị, search mô tả |
| | `sourceStatus` | keyword | filter Tình trạng nguồn |
| Mỗi view (`current.*`, `published.*`) | `recordType`, `entityStatus`, `businessVersion`, `releaseVersionType` | keyword | filter, hiển thị |
| | `workingRevision` | long | chỉ `current`, để UI gửi kèm khi ghi |
| | `cde.id`, `cde.code`, `cde.name`, `cde.businessVersion` | keyword + text | filter CDE, search Mã/Tên CDE |
| | `dataOwners[].id`, `dataOwners[].name` | keyword | hiển thị Chủ sở hữu dữ liệu |
| | `rank` | integer | hiển thị, cảnh báo trùng |
| | `elementType`, `generationType`, `creationMethod`, `timeliness` | keyword (tag FQN) + label | filter |
| | `systemOwner.id`, `systemOwner.name` | keyword | filter |
| | `updatedAt`, `updatedBy` | date / keyword | hiển thị |
| Cờ | `hasPublished` | boolean | quyết định có được Xóa (TDX-06) |

Dữ liệu CDE (mã, tên, chủ sở hữu) được **lưu sẵn** trong document để search và hiển thị
không phải truy Postgres; §5.2 mô tả cách giữ nó đúng khi CDE thay đổi.

### 4.3. Truy vấn

- Server luôn tự dựng truy vấn; UI chỉ gửi tham số (`q`, các filter, `limit`, `offset`).
- Điều kiện bắt buộc: `glossaryId`, `parentBusinessVersion`, và theo quyền (§6).
- Search `q`: khớp một phần (ngram) trên database, schema, bảng, cột, Mã CDE, Tên CDE.
- Filter: Trạng thái, Nguồn, Mã CDE (gồm **Chưa quy chiếu** = không có `cde.id`),
  Loại thành tố, Loại trường dữ liệu, Phương thức tạo, Thời gian, Chủ sở hữu hệ thống,
  Tình trạng nguồn.
- Không có tham số `versionView`: mỗi record là một dòng (TDX-12).
- Sort mặc định `columnFqn` tăng dần; phân trang `from/size`.
  Giới hạn 10.000 kết quả đầu (`max_result_window`); vượt giới hạn cần thu hẹp filter.
- Thống kê (TDX-10) bằng aggregation trên cùng điều kiện scope và quyền:
  Tổng cột = số document; Bảng dữ liệu = cardinality `database.schema.table`;
  Hệ thống nguồn = cardinality `service`; Đã phê duyệt = số document có `hasPublished`.

## 5. Đồng bộ Postgres → index

### 5.1. Cơ chế

Theo cùng mô hình OpenMetadata dùng cho entity (ghi DB rồi cập nhật search index),
bổ sung lớp thử lại:

1. Thao tác ghi commit transaction trên Postgres.
2. Ngay sau commit, trong cùng request: đọc lại record từ Postgres (identity, working,
   published trong scope, source state, CDE tham chiếu), dựng document và ghi vào index với
   `refresh=wait_for`, để lần tải lại bảng ngay sau đó thấy thay đổi.
3. Nếu bước 2 lỗi: ghi `termId` vào `technical_index_outbox`, **không** rollback Postgres,
   request vẫn thành công.
4. Worker xử lý `technical_index_outbox`: khi khởi động server, định kỳ, và trước mỗi request
   đọc của Từ điển kỹ thuật (tương tự `processPendingOutbox` hiện có).

Document luôn được dựng lại **toàn bộ** từ Postgres (không cập nhật từng phần), nên việc đồng
bộ lặp lại là an toàn.

### 5.2. Điểm kích hoạt

| Sự kiện | Document được đồng bộ |
| --- | --- |
| Khai báo Column, Save Draft, Submit, Reject, Reopen, Approve, Tạo phiên bản mới, Thu hồi | Record đó |
| Xóa Draft chưa duyệt | Xóa document |
| Bulk Submit/Approve/Reject | Các record trong chunk, ghi hàng loạt cuối chunk |
| Import commit | Các record được tạo hoặc cập nhật, ghi hàng loạt |
| Ingest làm Column đã khai báo bị xóa hoặc đổi (`technical_source_state`) | Record của Column đó |
| CDE được duyệt phiên bản mới trong Từ điển dữ liệu dùng chung scope `N` | Các record scope `N` tham chiếu CDE đó (tìm qua `cde.id` trên index) |
| Duyệt catalog `N+1` (cutover) | Toàn bộ record scope `N` (chuyển Archived hoặc bị xóa nếu chưa Approved) |

### 5.3. Dựng lại index

- API Admin `POST /v1/glossaries/{id}/technical-index/rebuild`.
- Dựng vào index vật lý mới, đọc các identity Từ điển kỹ thuật từ Postgres theo trang
  (keyset theo `termId`), ghi hàng loạt, sau đó chuyển alias sang index mới và xóa index cũ,
  nên trong lúc dựng người dùng vẫn đọc index cũ.
- Tự chạy khi khởi động nếu index chưa tồn tại (môi trường mới, đổi mapping).
- Khối lượng chỉ là số Column **đã khai báo**, không phải toàn bộ Column.

## 6. Phân quyền khi đọc

| Người xem | Điều kiện server thêm vào truy vấn | View dùng để filter/hiển thị |
| --- | --- | --- |
| Có `canViewWorking` trên catalog | Scope đang xem | `current` |
| Consumer (chỉ xem bản phát hành) | Scope đang xem và `hasPublished = true` | `published` |
| Catalog `N` đã Archived | Scope `N` | Snapshot Archived |

Quyền ghi luôn được kiểm tra lại trên Postgres theo capability hiện có; việc một row hiện
nút Sửa trên UI không phải căn cứ cho phép ghi.

## 7. Luồng thao tác

| # | Thao tác người dùng | Đọc | Ghi Postgres | Index |
| --- | --- | --- | --- | --- |
| 1 | Ingest database service | — | `table_entity` (OpenMetadata) | `column_search_index` (OpenMetadata). Index TD **không đổi** |
| 2 | Mở trang, search, filter, phân trang, thống kê | Index TD | — | — |
| 3 | **Thêm cột**: tìm Column | `column_search_index` (chỉ đọc) + index TD để đánh dấu Column đã khai báo trong scope | — | — |
| 4 | **Thêm cột**: Lưu | `table_entity` để lấy thông tin Column chính xác | Identity + working `N.0 Draft` kèm giá trị đã nhập | Tạo document |
| 5 | Sửa, Save Draft | `glossary_business_working` (kiểm tra revision) | Working | Cập nhật document |
| 6 | Gửi duyệt / Từ chối / Mở lại | Working | Working | Cập nhật document |
| 7 | Phê duyệt | Working, kiểm tra Thứ hạng | Snapshot + head + outbox projection lên Column | Cập nhật document (`published` xuất hiện) |
| 8 | Tạo phiên bản mới từ bản Approved | Published head | Working `N.x+1` | Cập nhật document |
| 9 | Xóa Draft chưa duyệt | Working, xác nhận không có snapshot | Xóa working + identity + source state | Xóa document |
| 10 | Bulk theo filter | Index TD để lấy danh sách `termId` | Từng record, như 6–7 | Ghi hàng loạt cuối chunk |
| 11 | Import preview | Index TD (record đã khai báo theo vị trí) + `column_search_index` (Column chưa khai báo) | — | — |
| 12 | Import commit | Kiểm tra revision | Cập nhật record có sẵn; tạo record cho Column chưa khai báo | Ghi hàng loạt |
| 13 | Export | Index TD (duyệt toàn bộ bằng point-in-time) | — | — |
| 14 | Ingest lại, Column đã khai báo bị xóa/đổi | `glossary_term_entity` theo column key | `technical_source_state`; làm mới source snapshot nếu Draft | Cập nhật document |
| 15 | Tạo catalog `N+1` | — | Working của glossary | Không có document nào cho `N+1` |
| 16 | Duyệt catalog `N+1` | — | Cutover theo DQ | Đồng bộ lại toàn bộ record scope `N` |

## 8. REST

Endpoint riêng của Từ điển kỹ thuật (thay cho nhánh TD trong endpoint flat list chung):

```http
GET    /v1/glossaryTerms/technical/search?glossary=&parentBusinessVersion=&q=&statuses=&sourceServices=&cdeMapping=&cdeTermIds=&systemOwnerIds=&sourceStatuses=&elementTypes=&generationTypes=&creationMethods=&timeliness=&limit=&offset=
GET    /v1/glossaryTerms/technical/stats?glossary=&parentBusinessVersion=
GET    /v1/glossaryTerms/technical/columns?glossary=&parentBusinessVersion=&q=&limit=   # chọn Column khi Thêm cột
POST   /v1/glossaryTerms/technical/records?glossary=&parentBusinessVersion=              # khai báo Column + giá trị
DELETE /v1/glossaryTerms/technical/records/{termId}?parentBusinessVersion=              # xóa Draft chưa duyệt
POST   /v1/glossaries/{id}/technical-index/rebuild                                      # Admin
```

- Record, workflow, bulk, import, export giữ endpoint hiện có; chỉ đổi nguồn đọc sang index.
- Lịch sử phiên bản trong modal dùng endpoint có sẵn
  `GET /v1/glossaryTerms/{id}/published?parentBusinessVersion=N` và working hiện tại.
- Khi ghi record Từ điển kỹ thuật, `GlossaryVersioningService` bỏ qua việc cập nhật
  `glossary_term_search_index` và `glossary_term_published_search_index` (TDX-11).
- Bỏ `/v1/glossaries/{id}/bootstrap-jobs*`.
- Mã lỗi mới: `TD_COLUMN_NOT_FOUND`, `TD_COLUMN_ALREADY_DECLARED`, `TD_DRAFT_NOT_DELETABLE`,
  `TD_INDEX_UNAVAILABLE`. Bỏ `TD_COLUMN_SCOPE_EMPTY`, `TD_BOOTSTRAP_NOT_READY`.
  `POST /v1/glossaryTerms` với glossary TD vẫn trả `TD_MANUAL_CREATE_NOT_ALLOWED`; khai báo
  đi qua endpoint riêng ở trên.

## 9. Giao diện

- Bỏ banner "Đang đồng bộ dữ liệu kỹ thuật".
- Nút **Thêm cột** (khi catalog mở và có `canEditWorking`): modal bước 1 tìm và chọn Column
  (Column đã khai báo trong scope hiển thị mờ, không chọn được), bước 2 dùng form sửa hiện có;
  Lưu tạo `Draft`.
- Action **Xóa** trên row `Draft` chưa từng Approved, có xác nhận.
- Bốn thẻ thống kê theo TDX-10.
- Trạng thái trống: "Chưa có cột nào được khai báo" kèm nút Thêm cột và Import.
- Thanh lọc theo thiết kế gọn đã thống nhất (4 bộ lọc chính + **Bộ lọc khác**);
  bỏ công tắc **Tất cả phiên bản** (TDX-12).
- Modal xem/sửa có thêm nhóm **Lịch sử phiên bản** (danh sách phiên bản, trạng thái,
  người/ngày duyệt; chọn một phiên bản để xem nội dung, chỉ đọc).

## 10. Rủi ro và giới hạn

| Rủi ro | Xử lý |
| --- | --- |
| Index trễ hoặc lệch so với Postgres | `refresh=wait_for` sau mỗi ghi; outbox thử lại; API rebuild. Ghi luôn kiểm tra trên Postgres |
| OpenSearch không khả dụng | Đọc trả lỗi `TD_INDEX_UNAVAILABLE`; ghi vẫn thành công và được đưa vào outbox |
| Mã/Tên CDE lưu sẵn bị cũ | Đồng bộ lại khi CDE được duyệt phiên bản mới (§5.2) |
| Column đã khai báo bị xóa khỏi nguồn | Record và document giữ nguyên, `sourceStatus = Unavailable` |
| Phân trang sâu quá 10.000 kết quả | Giới hạn, yêu cầu thu hẹp filter |

## 11. Câu hỏi cần chốt

1. ~~Ghi vào index glossary chung~~ — đã chốt: không (TDX-11).
2. ~~Chế độ "Tất cả phiên bản"~~ — đã chốt: bỏ khỏi danh sách (TDX-12).
3. ~~Ai được xóa Draft chưa duyệt~~ — đã chốt: mọi người có `canEditWorking` trên catalog (TDX-06).

## 12. Hiện trạng mã nguồn

Đã thay đổi trong nhánh làm việc (chưa build/test), phù hợp thiết kế này:

- Gỡ bootstrap job: service, DAO, view, endpoint, cấu hình phạm vi, bảng
  `technical_bootstrap_job` trong migration 1.13.3 và schema.
- `TechnicalColumnSync` chỉ cập nhật trạng thái nguồn của record đã khai báo, không tạo record.
- `TechnicalColumnSource` suy service/database/schema/table từ Column FQN.
- Import tạo record cho Column chưa khai báo (`CREATE_RECORD`), tra Column qua
  `column_search_index`.

Sẽ bỏ hoặc thay khi triển khai thiết kế này:

- Hướng ghép danh sách Column chưa khai báo từ `column_search_index` với record trên Postgres
  (`TechnicalColumnIndex.page/counts`) — không còn dùng; chỉ giữ tra Column theo bảng cho
  Import và Thêm cột.
- Read model trong bộ nhớ (`loadAuthorizedGlossaryFlatRows` + `TechnicalRowMatcher`) cho
  search/stats/export/bulk của Từ điển kỹ thuật.
