# Thiết kế Từ điển kỹ thuật (Technical Dictionary)

> Trạng thái tài liệu: **Đã chốt**, cập nhật quyết định phê duyệt bản ghi mới ngày 2026-10-05; duyệt hàng loạt, từ chối không cần lý do và bản nháp ngày 2026-10-06.
> Giao diện (§11), chủ quản dữ liệu (TD-D11) và hiện trạng triển khai (§16) đã được đối chiếu lại với code ngày 2026-10-06.
> Cập nhật 2026-10-08 (commit `b9a2421e757`): đề nghị xóa gửi duyệt ngay, rút lại yêu cầu (§7.5), tab **Yêu cầu** và `GET /technical/requests` (§11.7). Kiến trúc tổng thể: [Kiến trúc hiện tại hệ thống](./agribank-metadata-architecture.md).
> Đây là tài liệu thiết kế duy nhất của Từ điển kỹ thuật (TD).
>
> Tài liệu hợp nhất ba tài liệu trước đây và thay thế chúng:
> *Thiết kế Từ điển kỹ thuật — profile của Governed Glossary* (`technical-dictionary-ui-design.md`),
> *Bản ghi theo khai báo, đọc qua index riêng* (`technical-dictionary-search-index-design.md`) và
> *Không phiên bản, gắn với Từ điển dữ liệu đang hiệu lực* (`technical-dictionary-unversioned-design.md`).
> Chỉ giữ nội dung còn hiệu lực. Các ID quyết định cũ (`TD-D*`, `TDX-*`, `TDV-*`) được giữ để truy vết.
>
> Kế hoạch triển khai lịch sử (không thay thế thiết kế đích và chưa phản ánh quyết định phê duyệt mới):
> [technical-dictionary-search-index-implementation-plan.md](./technical-dictionary-search-index-implementation-plan.md).
> TD **không còn** là profile của Governed Glossary nên không kế thừa
> [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md). TD chỉ liên kết với
> [Thiết kế Từ điển dữ liệu dùng chung](./cde-glossary-ui-design.md) (DD) qua CDE.
> Baseline kiến trúc: [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md).

## 1. Bối cảnh và nguyên tắc

TD là danh mục kỹ thuật của các physical Column: mỗi bản ghi mô tả **một Column đã được khai báo**
và gán (tùy chọn) với một CDE của DD. Thiết kế đi qua ba lần đổi hướng và kết quả cuối là:

- **Không phiên bản; có phê duyệt khi khai báo mới.** Chỉ có một tập bản ghi TD. Bản ghi mới được tạo ở
  trạng thái `Draft` (bản nháp), được gửi duyệt riêng sang `In Review`, và chỉ có hiệu lực sau khi Data Steward
  hoặc Admin phê duyệt theo nguyên tắc maker-checker. Sửa hoặc xóa bản ghi `Approved` tạo một change request riêng;
  bản Approved cũ tiếp tục có hiệu lực cho tới khi người khác phê duyệt đề xuất. Mọi hành động được ghi audit.
- **Gắn với DD đang hiệu lực** (phiên bản Approved mới nhất, gọi là `vN`). Khi DD `vN+1` được phê
  duyệt, TD chụp lại phần `Approved` đã gán CDE rồi làm mới về trống.
- **Bản ghi theo khai báo, không sinh tự động.** Với một database service (khoảng 66k Column) việc
  sinh sẵn bản ghi cho mọi Column tốn khoảng 18 phút, tạo hàng chục nghìn bản ghi rỗng (dưới 10% Column
  thực sự được gán CDE) và làm server hết heap khi nạp toàn bộ để lọc. Vì vậy bản ghi chỉ tạo khi người
  dùng khai báo Column (nút **Thêm cột** hoặc Import).
- **Postgres là nguồn sự thật cho ghi; đọc danh sách chạy trên index riêng** `technical_dictionary_search_index`.

## 2. Quyết định

| ID | Quyết định | Lý do / ghi chú |
| --- | --- | --- |
| TDV-01 | TD không có phiên bản: không catalog `N`, không version bản ghi `N.x`, không bộ chọn phiên bản. Tại mọi thời điểm chỉ có một tập bản ghi | |
| TDV-02 | Khai báo mới phải được phê duyệt. Sửa hoặc xóa bản ghi `Approved` phải qua `technical_record_change_request`; chỉ `APPROVE_CHANGE` mới cập nhật/xóa bản có hiệu lực và projection. Consumer luôn đọc bản Approved hiện hành. Không có business version; mọi chuyển trạng thái và thay đổi đều vào audit | §7.3, §7.4, §11.6 |
| TDV-03 | TD gắn với DD đang hiệu lực `vN`; chỉ gán được CDE `Approved` của `vN` | |
| TDV-04 | Khi DD `vN+1` được phê duyệt, trong cùng transaction: chụp lại các bản ghi `Approved` đã gán CDE thành bản chụp của `vN` (giữ vĩnh viễn), rồi xóa toàn bộ bản ghi TD ở mọi trạng thái. Không tự nối sang CDE cùng mã | §9 |
| TDV-05 | Bản chụp các liên kết của DD đã lưu trữ được giữ vĩnh viễn, tải được và hiển thị trong tab Tài sản của CDE khi xem phiên bản đã lưu trữ (chỉ đọc) | §11.5 |
| TDV-06 | Chưa có DD nào Approved thì không khai báo cột hay Import | |
| TDV-07 | Người có quyền sửa xóa trực tiếp record chưa Approved; xóa record Approved tạo proposal `DELETE` và chỉ thực hiện sau phê duyệt | |
| TDV-08 | Bản ghi TD lưu trong bảng riêng, không còn là `GlossaryTerm`, không dùng bảng governed (`glossary_business_*`, `glossary_published_head`). Glossary `Technical Dictionary` chỉ còn làm đối tượng phân quyền | |
| TDX-01 | Bản ghi chỉ tạo khi người dùng khai báo Column. Không bootstrap job, không tự tạo khi ingest | |
| TDX-02 | Mã CDE quy chiếu không bắt buộc | |
| TDX-03 | Danh sách chỉ gồm Column đã khai báo | |
| TDX-04 | Mọi thao tác đọc danh sách (search, filter, sort, phân trang, export) chạy trên index riêng; Postgres không bị quét toàn bộ trong request đọc | |
| TDX-05 | Mọi thao tác ghi thực hiện trên Postgres (kiểm tra revision và quyền), rồi đồng bộ sang index. Index không bao giờ là căn cứ để ghi | |
| TDX-07 | Import được tạo bản ghi cho Column chưa khai báo | |
| TDX-09 | Không có cấu hình phạm vi Column; người dùng chọn Column cụ thể khi khai báo | |
| TDX-11 | Bản ghi TD không được ghi vào các index glossary chung; chỉ có trong index riêng | |
| TD-D06 | Mỗi bản ghi có **trang chi tiết riêng** `/technical-dictionary/:termId` (thông tin, sửa từng trường tại chỗ, lịch sử, duyệt). Modal chỉ còn dùng cho **Thêm cột** | Thay quyết định cũ “không có trang chi tiết”; §11.3 |
| TD-D08 | Database là nguồn sự thật; tag trên Column và search index là projection qua outbox | |
| TD-D10 | Chủ sở hữu dữ liệu suy ra từ `owners` của CDE được quy chiếu, không nhập ở TD | Một nguồn sự thật, không lệch giữa các Column cùng CDE |
| TD-D11 | Chủ sở hữu hệ thống (UI gọi là **Chủ quản dữ liệu**) là **danh sách** tham chiếu tới Team và/hoặc User `[{id, type}]`, không dùng trường `owners` của OpenMetadata | Có kiểm tra tồn tại, lọc theo ID; tránh policy "owner được sửa" cấp quyền ngoài ý muốn. Giá trị cũ là một UUID Team vẫn đọc được (§4) |
| TD-D12 | Thời gian là Classification `DataTimeliness`, đơn trị, danh sách chuẩn hóa được nghiệp vụ duyệt | Nhất quán với ba trường phân loại còn lại |
| TD-D13 | Mô tả lấy từ Column (server-owned), không sửa ở TD | Mô tả do ingestion và trang Table quản lý |
| TD-D14 | Không giữ liên kết lịch sử khi đổi tên Column/Table | OpenMetadata không có định danh Column ổn định qua đổi tên; Import cho phép gán lại nhanh |
| TD-D15 | Thứ hạng `1..999`, bắt buộc khi có CDE, duy nhất trong cùng CDE trên bản ghi `Approved` còn nguồn; kiểm tra lại khi phê duyệt và mỗi lần sửa bản ghi đã duyệt (§7.2) | |
| TD-D16 | Liên kết CDE chỉ lưu `termId`, không lưu version; bao trùm mọi version `vN.x` của CDE | Column chứa dữ liệu của thành tố nghiệp vụ, không phụ thuộc lần sửa minor của CDE |
| TD-D17 | Bảng không có cột Chủ sở hữu dữ liệu (suy ra từ CDE); header không có thẻ thống kê. Cột Chủ quản dữ liệu (chủ sở hữu hệ thống) hiển thị mặc định. Bốn cột Database/Schema/Bảng/Cột gộp thành một cột **Tên trường**. File Export giữ 14 cột và không có cột chủ sở hữu | Quyết định giao diện, §11 và §12.1 |
| TD-D18 | Phê duyệt bản ghi mới theo maker-checker: người tạo không được tự phê duyệt; quyền phê duyệt tách khỏi quyền khai báo/sửa | §10 |

## 3. Identity và thông tin nguồn

### 3.1. Column key

OpenMetadata không có UUID riêng cho `Column`; Column được định danh bằng `fullyQualifiedName`. TD dùng
cùng quy ước với `ColumnSearchIndex.generateColumnId`:

```text
columnKey = UUID.nameUUIDFromBytes(columnFqn UTF-8)
```

- `columnKey` là UNIQUE trong `technical_record`, nên mỗi Column có tối đa một bản ghi.
- Không hiển thị trên UI/Excel; người dùng nhận diện bản ghi qua Database/Schema/Bảng/Cột.
- **Đổi tên Column hoặc Table làm đổi FQN nên đổi `columnKey`**: Column cũ coi như không còn (§8), Column
  mới là Column khác. Không nối lại theo tên gần giống (TD-D14).

### 3.2. Trường server-owned

Thông tin nguồn do server quản lý: `columnFqn`, `service`, `database`, `schema`, `table`, `column`,
`dataType`, `dataLength`, `precision`, `scale`, `description`, `sourceStatus`. Client gửi bất kỳ trường
nào trong số này khi Lưu hoặc Import bị từ chối `400 TD_SERVER_OWNED_FIELD`.

### 3.3. Bốn trường phân loại

| Classification | Tag |
| --- | --- |
| `DataElementType` | `AtomicDataElement` (Dữ liệu nguyên tố), `TransformedDataElement` (Dữ liệu chuyển đổi) |
| `FieldGenerationType` | `SystemGenerated` (Hệ thống tự sinh), `SystemDerived` (Hệ thống tính toán), `ManualInput` (Nhập thủ công), `FileUpload` (Tải lên) |
| `DataCreationMethod` | `Parameterised` (Tham số), `Hardcoded` (Mã cứng), `NotApplicable` (N/A) |
| `DataTimeliness` | Danh sách chuẩn hóa theo TD-D12 |

Tag chỉ nhận giá trị trong allowlist classification tương ứng; UI và Excel dùng `displayName`, API lưu tag FQN.

## 4. Lưu trữ trên Postgres

