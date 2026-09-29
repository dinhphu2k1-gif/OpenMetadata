# Thiết kế Từ điển kỹ thuật (Technical Dictionary) — profile của Governed Glossary

> Trạng thái tài liệu: **Thiết kế đích**.
>
> Từ điển kỹ thuật là profile `TECHNICAL_DICTIONARY` của Governed Glossary và
> **kế thừa toàn bộ** [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md)
> (qua đó kế thừa [Thiết kế Từ điển dữ liệu dùng chung](./cde-glossary-ui-design.md)).
> Tài liệu này chỉ mô tả phần **khác** DQ. Mọi hành vi không được nêu ở đây —
> catalog lifecycle, business version, state machine, cutover/archive, capability,
> optimistic locking, DB-backed list/search, import/export session, audit,
> observability — áp dụng nguyên văn tài liệu DQ.
>
> Baseline kiến trúc: [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md).

## 1. Khác biệt so với Chất lượng dữ liệu

| Hạng mục | Chất lượng dữ liệu (DQ) | Từ điển kỹ thuật (TD) |
| --- | --- | --- |
| Glossary hệ thống | `Data Quality` / `Chất lượng dữ liệu` | `Technical Dictionary` / `Từ điển kỹ thuật` |
| Bản ghi | DQ Rule do người dùng tạo | Bản ghi kỹ thuật **chỉ do hệ thống sinh từ physical Column** |
| `name` (mã nghiệp vụ) | Mã quy tắc do người dùng nhập | Column key do server sinh, không hiển thị |
| Liên kết bắt buộc | CDE (bắt buộc) | Column (bắt buộc, server-owned); CDE tùy chọn |
| Schema trường | 19 trường DQ | 19 trường TD (§4) |
| Tạo/xóa thủ công | Có theo capability | **Không** — `canCreate = false`, `canDelete = false` với mọi người dùng |
| Trang chi tiết | Có (Overview, Assets, Versions) | **Không** — row mở modal xem/sửa (§7) |
| Import | Tạo mới và cập nhật | **Chỉ cập nhật** các trường editable, chủ yếu để gán CDE nhanh (§8) |
| Bulk workflow | Có | Có, bổ sung chọn toàn bộ kết quả lọc (§9) |
| Nguồn record mới | Form/Import | Bootstrap job và sự kiện Column (§5) |

## 2. Quyết định đã chốt

| ID | Quyết định |
| --- | --- |
| TD-D01 | TD là profile `TECHNICAL_DICTIONARY` của Governed Glossary; dùng cùng engine, endpoint và UI shell với DQ. Không có resource, state machine, version resolver hoặc scope object riêng. |
| TD-D02 | Người dùng không tạo và không xóa record. Record chỉ được tạo bởi bootstrap job/sự kiện Column chạy dưới system principal. |
| TD-D03 | Identity theo scope giống DQ: mỗi catalog version `N` có identity riêng; cùng Column ở `N` và `N+1` là hai identity khác nhau. Record dùng version `N.MINOR`. |
| TD-D04 | Liên kết CDE dùng Data Dictionary **cùng số version `N`**: record trong TD `N` chỉ được gán CDE thuộc Data Dictionary scope `N`. |
| TD-D05 | Import chỉ cập nhật trường editable của record đã tồn tại; không tạo record. |
| TD-D06 | Không có trang chi tiết; bảng và modal phải đủ thông tin. |
| TD-D07 | Catalog `N+1` bắt đầu trắng như DQ; bootstrap sinh lại record `N+1.0` từ Column. Mapping CDE không tự kế thừa; người dùng dùng Export `N` → Import `N+1` để gán nhanh. |
| TD-D08 | Database là nguồn sự thật; tag CDE trên Column, survivorship rule và search index là projection qua outbox. |

## 3. Identity và liên kết Column

### 3.1. Column key

OpenMetadata không có UUID riêng cho `Column`; Column được định danh bằng
`fullyQualifiedName` trong Table. TD dùng cùng quy ước với
`ColumnSearchIndex.generateColumnId`:

```text
columnKey = UUID.nameUUIDFromBytes(columnFqn UTF-8)
name      = columnKey (chuỗi UUID canonical)
FQN       = Technical Dictionary.{columnKey}@v{N}
```

- Unique key nghiệp vụ dùng lại key chung `(glossaryId, parentBusinessVersion, normalizedName)`;
  vì `name = columnKey` nên mỗi Column có tối đa một record trong một scope.
  Không cần bảng binding Column riêng.
- `name` không hiển thị trên UI/Excel; người dùng nhận diện record qua
  Database/Schema/Bảng/Cột.
- **Đổi tên Column hoặc Table làm đổi FQN nên đổi `columnKey`.** Hệ thống coi đó là
  Column cũ không còn và Column mới xuất hiện (§5.3). Không nối lại theo tên gần giống.

