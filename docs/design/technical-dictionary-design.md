# Thiết kế Từ điển kỹ thuật (Technical Dictionary)

> Trạng thái tài liệu: **Đã chốt**, cập nhật quyết định phê duyệt bản ghi mới ngày 2026-10-05.
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
  trạng thái `In Review` và chỉ có hiệu lực sau khi Data Steward hoặc Admin phê duyệt theo nguyên tắc
  maker-checker. Sửa bản ghi đã `Approved` vẫn có hiệu lực ngay; mọi hành động được ghi audit.
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
| TDV-02 | Khai báo mới phải được phê duyệt: tạo bản ghi ở `In Review`, Data Steward/Admin khác người tạo được `Approve` hoặc `Reject`; chỉ bản ghi `Approved` mới có hiệu lực và được projection lên Column. Sửa bản ghi đã `Approved` có hiệu lực ngay. Không có version hay bulk workflow; mọi chuyển trạng thái và thay đổi đều vào audit | §7.3 |
| TDV-03 | TD gắn với DD đang hiệu lực `vN`; chỉ gán được CDE `Approved` của `vN` | |
| TDV-04 | Khi DD `vN+1` được phê duyệt, trong cùng transaction: chụp lại các bản ghi `Approved` đã gán CDE thành bản chụp của `vN` (giữ vĩnh viễn), rồi xóa toàn bộ bản ghi TD ở mọi trạng thái. Không tự nối sang CDE cùng mã | §9 |
| TDV-05 | Bản chụp các liên kết của DD đã lưu trữ được giữ vĩnh viễn, tải được và hiển thị trong tab Tài sản của CDE khi xem phiên bản đã lưu trữ (chỉ đọc) | §11.5 |
| TDV-06 | Chưa có DD nào Approved thì không khai báo cột hay Import | |
| TDV-07 | Người có quyền sửa được xóa bất kỳ bản ghi nào, có xác nhận và ghi audit | |
| TDV-08 | Bản ghi TD lưu trong bảng riêng, không còn là `GlossaryTerm`, không dùng bảng governed (`glossary_business_*`, `glossary_published_head`). Glossary `Technical Dictionary` chỉ còn làm đối tượng phân quyền | |
| TDX-01 | Bản ghi chỉ tạo khi người dùng khai báo Column. Không bootstrap job, không tự tạo khi ingest | |
| TDX-02 | Mã CDE quy chiếu không bắt buộc | |
| TDX-03 | Danh sách chỉ gồm Column đã khai báo | |
| TDX-04 | Mọi thao tác đọc danh sách (search, filter, sort, phân trang, export) chạy trên index riêng; Postgres không bị quét toàn bộ trong request đọc | |
| TDX-05 | Mọi thao tác ghi thực hiện trên Postgres (kiểm tra revision và quyền), rồi đồng bộ sang index. Index không bao giờ là căn cứ để ghi | |
| TDX-07 | Import được tạo bản ghi cho Column chưa khai báo | |
| TDX-09 | Không có cấu hình phạm vi Column; người dùng chọn Column cụ thể khi khai báo | |
| TDX-11 | Bản ghi TD không được ghi vào các index glossary chung; chỉ có trong index riêng | |
| TD-D06 | Không có trang chi tiết; bảng và modal phải đủ thông tin | |
| TD-D08 | Database là nguồn sự thật; tag trên Column và search index là projection qua outbox | |
| TD-D10 | Chủ sở hữu dữ liệu suy ra từ `owners` của CDE được quy chiếu, không nhập ở TD | Một nguồn sự thật, không lệch giữa các Column cùng CDE |
| TD-D11 | Chủ sở hữu hệ thống là tham chiếu tới một Team, không dùng trường `owners` của OpenMetadata | Có kiểm tra tồn tại, lọc theo ID; tránh policy "owner được sửa" cấp quyền ngoài ý muốn |
| TD-D12 | Thời gian là Classification `DataTimeliness`, đơn trị, danh sách chuẩn hóa được nghiệp vụ duyệt | Nhất quán với ba trường phân loại còn lại |
| TD-D13 | Mô tả lấy từ Column (server-owned), không sửa ở TD | Mô tả do ingestion và trang Table quản lý |
| TD-D14 | Không giữ liên kết lịch sử khi đổi tên Column/Table | OpenMetadata không có định danh Column ổn định qua đổi tên; Import cho phép gán lại nhanh |
| TD-D15 | Thứ hạng `1..999`, bắt buộc khi có CDE, duy nhất trong cùng CDE trên bản ghi `Approved` còn nguồn; kiểm tra lại khi phê duyệt và mỗi lần sửa bản ghi đã duyệt (§7.2) | |
| TD-D16 | Liên kết CDE chỉ lưu `termId`, không lưu version; bao trùm mọi version `vN.x` của CDE | Column chứa dữ liệu của thành tố nghiệp vụ, không phụ thuộc lần sửa minor của CDE |
| TD-D17 | Bảng hiển thị **14 trường**, không có cột Chủ sở hữu dữ liệu và Chủ sở hữu hệ thống; header không có thẻ thống kê | Quyết định giao diện, §11 |
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
| `systemOwnerId` | `uuid` null | Team |
| `status` | `varchar(16)` | `In Review` / `Approved` / `Rejected`; bản ghi mới là `In Review` |
| `submittedAt`, `submittedBy` | | Lần gửi duyệt gần nhất |
| `reviewedAt`, `reviewedBy`, `reviewComment` | | Quyết định phê duyệt/từ chối gần nhất; từ chối bắt buộc có lý do |
| `revision` | `bigint` | Khóa lạc quan, tăng mỗi lần lưu |
| `createdAt`, `createdBy`, `updatedAt`, `updatedBy` | | |