`technical_dictionary_state`: một dòng duy nhất, giữ ngữ cảnh gắn DD và làm khóa đồng bộ với cutover.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `int` PK | Luôn bằng `1` |
| `dataDictionaryVersion` | `varchar(16)` | `N` của DD đang gắn; `null` khi chưa có DD Approved |
| `resetAt`, `resetBy` | `bigint`, `varchar(256)` | Lần làm mới gần nhất do cutover DD |
| `previousDataDictionaryVersion` | `varchar(16)` | Phiên bản vừa được chụp lại, dùng cho banner §11.1 |

`technical_record`: một dòng cho mỗi Column đã khai báo.

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `uuid` PK | Sinh ngẫu nhiên khi khai báo |
| `columnKey` | `uuid` UNIQUE | §3.1 |
| `columnFqn`, `service`, `database`, `schema`, `table`, `column` | `varchar` | Vị trí Column |
| `dataType`, `dataLength`, `precision`, `scale`, `description` | | Thuộc tính Column từ ingestion |
| `sourceStatus` | `varchar(16)` | `Available` / `Unavailable` (§8) |
| `cdeTermId` | `uuid` null | CDE identity; phải thuộc DD `vN` đang gắn |
| `cdeAssignedAt`, `cdeAssignedBy` | | Lần đầu đặt khi phê duyệt; sau đó cập nhật mỗi khi đổi CDE; dùng cho endpoint `technicalAssets` |
| `rank` | `smallint` null | Thứ hạng `1..999` |
| `elementType`, `generationType`, `creationMethod`, `timeliness` | `varchar` null | Tag FQN của bốn classification |
| `systemOwnerId` | `text` null | Chủ quản dữ liệu (TD-D11): JSON `[{"id", "type": "team"\|"user"}]`. Giá trị cũ là một UUID trần được đọc là một Team. Tên cột giữ nguyên để không phải migration |
| `status` | `varchar(16)` | `Draft` / `In Review` / `Approved` / `Rejected`; bản ghi mới (khai báo và Import) là `Draft` |
| `submittedAt`, `submittedBy` | | Lần gửi duyệt gần nhất; rỗng khi bản ghi còn là bản nháp |
| `reviewedAt`, `reviewedBy`, `reviewComment` | | Quyết định phê duyệt/từ chối gần nhất. Từ chối không có lý do: `reviewComment` luôn rỗng (cột giữ lại cho dữ liệu cũ) |
| `revision` | `bigint` | Khóa lạc quan, tăng mỗi lần lưu |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | | |

Index phụ: `(cdeTermId, rank)` cho kiểm tra Thứ hạng và endpoint `technicalAssets`.

`technical_record_change_request`: đề xuất sửa/xóa một bản ghi `Approved` (§7.4), tối đa một dòng cho mỗi record
(`UNIQUE(recordId)`).

| Cột | Ghi chú |
| --- | --- |
| `id`, `recordId` | |
| `operation` | `UPDATE` / `DELETE` |
| `baseRevision` | Revision của record lúc tạo đề xuất; lệch lúc duyệt thì `TD_CHANGE_REQUEST_STALE` |
| `proposedValues` | JSON giá trị đề xuất (rỗng với `DELETE`) |
| `status`, `revision` | `Draft` / `InReview` / `Rejected`; `revision` là khóa lạc quan của chính đề xuất |
| `createdAt/By`, `updatedAt/By`, `submittedAt/By`, `reviewedAt/By`, `reviewComment` | Như bản ghi; `reviewComment` luôn rỗng |

`technical_record_audit`: lịch sử thay đổi, không bị xóa khi TD làm mới.

| Cột | Ghi chú |
| --- | --- |
| `id`, `recordId`, `columnFqn`, `dataDictionaryVersion` | |
| `action` | Bản ghi: `CREATE`, `UPDATE`, `SUBMIT`, `APPROVE`, `REJECT`, `RESUBMIT`, `DELETE`, `IMPORT`, `RESET`. Đề xuất thay đổi: `CREATE_CHANGE`, `UPDATE_CHANGE`, `SUBMIT_CHANGE`, `RESUBMIT_CHANGE`, `APPROVE_CHANGE`, `REJECT_CHANGE`, `CANCEL_CHANGE`, `RESET_CHANGE` |
| `changes` | JSON `[{field, oldValue, newValue}]` với `field` là `cde`, `rank`, `elementType`, `generationType`, `creationMethod`, `timeliness`, `systemOwner`; CDE ghi cả mã CDE để đọc được sau khi identity bị lưu trữ |
| `actor`, `at` | |

`technical_binding_snapshot`: bản chụp bất biến các liên kết Column–CDE tại mỗi lần cutover DD. Chỉ chứa
bản ghi **`Approved` đã gán CDE**. Giữ **vĩnh viễn**, không có job dọn dẹp và không có API xóa, vì là căn cứ lịch sử
của DD đã lưu trữ.

| Cột | Ghi chú |
| --- | --- |
| `dataDictionaryVersion`, `recordId` | PK. `dataDictionaryVersion` là `N` của DD bị lưu trữ |
| `columnKey`, `cdeTermId` (NOT NULL), `cdeCode`, `cdeName`, `rank`, `columnFqn`, `frozenAt` | Mã/Tên CDE resolve lúc chụp; không resolve lại sau này |
| `payload` | JSON dòng phẳng đầy đủ tại thời điểm chụp, gồm nhãn tag và tên Team/User chủ quản |

Index phụ: `(cdeTermId)` cho endpoint `technicalAssets` của CDE đã lưu trữ.

`technical_outbox`: cột `kind` = `INDEX` (đồng bộ document), `PROJECTION` (tag trên Column theo `columnFqn`),
`RESET` (gỡ tag được quản lý trên mọi Column của các bản ghi vừa bị xóa khi làm mới); kèm `attempts`,
`lastError`, `enqueuedAt`.

Glossary hệ thống `Technical Dictionary` được giữ **chỉ làm đối tượng phân quyền** (§10): không có term,
không có `versioningMode`, không đăng ký trong `GovernedGlossaryProfileRegistry`.

## 5. Index `technical_dictionary_search_index`

### 5.1. Nguyên tắc

- Một document phẳng cho mỗi bản ghi, `_id = recordId`. Không có document cho Column chưa khai báo.
- Index do TD tự quản lý (tạo khi khởi động nếu chưa có, mapping riêng). **Không đăng ký** trong
  `indexMapping.json` để ứng dụng Reindex của OpenMetadata không cố dựng lại từ nguồn khác.
- Người có `canEdit` hoặc `canApprove` thấy cùng một danh sách gồm cả bản nháp, bản ghi chờ duyệt hoặc bị từ chối.
  Người chỉ có `canView` (Consumer) chỉ nhận `status = Approved` ở danh sách, thống kê và export;
  `GET /records/{id}` trả `404 TD_RECORD_NOT_FOUND` cho mọi trạng thái chưa Approved. History của Consumer loại
  các audit lifecycle proposal chưa có hiệu lực, còn metadata và payload proposal cũng bị loại khỏi read model.
  Không có hai view `current`/`published`.

### 5.2. Trường

| Nhóm | Trường | Kiểu | Dùng cho |
| --- | --- | --- | --- |
| Identity | `recordId`, `columnKey`, `dataDictionaryVersion`, `status` | keyword | lookup, trạng thái phê duyệt; truy vấn luôn lọc theo version đang gắn, phát hiện document sót sau làm mới |
| Vị trí Column | `columnFqn` | keyword (lowercase) | sort phụ sau Thứ hạng, match chính xác |
| | `service`, `database`, `schema`, `table`, `column` | keyword (lowercase) + text ngram | filter, search |
| | `dataType`, `description` | keyword / text | hiển thị, search mô tả |
| | `sourceStatus` | keyword | filter Tình trạng nguồn |
| CDE | `cde.id`, `cde.code`, `cde.name`, `cde.assignedAt`, `cde.assignedBy` | keyword + text | filter CDE, search Mã/Tên CDE, endpoint `technicalAssets`. `code`, `name` là bản CDE resolve khi dựng document |
| | `dataOwners[].id`, `dataOwners[].name` | keyword | Chủ sở hữu dữ liệu suy ra từ CDE; chỉ có trong API/index, giao diện không hiển thị |
| Đặc tả | `rank` | integer | hiển thị, cảnh báo trùng |
| | `elementType`, `generationType`, `creationMethod`, `timeliness` | keyword (tag FQN) + label | filter |
| | `systemOwners[].id`, `systemOwners[].name`, `systemOwners[].type` | keyword | filter, cột Chủ quản dữ liệu, trang chi tiết. Tên được làm tươi khi đọc (`TechnicalOwnerLabels`) |
| Khác | `revision` | long | UI gửi kèm khi ghi |
| | `submittedAt`, `submittedBy`, `reviewedAt`, `reviewedBy`, `reviewComment`, `createdBy` | date / keyword / text | trạng thái, quyết định duyệt và kiểm tra tự duyệt |
| | `hasPendingChange`, `changeRequestId`, `changeRequestStatus`, `changeOperation`, `changeCreatedBy` | boolean / keyword | đánh dấu bản ghi `Approved` đang có đề xuất (§7.4); không chứa nội dung đề xuất |
| | `updatedAt`, `updatedBy` | date / keyword | hiển thị |

Dữ liệu CDE (mã, tên, chủ sở hữu) được lưu sẵn trong document để search và hiển thị không phải truy
Postgres; §6.2 mô tả cách giữ nó đúng khi CDE thay đổi.

### 5.3. Truy vấn

- Server luôn tự dựng truy vấn; UI chỉ gửi tham số (`q`, các filter, `limit`, `offset`).
- Search `q`: khớp một phần (ngram) trên database, schema, bảng, cột, Mã CDE, Tên CDE.
- Filter trên UI: Trạng thái, Nguồn, Loại thành tố, Loại trường dữ liệu,
  Phương thức tạo, Thời gian. Filter tag gửi tag FQN. Giao diện không có filter Mã CDE quy chiếu, Tình trạng nguồn và Chủ quản dữ liệu; tham số `cdeMapping`, `cdeTermIds`, `sourceStatuses`, `systemOwnerIds` vẫn được API hỗ trợ.
- Với người có `canEdit`/`canApprove`, kết quả `search` được **mở rộng** sau truy vấn: bản ghi `Approved` có đề xuất `UPDATE` trở thành hai dòng cùng `termId` (`rowRole = APPROVED` rồi `rowRole = CHANGE` mang giá trị đề xuất và trạng thái của đề xuất). Đề xuất `DELETE` giữ một dòng. Filter trạng thái chỉ giữ nửa dòng có trạng thái khớp. Consumer không nhận dòng `CHANGE` và không nhận metadata đề xuất.
- API hỗ trợ thêm filter `statuses`; UI hiển thị nhanh `Tất cả / Bản nháp / Chờ duyệt / Đã duyệt / Bị từ chối` (không có `Bản nháp` với Consumer).
- Sort mặc định **Thứ hạng tăng dần (bản ghi chưa có Thứ hạng xếp cuối), rồi `columnFqn` tăng dần**, rồi `recordId`; phân trang `from/size`, `limit` chỉ nhận 10/15/25/50. Giới hạn
  10.000 kết quả đầu (`max_result_window`); vượt giới hạn cần thu hẹp filter.
- Thống kê (`/technical/stats`): Tổng cột, Bảng dữ liệu (cardinality `database.schema.table`), Hệ thống
  nguồn (cardinality `service`), Đã gán CDE (số document `Approved` có `cde.id`). **Giao diện hiện không hiển thị**
  (TD-D17); endpoint được giữ cho mục đích khác.