### 3.2. Source snapshot

Thông tin nguồn là trường server-owned, được khai báo trong profile manifest và
đăng ký trong schema custom property trước khi bootstrap:

| Trường | Ý nghĩa |
| --- | --- |
| `sourceColumnFqn` | FQN Column tại thời điểm snapshot |
| `sourceService` | Database service (cột **Nguồn**) |
| `sourceDatabase`, `sourceSchema`, `sourceTable`, `sourceColumn` | Vị trí Column |
| `sourceDataType`, `sourceDataLength`, `sourcePrecision`, `sourceScale` | Kiểu dữ liệu |
| `description` | Mô tả Column từ ingestion |
| Trạng thái nguồn | Không nằm trong snapshot của record: bảng vận hành `technical_source_state` (`Available`/`Unavailable`/`Changed`) theo `(catalog, N, columnKey)`; snapshot đã publish luôn bất biến |

Quy tắc:

- Client gửi bất kỳ trường server-owned nào trong Save Draft/Import → `400`.
- Working `Draft` được server làm mới source snapshot khi Column thay đổi thuộc tính
  (kiểu, độ dài, mô tả). Published snapshot bất biến.
- Record Approved không tự sinh Draft khi Column thay đổi; bảng hiển thị badge
  **Nguồn đã thay đổi** khi snapshot khác metadata hiện tại. Thay đổi được đưa vào
  version kế tiếp do người dùng chủ động tạo, hoặc catalog version sau.

## 4. Schema hiển thị — 19 trường

Checkbox chọn hàng và cột **Hành động** là control UI, không tính vào 19 trường.

| STT | Trường UI | Lưu trữ | Nguồn giá trị | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | Tên cơ sở dữ liệu | `sourceDatabase` | Hệ thống | Cố định trái |
| 2 | Tên Schema | `sourceSchema` | Hệ thống | Cố định trái |
| 3 | Tên Bảng | `sourceTable` | Hệ thống | Cố định trái |
| 4 | Tên cột | `sourceColumn` | Hệ thống | Cố định trái |
| 5 | Chủ sở hữu dữ liệu | relation → CDE `owners` | Suy ra | Read-only; `--` khi chưa quy chiếu CDE (TD-D10) |
| 6 | Nguồn | `sourceService` | Hệ thống | |
| 7 | Mã CDE quy chiếu | relation → CDE `name` | Người dùng | Tùy chọn; nguồn sự thật là CDE `termId` + `versionContext` |
| 8 | Tên thành tố CDE | relation → CDE `displayName` | Suy ra | Read-only |
| 9 | Thứ hạng | `extension.survivorshipRank` | Người dùng | Quy tắc tại §6.4 |
| 10 | Loại dữ liệu | `sourceDataType` + length/precision/scale | Hệ thống | |
| 11 | Loại thành tố | Tag `DataElementType.*` | Người dùng | Đơn trị, allowlist classification |
| 12 | Loại trường dữ liệu | Tag `FieldGenerationType.*` | Người dùng | Đơn trị, allowlist classification |
| 13 | Phương thức tạo | Tag `DataCreationMethod.*` | Người dùng | Đơn trị, allowlist classification |
| 14 | Thời gian | Tag `DataTimeliness.*` | Người dùng | Đơn trị, allowlist classification (TD-D12) |
| 15 | Chủ sở hữu hệ thống | `extension.systemOwner` | Người dùng | Custom property kiểu `entityReference` tới một Team (TD-D11) |
| 16 | Mô tả | `description` | Hệ thống | Mô tả Column từ ingestion (TD-D13) |
| 17 | Phiên bản | `businessVersion` | Hệ thống | `N.MINOR` |
| 18 | Loại phiên bản phát hành | `extension.releaseVersionType` | Hệ thống | `Bản chính`/`Bản phụ` theo DQ |
| 19 | Trạng thái | `entityStatus` | Workflow | Cột nghiệp vụ cuối cùng |

Không có cột **Phiên bản CDE**; exact CDE version nằm trong `versionContext` và dùng
cho audit/historical render.

Các trường phân loại dùng Classification giống cách DQ dùng tag cho tiêu chí/hình thức/tần suất,
với giá trị canonical đã có trong seed:

| Classification | Tag |
| --- | --- |
| `DataElementType` | `AtomicDataElement` (Dữ liệu nguyên tố), `TransformedDataElement` (Dữ liệu chuyển đổi) |
| `FieldGenerationType` | `SystemGenerated` (Hệ thống tự sinh), `SystemDerived` (Hệ thống tính toán), `ManualInput` (Nhập thủ công), `FileUpload` (Tải lên) |
| `DataCreationMethod` | `Parameterised` (Tham số), `Hardcoded` (Mã cứng), `NotApplicable` (N/A) |
| `DataTimeliness` | Danh sách chuẩn hóa theo TD-D12 |