Index phụ: `(cdeTermId, rank)` cho kiểm tra Thứ hạng và endpoint `technicalAssets`.

`technical_record_audit`: lịch sử thay đổi, không bị xóa khi TD làm mới.

| Cột | Ghi chú |
| --- | --- |
| `id`, `recordId`, `columnFqn`, `dataDictionaryVersion` | |
| `action` | `CREATE`, `UPDATE`, `APPROVE`, `REJECT`, `RESUBMIT`, `DELETE`, `IMPORT`, `RESET` |
| `changes` | JSON `[{field, oldValue, newValue}]`; CDE ghi cả mã CDE để đọc được sau khi identity bị lưu trữ |
| `actor`, `at` | |

`technical_binding_snapshot`: bản chụp bất biến các liên kết Column–CDE tại mỗi lần cutover DD. Chỉ chứa
bản ghi **`Approved` đã gán CDE**. Giữ **vĩnh viễn**, không có job dọn dẹp và không có API xóa, vì là căn cứ lịch sử
của DD đã lưu trữ.

| Cột | Ghi chú |
| --- | --- |
| `dataDictionaryVersion`, `recordId` | PK. `dataDictionaryVersion` là `N` của DD bị lưu trữ |
| `columnKey`, `cdeTermId` (NOT NULL), `cdeCode`, `cdeName`, `rank`, `columnFqn`, `frozenAt` | Mã/Tên CDE resolve lúc chụp; không resolve lại sau này |
| `payload` | JSON dòng phẳng đầy đủ tại thời điểm chụp, gồm nhãn tag và tên Team |

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
- Mọi người có `canView` thấy cùng một danh sách gồm cả bản ghi chờ duyệt hoặc bị từ chối; trạng thái cho
  biết bản ghi đã có hiệu lực hay chưa. Không có hai view `current`/`published`.

### 5.2. Trường

| Nhóm | Trường | Kiểu | Dùng cho |
| --- | --- | --- | --- |
| Identity | `recordId`, `columnKey`, `dataDictionaryVersion`, `status` | keyword | lookup, trạng thái phê duyệt; truy vấn luôn lọc theo version đang gắn, phát hiện document sót sau làm mới |
| Vị trí Column | `columnFqn` | keyword (lowercase) | sort phụ sau Thứ hạng, match chính xác |
| | `service`, `database`, `schema`, `table`, `column` | keyword (lowercase) + text ngram | filter, search |
| | `dataType`, `description` | keyword / text | hiển thị, search mô tả |
| | `sourceStatus` | keyword | filter Tình trạng nguồn |
| CDE | `cde.id`, `cde.code`, `cde.name`, `cde.assignedAt`, `cde.assignedBy` | keyword + text | filter CDE, search Mã/Tên CDE, endpoint `technicalAssets`. `code`, `name` là bản CDE resolve khi dựng document |
| | `dataOwners[].id`, `dataOwners[].name` | keyword | Chủ sở hữu dữ liệu hiển thị trong modal |
| Đặc tả | `rank` | integer | hiển thị, cảnh báo trùng |
| | `elementType`, `generationType`, `creationMethod`, `timeliness` | keyword (tag FQN) + label | filter |
| | `systemOwner.id`, `systemOwner.name` | keyword | filter, modal |
| Khác | `revision` | long | UI gửi kèm khi ghi |
| | `submittedAt`, `submittedBy`, `reviewedAt`, `reviewedBy`, `reviewComment` | date / keyword / text | hiển thị trạng thái và quyết định duyệt |
| | `updatedAt`, `updatedBy` | date / keyword | hiển thị |

Dữ liệu CDE (mã, tên, chủ sở hữu) được lưu sẵn trong document để search và hiển thị không phải truy
Postgres; §6.2 mô tả cách giữ nó đúng khi CDE thay đổi.

### 5.3. Truy vấn