## 6. Đồng bộ Postgres → index và projection

### 6.1. Cơ chế

1. Thao tác ghi commit transaction trên Postgres, ghi sự kiện `INDEX`/`PROJECTION` vào `technical_outbox`
   **trong cùng transaction**.
2. Ngay sau commit, trong cùng request: xử lý sự kiện, đọc lại record từ Postgres, dựng document và ghi
   vào index với `refresh=wait_for` để lần tải lại bảng ngay sau đó thấy thay đổi.
3. Nếu bước 2 lỗi: sự kiện còn trong outbox, **không** rollback Postgres, request vẫn thành công.
4. Worker xử lý outbox khi khởi động server, định kỳ, và trước mỗi request đọc của TD.

Document luôn được dựng lại toàn bộ từ Postgres nên đồng bộ lặp lại là an toàn.

### 6.2. Điểm kích hoạt

Khai báo, phê duyệt, từ chối, gửi duyệt lại, sửa, xóa, commit Import (ghi hàng loạt), ingest làm Column đã khai báo đổi hoặc bị xóa, CDE của
`vN` được duyệt phiên bản minor mới (cập nhật Mã/Tên tìm qua `cde.id`), và làm mới TD (xóa toàn bộ).

### 6.3. Dựng lại index

- `POST /v1/glossaryTerms/technical/index/rebuild` (Admin).
- Dựng vào index vật lý mới, đọc `technical_record` theo keyset `id`, ghi hàng loạt, chuyển alias sang
  index mới rồi xóa index cũ; người dùng vẫn đọc index cũ trong lúc dựng. Tự chạy khi khởi động nếu index
  chưa tồn tại. Khối lượng chỉ là số Column đã khai báo.

### 6.4. Projection lên Column

- Chỉ bản ghi `Approved` mới được projection. Khi phê duyệt hoặc sửa bản ghi đã duyệt, sự kiện `PROJECTION`
  gán cho Column tag CDE (`Data Dictionary.<mã>@v<N>`) và bốn tag classification theo giá trị hiện tại.
  Bản ghi `Draft`/`In Review`/`Rejected`, bản ghi bị xóa hoặc nguồn `Unavailable` không mang các tag do TD quản lý.
- Cập nhật Table bằng **PATCH** (`EntityRepository.patch` với JSON Patch từ bản gốc sang bản mới), không dùng PUT
  (`update`). PUT hợp nhất tag mới với tag đang lưu nên không bao giờ gỡ được tag (RESET §9.2 và xóa bản ghi không
  có tác dụng) và đổi giá trị của một classification loại trừ nhau (ví dụ `DataTimeliness.T0` sang `T1`) bị từ
  chối với `Tag labels … are mutually exclusive`; mục outbox `PROJECTION` khi đó lỗi và được thử lại mãi.
- Nhãn gắn lên Column phải mang đủ `name`, `displayName`, `description` và `style` của tag (tra qua
  `TagLabelUtil.applyTagCommonFieldsGracefully`; với thuật ngữ CDE không tra được thì lấy mã CDE làm `name` và
  tên CDE làm `displayName`). Document search của Column được dựng từ nhãn như đã ghi, nên nhãn chỉ có `tagFQN`
  làm panel tóm tắt Column chỉ hiển thị icon, không có chữ. Document đã lập chỉ mới có tên sau khi Column được
  chiếu lại với thay đổi tag hoặc bảng được reindex.
- Projection quản lý mọi tag Glossary có tiền tố `Data Dictionary.` trên Column và các tag thuộc bốn
  classification; không xóa metadata ngoài allowlist.
- Survivorship rule chưa được projection: UI đọc `extension.survivorshipRules` của CDE. Khi có đích lưu,
  thêm vào `TechnicalColumnProjection`.

## 7. Liên kết CDE và Thứ hạng

### 7.1. Liên kết CDE

- Relation lưu `cdeTermId`, không lưu version; bao trùm mọi version `vN.x` của CDE (TD-D16).
- Endpoint `technicalAssets` và tab Tài sản chỉ đọc liên kết từ bản ghi `Approved`.
- Chỉ nhận CDE thuộc DD `vN` đang gắn và có ít nhất một snapshot `Approved` chưa bị thu hồi.
- Mã/Tên thành tố và Chủ sở hữu dữ liệu resolve theo snapshot `Approved` mới nhất của CDE trong `vN`.
- CDE bị thu hồi hết phiên bản Approved: bản ghi giữ liên kết, UI hiển thị mã CDE kèm cảnh báo
  **“CDE không còn phiên bản được phê duyệt.”** Lưu bản ghi đó bị từ chối cho tới khi đổi hoặc bỏ CDE.
- Selector CDE (`CDESelectableList`, mở từ biểu tượng sửa của trường Mã CDE trên trang chi tiết, và trong modal Thêm cột), mỗi CDE một option `Mã CDE · Tên thành tố`.
- Chưa có DD Approved (TDV-06): trang TD hiển thị **“Chưa có Từ điển dữ liệu dùng chung được phê duyệt.
  Từ điển kỹ thuật sẽ khả dụng sau khi phê duyệt phiên bản đầu tiên.”** Nút **Thêm cột** và Import bị ẩn.

### 7.2. Thứ hạng (survivorship rank)

Thứ hạng xác định Column nào được ưu tiên khi nhiều Column cùng quy chiếu một CDE.

- Số nguyên `1..999`, `1` là ưu tiên cao nhất; cho phép khoảng trống (`1, 3, 5`).
- Có CDE thì bắt buộc có Thứ hạng, không có CDE thì Thứ hạng phải trống.
- Duy nhất trong cùng CDE, xét trên các bản ghi `status = Approved` và `sourceStatus = Available`.
- Kiểm tra khi tạo/gửi lại để cảnh báo sớm và **kiểm tra lại trong transaction phê duyệt**. Hai bản ghi
  chờ duyệt có thể cùng hạng; bản được duyệt sau trả `409 TD_RANK_DUPLICATE` kèm cột đã giữ Thứ hạng đó.
  Với change request của bản ghi `Approved`, kiểm tra lại trong transaction phê duyệt đề xuất.
  Ghi có thể đổi CDE/Thứ hạng lấy khóa trước khi kiểm tra để hai lần lưu đồng thời không tạo trùng (§13.2).
- Import kiểm tra trạng thái cuối của các dòng `UPDATE` trên bản ghi `Approved` trong một transaction;
  trùng là lỗi dòng. `CREATE_RECORD` chỉ tạo `Draft`, nên trùng hạng với bản ghi đã duyệt là cảnh báo
  và sẽ được chặn nếu xung đột vẫn còn lúc phê duyệt. Muốn đổi chỗ Thứ hạng giữa hai cột đã duyệt, dùng
  Import hoặc sửa lần lượt qua một giá trị tạm.

### 7.3. Phê duyệt bản ghi mới

Luồng chỉ áp dụng cho lần khai báo đầu tiên của một Column:

1. Người có `canEdit` chọn Column trong modal **Thêm cột** (§11.4), nhập thông tin và bấm **Lưu nháp**. `POST /records` tạo bản ghi `Draft`,
   ghi `CREATE` và đồng bộ document vào index, nhưng chưa projection tag và chưa chờ duyệt. Người có `canEdit`
   sửa được bản nháp (vẫn là `Draft`) hoặc xóa nó trên trang chi tiết (§11.3).
1a. Người có `canEdit` mở bản nháp và bấm **Gửi phê duyệt** (hoặc đánh dấu nhiều bản nháp rồi **Gửi phê duyệt
   ({k})**, §11.6). `POST /records/{id}/submit` kiểm tra revision, trạng thái `Draft` và CDE còn gán được,
   chuyển sang `In Review`, ghi `submittedAt/submittedBy` và audit `SUBMIT`. Bản ghi `Rejected` không có thao tác gửi
   lại riêng: người khai báo sửa rồi lưu để gửi duyệt lại (mục 5), không có gửi lại hàng loạt. Người gửi không nhất thiết là người tạo;
   quy tắc tự duyệt vẫn tính theo `createdBy`.
2. Người có `canApprove`, đồng thời khác `createdBy`, rà soát và chọn **Phê duyệt** hoặc **Từ chối**.
3. **Phê duyệt** kiểm tra lại DD/CDE, Thứ hạng, revision và trạng thái trong cùng transaction; chuyển sang
   `Approved`, ghi audit `APPROVE`, rồi phát sự kiện `INDEX` và `PROJECTION`. Từ thời điểm này bản ghi có hiệu lực.
4. **Từ chối** không cần lý do; chuyển sang `Rejected`, ghi audit `REJECT`, cập nhật index và không projection.
5. Người tạo hoặc người có `canEdit` được sửa bản ghi `Draft`/`In Review`/`Rejected`. Lưu bản ghi `Rejected` đồng
   thời gửi duyệt lại: chuyển sang `In Review`, xóa quyết định duyệt cũ khỏi trạng thái hiện hành nhưng giữ
   trong audit, cập nhật `submittedAt/submittedBy` và ghi `RESUBMIT`.
6. **Xử lý hàng loạt.** Người dùng đánh dấu nhiều dòng của trang đang xem rồi chọn **Gửi duyệt** (`canEdit`, chỉ
   các dòng `Draft`), **Phê duyệt** hoặc **Từ chối** (`canApprove`, chỉ các dòng `In Review` do người khác tạo)
   (§11.6). `POST /records/bulk/submit`, `/bulk/approve` và
   `/bulk/reject` nhận tối đa 100 bản ghi; mỗi bản ghi chạy trong **transaction riêng** qua đúng luật
   xử lý từng bản ghi (revision, trạng thái, tự duyệt, DD/CDE, Thứ hạng), nên một bản ghi lỗi không làm hỏng các
   bản ghi khác. Kết quả trả theo từng bản ghi, đúng thứ tự yêu cầu; audit ghi `SUBMIT`/`APPROVE`/`REJECT` cho từng bản ghi
   và outbox được xử lý một lần sau bản ghi cuối.

Người tạo không được tự phê duyệt kể cả khi đồng thời có `canApprove`; API trả `403 TD_SELF_APPROVAL_FORBIDDEN`.
Bản nháp không có hiệu lực và không bị giới hạn thời gian; chỉ người có `canEdit` hoặc `canApprove` thấy nó
(§5.1). Bản ghi `Approved` không đổi trạng thái khi có proposal; metadata `hasPendingChange` trên read model
cho biết proposal Draft/InReview/Rejected nhưng không chứa nội dung đề xuất.
Đây là state machine riêng, nhẹ của TD; không đưa TD trở lại `GovernedGlossaryProfileRegistry` và không
dùng version/bảng working-published của Governed Glossary.

### 7.4. Thay đổi bản ghi đã phê duyệt

`technical_record` luôn giữ giá trị Approved đang có hiệu lực. Mỗi record có tối đa một dòng
`technical_record_change_request` gồm `operation` (`UPDATE`/`DELETE`), `baseRevision`, payload đề xuất,
revision và trạng thái `Draft`/`InReview`/`Rejected`. Maker lưu nháp rồi gửi duyệt; checker khác `createdBy`
phê duyệt hoặc từ chối. Approve khóa cả record và proposal, kiểm tra `baseRevision`, CDE và Thứ hạng, sau đó
áp dụng nguyên tử, tăng revision, ghi `APPROVE_CHANGE` và enqueue INDEX/PROJECTION. Reject không thay đổi
record hay projection. Proposal stale trả `409 TD_CHANGE_REQUEST_STALE`.