Tag chỉ nhận giá trị trong allowlist classification tương ứng; UI và Excel dùng `displayName`,
API lưu tag FQN.

## 5. Sinh record từ Column

### 5.1. Bootstrap job

Bootstrap job là trạng thái vận hành, tách khỏi workflow status.

| Thuộc tính | Quy tắc |
| --- | --- |
| Khóa | `(technicalGlossaryId, parentBusinessVersion)` |
| Trạng thái | `Pending`, `Running`, `Succeeded`, `Failed` |
| Tiến độ | `total`, `processed`, `created`, `skipped`, `failed`, checkpoint |
| Lỗi | Error summary và mẫu lỗi theo Column; không nuốt exception |

Luồng:

1. Preflight một lần: profile manifest, custom properties, classifications đã đăng ký và
   cấu hình phạm vi Column (§5.4) không rỗng. Thiếu thì job `Failed` với lỗi cụ thể
   trước khi duyệt Column.
2. Duyệt Column thuộc phạm vi (§5.4) theo batch, có checkpoint.
3. Với mỗi Column chưa có record trong scope `N`: tạo identity và working `N.0 Draft`
   qua cùng service tạo governed record của DQ, dưới system principal.
4. Column đã có record trong scope → bỏ qua. Chạy lại job không tạo trùng
   (được bảo vệ bởi unique key §3.1).
5. `Succeeded` chỉ khi mọi Column được xử lý; lỗi từng Column được lưu và retry được.

Job được kích hoạt khi:

- Khởi tạo Technical Dictionary lần đầu (catalog Draft `1`).
- Tạo catalog version kế tiếp `N+1` (§6.2).
- Admin chạy lại job lỗi.

### 5.2. Column mới sau bootstrap

Sự kiện Column mới đi qua outbox, tạo `N.0 Draft` cho Column đó trong mọi TD scope
chưa Archived (active và working nếu có). Idempotent theo unique key.

### 5.3. Column không còn tồn tại

- Record không bị xóa; trạng thái nguồn là `Unavailable`, bảng hiển thị badge **Nguồn không còn**.
- Record `Draft`/`In Review` có nguồn không còn không được Submit/Approve
  (`TD_SOURCE_UNAVAILABLE`); Reject vẫn cho phép.
- Record `Approved` giữ nguyên để tra cứu; catalog version sau không sinh lại record cho Column này.
- Đổi tên Column/Table được xử lý như Column cũ không còn và Column mới xuất hiện.
  Không tự nối lại mapping; người dùng gán lại qua modal hoặc Import (TD-D14).
- Table bị soft-delete được xử lý như mọi Column của Table không còn; restore Table
  đặt lại trạng thái nguồn `Available` nếu record chưa bị Archived.

### 5.4. Phạm vi Column

Phạm vi được cấu hình ở mục `technicalDictionary` của `openmetadata.yaml` (`includeServices`,
`includeDatabases`, `includeSchemas`, `excludePatterns`; biến môi trường `TECHNICAL_DICTIONARY_*`,
mặc định loại `TMP_*,*_BAK,*_OLD`) và **chụp lại vào bootstrap job khi tạo
catalog version** (`columnScopeSnapshot`). Mọi sự kiện Column trong scope `N` dùng
snapshot của scope `N`, nên kết quả bootstrap tái lập được.

| Quy tắc | Giá trị |
| --- | --- |
| Include | Danh sách tường minh theo database service; có thể thu hẹp theo database/schema. Danh sách rỗng làm preflight thất bại, không hiểu là "tất cả" |
| Exclude | Pattern tên Table/Schema (glob, không phân biệt hoa thường), ví dụ `TMP_*`, `*_BAK`, `*_OLD` |
| Loại Table được lấy | `Regular`, `Partitioned`, `External`, `Iceberg` — các loại lưu dữ liệu vật lý |
| Loại Table bị loại | `View`, `SecureView`, `MaterializedView`, `Dynamic` (dữ liệu dẫn xuất, truy vết qua lineage); `Transient`, `Local`, `Stream`, `Stage` (tạm thời/đường ống); `Foreign` (trỏ tới dữ liệu của hệ thống khác, tránh ghi nhận trùng) |
| Table soft-delete | Bị loại |
| Column lồng nhau | Chỉ lấy Column cấp cao nhất; `children` của kiểu struct/array/map nằm ngoài phạm vi v1 |

Thay đổi cấu hình chỉ có hiệu lực từ catalog version kế tiếp; không làm thay đổi record
của scope đang tồn tại.

## 6. Version, workflow và liên kết CDE

### 6.1. Kế thừa DQ