- Server luôn tự dựng truy vấn; UI chỉ gửi tham số (`q`, các filter, `limit`, `offset`).
- Search `q`: khớp một phần (ngram) trên database, schema, bảng, cột, Mã CDE, Tên CDE.
- Filter trên UI: Nguồn, Loại thành tố, Loại trường dữ liệu,
  Phương thức tạo, Thời gian. Filter tag gửi tag FQN. Giao diện không còn filter Mã CDE quy chiếu, Tình trạng nguồn và Chủ sở hữu hệ thống (TD-D17); tham số `cdeMapping`, `cdeTermIds`, `sourceStatuses`, `systemOwnerIds` vẫn được API hỗ trợ.
- API hỗ trợ thêm filter `statuses`; UI hiển thị nhanh `Tất cả / Chờ duyệt / Đã duyệt / Bị từ chối`.
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
  Bản ghi `In Review`/`Rejected`, bản ghi bị xóa hoặc nguồn `Unavailable` không mang các tag do TD quản lý.
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
- Selector: placeholder **“Tìm theo mã hoặc tên CDE”**, mỗi CDE một option `Mã CDE · Tên thành tố`.
- Chưa có DD Approved (TDV-06): trang TD hiển thị **“Chưa có Từ điển dữ liệu dùng chung được phê duyệt.
  Từ điển kỹ thuật sẽ khả dụng sau khi phê duyệt phiên bản đầu tiên.”** Nút **Thêm cột** và Import bị ẩn.

### 7.2. Thứ hạng (survivorship rank)

Thứ hạng xác định Column nào được ưu tiên khi nhiều Column cùng quy chiếu một CDE.

- Số nguyên `1..999`, `1` là ưu tiên cao nhất; cho phép khoảng trống (`1, 3, 5`).
- Có CDE thì bắt buộc có Thứ hạng, không có CDE thì Thứ hạng phải trống.
- Duy nhất trong cùng CDE, xét trên các bản ghi `status = Approved` và `sourceStatus = Available`.
- Kiểm tra khi tạo/gửi lại để cảnh báo sớm và **kiểm tra lại trong transaction phê duyệt**. Hai bản ghi
  chờ duyệt có thể cùng hạng; bản được duyệt sau trả `409 TD_RANK_DUPLICATE` kèm cột đã giữ Thứ hạng đó.
  Khi sửa bản ghi `Approved`, kiểm tra mỗi lần lưu như hiện tại.
  Ghi có thể đổi CDE/Thứ hạng lấy khóa trước khi kiểm tra để hai lần lưu đồng thời không tạo trùng (§13.2).
- Import kiểm tra trạng thái cuối của các dòng `UPDATE` trên bản ghi `Approved` trong một transaction;
  trùng là lỗi dòng. `CREATE_RECORD` chỉ tạo `In Review`, nên trùng hạng với bản ghi đã duyệt là cảnh báo
  và sẽ được chặn nếu xung đột vẫn còn lúc phê duyệt. Muốn đổi chỗ Thứ hạng giữa hai cột đã duyệt, dùng
  Import hoặc sửa lần lượt qua một giá trị tạm.

### 7.3. Phê duyệt bản ghi mới

Luồng chỉ áp dụng cho lần khai báo đầu tiên của một Column:

1. Người có `canEdit` chọn Column, nhập thông tin và bấm **Gửi phê duyệt**. `POST /records` tạo bản ghi
   `In Review`, ghi `CREATE`, `submittedAt/submittedBy` và đồng bộ document vào index, nhưng chưa projection tag.
2. Người có `canApprove`, đồng thời khác `createdBy`, rà soát và chọn **Phê duyệt** hoặc **Từ chối**.
3. **Phê duyệt** kiểm tra lại DD/CDE, Thứ hạng, revision và trạng thái trong cùng transaction; chuyển sang
   `Approved`, ghi audit `APPROVE`, rồi phát sự kiện `INDEX` và `PROJECTION`. Từ thời điểm này bản ghi có hiệu lực.
4. **Từ chối** bắt buộc có lý do; chuyển sang `Rejected`, ghi audit `REJECT`, cập nhật index và không projection.
5. Người tạo hoặc người có `canEdit` được sửa bản ghi `In Review`/`Rejected`. Lưu bản ghi `Rejected` đồng
   thời gửi duyệt lại: chuyển sang `In Review`, xóa quyết định duyệt cũ khỏi trạng thái hiện hành nhưng giữ
   trong audit, cập nhật `submittedAt/submittedBy` và ghi `RESUBMIT`.