Import cập nhật record Approved chỉ tạo/cập nhật proposal Draft, không tự submit/approve. Preview trả lỗi theo
dòng nếu proposal đang `InReview` và ghim cả record revision lẫn change-request revision để commit không ghi đè
proposal đã đổi sau preview. Cutover DD ghi
`RESET_CHANGE`, xóa proposal trước khi xóa record để không để lại dữ liệu mồ côi.

Trên giao diện (§11.3): **Sửa phiên bản** tạo đề xuất `UPDATE` ở `Draft` sao chép giá trị đã duyệt rồi mở `view=working` để sửa từng trường;
**Đề nghị xóa** gọi `POST /records/{id}/deletion-request`: tạo đề xuất `DELETE` và gửi duyệt (`InReview`) trong cùng transaction, không có bước Draft; bản ghi Approved và tag trên Column giữ hiệu lực tới khi duyệt. Phê duyệt xóa bản ghi, gỡ tag CDE/phân loại được quản lý trên Column và có thể kích hoạt reconcile kiểm thử DQ; audit vẫn giữ. **Hủy bản nháp thay đổi** gọi `DELETE /change-request`. Danh sách hiển thị bản đã duyệt và bản đề xuất thành hai dòng (§5.3, §11.2).

### 7.5. Rút lại yêu cầu

Chỉ người gửi, chỉ khi yêu cầu đang `InReview`:

- Bản ghi mới: `POST /records/{id}/withdraw` (body `{"expectedRevision": n}`) đưa về `Draft`, giữ nội dung.
- Đề xuất sửa/xóa: `POST /records/{id}/change-request/withdraw` xóa đề xuất, ghi audit `WITHDRAW_CHANGE`; bản Approved không đổi.

Người khác gọi trả `403`; sai trạng thái trả `409 TD_INVALID_STATUS_TRANSITION`.

## 8. Column nguồn thay đổi

- Ingest làm đổi kiểu, độ dài hoặc mô tả Column: cập nhật thẳng các trường nguồn của bản ghi, ghi audit
  `UPDATE` với actor hệ thống.
- Column bị xóa, hoặc Table/Column đổi tên: `sourceStatus = Unavailable`. Bản ghi được giữ lại, không tham
  gia Thứ hạng và không projection. Bảng hiển thị badge **Nguồn không còn**. Người dùng xóa bản ghi đó hoặc
  khai báo Column mới (TD-D14).
- Table bị soft-delete được xử lý như mọi Column của Table không còn; restore Table hoặc Column đặt lại
  `sourceStatus = Available`.

## 9. Cutover Từ điển dữ liệu — làm mới TD

### 9.1. Trong transaction phê duyệt DD `vN+1`

Sau khi DD đã phê duyệt nguyên tử các CDE và publish `vN+1`, trong **cùng transaction**:

1. Khóa `FOR UPDATE` dòng `technical_dictionary_state`.
2. Chụp các bản ghi có `status = Approved AND cdeTermId IS NOT NULL` vào `technical_binding_snapshot`, kèm mã/tên CDE resolve
   theo snapshot `Approved` mới nhất của `vN`, nhãn tag, Team/User chủ quản và `frozenAt`.
3. Ghi một dòng audit `RESET` cho **mỗi** bản ghi, kể cả chưa gán CDE (danh sách Column cần gỡ tag).
4. Xóa toàn bộ `technical_record`.
5. Cập nhật `technical_dictionary_state`: `dataDictionaryVersion = N+1`, `previousDataDictionaryVersion = N`,
   `resetAt`, `resetBy`.
6. Ghi sự kiện `RESET` vào `technical_outbox`.

Lỗi ở bất kỳ bước nào làm rollback toàn bộ phê duyệt DD. Khối lượng là số cột đã khai báo, tối đa khoảng
65k dòng, nằm trong giới hạn transaction chấp nhận được.

### 9.2. Sau commit (outbox, idempotent)

- `RESET`: duyệt các dòng audit `RESET` của lần làm mới đó theo từng Table (không dùng bản chụp, vì bản
  chụp không có bản ghi chưa gán CDE nhưng Column của chúng vẫn mang tag classification), gỡ tag CDE
  `Data Dictionary.*` và bốn tag classification do TD quản lý. Mỗi Table một lần cập nhật.
- Xóa toàn bộ document trong index.

### 9.3. Ghi đồng thời với cutover

- Mọi thao tác ghi TD mở transaction bằng khóa `FOR SHARE` trên `technical_dictionary_state` và kiểm tra CDE
  thuộc đúng `dataDictionaryVersion` đang gắn. Cutover giữ `FOR UPDATE`, nên một thao tác ghi hoặc commit
  trước cutover (và được chụp lại), hoặc chạy sau cutover trên TD đã làm mới.
- Sau cutover, sửa/xóa bản ghi đã bị xóa trả `404 TD_RECORD_NOT_FOUND`; UI báo **“Từ điển kỹ thuật đã được
  làm mới theo Từ điển dữ liệu dùng chung v{N+1}.”** và tải lại trang.
- Gán CDE của `vN` sau cutover trả `409 TD_CDE_SCOPE_NOT_ACTIVE`.
- Import session lưu `dataDictionaryVersion` lúc preview; commit khi version đã đổi trả `409 TD_IMPORT_SESSION_INVALID`.

### 9.4. Cảnh báo trước khi phê duyệt DD

- `GET /v1/glossaries/{ddId}/working/publish-preview` bổ sung `technicalDictionary: { declaredColumns, mappedColumns }`.
- Hộp xác nhận phê duyệt DD hiển thị: **“Phê duyệt sẽ làm mới Từ điển kỹ thuật: {declaredColumns} cột đã khai
  báo ở mọi trạng thái sẽ bị xóa. {mappedColumns} cột đã duyệt và gán CDE được lưu vào bản chụp của phiên bản v{N}; các cột chưa duyệt hoặc chưa gán
  CDE không được lưu. Hãy xuất Từ điển kỹ thuật trước nếu cần giữ lại.”** kèm nút **Xuất Từ điển kỹ thuật**.

## 10. Phân quyền

| Capability | Ý nghĩa | Nguồn |
| --- | --- | --- |
| `canView` | Xem danh sách, trang chi tiết, bản chụp. Lịch sử thay đổi chỉ gồm các sự kiện đã có hiệu lực với Consumer (§5.1) | Policy `ViewAll`/`ViewBasic` trên glossary `Technical Dictionary` |
| `canEdit` | Khai báo (bản nháp), sửa, gửi duyệt, gửi duyệt lại, xóa bản nháp, đề nghị sửa/xóa, rút lại yêu cầu của mình | Policy `EditAll` hoặc `EditGlossaryTerms` trên glossary `Technical Dictionary` |
| `canApprove` | Phê duyệt hoặc từ chối bản ghi mới | `DATA_STEWARD`, Admin hoặc policy `ApproveWorking`; vẫn phải khác người tạo |
| `canImport` | Import | Bằng `canEdit` |
| `canExport` | Export danh sách và bản chụp | Theo quyền Export chung (API spec §2.1) |

- Mọi người xem thấy cùng một dữ liệu, trừ bản nháp và tab **Yêu cầu** chỉ hiện với người có `canEdit` hoặc `canApprove`. Runtime hiện tại: `canEdit` theo policy (thực tế gồm `DataProposer`, `DataSteward`, `Admin`); `canApprove` cấp cho `DataSteward` và `Admin`. Ma trận nghiệp vụ chuẩn chỉ cho `DataProposer` có `W`, `DataSteward` có `A`, `DataConsumer` có `R`, `BasicConsumer` không truy cập; khoảng cách theo dõi ở `GAP-TD-02` của [đặc tả API](../api/openmetadata-governed-api-specification.md). Các role nghiệp vụ dùng Portal; `Admin` dùng OM UI. Kiểm tra maker-checker áp dụng độc lập với role: actor có
  cả hai quyền vẫn không được duyệt bản ghi do chính mình tạo.
- Quyền ghi luôn được kiểm tra lại trên Postgres; nút Sửa trên UI không phải căn cứ cho phép ghi.
- `GET /v1/glossaryTerms/technical/context` trả các capability gồm `canApprove`, DD đang gắn và `resetAt`.

## 11. Giao diện

### 11.1. Route, header và chế độ xem

```text
/technical-dictionary                         danh sách (có thể nhúng trong trang glossary `Technical Dictionary`)
/technical-dictionary/import                  Import (§12.2)
/technical-dictionary/:termId?businessVersion=v&view=working   chi tiết bản ghi (§11.3)
```

`termId` là `recordId`. `businessVersion` là phiên bản DD đang xem (mặc định là phiên bản đang gắn); `view=working` mở
bản đề xuất thay đổi của bản ghi `Approved` (§7.4). Trang danh sách cũng được `GlossaryTermTab` hiển thị (`isEmbedded`)
khi người dùng mở glossary hệ thống `Technical Dictionary`; bản nhúng không có header riêng và đặt nút **Thêm cột** ở thanh công cụ của bảng.