Catalog `N`, record `N.MINOR`, Save Draft tăng `workingRevision`, state machine,
cutover `Approved → Archived`, capability và optimistic locking áp dụng nguyên văn DQ §5.1, §7.
Khác biệt duy nhất về capability: `canCreate`, `canDelete` luôn `false` với người dùng.
Proposer có quyền theo policy (DQ §7.3), không theo ownership, vì record không có người tạo là người dùng.

### 6.2. Catalog version kế tiếp

- Tạo catalog `N+1` dùng cùng flow DQ/CDE F10; catalog mới bắt đầu trắng.
- Sau khi tạo, hệ thống chạy bootstrap job cho scope `N+1`, sinh record `N+1.0 Draft`
  cho mọi Column hiện có. Không copy mapping CDE hoặc trường editable từ `N`.
- Cách gán nhanh cho `N+1`: Export TD `N` → Import vào TD `N+1`. Import match theo vị trí
  Column và resolve Mã CDE trong Data Dictionary scope `N+1` (§8).
- Approve catalog `N+1` thực hiện cutover như DQ: TD `N` và record Approved `N.x`
  chuyển Archived, record non-Approved `N.x` bị xóa, `N+1` active. Publish-preview
  phải hiển thị số record `N+1.x` đã Approved; sau cutover Consumer chỉ thấy các record đó.

### 6.3. Liên kết CDE cùng số version

Áp dụng DQ §5.4 với ràng buộc scope:

- Record TD scope `N` chỉ được gán CDE thuộc Data Dictionary scope `N`.
- Selector chỉ trả CDE `Approved` của Data Dictionary scope `N` khi Data Dictionary `N`
  đang `Approved` active.
- Data Dictionary `N` chưa Approved hoặc chưa tồn tại → disable chọn mới, thông báo
  **“Từ điển dữ liệu dùng chung phiên bản N chưa được phê duyệt.”**
- Data Dictionary `N` đã Archived → disable chọn mới, thông báo
  **“Từ điển dữ liệu dùng chung phiên bản N đã lưu trữ. Hãy tạo phiên bản Từ điển kỹ thuật mới.”**
  Mapping hiện có vẫn hiển thị read-only kèm badge `Archived`.
- Relation lưu `termId` + `versionContext`; trong scope, context tự chuẩn hóa sang
  CDE Approved mới nhất như DQ §5.4.
- Mã CDE để trống là hợp lệ (Column chưa quy chiếu).

Hệ quả vận hành: sau khi Data Dictionary cutover sang `N+1`, TD `N` không gán thêm CDE
cho tới khi TD `N+1` được tạo, bootstrap và gán mapping.

### 6.4. Thứ hạng (survivorship rank)

Thứ hạng xác định Column nào được ưu tiên khi nhiều Column cùng quy chiếu một CDE.

- Số nguyên từ `1` đến `999`; `1` là ưu tiên cao nhất. Cho phép có khoảng trống (`1, 3, 5`).
- Có CDE thì bắt buộc có Thứ hạng; không có CDE thì Thứ hạng phải trống.
  Save Draft cho phép thiếu, Submit và Approve kiểm tra bắt buộc.
- **Duy nhất trong cùng CDE identity trong một TD scope**, xét trên các representation
  hiệu lực (`Approved`) có `sourceAvailable = true`. Record có nguồn không còn không
  giữ Thứ hạng và không tham gia survivorship.
- Mức kiểm tra:

| Thời điểm | Hành vi khi trùng |
| --- | --- |
| Save Draft, Import preview | Cảnh báo, vẫn cho lưu để người dùng sắp xếp lại |
| Submit | Lỗi `TD_RANK_DUPLICATE` nếu trùng record `Approved` khác |
| Approve (đơn lẻ hoặc bulk) | Lỗi `TD_RANK_DUPLICATE`; kiểm tra trên trạng thái sau khi toàn bộ tập đang duyệt được áp dụng |

- Approve khóa theo `(glossaryId, parentBusinessVersion, cdeTermId)` trước khi kiểm tra
  để hai phê duyệt đồng thời không tạo trùng.
- Đổi chỗ Thứ hạng giữa hai record `Approved`: tạo minor version cho cả hai, Submit rồi
  **bulk Approve cùng lúc**; kiểm tra trên trạng thái cuối nên hợp lệ. Approve riêng
  từng record sẽ bị từ chối và thông báo record đang giữ Thứ hạng đó.

## 7. Giao diện

### 7.1. Route

```text
/technical-dictionary
/technical-dictionary?businessVersion=N
```

- Route mặc định resolve catalog giống DQ/CDE: Consumer-only mở Approved mới nhất;
  người có `canViewWorking` mở working nếu có, nếu không mở Approved mới nhất.
- Explicit version không tồn tại hoặc không có quyền → Not Found/Forbidden, không fallback.
- Filter khác mặc định đồng bộ URL như DQ §8.3; giá trị mặc định không ghi lên URL.
- Không có UUID, `scopeId` hoặc route chi tiết record.