Người tạo không được tự phê duyệt kể cả khi đồng thời có `canApprove`; API trả `403 TD_SELF_APPROVAL_FORBIDDEN`.
Không tạo bản ghi `Draft` lâu dài và chưa có bulk approve/reject. Sửa một bản ghi đã `Approved` không đưa
bản ghi về `In Review`; thay đổi vẫn có hiệu lực ngay theo phạm vi quyết định TDV-02.
Đây là state machine riêng, nhẹ của TD; không đưa TD trở lại `GovernedGlossaryProfileRegistry` và không
dùng version/bảng working-published của Governed Glossary.

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
   theo snapshot `Approved` mới nhất của `vN`, nhãn tag, Team và `frozenAt`.
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
| `canView` | Xem danh sách, modal, lịch sử thay đổi, bản chụp | Policy `ViewAll`/`ViewBasic` trên glossary `Technical Dictionary` |
| `canEdit` | Khai báo, sửa, gửi duyệt lại, xóa bản ghi | Policy `EditAll` hoặc `EditGlossaryTerms` trên glossary `Technical Dictionary` |
| `canApprove` | Phê duyệt hoặc từ chối bản ghi mới | `DATA_STEWARD`, Admin hoặc policy `ApproveWorking`; vẫn phải khác người tạo |
| `canImport` | Import | Bằng `canEdit` |
| `canExport` | Export danh sách và bản chụp | Theo quyền Export chung (API spec §2.1) |

- Mọi người xem thấy cùng một dữ liệu. Mặc định `canEdit` cấp cho `DATA_PROPOSER`, `DATA_STEWARD` và `Admin`;
  `canApprove` cấp cho `DATA_STEWARD` và `Admin`. Kiểm tra maker-checker áp dụng độc lập với role: actor có
  cả hai quyền vẫn không được duyệt bản ghi do chính mình tạo.
- Quyền ghi luôn được kiểm tra lại trên Postgres; nút Sửa trên UI không phải căn cứ cho phép ghi.
- `GET /v1/glossaryTerms/technical/context` trả các capability gồm `canApprove`, DD đang gắn và `resetAt`.

## 11. Giao diện

### 11.1. Route và header

```text
/technical-dictionary
```

Không có UUID, `scopeId`, `businessVersion` hay route chi tiết bản ghi.