```text
Quản trị / Từ điển kỹ thuật

[Icon] Từ điển kỹ thuật  [Phiên bản: vN — Đã duyệt ▾]                         [Thêm cột] [⋯]
       Technical Dictionary [copy]
[ Trường dữ liệu  {tổng} ]
┌────────────────────────────────────────────────────────────────────────────────────┐
│ [Tìm kiếm] [Trạng thái] [Nguồn] [Loại TT] [Loại trường] [Phương thức] [Thời gian] [Tùy chỉnh] │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Tên trường │ Nguồn │ Mã CDE │ ... │ Mô tả │ Trạng thái                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Header gồm tiêu đề, **bộ chọn phiên bản** (`TechnicalVersionBadges`: phiên bản đang gắn trạng thái Đã duyệt, rồi các
  DD đã lưu trữ có bản chụp), dòng phụ là tên glossary kèm nút sao chép, và một thẻ tab **Trường dữ liệu** kèm tổng số
  bản ghi. Không có thẻ thống kê (TD-D17). Phiên bản chỉ là bộ chọn xem lại; bản đang gắn vẫn là TD hiện hành duy nhất (TDV-01).
- **Xem bản chụp** (chọn phiên bản đã lưu trữ, hoặc nút **Xem bản chụp v{N-1}** ở banner): danh sách đọc
  `GET /technical/snapshots/{v}/records` — chỉ đọc, chỉ có ô tìm kiếm, không checkbox, không **Thêm cột**, hàng mở trang chi tiết của bản chụp.
- Nút **Thêm cột** (`canEdit`, có DD đang gắn, không ở chế độ bản chụp) nằm ở header (trang độc lập) hoặc thanh công cụ (bản nhúng).
- Menu `⋯`: **Xuất Excel** (`canExport`), **Nhập gán CDE** (`canImport`), **Bản chụp các phiên bản trước** (§12.3), **Dựng lại index** (Admin).
  Hai mục đầu chỉ có khi đã có DD đang gắn. Menu dùng đúng kiểu menu quản lý của OpenMetadata (như header glossary): mỗi mục có icon,
  tên và một dòng mô tả (`ManageButtonItemLabel`), rộng 350px, đóng lại sau khi chọn.
- Banner sau lần làm mới, hiển thị tới khi người dùng đóng hoặc sau 30 ngày: **“Từ điển kỹ thuật đã được làm
  mới ngày {resetAt} khi Từ điển dữ liệu dùng chung v{N} được phê duyệt.”** kèm hai nút **Xem bản chụp v{N-1}** và **Tải bản chụp v{N-1}**
  (để nhập lại các cột đã duyệt và gán CDE).
- Trạng thái trống: **“Chưa có cột nào được khai báo”**; hành động nằm ở nút **Thêm cột** và mục **Nhập gán CDE** trong menu `⋯`.

### 11.2. Bảng

Checkbox chọn hàng dùng để gửi duyệt/duyệt hàng loạt (§11.6). Bảng **không có cột Hành động**: bấm vào một dòng hoặc tên trường mở trang chi tiết (§11.3).

| Cột | Mặc định | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| **Tên trường** | Hiện, cố định trái, không tắt được | Hệ thống | Tên cột (bấm mở chi tiết) và dòng đường dẫn `Database / Schema / Bảng`, mỗi đoạn là liên kết tới thực thể trong OpenMetadata |
| Nguồn | Hiện | Hệ thống | `service`; kèm badge **Nguồn không còn** khi `sourceStatus = Unavailable` |
| Mã CDE quy chiếu | Hiện | Người dùng | Tùy chọn. Bấm sẽ tra FQN của CDE theo `termId` (`GET /v1/glossaryTerms/{id}`) rồi mở trang chi tiết thuật ngữ |
| Tên thành tố CDE | Hiện | Suy ra | Read-only |
| Thứ hạng | Hiện | Người dùng | Badge survivorship, §7.2 |
| Loại dữ liệu | Hiện | Hệ thống | |
| Chủ quản dữ liệu | Hiện | Người dùng | Tên các Team/User của TD-D11, nối bằng dấu phẩy |
| Loại thành tố, Loại trường dữ liệu, Phương thức tạo, Thời gian | Hiện | Người dùng | Bốn tag classification (§3.3), hiển thị dạng thẻ màu |
| Mô tả | Hiện | Hệ thống | TD-D13 |
| **Trạng thái** | Hiện, cố định, không tắt được | Hệ thống | Badge `Bản nháp` / `Chờ duyệt` / `Đã duyệt` / `Bị từ chối`. Bản ghi `Approved` có đề xuất kèm thẻ `Có bản nháp thay đổi` / `Thay đổi chờ duyệt` / `Thay đổi bị từ chối` / `Chờ duyệt xóa` |
| Cập nhật lúc, Cập nhật bởi | Ẩn | Hệ thống | Tùy chọn qua **Tùy chỉnh** |

- Không có cột Chủ sở hữu dữ liệu (suy ra từ CDE, chỉ còn trong API/index). Khóa lưu cấu hình cột `technicalDictionary.v6`; đổi khóa
  để cấu hình cũ không bị áp dụng lại khi bố cục thay đổi.
- Thứ tự dòng cố định do server: Thứ hạng tăng dần (chưa có Thứ hạng xếp cuối), rồi `columnFqn` (§5.3). Bấm tiêu đề cột không đổi thứ tự.
- **Hai dòng cho một bản ghi đang được đề xuất sửa** (§5.3): dòng giá trị đã duyệt rồi dòng đề xuất với trạng thái
  của đề xuất. Cả hai mở cùng trang chi tiết; dòng đề xuất mở ở chế độ `view=working`.
- Giá trị thiếu hiển thị `--`. Phân trang số trang với `limit` 10/15/25/50, mặc định 25.
- Filter đặt trực tiếp trên thanh công cụ: Trạng thái (`Bản nháp` chỉ có với `canEdit`/`canApprove`), Nguồn, Loại thành tố,
  Loại trường dữ liệu, Phương thức tạo, Thời gian. Kết hợp filter, reset page, chống stale response; filter khác mặc định đồng bộ URL.

### 11.3. Trang chi tiết bản ghi

Thay cho modal xem/sửa/duyệt trước đây. Bố cục giống trang chi tiết của Từ điển dữ liệu: breadcrumb `Từ điển kỹ thuật / {Tên cột}`, header
(tên cột, bộ chọn phiên bản, `columnFqn` kèm nút sao chép, nút hành động), hai tab **Tổng quan** và **Lịch sử thay đổi**.

- **Tổng quan**: khối **Mô tả** (từ Column, TD-D13) rồi ba nhóm:
  - *Thông tin nguồn*: Nguồn, Bảng nguồn (`database / schema / table`), Loại dữ liệu, **Chủ quản dữ liệu** (chọn nhiều Team/User).
  - *Tham chiếu CDE*: Mã CDE (liên kết tới CDE), Tên thành tố (tự điền), Thứ hạng (sửa tại chỗ, `1..999`).
  - *Đặc tả kỹ thuật*: Loại thành tố, Loại trường dữ liệu, Phương thức tạo, Thời gian.
- **Sửa từng trường tại chỗ**: mỗi trường editable có biểu tượng sửa riêng, lưu ngay khi chọn xong và gửi `expectedRevision`; xung đột
  (`TD_RECORD_REVISION_CONFLICT`, `TD_CHANGE_REQUEST_STALE`) báo người khác đã cập nhật và tải lại. Gán CDE khi chưa có Thứ hạng bị chặn bằng thông báo yêu cầu Thứ hạng. Sửa được khi bản ghi là
  `Draft`/`Rejected` (hoặc đang xem bản đề xuất `Draft`/`Rejected`) và người dùng có `canEdit`; bản `Approved` hoặc `In Review` chỉ đọc. Lưu bản `Rejected` gửi duyệt lại (§7.3).
- **Hành động ở header** (không áp dụng khi đang xem bản chụp):

| Điều kiện | Nút |
| --- | --- |
| `Draft`, `canEdit` | **Gửi phê duyệt** |
| `In Review`, `canApprove`, khác người tạo | **Từ chối** (viền đỏ), **Phê duyệt** — mở hộp xác nhận §11.6 với một bản ghi |
| `Approved`, chưa có đề xuất, `canEdit` | **Sửa phiên bản** (tạo đề xuất `UPDATE` ở `Draft`, chuyển sang `view=working`) |
| Menu `⋯` | `Draft`/`Rejected`: **Xóa khai báo**; `Approved`: **Đề nghị xóa** (đề xuất `DELETE`); đề xuất đang mở: **Hủy bản nháp thay đổi** |

  Xóa bản chưa Approved có hiệu lực ngay (TDV-07); mọi thao tác trên bản `Approved` đi qua đề xuất (§7.4). Đề xuất `DELETE` chỉ đọc.
- **Lịch sử thay đổi** (`TechnicalHistoryPanel`, `GET /records/{id}/history`, 10 dòng/trang): thời gian, người thực hiện, hành động và từng thay đổi `giá trị cũ → mới`. Ẩn khi xem bản chụp.
- **Xem bản chụp**: bộ chọn phiên bản liệt kê các DD đã lưu trữ từng có Column này (`GET /records/{id}/versions`, kèm `currentRecordId`). Chọn một phiên bản nạp `GET /snapshots/{v}/records/{id}` ở trạng thái `Archived`, chỉ đọc, không có tab Lịch sử,
  có nút **Tải bản chụp v{K}**; chọn lại phiên bản hiện tại thì về `currentRecordId`.
- Bản ghi đã bị làm mới hoặc xóa trả `404 TD_RECORD_NOT_FOUND`: trang báo không tìm thấy và quay lại danh sách.

### 11.4. Thêm cột

Nút **Thêm cột** (khi có `canEdit`) mở **modal Thêm cột** (`TechnicalRecordModal` ở chế độ `create`; modal còn mã cho các chế độ xem/sửa/duyệt nhưng giao diện không còn dùng). Ô **Chọn cột**
ở đầu form tìm theo tên bảng hoặc tên cột, hiển thị `Bảng · Cột`, kiểu dữ liệu, `service / database / schema`
(Column đã khai báo hiển thị mờ kèm nhãn **Đã khai báo**, không chọn được). Chọn Column tự điền các trường nguồn chỉ đọc (Database, Schema, Bảng, Cột, Nguồn, Loại dữ liệu, Mô tả);
nhóm **Quy chiếu và đặc tả** gồm Mã CDE (Tên thành tố tự điền), Thứ hạng và bốn tag classification. **Chủ quản dữ liệu không nhập ở modal**; đặt sau trên trang chi tiết hoặc qua Import.
**Lưu nháp** bị khóa tới khi đã chọn Column, và tạo bản ghi ở trạng thái `Draft`; bản ghi chưa chờ duyệt và
chỉ có hiệu lực sau khi được gửi duyệt rồi phê duyệt (§7.3). Mỗi lần khai báo một Column; khai
báo hàng loạt dùng Import. Tìm Column dùng `column_search_index` (chỉ đọc) kèm index TD để đánh dấu Column đã khai báo.
Khai báo Column đã có bản ghi: `TD_COLUMN_ALREADY_DECLARED`, modal báo và tải lại danh sách ứng viên.

### 11.5. Tab Tài sản của CDE

- Tab dùng **giao diện gốc của OpenMetadata** (`AssetsTabs` trong bố cục hai panel). Có hai nguồn dữ liệu:

| Cách xem CDE | Tab | Nguồn danh sách |
| --- | --- | --- |
| CDE của DD đang hiệu lực, xem bản hiện hành | Tab Tài sản gốc, có huy hiệu đếm | Column mang tag CDE (`Data Dictionary.<mã>@v<N>`) do projection §6.4 gắn lên, tìm theo `tags.tagFQN` |
| Xem một phiên bản của CDE (view version), gồm CDE của DD đã lưu trữ | Tab Tài sản do TD thêm vào, không có huy hiệu đếm | `GET /v1/glossaryTerms/{cdeId}/technicalAssets`: danh sách hiện hành, hoặc `technical_binding_snapshot` theo `(K, cdeTermId)` với DD đã lưu trữ |

- Tab gốc không có Tài sản khi xem phiên bản, và tag của DD đã lưu trữ bị gỡ khi làm mới TD (§9.2), nên nếu không
  thêm tab thì CDE của DD đã lưu trữ không có chỗ xem liên kết cột. Tab thêm vào nạp sẵn dữ liệu vào `AssetsTabs`
  (`skipSearch` + `preloadedData`, `selectFirstAsset = false`). Mỗi dòng lấy **document Column thật** trong
  `column_search_index` theo `columnFqn` (nên thẻ, icon service và panel tóm tắt đầy đủ như tab gốc); chỉ khi Column
  không còn trong index mới dựng document giả từ dòng đã chụp (Table cha, service, database, schema, kiểu dữ liệu).
  Nhãn/thuật ngữ trong panel là trạng thái hiện tại của Column, không phải lúc chụp.
- Banner theo nguồn: **“Danh sách cột được gán tại thời điểm Từ điển dữ liệu dùng chung v{K} được lưu trữ ({frozenAt}).
  Chỉ đọc.”** khi là bản chụp; **“Liên kết cột sẽ khả dụng sau khi Từ điển dữ liệu dùng chung v{N+1} được phê
  duyệt.”** khi DD chưa được phê duyệt.
- Chỉ đọc: không có nút thêm/gỡ tài sản; việc gán CDE thực hiện ở Từ điển kỹ thuật.
- Tối đa 100 Column mỗi CDE (giới hạn của endpoint), hiển thị một trang. Ô tìm kiếm và bộ lọc nhanh chưa tác động
  lên danh sách nạp sẵn. Thứ tự theo rule survivorship của CDE rồi tên, như tab gốc.
- **Badge Hạng N** trên từng Column: với thuật ngữ thuộc glossary Data Dictionary, `AssetsTabs` gọi `technicalAssets` và gộp `rank` của từng bản ghi TD vào danh sách rule survivorship (bên cạnh `extension.survivorshipRules` cũ), nên badge hiện và danh sách xếp theo hạng ở cả tab gốc lẫn tab TD thêm vào (tab TD gắn `rank` vào `extension.survivorshipRank` của document).
- Không còn các cột Gán lúc, Gán bởi và badge **Nguồn không còn**; Column có nguồn `Unavailable` được đánh dấu đã xóa.
- Panel tóm tắt Column bên phải là của OpenMetadata; các chip **Nhãn** và **Mục thuật ngữ** trong `TagsSection` và
  `GlossaryTermsSection` có tooltip (thuộc tính `title`) hiện tên và mô tả của tag. Thay đổi này dùng chung cho
  mọi nơi dùng hai component đó.

### 11.6. Gửi duyệt và duyệt hàng loạt

- **Thanh xử lý hàng loạt** (`BulkSelectionBar`, component dùng chung với trang Chất lượng dữ liệu) **thay chỗ hàng
  toolbar** (tìm kiếm, bộ lọc, Tùy chỉnh): thanh nằm trong cùng hàng, cùng padding và chiều cao như toolbar nên bảng
  không bị đẩy xuống; bỏ chọn hết thì toolbar quay lại. Thanh hiện khi người dùng có `canEdit` hoặc `canApprove` và đã đánh dấu ít nhất một dòng.
  Nền trắng như toolbar, không có khối màu riêng. Từ trái sang: `Đã chọn {n} bản ghi` (đậm) · một chip cho mỗi trạng
  thái đang có trong lựa chọn (`{x} Bản nháp`, `{y} Chờ duyệt`, `{w} Đã từ chối`, `{z} Đã phê duyệt`, màu như badge trạng thái) ·
  `Bỏ chọn` (link xám gạch chân). Bên phải: **Gửi phê duyệt ({k})**, **Từ chối ({m})** (viền đỏ), **Phê duyệt ({m})**.
  `k` là số dòng đã chọn đang là `Draft` (`canEdit`); `m` là số dòng thỏa điều kiện duyệt (`In Review`, không phải người
  tạo, `canApprove`). **Chỉ hiện nút có ít nhất một bản ghi áp dụng**, không hiện nút bị khóa; nếu không có nút nào thì
  hiện dòng chữ xám `Không có thao tác cho các bản ghi đã chọn`. **Phê duyệt** là nút chính (đỏ đậm); **Gửi phê duyệt**
  chỉ là nút chính khi không có nút Phê duyệt, còn lại là nút phụ (viền xám). Các dòng không áp dụng không được gửi
  đi và không có chú thích riêng. Hai trang dùng chung chữ **Gửi phê duyệt** và **Bỏ chọn**.
- Lựa chọn chỉ trong trang đang xem và bị xóa khi đổi trang, đổi bộ lọc hoặc tìm kiếm, và sau khi xử lý xong.
  Người không có `canEdit` lẫn `canApprove` vẫn thấy checkbox nhưng không có thanh này.
- **Hộp xác nhận** là component dùng chung `ReviewActionConfirmModal`, cũng được dùng ở Từ điển dữ liệu dùng chung
  và Chất lượng dữ liệu (hộp xác nhận hàng loạt và hộp xác nhận ở header thuật ngữ), nên cả ba nơi giống hệt nhau:
  tiêu đề `Xác nhận gửi phê duyệt` / `Xác nhận phê duyệt` / `Xác nhận từ chối` kèm nút ✕ góc trên bên phải, không
  có icon, không có danh sách bản ghi; thân là một câu hỏi (ví dụ `Bạn có chắc chắn muốn gửi phê duyệt {k} bản ghi
  đang ở trạng thái Bản nháp sang trạng thái Chờ duyệt?`); footer góc dưới bên phải gồm **Hủy** và **Xác nhận** cách
  nhau 8px (**Xác nhận** màu đỏ cảnh báo khi từ chối). Không có ô lý do.
- Xử lý một bản ghi từ trang chi tiết (bản nháp có nút **Gửi phê duyệt**; bản ghi chờ duyệt có **Từ chối** · **Phê duyệt**) gọi API từng bản ghi
  (§13.1), hoặc API `change-request` nếu đang xem bản đề xuất; xử lý từ thanh hàng loạt gọi API hàng loạt.
- **Dòng đề xuất thay đổi (§7.4) cũng chọn và xử lý hàng loạt được.** Dòng `CHANGE` mang trạng thái của đề xuất nên tính vào `k` khi là `Draft`
  và vào `m` khi `InReview` do người khác tạo (`changeCreatedBy`). Vì không có endpoint hàng loạt cho đề xuất, các dòng này đi qua API
  `change-request/submit|approve|reject` từng dòng song song, còn bản ghi thường vẫn đi qua endpoint hàng loạt; kết quả được gộp lại theo đúng thứ tự dòng đã chọn.
  Dòng `Approved` (nửa đã duyệt của bản ghi có đề xuất) không có thao tác. Người duyệt muốn xem so sánh trước khi quyết định thì mở trang chi tiết `view=working`.
- **Kết quả:** tất cả thành công thì hiện toast `Đã phê duyệt {m} bản ghi` / `Đã từ chối {m} bản ghi` và tải lại danh
  sách. Có bản ghi lỗi thì hiện modal kết quả cùng kiểu modal chuẩn (tiêu đề `Đã phê duyệt {x}/{m} bản ghi` kèm nút ✕, danh sách từng bản
  ghi với ✓ hoặc ✕ kèm thông báo lỗi của máy chủ, cuộn được, nút **Đóng**); bản ghi lỗi giữ nguyên trạng thái trước đó (`Draft` hoặc `In Review`). Lỗi của
  cả yêu cầu (ví dụ không có quyền) hiện toast lỗi và giữ nguyên lựa chọn.

### 11.7. Tab Yêu cầu

Trang Từ điển kỹ thuật có hai tab: **Bản ghi** (bảng §11.2) và **Yêu cầu** kèm số yêu cầu chờ. Tab Yêu cầu hiện khi có `canEdit` hoặc `canApprove` và dùng component chung `PendingRequestsTab` (như Từ điển dữ liệu dùng chung, Chất lượng dữ liệu) với adapter `useTechnicalPendingRequestsAdapter`.

- **Nguồn:** `GET /v1/glossaryTerms/technical/requests?q=&types=&requesters=&sourceServices=&cdeTermIds=&limit=&offset=` (`canView`; `limit` 1..100). Server đọc một lần mọi bản ghi mới `In Review` và đề xuất `In Review` từ Postgres, không truy vấn từng yêu cầu.
- **Loại yêu cầu:** `Thêm mới` (bản ghi mới), `Sửa` (đề xuất `UPDATE`, mở rộng dòng hiện **Hiện hành / Đề xuất** từng trường), `Xóa` (đề xuất `DELETE`, cảnh báo gỡ mapping trên Column).
- **Thao tác:** `canApprove` phê duyệt/từ chối (không với yêu cầu của chính mình); người gửi **Rút lại**. Bản ghi mới đi qua `/records/bulk/*`, đề xuất đi qua `/change-request/{approve|reject|withdraw}` từng dòng; kết quả gộp theo thứ tự đã chọn, lỗi từng phần hiện theo dòng.

## 12. Import và Export

### 12.1. Export

- Xuất toàn bộ danh sách (duyệt index bằng point-in-time). Thứ tự dòng của file theo `columnFqn`, không theo Thứ hạng như bảng trên giao diện.
- Tên file `TuDienKyThuat_Agribank_TDDLv{N}_YYYYMMDD_HHmm.xlsx`, sheet `Technical Dictionary`; `v{N}` là phiên
  bản DD đang gắn để file tự nói rõ mã CDE thuộc DD nào. Không chứa UUID, `columnKey` hoặc FQN kỹ thuật.
- File Excel gồm **14 cột** (`TechnicalExcelExporter.HEADERS`): Tên cơ sở dữ liệu, Tên Schema, Tên Bảng, Tên cột, Nguồn, Mã CDE quy chiếu,
  Tên thành tố CDE, Thứ hạng, Loại dữ liệu, Loại thành tố, Loại trường dữ liệu, Phương thức tạo, Thời gian, Mô tả. Giữ bốn cột vị trí riêng
  (khác cột **Tên trường** gộp trên bảng) và không có cột Chủ quản dữ liệu hay Chủ sở hữu dữ liệu (TD-D17).
  File Export vẫn Import được vì Import chỉ cập nhật các cột editable có mặt trong file (§12.2); không
  đổi được Chủ quản dữ liệu qua file Export, chỉ qua template Import hoặc trang chi tiết.
  Export không đọc bản đề xuất: file chứa giá trị của index, tức giá trị đã duyệt cùng các bản ghi chưa duyệt (với người có `canEdit`/`canApprove`).

### 12.2. Import

Khung session: template → preview → commit, dùng một lần, gắn actor, TTL 30 phút, file hash, commit nguyên
tử, kiểm tra lại quyền. Dùng **trang riêng** `/technical-dictionary/import` (nút Nhập Excel ở menu `⋯` điều hướng tới),
cùng bố cục với trang nhập CDE của Từ điển dữ liệu dùng chung: breadcrumb, stepper 3 bước.

1. **Tải lên Tệp Excel**: cảnh báo mô tả, nút Tải template, vùng kéo thả `.xlsx`. File được đọc ở trình duyệt (`xlsx`).
2. **Xem trước & Sửa**: lưới `react-data-grid` (style `om-rdg`) có thể sửa, copy/paste, undo/redo, **Thêm hàng**. **Tiếp theo**
   đóng các dòng đã sửa (bỏ dòng trống) thành file Excel mới và gọi preview của server.
3. **Cập nhật**: dải tóm tắt số dòng lỗi/hợp lệ, bộ lọc Tất cả/Bị lỗi/Hợp lệ, lưới chỉ đọc thêm cột Trạng thái và Chi tiết
   (lỗi, cảnh báo hoặc nhãn action). Dòng ghép với kết quả server theo số dòng trong file gửi đi (dòng dữ liệu đầu là 2).
   **Cập nhật** chỉ bật khi `canCommit`; commit một lần cho cả file rồi hiện màn hình kết quả.

- Match theo `Tên cơ sở dữ liệu + Tên Schema + Tên Bảng + Tên cột` (và `Nguồn` nếu có). Match nhiều bản ghi là lỗi dòng.
- Action preview: `CREATE_RECORD` (Column chưa khai báo, tra qua `column_search_index`), `UPDATE`, `NO_CHANGE`, `ERROR`.
- Khi commit, mọi `CREATE_RECORD` được tạo ở `Draft`; Import không tự gửi duyệt hay phê duyệt. `UPDATE` trên
  bản nháp giữ nguyên `Draft`; `UPDATE` trên record `Approved` tạo/cập nhật proposal Draft. Màn hình kết quả
  tách `created`, `proposed` và `updated`.
- Cột editable: Mã CDE quy chiếu, Thứ hạng, Loại thành tố, Loại trường dữ liệu, Phương thức tạo, Thời gian,
  Chủ sở hữu hệ thống. Cột nhận diện: bốn cột vị trí và Nguồn. Cột server-owned hoặc suy ra (Tên thành tố,
  Chủ sở hữu dữ liệu, Loại dữ liệu, Mô tả) trong file bị bỏ qua.
- Tag resolve theo `displayName` trong đúng classification; cột **Chủ sở hữu hệ thống** của template resolve theo `displayName` của
  **Team** (một giá trị). Chủ quản dữ liệu là User hoặc nhiều chủ chỉ đặt được trên trang chi tiết. Không tìm thấy hoặc trùng tên là lỗi dòng; không tự tạo Team/tag.
- Template có 12 cột: bốn cột vị trí, Nguồn, Mã CDE quy chiếu, Thứ hạng, bốn cột tag, Chủ sở hữu hệ thống.
- Mã CDE resolve trong DD `vN` đang gắn, chỉ nhận CDE `Approved`. Nếu có cột Tên thành tố thì phải khớp.
- **Chỉ cập nhật các cột editable có mặt trong file.** Cột vắng mặt giữ nguyên; cột có mặt nhưng ô trống thì
  xóa giá trị. File tối thiểu gồm bốn cột vị trí và Mã CDE.
- Thứ hạng kiểm tra trên trạng thái cuối (§7.2). Mỗi dòng thay đổi ghi audit `IMPORT`.

### 12.3. Bản chụp các phiên bản trước

- Menu `⋯` → **Bản chụp các phiên bản trước**: danh sách DD đã lưu trữ có bản chụp, gồm phiên bản, `frozenAt`,
  số cột đã gán CDE, nút **Tải Excel**.
- File bản chụp cùng cột với Export (Mã/Tên CDE lấy từ lúc chụp), tên `TuDienKyThuat_Agribank_TDDLv{K}_banchup_YYYYMMDD.xlsx`.
  Import tạo record mới ở Draft; dòng cập nhật record Approved tạo/cập nhật change request Draft, không đổi
  dữ liệu đang có hiệu lực và không tự submit/approve. Mã CDE được resolve lại trong DD đang hiệu lực.
- Bản chụp chỉ có cột `Approved` đã gán CDE. Muốn giữ bản ghi chưa duyệt hoặc khai báo chưa gán CDE qua lần
  làm mới, Export TD trước khi phê duyệt DD (§9.4).

## 13. REST và lỗi

### 13.1. Endpoint

Không có tham số `glossary` hay `parentBusinessVersion`.

```http
GET    /v1/glossaryTerms/technical/context                      # DD đang gắn, resetAt, capability
GET    /v1/glossaryTerms/technical/search?q=&sourceServices=&cdeMapping=&cdeTermIds=&systemOwnerIds=&sourceStatuses=&statuses=&elementTypes=&generationTypes=&creationMethods=&timeliness=&limit=&offset=
GET    /v1/glossaryTerms/technical/stats                        # UI không dùng (TD-D17)
GET    /v1/glossaryTerms/technical/columns?q=&limit=            # chọn Column khi Thêm cột
POST   /v1/glossaryTerms/technical/records
GET    /v1/glossaryTerms/technical/records/{id}
PATCH  /v1/glossaryTerms/technical/records/{id}                 # body có expectedRevision
POST   /v1/glossaryTerms/technical/records/{id}/change-request  # tạo Draft UPDATE/DELETE cho Approved
GET    /v1/glossaryTerms/technical/records/{id}/change-request  # canEdit/canApprove
PATCH  /v1/glossaryTerms/technical/records/{id}/change-request  # sửa Draft/Rejected
DELETE /v1/glossaryTerms/technical/records/{id}/change-request?expectedRevision=
POST   /v1/glossaryTerms/technical/records/{id}/change-request/submit
POST   /v1/glossaryTerms/technical/records/{id}/change-request/approve
POST   /v1/glossaryTerms/technical/records/{id}/change-request/reject
POST   /v1/glossaryTerms/technical/records/{id}/change-request/withdraw  # người gửi; xóa đề xuất InReview
POST   /v1/glossaryTerms/technical/records/{id}/deletion-request  # canEdit; tạo DELETE và gửi duyệt nguyên tử
POST   /v1/glossaryTerms/technical/records/{id}/withdraw        # người gửi; bản ghi mới InReview -> Draft
GET    /v1/glossaryTerms/technical/requests?q=&types=&requesters=&sourceServices=&cdeTermIds=&limit=&offset=   # tab Yêu cầu
POST   /v1/glossaryTerms/technical/records/{id}/submit          # canEdit; Draft -> In Review, body có expectedRevision
POST   /v1/glossaryTerms/technical/records/{id}/approve         # body có expectedRevision
POST   /v1/glossaryTerms/technical/records/{id}/reject          # body có expectedRevision; không cần lý do
POST   /v1/glossaryTerms/technical/records/bulk/submit          # canEdit; body {items:[{id, expectedRevision}]}, 1..100
POST   /v1/glossaryTerms/technical/records/bulk/approve         # canApprove; body {items:[{id, expectedRevision}]}, 1..100
POST   /v1/glossaryTerms/technical/records/bulk/reject          # như trên
DELETE /v1/glossaryTerms/technical/records/{id}?expectedRevision=
GET    /v1/glossaryTerms/technical/records/{id}/history?limit=&offset=
GET    /v1/glossaryTerms/technical/records/{id}/versions               # DD đã lưu trữ từng có Column này + currentRecordId (chọn phiên bản ở trang chi tiết)
GET    /v1/glossaryTerms/technical/export
GET    /v1/glossaryTerms/import/technical/template
POST   /v1/glossaryTerms/import/technical/preview
POST   /v1/glossaryTerms/import/technical/{importSessionId}/commit
GET    /v1/glossaryTerms/technical/snapshots
GET    /v1/glossaryTerms/technical/snapshots/{dataDictionaryVersion}/export
GET    /v1/glossaryTerms/technical/snapshots/{dataDictionaryVersion}/records?q=&limit=&offset=   # danh sách bản chụp, chỉ đọc (xem bản chụp, §11.1)
GET    /v1/glossaryTerms/technical/snapshots/{dataDictionaryVersion}/records/{id}                # một bản ghi bản chụp (trang chi tiết, §11.3)
GET    /v1/glossaryTerms/{cdeId}/technicalAssets?limit=&offset= # tab Tài sản khi xem phiên bản CDE (§11.5)
POST   /v1/glossaryTerms/technical/index/rebuild                # Admin
```

Không còn với TD: `/v1/technical-dictionary/*`, `/glossaries/{id}/working*`, `/glossaries/{id}/published*`,
`/glossaryTerms/{id}/working*`, `/glossaryTerms/{id}/published*`, `/glossaryTerms/{id}/permissions`,
`/glossaryTerms/bulk/*`, `/glossaries/{id}/bootstrap-jobs*`, `/glossaries/{id}/technical-index/rebuild`.
`POST /v1/glossaryTerms` với glossary TD không còn là đường khai báo.

`PATCH /technical/records/{id}` nhận JSON thường (`Content-Type: application/json`), không phải JSON Patch. Client
axios của UI mặc định gửi PATCH là `application/json-patch+json` nên `updateTechnicalRecord` phải ghi đè header,
nếu không server trả `415 Unsupported Media Type`.

Kết quả của ba endpoint hàng loạt luôn là `200` khi body hợp lệ, kể cả khi mọi bản ghi lỗi:

```json
{
  "succeeded": 1,
  "failed": 1,
  "results": [
    { "termId": "…", "outcome": "SUCCEEDED", "record": { "…": "như API từng bản ghi" } },
    { "termId": "…", "outcome": "FAILED", "code": "TD_RANK_DUPLICATE", "message": "…" }
  ]
}
```

`results` đúng thứ tự `items`. Body rỗng, quá 100 bản ghi, thiếu `expectedRevision`, `id` không hợp lệ hoặc trùng
trả `400 TD_INVALID_FIELD`; không có quyền (`canEdit` cho `submit`, `canApprove` cho `approve`/`reject`) trả `403`. Mỗi bản ghi lỗi mang mã của luật duyệt từng bản ghi
(`TD_RECORD_REVISION_CONFLICT`, `TD_INVALID_STATUS_TRANSITION` (kể cả gửi duyệt bản ghi không còn là `Draft`), `TD_SELF_APPROVAL_FORBIDDEN`, `TD_RANK_DUPLICATE`,
`TD_CDE_SCOPE_NOT_ACTIVE`, `TD_RECORD_NOT_FOUND`, …); lỗi không lường trước trả `TD_INTERNAL_ERROR`.

### 13.2. Mã lỗi

| Mã | HTTP | Ý nghĩa |
| --- | --- | --- |
| `TD_DATA_DICTIONARY_NOT_ACTIVE` | 409 | Chưa có DD Approved (TDV-06) |
| `TD_RECORD_NOT_FOUND` | 404 | Bản ghi không tồn tại hoặc đã bị xóa khi làm mới |
| `TD_RECORD_REVISION_CONFLICT` | 409 | `expectedRevision` lệch |
| `TD_INVALID_STATUS_TRANSITION` | 409 | Trạng thái hiện tại không cho phép approve/reject/resubmit |
| `TD_SELF_APPROVAL_FORBIDDEN` | 403 | Người tạo cố phê duyệt bản ghi của chính mình |
| `TD_CDE_SCOPE_NOT_ACTIVE` | 409 | CDE không thuộc DD đang gắn hoặc không còn Approved |
| `TD_RANK_REQUIRED`, `TD_RANK_DUPLICATE` | 400 / 409 | §7.2 |
| `TD_COLUMN_NOT_FOUND`, `TD_COLUMN_ALREADY_DECLARED` | 404 / 409 | Column không tồn tại / đã khai báo |
| `TD_SERVER_OWNED_FIELD`, `TD_INVALID_FIELD` | 400 | §3.2 |
| `TD_APPROVED_EDIT_REQUIRES_CHANGE_REQUEST` | 409 | Sửa hoặc xóa trực tiếp bản ghi `Approved`; phải tạo đề xuất (§7.4) |
| `TD_CHANGE_REQUEST_NOT_FOUND` | 404 | Bản ghi không có đề xuất thay đổi |
| `TD_CHANGE_REQUEST_EXISTS` | 409 | Đề xuất đang `InReview` nên không tạo hoặc ghi đè được (cả khi Import) |
| `TD_CHANGE_REQUEST_STALE` | 409 | Bản `Approved` hoặc đề xuất đã đổi sau `baseRevision`/revision của đề xuất; tải lại |
| `TD_NOT_INITIALIZED` | — | Trạng thái TD chưa được khởi tạo |
| `TD_IMPORT_ROW_NOT_MATCHED`, `TD_IMPORT_CONFLICT`, `TD_IMPORT_SESSION_INVALID` | 400 / 409 | Gồm trường hợp DD đã đổi version (§9.3) |
| `TD_INTERNAL_ERROR` | — | Chỉ xuất hiện trong kết quả hàng loạt: bản ghi gặp lỗi không lường trước, chi tiết ở nhật ký máy chủ |
| `TD_INDEX_UNAVAILABLE` | 503 | OpenSearch không khả dụng: đọc lỗi, ghi vẫn thành công và vào outbox |

Mã chung (`WORKING_REVISION_CONFLICT`, ...) của Governed Glossary không áp dụng cho TD.

## 14. Rủi ro và giới hạn

| Rủi ro | Xử lý |
| --- | --- |
| Index trễ hoặc lệch so với Postgres | `refresh=wait_for` sau mỗi ghi; outbox thử lại; API rebuild. Ghi luôn kiểm tra trên Postgres |
| OpenSearch không khả dụng | Đọc trả `TD_INDEX_UNAVAILABLE`; ghi vẫn thành công và nằm trong outbox |
| Mã/Tên CDE lưu sẵn bị cũ | Đồng bộ lại khi CDE của `vN` được duyệt minor mới (§6.2) |
| Column đã khai báo bị xóa khỏi nguồn | Bản ghi và document giữ nguyên, `sourceStatus = Unavailable` |
| Phân trang sâu quá 10.000 kết quả | Giới hạn, yêu cầu thu hẹp filter |
| Cutover DD mất bản ghi chưa duyệt hoặc chưa gán CDE | Hộp xác nhận §9.4 và Export trước khi phê duyệt |

## 15. Tiêu chí chấp nhận

1. TD không có bộ chọn phiên bản. Bản ghi mới ở `Draft`, chỉ chờ duyệt sau khi gửi duyệt, người tạo không tự duyệt,
   và chỉ sau khi actor có `canApprove` phê duyệt thì bản ghi mới thành `Approved` và tag trên Column mới
   được cập nhật qua outbox.
2. Bản ghi chỉ có khi người dùng khai báo Column; Column chưa khai báo không xuất hiện; mỗi Column tối đa một bản ghi.
3. Chỉ gán được CDE `Approved` của DD đang hiệu lực; gán CDE của DD đã lưu trữ bị backend từ chối.
4. Phê duyệt DD `vN+1` xóa toàn bộ bản ghi TD ở mọi trạng thái và chụp lại đủ các bản ghi `Approved` đã gán CDE vào
   `technical_binding_snapshot` với `vN`, trong cùng transaction. Lỗi thì DD không được phê duyệt.
5. Sau làm mới, mọi Column từng được khai báo (kể cả chưa gán CDE) không còn tag CDE `vN` hay bốn tag
   classification do TD quản lý.
6. Tab Tài sản của CDE thuộc DD đang hiệu lực dùng giao diện gốc và chỉ phản ánh bản ghi `Approved`; bản ghi
   `Draft`/`In Review`/`Rejected` và proposal chưa approve không xuất hiện, không gắn tag lên Column.
   CDE của DD đã lưu trữ có tab Tài sản (chỉ đọc) hiển thị đúng danh sách cột và Thứ hạng tại thời điểm cutover, ở
   mọi version `vN.x`, kể cả sau khi Column bị xóa khỏi nguồn.
7. Ghi TD đồng thời với cutover DD không để lại bản ghi trỏ tới CDE của DD đã lưu trữ.
8. Thứ hạng không trùng trong cùng CDE trên các bản ghi `Approved` còn nguồn, kể cả khi phê duyệt/lưu đồng thời.
9. Import chỉ ghi cột có mặt trong file, tạo bản ghi cho Column chưa khai báo ở `Draft` và commit nguyên tử;
   Import không tự phê duyệt bản ghi mới.
10. Bản chụp tải được và Import lại được vào TD hiện tại; không có API hay job nào xóa bản chụp.
11. Mọi thay đổi và quyết định phê duyệt (người dùng, Import, approve/reject/resubmit, ingest, làm mới) có
    dòng audit, đọc được qua API `/history` (giao diện không hiển thị).
12. Đọc danh sách/export không quét Postgres; ghi luôn kiểm tra trên Postgres rồi đồng bộ index.
13. Bảng đúng các cột và thứ tự §11.2: cột Tên trường gộp, cột Trạng thái, có Chủ quản dữ liệu, không có Chủ sở hữu dữ liệu và không có cột Hành động; header có bộ chọn phiên bản
    nhưng không có thẻ thống kê; cột Tên trường và Trạng thái cố định; bấm dòng mở trang chi tiết; scrollbar đúng thiết kế.
14. `DATA_PROPOSER` tạo được bản ghi/proposal nhưng không tự phê duyệt; Data Steward/Admin khác người tạo duyệt.
    Sửa hoặc xóa record `Approved` chỉ có hiệu lực sau `APPROVE_CHANGE`.
15. Từ chối không cần lý do ở cả API từng bản ghi, API hàng loạt và giao diện; không còn ô nhập lý do.
16. Xử lý hàng loạt: thanh chỉ hiện cho người có `canEdit` hoặc `canApprove`; chỉ bản ghi `Draft` được gửi duyệt và chỉ
    bản ghi `In Review` do người khác tạo được duyệt; mỗi bản ghi một transaction nên bản ghi lỗi không chặn bản ghi khác và được báo riêng; tối đa 100 bản ghi
    mỗi lần; audit ghi từng bản ghi.
17. Bản nháp: `POST /records` và Import chỉ tạo `Draft`; chỉ người có `canEdit` gửi duyệt được (từng bản ghi hoặc hàng
    loạt); bản nháp không bị projection; Consumer không thấy bản nháp ở danh sách, thống kê, export, chi tiết và lịch
    sử.
18. Trang chi tiết (§11.3) sửa từng trường tại chỗ cho bản `Draft`/`Rejected` và đề xuất `Draft`/`Rejected`; bản `Approved` chỉ sửa qua **Sửa phiên bản**;
    xem được bản chụp của các DD đã lưu trữ ở chế độ chỉ đọc, kể cả khi Column không còn trong danh sách hiện hành.
19. Consumer chỉ đọc record `Approved`; audit proposal chưa được duyệt và toàn bộ metadata/payload pending-change
    không được trả về. `APPROVE_CHANGE` có thể xuất hiện trong history vì đó là thay đổi đã có hiệu lực.

## 16. Hiện trạng triển khai

Đã triển khai (đối chiếu code ngày 2026-10-06, HEAD `b5a2a656d4`): schema (migration `1.13.3` và `bootstrap/sql/schema`), DAO
`TechnicalDictionaryDAO`, ghi record (`TechnicalRecordService`), cutover trong transaction phê duyệt DD
(`TechnicalCutover`), outbox (`TechnicalOutbox`), index phẳng, REST (`TechnicalDictionaryResource`,
`TechnicalDictionaryImportResource`), endpoint `technicalAssets` và UI. Đã bỏ profile `TECHNICAL_DICTIONARY`
khỏi Governed Glossary, bootstrap/bulk workflow và các bảng governed của TD.

Luồng maker-checker tại §7.3 đã được bổ sung: bản ghi mới/import mới ở `Draft` rồi gửi duyệt sang `In Review`, có
capability và endpoint submit/approve/reject (từng bản ghi và hàng loạt, từ chối không cần lý do), bản nháp ẩn với Consumer, chặn tự duyệt, audit đầy đủ, lọc trạng thái trên index và UI duyệt từng bản ghi hoặc hàng loạt. Chỉ dữ liệu
`Approved` được projection, xuất hiện trong tab Tài sản và được tính là đã gán CDE.

Đề nghị xóa gửi duyệt nguyên tử, rút lại yêu cầu (§7.5) và tab Yêu cầu (§11.7) đã có ở backend và giao diện (commit `b9a2421e757`, 2026-10-08). Đề xuất sửa/xóa bản ghi `Approved` (§7.4), trang chi tiết và xem bản chụp (§11.1, §11.3), Chủ quản dữ liệu nhiều Team/User (TD-D11) và hiển thị hai dòng cho bản ghi đang có đề xuất (§5.3) đã có ở cả backend và giao diện.

Khác biệt so với mô tả ở trên:

| Mục | Thiết kế | Triển khai | Lý do |
| --- | --- | --- | --- |
| §7.2, §9.3 | Khóa advisory theo `cdeTermId` | Ghi có thể đổi CDE/Thứ hạng lấy khóa `FOR UPDATE` trên `technical_dictionary_state`; ghi khác lấy `FOR SHARE` | Portable giữa MySQL và PostgreSQL; ghi Thứ hạng tần suất thấp |
| §9.1 bước 2 | `INSERT ... SELECT` bản chụp | Đọc từng trang bản ghi và `INSERT` từng dòng cùng transaction | Payload bản chụp là JSON phẳng khó dựng bằng SQL portable |
| §4 `technical_binding_snapshot` | Nhân đôi mọi cột | Cột khóa và cột `payload` JSON là dòng phẳng đầy đủ | Export và `technicalAssets` dùng đúng dòng phẳng của index |
| §6.1 | Ghi index ngay rồi mới xếp hàng khi lỗi | Ghi `INDEX`/`PROJECTION` vào outbox trong transaction rồi xử lý ngay sau commit | Không mất sự kiện nếu tiến trình dừng giữa commit và ghi index |
| §9.2 | Xử lý `RESET` trong request phê duyệt | `RESET` chạy nền qua worker của outbox | Gỡ tag trên hàng chục nghìn Column có thể mất vài phút |
| §13.1 | — | `/technical/stats` vẫn còn nhưng UI không gọi | Chỉ giao diện đã đổi theo TD-D17 |
| §11.4, §12.2 | Chủ quản dữ liệu nhập ở mọi nơi như nhau | Modal Thêm cột không có trường này; trang chi tiết chọn nhiều Team/User; template Import chỉ nhận **một Team** theo tên | Nhập User hoặc nhiều chủ qua Import chưa được hỗ trợ |
| §11.4 | Modal dùng chung cho xem/sửa/duyệt/thêm | `TechnicalRecordModal` còn mã cho `view`/`edit`/`review` nhưng UI chỉ dùng `create` | Các chế độ đó được thay bằng trang chi tiết; có thể dọn mã |
| §11.3 | Trang chi tiết sửa bản ghi `Approved` trực tiếp | `Approved` chỉ đọc; phải **Sửa phiên bản** để tạo đề xuất | Maker-checker cho sửa/xóa (TDV-02) |
| Dữ liệu cũ | Bản ghi TD hiện hữu giữ hiệu lực | Migration thêm trạng thái với mặc định `Approved`; glossary cũ và các `GlossaryTerm` của mô hình cũ không được dọn tự động | Tránh làm mất hiệu lực dữ liệu đang dùng |

Đối chiếu code ngày 2026-10-06: `TechnicalExcelExporter.HEADERS` đã là 14 cột và `/technical/stats` vẫn tồn tại nhưng giao diện không gọi.
Chưa có tài liệu kiểm thử `docs/test` cho TD.

Chưa kiểm chứng: SQL chưa chạy trên MySQL/PostgreSQL thật, luồng OpenSearch chưa chạy thật; thay đổi giao
diện TD-D17, trang chi tiết, đề xuất thay đổi và duyệt hàng loạt chưa được build/chạy test trong lần cập nhật tài liệu này (chỉ đối chiếu bằng đọc code). Chỉ `en-us` và `vi-vn` có khóa i18n mới; các locale còn lại chưa đồng bộ.

## 17. Ảnh hưởng tới tài liệu và mã nguồn khác

| Nơi | Thay đổi |
| --- | --- |
| DQ design §5.4 | Chỉ áp dụng cho DQ Rule; liên kết CDE của TD theo §7.1 tài liệu này |
| CDE design, tab Assets và API spec §9.6 | Theo §11.5: tab gốc theo tag cho CDE hiện hành, tab thêm vào từ `technicalAssets` cho phiên bản đã lưu trữ; cần rà lại phần mô tả tab Assets trong hai tài liệu này |
| `GlossaryVersioningService` | Thêm bước §9.1 vào transaction cutover; publish-preview §9.4 |
| `TechnicalColumnProjection` | Tính tag từ `technical_record`; xử lý `RESET` |
| `GovernedGlossaryProfileRegistry`, `TechnicalDictionaryBootstrap` | Bỏ profile TD; bootstrap chỉ tạo glossary phân quyền và bảng |
| UI `TechnicalDictionaryPage/*` | Header và chế độ xem §11.1, bảng §11.2, trang chi tiết §11.3 (`TechnicalRecordDetailPage`), modal Thêm cột §11.4, duyệt hàng loạt §11.6 |
| `GlossaryTermTab` | Glossary `Technical Dictionary` hiển thị `TechnicalDictionaryPage` ở chế độ nhúng (§11.1) |
| Route | `/technical-dictionary`, `/technical-dictionary/import`, `/technical-dictionary/:termId` |

## 18. Tài liệu tham khảo

- [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md).
- [Thiết kế Từ điển dữ liệu dùng chung](./cde-glossary-ui-design.md).
- [Kế hoạch triển khai index riêng của Từ điển kỹ thuật](./technical-dictionary-search-index-implementation-plan.md).
- [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md).