### 7.2. Bố cục

```text
Quản trị / Từ điển kỹ thuật

┌──────────────────────────────────────────────────────────────────────┐
│ [Icon] Từ điển kỹ thuật  [Trạng thái] [Phiên bản: N ▾]   [Action] [⋯]│
├────────────────┬────────────────┬────────────────┬───────────────────┤
│ Tổng cột       │ Bảng dữ liệu   │ Đã quy chiếu   │ Hệ thống nguồn    │
└────────────────┴────────────────┴────────────────┴───────────────────┘
┌──────────────────────────────────────────────────────────────────────┐
│ [Tìm kiếm] [Trạng thái] [Nguồn] [CDE] [Loại TT] [Loại trường]        │
│ [Phương thức tạo] [Tình trạng nguồn]           [Bulk ▾] [Tùy chỉnh]  │
├──────────────────────────────────────────────────────────────────────┤
│ □ │ Database │ Schema │ Bảng │ Cột │ ... │ Phiên bản │ Loại PH │ TT │⋯│
└──────────────────────────────────────────────────────────────────────┘
```

- Header, badge, version selector và catalog actions dùng shared shell của DQ.
  Không có nút **Thêm thuật ngữ**.
- Menu `⋯` của header: Xuất Excel, Nhập gán CDE (theo `canImport`), Trạng thái bootstrap (Admin).
- Stats tính theo catalog version đang chọn và quyền xem:

| Card | Ý nghĩa |
| --- | --- |
| Tổng cột | Số record trong scope |
| Bảng dữ liệu | Số Table phân biệt |
| Đã quy chiếu CDE | Record hiệu lực có CDE |
| Hệ thống nguồn | Số service phân biệt |

- Bootstrap `Running`: vùng bảng hiển thị tiến độ; header vẫn dùng catalog status.
  Bootstrap `Failed`: hiển thị lỗi cụ thể và nút chạy lại nếu có quyền.

### 7.3. Search và filter

- Search: database, schema, table, column, Mã/Tên CDE.
- Filter: Trạng thái, Nguồn, Mã CDE (gồm lựa chọn **Chưa quy chiếu**), Loại thành tố,
  Loại trường dữ liệu, Phương thức tạo, Thời gian, Chủ sở hữu hệ thống, Tình trạng nguồn.
  Filter tag gửi tag FQN, filter Team gửi Team ID.
- Kết hợp filter, reset page, chống stale response, Consumer không thấy working status:
  theo DQ §8.3.
- Mặc định mỗi record hiển thị representation mới nhất actor được xem; chế độ
  **Tất cả phiên bản** hiển thị các version thành row phẳng.

### 7.4. Bảng

- Thứ tự cột theo §4, sau đó là cột **Hành động**.
- Bốn cột Database, Schema, Bảng, Cột cố định trái; **Hành động** cố định phải,
  chỉ rộng đủ cho icon.
- Scrollbar ngang luôn nhìn thấy ở đáy vùng bảng, cách footer; không che row.
- Giá trị thiếu hiển thị `--`; action có tooltip và accessible name.
- Column preference key `governedGlossary.TECHNICAL_DICTIONARY.v1`.
- Row actions theo capability: Xem, Sửa, Gửi duyệt, Phê duyệt, Từ chối, Mở lại,
  Tạo phiên bản mới, Thu hồi. Không có action lịch sử riêng.

### 7.5. Modal thay cho trang chi tiết

- Dùng modal shell chung với DQ: header/footer cố định, chỉ body cuộn, căn giữa,
  một cột trên mobile, không tạo scrollbar ngoài thứ hai.
- Hai chế độ: **Xem** (Approved, Archived, historical, In Review hoặc không có
  `canEdit`) và **Sửa** (Draft có `canEdit`). Không có chế độ tạo mới.
- Nhóm **Phiên bản** (read-only): Phiên bản, Loại phiên bản phát hành.
- Nhóm **Nguồn** (read-only): Database, Schema, Bảng, Cột, Nguồn, Loại dữ liệu, Mô tả,
  badge tình trạng nguồn.
- Nhóm **Quy chiếu và đặc tả** (editable ở Draft): Mã CDE (Tên thành tố và
  Chủ sở hữu dữ liệu tự điền, read-only), Thứ hạng, Loại thành tố, Loại trường dữ liệu,
  Phương thức tạo, Thời gian, Chủ sở hữu hệ thống.
- Cảnh báo trùng Thứ hạng hiển thị ngay tại field kèm record đang giữ Thứ hạng đó.
- Footer chứa workflow action theo capability; Save Draft và chống double-click theo DQ §8.4.
- CDE selector dùng component của DQ với contract scope §6.3; placeholder
  **“Tìm theo mã hoặc tên CDE”**; option `Mã CDE · Tên thành tố · v<businessVersion>`.