```text
Quản trị / Từ điển kỹ thuật

[Icon] Từ điển kỹ thuật                                                                  [⋯]
┌────────────────────────────────────────────────────────────────────────────────────┐
│ [Tìm kiếm] [Nguồn] [Loại TT] [Loại trường] [Phương thức] [Thời gian]  [Thêm cột] [Tùy chỉnh] │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Database │ Schema │ Bảng │ Cột │ Nguồn │ Mã CDE │ ... │ Mô tả │ Hành động           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Header không có badge trạng thái tổng, bộ chọn phiên bản, action vòng đời catalog **và không có thẻ thống kê**;
  trạng thái phê duyệt nằm trên từng bản ghi.
- Lề trái/phải của hàng tiêu đề bằng 0 để tiêu đề và nút `⋯` thẳng hàng với mép bảng (bảng tràn sát mép vùng nội dung).
- Không hiển thị nhãn “Theo Từ điển dữ liệu dùng chung v{N}” cạnh tiêu đề; phiên bản DD đang gắn chỉ dùng nội bộ và trong tên file Export.
- Menu `⋯`: Xuất Excel, Nhập Excel (`canImport`), **Bản chụp các phiên bản trước** (§12.3), Dựng lại index (Admin).
  Menu dùng đúng kiểu menu quản lý của OpenMetadata (như header glossary): mỗi mục có icon, tên và một dòng mô
  tả (`ManageButtonItemLabel`), rộng 350px, đóng lại sau khi chọn.
- Banner sau lần làm mới, hiển thị tới khi người dùng đóng hoặc sau 30 ngày: **“Từ điển kỹ thuật đã được làm
  mới ngày {resetAt} khi Từ điển dữ liệu dùng chung v{N} được phê duyệt. [Tải bản chụp v{N-1}] để nhập lại
  các cột đã duyệt và gán CDE.”**
- Trạng thái trống: **“Chưa có cột nào được khai báo”**; hành động nằm ở nút **Thêm cột** trên thanh công
  cụ và mục **Nhập gán CDE** trong menu `⋯`.

### 11.2. Bảng — 14 trường

Checkbox chọn hàng không còn (không có bulk). Cột **Hành động** là control UI, không tính vào 14 trường.

| STT | Trường | Nguồn | Ghi chú |
| --- | --- | --- | --- |
| 1–4 | Tên cơ sở dữ liệu, Tên Schema, Tên Bảng, Tên cột | Hệ thống | Cố định trái |
| 5 | Nguồn | Hệ thống | `service` |
| 6 | Mã CDE quy chiếu | Người dùng | Tùy chọn. Là liên kết: bấm vào sẽ tra FQN của CDE theo `termId` (`GET /v1/glossaryTerms/{id}`) rồi mở trang chi tiết thuật ngữ |
| 7 | Tên thành tố CDE | Suy ra | Read-only |
| 8 | Thứ hạng | Người dùng | §7.2 |
| 9 | Loại dữ liệu | Hệ thống | Kèm length/precision/scale |
| 10 | Loại thành tố | Người dùng | Tag `DataElementType` |
| 11 | Loại trường dữ liệu | Người dùng | Tag `FieldGenerationType` |
| 12 | Phương thức tạo | Người dùng | Tag `DataCreationMethod` |
| 13 | Thời gian | Người dùng | Tag `DataTimeliness` |
| 14 | Mô tả | Hệ thống | TD-D13 |

- **Không có** cột Chủ sở hữu dữ liệu và Chủ sở hữu hệ thống (TD-D17). Modal cũng không hiển thị hai
  thông tin này; chúng chỉ còn trong template Import (Chủ sở hữu hệ thống, §12.2) và dữ liệu. File Export cũng không có hai cột này (§12.1).
- Thứ tự dòng cố định do server: Thứ hạng tăng dần (chưa có Thứ hạng xếp cuối), rồi `columnFqn` (§5.3). Thứ hạng chỉ
  duy nhất trong cùng CDE nên các CDE khác nhau có cùng hạng sẽ đứng cạnh nhau. Bấm tiêu đề cột không đổi thứ tự.
- Cột control **Trạng thái** hiển thị badge `Chờ duyệt` / `Đã duyệt` / `Bị từ chối` và không tính vào 14
  trường nghiệp vụ. Cột tùy chọn, mặc định ẩn: **Cập nhật lúc**, **Cập nhật bởi**.
- Bốn cột Database, Schema, Bảng, Cột cố định trái; **Hành động** cố định phải, chỉ rộng đủ cho icon.
  Scrollbar ngang luôn nhìn thấy ở đáy vùng bảng, cách footer; không che row.
- Giá trị thiếu hiển thị `--`; action có tooltip và accessible name.
- Column preference key `technicalDictionary.v3`, để cấu hình cột trước khi có trạng thái maker-checker
  không được áp dụng lại.
- Row action: **Xem/Sửa** (mở modal), **Phê duyệt/Từ chối** (`canApprove`, chỉ với `In Review` và không phải
  người tạo), **Xóa** (`canEdit`, có xác nhận). Không có bulk approve/reject; cập nhật hàng loạt dùng Import.
- Filter (đặt trực tiếp trên thanh công cụ, không có popover **Bộ lọc khác**): Trạng thái, Nguồn, Loại thành tố,
  Loại trường dữ liệu, Phương thức tạo, Thời gian. Kết hợp filter, reset page, chống
  stale response; filter khác mặc định đồng bộ URL.

### 11.3. Modal

- Một modal cho Xem, Sửa, Thêm cột và duyệt, **cùng bố cục và cùng kiểu form** (header/footer cố định, chỉ body cuộn,
  căn giữa, một cột trên mobile). Thêm cột có ô **Chọn cột** ở đầu; Sửa có thêm nút **Xóa**; chế độ Xem và
  duyệt chỉ đọc. Có `canEdit` thì các trường editable mở sửa ngay ngoài chế độ duyệt.
- Nhóm **Nguồn** (chỉ đọc): Database, Schema, Bảng, Cột, Nguồn, Loại dữ liệu, Mô tả, badge tình trạng nguồn.
- Nhóm **Quy chiếu và đặc tả** (editable): Mã CDE (Tên thành tố tự điền, read-only), Thứ hạng, Loại thành tố,
  Loại trường dữ liệu, Phương thức tạo, Thời gian. Không có Chủ sở hữu dữ liệu và Chủ sở hữu hệ thống (TD-D17).
  Khi Lưu, Chủ sở hữu hệ thống đã có được giữ nguyên.
- Cảnh báo trùng Thứ hạng hiển thị ngay tại field kèm bản ghi đang giữ Thứ hạng đó.
- Modal **không** hiển thị lịch sử thay đổi (TD-D17). Audit vẫn được ghi vào `technical_record_audit` và đọc được qua API `/history`.
- Modal hiển thị badge trạng thái; bản ghi bị từ chối hiển thị lý do, người duyệt và thời điểm. Chế độ duyệt
  là chỉ đọc và có footer **Từ chối** · **Phê duyệt**; từ chối mở ô nhập lý do bắt buộc.
- Footer sửa: **Xóa** (trái) · **Hủy** · **Lưu**. Lưu gửi `expectedRevision`; xung đột trả
  `409 TD_RECORD_REVISION_CONFLICT`, UI báo cột đã được người khác cập nhật và tải lại giá trị mới.

### 11.4. Thêm cột

Nút **Thêm cột** (khi có `canEdit`, chỉ ở thanh công cụ của bảng) mở một modal dùng form sửa. Ô **Chọn cột**
ở đầu form tìm theo tên bảng hoặc tên cột, hiển thị `Bảng · Cột`, kiểu dữ liệu, `service / database / schema`
(Column đã khai báo hiển thị mờ kèm nhãn, không chọn được). Chọn Column tự điền các trường nguồn chỉ đọc;
**Gửi phê duyệt** bị khóa tới khi đã chọn Column, và tạo bản ghi ở trạng thái `In Review`; bản ghi chỉ có
hiệu lực sau khi được duyệt (§7.3). Mỗi lần khai báo một Column; khai
báo hàng loạt dùng Import. Tìm Column dùng `column_search_index` (chỉ đọc) kèm index TD để đánh dấu Column đã khai báo.

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

## 12. Import và Export

### 12.1. Export

- Xuất toàn bộ danh sách (duyệt index bằng point-in-time), theo thứ tự cột của template Import (§12.2).
  Thứ tự dòng của file vẫn theo `columnFqn`, không theo Thứ hạng như bảng trên giao diện.
- Tên file `TuDienKyThuat_Agribank_TDDLv{N}_YYYYMMDD_HHmm.xlsx`, sheet `Technical Dictionary`; `v{N}` là phiên
  bản DD đang gắn để file tự nói rõ mã CDE thuộc DD nào. Không chứa UUID, `columnKey` hoặc FQN kỹ thuật.
- File Excel gồm **14 cột**, đúng 14 trường của bảng (§11.2); không có cột Chủ sở hữu dữ liệu và Chủ sở hữu hệ thống (TD-D17).
  File Export vẫn Import được vì Import chỉ cập nhật các cột editable có mặt trong file (§12.2); tuy nhiên không
  còn cách đổi Chủ sở hữu hệ thống qua file Export, chỉ qua template Import hoặc modal.

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
- Khi commit, mọi `CREATE_RECORD` được tạo ở `In Review` và phải duyệt từng bản ghi; Import không tự phê
  duyệt và chưa có bulk approve. `UPDATE` trên bản ghi đã `Approved` vẫn có hiệu lực ngay. Màn hình kết quả
  tách số dòng **Chờ duyệt** khỏi số dòng đã cập nhật.
- Cột editable: Mã CDE quy chiếu, Thứ hạng, Loại thành tố, Loại trường dữ liệu, Phương thức tạo, Thời gian,
  Chủ sở hữu hệ thống. Cột nhận diện: bốn cột vị trí và Nguồn. Cột server-owned hoặc suy ra (Tên thành tố,
  Chủ sở hữu dữ liệu, Loại dữ liệu, Mô tả) trong file bị bỏ qua.
- Tag resolve theo `displayName` trong đúng classification; Chủ sở hữu hệ thống resolve theo `displayName` của
  Team. Không tìm thấy hoặc trùng tên là lỗi dòng; không tự tạo Team/tag.
- Mã CDE resolve trong DD `vN` đang gắn, chỉ nhận CDE `Approved`. Nếu có cột Tên thành tố thì phải khớp.
- **Chỉ cập nhật các cột editable có mặt trong file.** Cột vắng mặt giữ nguyên; cột có mặt nhưng ô trống thì
  xóa giá trị. File tối thiểu gồm bốn cột vị trí và Mã CDE.
- Thứ hạng kiểm tra trên trạng thái cuối (§7.2). Mỗi dòng thay đổi ghi audit `IMPORT`.

### 12.3. Bản chụp các phiên bản trước

- Menu `⋯` → **Bản chụp các phiên bản trước**: danh sách DD đã lưu trữ có bản chụp, gồm phiên bản, `frozenAt`,
  số cột đã gán CDE, nút **Tải Excel**.
- File bản chụp cùng cột với Export (Mã/Tên CDE lấy từ lúc chụp), tên `TuDienKyThuat_Agribank_TDDLv{K}_banchup_YYYYMMDD.xlsx`.
  Import được trực tiếp vào TD hiện tại; mã CDE được resolve lại trong DD đang hiệu lực.
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
POST   /v1/glossaryTerms/technical/records/{id}/approve         # body có expectedRevision
POST   /v1/glossaryTerms/technical/records/{id}/reject          # body có expectedRevision, comment bắt buộc
DELETE /v1/glossaryTerms/technical/records/{id}?expectedRevision=
GET    /v1/glossaryTerms/technical/records/{id}/history?limit=&offset=
GET    /v1/glossaryTerms/technical/export
GET    /v1/glossaryTerms/import/technical/template
POST   /v1/glossaryTerms/import/technical/preview
POST   /v1/glossaryTerms/import/technical/{importSessionId}/commit
GET    /v1/glossaryTerms/technical/snapshots
GET    /v1/glossaryTerms/technical/snapshots/{dataDictionaryVersion}/export
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

### 13.2. Mã lỗi

| Mã | HTTP | Ý nghĩa |
| --- | --- | --- |
| `TD_DATA_DICTIONARY_NOT_ACTIVE` | 409 | Chưa có DD Approved (TDV-06) |
| `TD_RECORD_NOT_FOUND` | 404 | Bản ghi không tồn tại hoặc đã bị xóa khi làm mới |
| `TD_RECORD_REVISION_CONFLICT` | 409 | `expectedRevision` lệch |
| `TD_INVALID_STATUS_TRANSITION` | 409 | Trạng thái hiện tại không cho phép approve/reject/resubmit |
| `TD_SELF_APPROVAL_FORBIDDEN` | 403 | Người tạo cố phê duyệt bản ghi của chính mình |
| `TD_REJECTION_COMMENT_REQUIRED` | 400 | Từ chối nhưng không nhập lý do |
| `TD_CDE_SCOPE_NOT_ACTIVE` | 409 | CDE không thuộc DD đang gắn hoặc không còn Approved |
| `TD_RANK_REQUIRED`, `TD_RANK_DUPLICATE` | 400 / 409 | §7.2 |
| `TD_COLUMN_NOT_FOUND`, `TD_COLUMN_ALREADY_DECLARED` | 404 / 409 | Column không tồn tại / đã khai báo |
| `TD_SERVER_OWNED_FIELD`, `TD_INVALID_FIELD` | 400 | §3.2 |
| `TD_IMPORT_ROW_NOT_MATCHED`, `TD_IMPORT_CONFLICT`, `TD_IMPORT_SESSION_INVALID` | 400 / 409 | Gồm trường hợp DD đã đổi version (§9.3) |
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

1. TD không có bộ chọn phiên bản hay bulk workflow. Bản ghi mới ở `In Review`, người tạo không tự duyệt,
   và chỉ sau khi actor có `canApprove` phê duyệt thì bản ghi mới thành `Approved` và tag trên Column mới
   được cập nhật qua outbox.
2. Bản ghi chỉ có khi người dùng khai báo Column; Column chưa khai báo không xuất hiện; mỗi Column tối đa một bản ghi.
3. Chỉ gán được CDE `Approved` của DD đang hiệu lực; gán CDE của DD đã lưu trữ bị backend từ chối.
4. Phê duyệt DD `vN+1` xóa toàn bộ bản ghi TD ở mọi trạng thái và chụp lại đủ các bản ghi `Approved` đã gán CDE vào
   `technical_binding_snapshot` với `vN`, trong cùng transaction. Lỗi thì DD không được phê duyệt.
5. Sau làm mới, mọi Column từng được khai báo (kể cả chưa gán CDE) không còn tag CDE `vN` hay bốn tag
   classification do TD quản lý.
6. Tab Tài sản của CDE thuộc DD đang hiệu lực dùng giao diện gốc và chỉ phản ánh bản ghi `Approved`; bản ghi
   `In Review`/`Rejected` không xuất hiện và không gắn tag lên Column. Sửa bản ghi đã duyệt phản ánh ngay.
   CDE của DD đã lưu trữ có tab Tài sản (chỉ đọc) hiển thị đúng danh sách cột và Thứ hạng tại thời điểm cutover, ở
   mọi version `vN.x`, kể cả sau khi Column bị xóa khỏi nguồn.
7. Ghi TD đồng thời với cutover DD không để lại bản ghi trỏ tới CDE của DD đã lưu trữ.
8. Thứ hạng không trùng trong cùng CDE trên các bản ghi `Approved` còn nguồn, kể cả khi phê duyệt/lưu đồng thời.
9. Import chỉ ghi cột có mặt trong file, tạo bản ghi cho Column chưa khai báo ở `In Review` và commit nguyên tử;
   Import không tự phê duyệt bản ghi mới.
10. Bản chụp tải được và Import lại được vào TD hiện tại; không có API hay job nào xóa bản chụp.
11. Mọi thay đổi và quyết định phê duyệt (người dùng, Import, approve/reject/resubmit, ingest, làm mới) có
    dòng audit, đọc được qua API `/history` (giao diện không hiển thị).
12. Đọc danh sách/export không quét Postgres; ghi luôn kiểm tra trên Postgres rồi đồng bộ index.
13. Bảng đúng 14 trường và thứ tự §11.2, không có cột Chủ sở hữu; header không có thẻ thống kê; bốn cột trái
    và cột Hành động cố định; scrollbar đúng thiết kế.
14. `DATA_PROPOSER` tạo được bản ghi nhưng không phê duyệt; Data Steward/Admin khác người tạo duyệt. Sửa bản
    ghi đã `Approved` vẫn có hiệu lực ngay.

## 16. Hiện trạng triển khai

Đã triển khai trong nhánh làm việc: schema (migration `1.13.3` và `bootstrap/sql/schema`), DAO
`TechnicalDictionaryDAO`, ghi record (`TechnicalRecordService`), cutover trong transaction phê duyệt DD
(`TechnicalCutover`), outbox (`TechnicalOutbox`), index phẳng, REST (`TechnicalDictionaryResource`,
`TechnicalDictionaryImportResource`), endpoint `technicalAssets` và UI. Đã bỏ profile `TECHNICAL_DICTIONARY`
khỏi Governed Glossary, bootstrap/bulk workflow và các bảng governed của TD.

Luồng maker-checker tại §7.3 đã được bổ sung: bản ghi mới/import mới ở `In Review`, có capability và endpoint
approve/reject, chặn tự duyệt, audit đầy đủ, lọc trạng thái trên index và UI duyệt từng bản ghi. Chỉ dữ liệu
`Approved` được projection, xuất hiện trong tab Tài sản và được tính là đã gán CDE.

Khác biệt so với mô tả ở trên:

| Mục | Thiết kế | Triển khai | Lý do |
| --- | --- | --- | --- |
| §7.2, §9.3 | Khóa advisory theo `cdeTermId` | Ghi có thể đổi CDE/Thứ hạng lấy khóa `FOR UPDATE` trên `technical_dictionary_state`; ghi khác lấy `FOR SHARE` | Portable giữa MySQL và PostgreSQL; ghi Thứ hạng tần suất thấp |
| §9.1 bước 2 | `INSERT ... SELECT` bản chụp | Đọc từng trang bản ghi và `INSERT` từng dòng cùng transaction | Payload bản chụp là JSON phẳng khó dựng bằng SQL portable |
| §4 `technical_binding_snapshot` | Nhân đôi mọi cột | Cột khóa và cột `payload` JSON là dòng phẳng đầy đủ | Export và `technicalAssets` dùng đúng dòng phẳng của index |
| §6.1 | Ghi index ngay rồi mới xếp hàng khi lỗi | Ghi `INDEX`/`PROJECTION` vào outbox trong transaction rồi xử lý ngay sau commit | Không mất sự kiện nếu tiến trình dừng giữa commit và ghi index |
| §9.2 | Xử lý `RESET` trong request phê duyệt | `RESET` chạy nền qua worker của outbox | Gỡ tag trên hàng chục nghìn Column có thể mất vài phút |
| §12.1 | Export theo 14 trường của bảng | Export và template Import vẫn 16 cột, gồm hai cột Chủ sở hữu (`TechnicalExcelExporter.HEADERS`) | Chưa đổi theo TD-D17; cần chốt có bỏ hai cột khỏi Excel hay không |
| §13.1 | — | `/technical/stats` vẫn còn nhưng UI không gọi | Chỉ giao diện đã đổi theo TD-D17 |
| §11.3 | Chủ sở hữu hệ thống nhập được ở Import | Không còn nhập được ở modal; `systemOwnerId` vẫn có ở API, Import/Export | Chưa có nơi nhập trên UI nếu chưa dùng Import |
| Dữ liệu cũ | Bản ghi TD hiện hữu giữ hiệu lực | Migration thêm trạng thái với mặc định `Approved`; glossary cũ và các `GlossaryTerm` của mô hình cũ không được dọn tự động | Tránh làm mất hiệu lực dữ liệu đang dùng |

Đối chiếu code ngày 2026-10-05: `TechnicalExcelExporter.HEADERS` vẫn 16 cột và `/technical/stats` vẫn tồn tại.
Chưa có tài liệu kiểm thử `docs/test` cho TD.

Chưa kiểm chứng: SQL chưa chạy trên MySQL/PostgreSQL thật, luồng OpenSearch chưa chạy thật; thay đổi giao
diện TD-D17 chưa được build/test. Chỉ `en-us` và `vi-vn` có khóa i18n mới; các locale còn lại chưa đồng bộ.

## 17. Ảnh hưởng tới tài liệu và mã nguồn khác

| Nơi | Thay đổi |
| --- | --- |
| DQ design §5.4 | Chỉ áp dụng cho DQ Rule; liên kết CDE của TD theo §7.1 tài liệu này |
| CDE design, tab Assets và API spec §9.6 | Theo §11.5: tab gốc theo tag cho CDE hiện hành, tab thêm vào từ `technicalAssets` cho phiên bản đã lưu trữ; cần rà lại phần mô tả tab Assets trong hai tài liệu này |
| `GlossaryVersioningService` | Thêm bước §9.1 vào transaction cutover; publish-preview §9.4 |
| `TechnicalColumnProjection` | Tính tag từ `technical_record`; xử lý `RESET` |
| `GovernedGlossaryProfileRegistry`, `TechnicalDictionaryBootstrap` | Bỏ profile TD; bootstrap chỉ tạo glossary phân quyền và bảng |
| UI `TechnicalDictionaryPage/*` | Header §11.1, 14 cột §11.2, modal §11.3 |

## 18. Tài liệu tham khảo

- [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md).
- [Thiết kế Từ điển dữ liệu dùng chung](./cde-glossary-ui-design.md).
- [Kế hoạch triển khai index riêng của Từ điển kỹ thuật](./technical-dictionary-search-index-implementation-plan.md).
- [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md).