## 8. Import gán CDE

Dùng cùng khung import session của DQ (template → preview → commit, TTL,
file hash, atomic commit, re-authorize). Khác biệt:

### 8.1. Match record

- Mỗi dòng match đúng một record trong scope đang mở theo
  `Tên cơ sở dữ liệu + Tên Schema + Tên Bảng + Tên cột` (và `Nguồn` nếu có trong file).
- Không match hoặc match nhiều → lỗi dòng. **Không tạo record.**
- File Export của TD dùng trực tiếp làm file import được.

### 8.2. Cột được cập nhật

- Cột editable: Mã CDE quy chiếu, Thứ hạng, Loại thành tố, Loại trường dữ liệu,
  Phương thức tạo, Thời gian, Chủ sở hữu hệ thống.
- Cột nhận diện: bốn cột vị trí và Nguồn. Cột server-owned hoặc suy ra (Tên thành tố,
  Chủ sở hữu dữ liệu, Loại dữ liệu, Mô tả, Phiên bản, Trạng thái...) trong file bị bỏ qua.
- Tag resolve theo `displayName` trong đúng classification; Chủ sở hữu hệ thống resolve
  theo `displayName` của Team. Không tìm thấy hoặc trùng tên là lỗi dòng; không tự tạo Team/tag.
- Trùng Thứ hạng trong file hoặc với record `Approved` là cảnh báo ở preview (§6.4).
- **Chỉ cập nhật các cột editable có mặt trong file.** Cột vắng mặt giữ nguyên;
  cột có mặt nhưng ô trống thì xóa giá trị. File tối thiểu gồm bốn cột vị trí và Mã CDE.
- Mã CDE resolve theo `name` trong Data Dictionary scope cùng số `N`, chỉ nhận CDE
  `Approved`. Nếu có cột Tên thành tố thì phải khớp CDE đã resolve.

### 8.3. Chính sách cập nhật

Người dùng chọn một trong hai trước preview:

| Chính sách | Hành vi |
| --- | --- |
| `DRAFT_ONLY` (mặc định) | Chỉ ghi vào record đang `Draft`; record trạng thái khác nhận `SKIP` |
| `ALL_EDITABLE` | `Draft`: cập nhật; `In Review`/`Rejected`: thay payload và đưa về `Draft`; chỉ có `Approved`: tạo minor Draft kế tiếp rồi ghi |

Preview action: `UPDATE_DRAFT`, `REPLACE_IN_REVIEW_AND_REOPEN`,
`REPLACE_REJECTED_AND_REOPEN`, `CREATE_VERSION`, `SKIP`, `NO_CHANGE`.
Dòng có nội dung giống hệt giá trị hiện tại nhận `NO_CHANGE` và không tăng revision.

## 9. Bulk workflow

Kế thừa DQ §8.6, bổ sung một điểm do quy mô dữ liệu (khoảng 65k record mỗi scope):

- Ngoài chọn theo trang, có lựa chọn **Áp dụng cho toàn bộ N kết quả đang lọc**.
- Request gửi filter criteria, không gửi danh sách ID; backend resolve lại tập row
  theo quyền trong database, xử lý theo batch và trả báo cáo thành công/thất bại theo row.
- Chỉ Submit row `Draft`, Approve/Reject row `In Review`; row không hợp lệ được liệt kê
  trong preview với lý do.
- Triển khai trong `GovernedBulkWorkflowService` dùng chung. Mỗi request xử lý **một chunk**
  (mặc định 500, tối đa 1000 record, mỗi record một transaction); client lặp lại với
  `offset = số record đã thất bại` cho tới khi `remaining = 0`. Hiệu ứng phụ (outbox,
  search) được gom và flush cuối chunk. Bulk Approve kiểm tra Thứ hạng trên trạng thái cuối
  của chunk.

## 10. REST contract

TD dùng đúng endpoint của DQ; backend rẽ nhánh theo profile resolve từ `glossaryId`.

| Mục đích | Endpoint |
| --- | --- |
| Working/tạo/lưu catalog | `GET/POST/PATCH /v1/glossaries/{id}/working` |
| Workflow catalog | `POST /v1/glossaries/{id}/working/{submit\|reject\|reopen\|approve}` |
| Publish preview | `GET /v1/glossaries/{id}/working/publish-preview` |
| Lịch sử/chi tiết catalog | `GET /v1/glossaries/{id}/published`, `/published/{businessVersion}` |
| Working record | `GET/PATCH /v1/glossaryTerms/{id}/working?parentBusinessVersion=N` |
| Tạo minor version | `POST /v1/glossaryTerms/{id}/working` |
| Workflow record | `POST /v1/glossaryTerms/{id}/working/{action}?parentBusinessVersion=N` |
| Lịch sử record | `GET /v1/glossaryTerms/{id}/published?parentBusinessVersion=N` |
| Quyền | `GET /v1/glossaryTerms/{id}/permissions?parentBusinessVersion=N` |
| List/search | Endpoint flat list/search governed dùng chung (F11/F12), `glossary` + `parentBusinessVersion` + filter profile |
| Export | `GET /v1/glossaryTerms/export`, rẽ nhánh theo profile của `glossary` |
| Bulk | `POST /v1/glossaryTerms/bulk/{submit\|approve\|reject}` (chunk, `dryRun`) |

Endpoint chỉ TD có:

```http
GET  /v1/glossaries/{id}/bootstrap-jobs?businessVersion=N
POST /v1/glossaries/{id}/bootstrap-jobs?businessVersion=N            # Admin
POST /v1/glossaries/{id}/bootstrap-jobs/{jobId}/retry               # Admin
GET  /v1/glossaryTerms/stats?glossary={id}&parentBusinessVersion=N
GET  /v1/glossaryTerms/import/technical/template
POST /v1/glossaryTerms/import/technical/preview?glossary=&parentBusinessVersion=&updatePolicy=
POST /v1/glossaryTerms/import/technical/{importSessionId}/commit
```

- Import dùng **modal** trong trang danh sách (không có route riêng) và endpoint riêng
  `/glossaryTerms/import/technical/*`; session dùng một lần, gắn actor, hết hạn 30 phút.
- `GET /glossaryTerms/search` nhận `q`, `statuses`, `sourceServices`, `cdeMapping`,
  `cdeTermIds`, `systemOwnerIds`, `sourceStatuses`, `elementTypes`, `generationTypes`,
  `creationMethods`, `timeliness`, `versionView`; `limit` chỉ nhận 10/15/25/50.

- `POST /v1/glossaryTerms` với glossary TD từ người dùng → `403 TD_MANUAL_CREATE_NOT_ALLOWED`.
  Bootstrap gọi service nội bộ, không đi qua REST.
- Không còn `/v1/technical-dictionary/*`, `scopeId`, `scopeVersion` hoặc scope CRUD.

Mã lỗi riêng: `TD_MANUAL_CREATE_NOT_ALLOWED`, `TD_MANUAL_DELETE_NOT_ALLOWED`, `TD_SERVER_OWNED_FIELD`,
`TD_INVALID_FIELD`, `TD_SOURCE_UNAVAILABLE`, `TD_CDE_SCOPE_MISMATCH`, `TD_CDE_SCOPE_NOT_ACTIVE`,
`TD_IMPORT_ROW_NOT_MATCHED`, `TD_IMPORT_CONFLICT`, `TD_IMPORT_SESSION_INVALID`,
`TD_BOOTSTRAP_NOT_READY`, `TD_RANK_DUPLICATE`, `TD_RANK_REQUIRED`, `TD_COLUMN_SCOPE_EMPTY`. Mã chung (`WORKING_REVISION_CONFLICT`, ...) theo DQ.

## 11. Persistence và projection

- Working/snapshot/head/outbox dùng bảng governed chung. Không có
  `technical_dictionary_scope`, `technical_catalog_version_binding` hoặc
  `technical_record_column_binding`.
- Hai bảng riêng: `technical_bootstrap_job` (§5.1), unique
  `(technicalGlossaryId, parentBusinessVersion)`; và `technical_source_state`, khóa chính
  `(technicalGlossaryId, parentBusinessVersion, columnKey)`, giữ trạng thái nguồn vận hành.
- Index list bổ sung cho filter nguồn: `sourceService`, `sourceDatabase`, `sourceTable`
  theo cơ chế index filter của flat read model chung.
- Approve/Revoke/Archive phát outbox idempotent cập nhật: tag CDE (exact scoped FQN)
  và bốn tag phân loại (`DataElementType`, `FieldGenerationType`, `DataCreationMethod`,
  `DataTimeliness`) trên Column, search index và audit.
  Projection quản lý mọi tag Glossary có tiền tố `Data Dictionary.` trên Column và các
  tag thuộc bốn classification của profile.
- **Survivorship rule chưa được projection**: backend chưa có nơi lưu tương ứng trên Column;
  UI đọc `extension.survivorshipRules` của CDE. Khi có đích lưu, thêm vào
  `TechnicalColumnProjection`.
- Record có trạng thái nguồn `Unavailable` không projection lên Column không còn tồn tại.
- Khóa lock Thứ hạng (§6.4) dùng row lock trên bảng governed hiện có hoặc advisory lock
  theo khóa băm; không thêm bảng mới.

## 12. Export

Theo DQ §6.3 với các khác biệt:

- Cột theo §4, không có cột Hành động.
- Tên file `TuDienKyThuat_Agribank_v{N}_YYYYMMDD_HHmm.xlsx`; sheet `Technical Dictionary v{N}`.
- Không chứa UUID, `columnKey` hoặc FQN kỹ thuật.
- File export dùng lại được làm file import (§8.1).

## 13. Quyết định bổ sung theo best practice

| ID | Quyết định | Lý do |
| --- | --- | --- |
| TD-D09 | Phạm vi Column theo allowlist service tường minh, chỉ Table lưu dữ liệu vật lý, chỉ Column cấp cao nhất, cấu hình được chụp lại theo catalog version (§5.4) | Danh mục kỹ thuật mô tả nơi dữ liệu thực sự được lưu; dữ liệu dẫn xuất đã có lineage. Allowlist rỗng fail-fast tránh bootstrap nhầm toàn bộ catalog. Snapshot giúp kết quả tái lập được |
| TD-D10 | Chủ sở hữu dữ liệu suy ra từ `owners` của CDE được quy chiếu, không nhập ở TD | Chủ sở hữu dữ liệu là thuộc tính của thành tố nghiệp vụ; một nguồn sự thật, không nhập trùng và không lệch giữa các Column cùng CDE |
| TD-D11 | Chủ sở hữu hệ thống là tham chiếu tới một Team (custom property `entityReference`), không dùng trường `owners` của OpenMetadata | Tham chiếu có kiểm tra tồn tại, lọc theo ID, không lệch chính tả. Không dùng `owners` để tránh policy "owner được sửa" cấp quyền ngoài ý muốn |
| TD-D12 | Thời gian là Classification `DataTimeliness`, đơn trị. Danh sách tag lấy từ tập giá trị đã chuẩn hóa của file nguồn hiện có, được nghiệp vụ duyệt trước TD01 | Nhất quán với ba trường phân loại còn lại, lọc được, không để text tự do |
| TD-D13 | Mô tả lấy từ Column (server-owned), không sửa ở TD | Mô tả Column do ingestion và trang Table quản lý; sửa ở hai nơi sẽ lệch nhau |
| TD-D14 | Không giữ liên kết lịch sử khi đổi tên Column/Table trong v1 | OpenMetadata không có định danh Column ổn định qua đổi tên; nối theo tên gần giống dễ nối sai. Import cho phép gán lại nhanh |
| TD-D15 | Thứ hạng `1..999`, bắt buộc khi có CDE, duy nhất trong cùng CDE trong một scope trên các record `Approved` còn nguồn; kiểm tra chặt ở Submit/Approve, cảnh báo ở Save Draft/Import (§6.4) | Survivorship cần thứ tự ưu tiên xác định; cho phép Draft tạm trùng để sắp xếp lại, bulk Approve để đổi chỗ |

## 14. Tiêu chí chấp nhận

1. TD dùng chung shell, endpoint, workflow, capability và version với DQ; không còn
   code/route/API scope riêng.
2. Người dùng không tạo và không xóa được record qua UI hoặc API.
3. Mỗi Column có tối đa một record trong một scope; bootstrap chạy lại không tạo trùng.
4. Selector và Import chỉ nhận CDE `Approved` của Data Dictionary scope cùng số `N`;
   request chéo scope bị backend từ chối.
5. Import chỉ cập nhật record đã có, chỉ ghi cột có trong file và commit nguyên tử.
6. Bulk workflow xử lý được toàn bộ kết quả lọc của khoảng 65k record, báo kết quả theo row.
7. Bảng đúng 19 trường và thứ tự; bốn cột trái và cột Hành động cố định; scrollbar đúng thiết kế.
8. Modal thay trang chi tiết: đủ thông tin, chế độ xem/sửa đúng trạng thái và capability.
9. Column không còn tồn tại được đánh dấu, không mất lịch sử, không được Submit/Approve.
   Bootstrap chỉ lấy Column cấp cao nhất của Table lưu dữ liệu vật lý thuộc allowlist.
10. Không có hai record `Approved` còn nguồn cùng CDE và cùng Thứ hạng trong một scope,
    kể cả khi phê duyệt đồng thời.
11. Chủ sở hữu dữ liệu luôn khớp `owners` của CDE được quy chiếu.
12. List/stats/export thống nhất theo catalog version đang chọn và quyền; Consumer không thấy working.
13. Projection hội tụ qua outbox và không xóa metadata ngoài allowlist.

## 15. Tài liệu tham khảo

- [Thiết kế Chất lượng dữ liệu](./dq-glossary-ui-design.md) — tài liệu gốc TD kế thừa.
- [Thiết kế Từ điển dữ liệu dùng chung](./cde-glossary-ui-design.md).
- [Kế hoạch triển khai Từ điển kỹ thuật](./technical-dictionary-feature-implementation-plan.md).
- [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md).
