# Kế hoạch triển khai Từ điển dữ liệu dùng chung theo từng chức năng

## 1. Tài liệu nguồn và phạm vi

Kế hoạch này là kế hoạch triển khai của tài liệu [Thiết kế luồng Từ điển dữ liệu dùng chung và CDE theo Version, Workflow và Role](./cde-glossary-ui-design.md). Khi có khác biệt, tài liệu thiết kế là nguồn yêu cầu nghiệp vụ; kế hoạch này quy định thứ tự thực hiện, kiểm thử và bàn giao.

### Trong phạm vi

- Duy nhất Glossary có định danh nghiệp vụ **Data Dictionary**, hiển thị là **Từ điển dữ liệu dùng chung**.
- Các GlossaryTerm trực thuộc Data Dictionary, được gọi là **Thành tố dữ liệu dùng chung (CDE)**. Data Dictionary là cha duy nhất; mọi CDE là con trực tiếp và không tồn tại quan hệ CDE cha — CDE con.
- Business version, working/published snapshot, maker-checker workflow, phân quyền, danh sách CDE, tìm kiếm/lọc, import/export và Assets được mô tả trong tài liệu thiết kế.
- Data Dictionary là Glossary nghiệp vụ duy nhất được hỗ trợ; toàn bộ GlossaryTerm của nó được xử lý như CDE theo BusinessWorkflow.

### Ngoài phạm vi

- Không cung cấp UI hoặc luồng nghiệp vụ Glossary gốc (`Native Glossary`) của OpenMetadata.
- Không hỗ trợ tạo thêm Glossary nghiệp vụ khác ngoài Data Dictionary.
- Không xóa entity kỹ thuật `Glossary`/`GlossaryTerm` và native metadata version ở tầng OpenMetadata vì đây vẫn là nền lưu trữ, quan hệ và REST contract của Data Dictionary/CDE.

Trong tài liệu này:

- “Data Dictionary” hoặc “Từ điển dữ liệu dùng chung” chỉ Glossary chuyên biệt nêu trên.
- “CDE” chỉ GlossaryTerm trực thuộc Data Dictionary.
- Từ “Glossary” trong tên class/API chỉ mô tả implementation OpenMetadata; ở tầng sản phẩm, nó luôn được biểu diễn là Data Dictionary hoặc CDE.

## 2. Cách chia

Mỗi mục bên dưới là một lát dọc có thể nghiệm thu độc lập, gồm backend contract, authorization, persistence/query, frontend API, UI và test. Một chức năng chưa hoàn thành nếu mới có API hoặc mới có giao diện.

Mỗi chức năng nên là một PR; chức năng lớn có thể tách PR backend và frontend nhưng chỉ tích hợp vào nhánh phát hành khi cả hai đã hoàn tất. Không trộn refactor ngoài phạm vi.

## 3. Thứ tự triển khai

| ID | Chức năng | Phụ thuộc | Mốc bàn giao |
| --- | --- | --- | --- |
| F00 | BusinessWorkflow foundation và safety baseline | Không | Nền tảng |
| F01 | Consumer xem Approved mới nhất | F00 | Read-only pilot |
| F02 | Lịch sử Approved và deep link | F01 | Read-only pilot |
| F07 | Lưu Draft Data Dictionary khởi tạo sẵn | F00 | Dictionary maker |
| F03 | Tạo và lưu Draft CDE | F00, F07 | CDE maker |
| F04 | Submit, Reject và Reopen CDE | F01, F03 | CDE checker |
| F05 | Approve và publish CDE | F01, F04 | Vòng đời CDE |
| F06 | Tạo business version CDE kế tiếp | F05 | Nhiều version CDE |
| F08 | Thêm/bớt CDE revision trong working Data Dictionary | F05, F07 | Soạn gói phát hành |
| F09 | Workflow và publish Data Dictionary | F01, F08 | Vòng đời Dictionary |
| F10 | Tạo business version Data Dictionary kế tiếp | F09 | Nhiều version Dictionary |
| F11 | Bảng flat mọi CDE business version | F02, F05 | Tra cứu đầy đủ |
| F12 | Search, filter, sort và pagination | F11 | Khai thác dữ liệu |
| F13 | Export theo quyền và bộ lọc | F12 | Export |
| F14 | Import vào Draft | F03, F07 | Import |
| F15 | CDE Overview và Assets | F02, F05 | Chi tiết CDE |
| F16 | Archive/delete, audit và vận hành | F05, F09 | Production-ready |

F00 bootstrap nguyên tử Data Dictionary identity và working Draft v1.0 trước khi các chức năng đọc/ghi được sử dụng. F01–F02 triển khai read-only trên nền đó; Consumer-only vẫn không thấy Data Dictionary cho tới khi có bản Approved. F07 phải hoàn thành trước F03 để khóa luồng xem/lưu Draft Data Dictionary trước khi tạo CDE. Sau F07, nhánh CDE F03–F06 và nhánh Data Dictionary F08–F10 có thể tiếp tục phát triển riêng, nhưng không publish Data Dictionary trước khi invariant tham chiếu CDE snapshot đã được kiểm chứng.

F01 chỉ bổ sung ràng buộc published-only dành cho **Consumer-only**. Các role khác tiếp tục sử dụng route và representation mặc định của OpenMetadata theo quyền hiện có, bao gồm working Draft v1.0 đã bootstrap; F01 không thay đổi hành vi của nhóm này.

### Ma trận truy vết về tài liệu thiết kế

| ID | Mục thiết kế được hiện thực |
| --- | --- |
| F00 | §2.1–2.4 Phạm vi Data Dictionary/CDE/version; §3 Trạng thái; §9.7 Phân quyền backend |
| F01 | §4.2 Nội dung được thấy; §6.1–6.2 Glossary UI; §7.1 CDE UI; §9.3, §9.5 |
| F02 | §2.3 Business version; §6.2 và §7.1 URL/businessVersion selector; §9.3, §9.5 |
| F03 | §5.4 Snapshot CDE; §7.1 Draft UI; §8 Save Draft; §9.5.3 |
| F04 | §3 State machine; §4.3 Ma trận thao tác; §7.1; §8; §9.5.3 |
| F05 | §5.4 Snapshot bất biến; §7.1 Approved; §8 Approve; §9.5.3; §9.7 |
| F06 | §5.5 Tạo business version mới của CDE; §7.1; §8 |
| F07 | §5.1–5.2 Snapshot/working Data Dictionary; §6.2; §8; §9.3.4 |
| F08 | §5.1 term revisions; §6.2–6.3 quản lý CDE trong bản làm việc; §9.3.4 |
| F09 | §3; §4; §5.1; §6.2; §8; §9.3.4 |
| F10 | §5.2 Data Dictionary version mới là bản trắng; §6.2; §8 |
| F11 | §6.3 Flat List và quyền xem |
| F12 | §6.3 Search, filters, pagination |
| F13 | §6.3 Export theo filter/quyền; §8 Export; §9.3.5 |
| F14 | §4.2–4.3 quyền Import; §6.2; §8 Import |
| F15 | §7.1 Overview, custom properties và Assets; §9.5–9.6 |
| F16 | §4.3 Delete/thu hồi; §6.2–7.1 action; §8 optimistic locking; §9.7 |

## 4. Chi tiết từng chức năng

### F00 — BusinessWorkflow foundation và safety baseline

**Phạm vi**

- Data Dictionary là Glossary nghiệp vụ duy nhất, có vòng đời Draft → InReview → Approved/Rejected và business version.
- Khi khởi tạo môi trường mới, F00 bootstrap nguyên tử một Data Dictionary identity và working record đầu tiên. Identity có `name = "Data Dictionary"`, `displayName = "Từ điển dữ liệu dùng chung"`, `versioningMode = BusinessWorkflow`; working record có `businessVersion = "1.0"`, `entityStatus = Draft`, `workingRevision = 1` và `termRevisions = []`.
- CDE kế thừa workflow và vòng đời từ Data Dictionary, không có cấu hình workflow riêng.
- Khóa mô hình một cấp: Data Dictionary là cha, CDE là con trực tiếp; từ chối mọi payload gán một CDE làm `parent` của CDE khác.
- Tạo resolver backend dùng chung để nhận diện Data Dictionary bằng định danh ổn định, không hard-code display name rải rác.
- Giữ nguyên các entry point, route và hành vi quản trị mặc định của OpenMetadata cho người dùng không phải Consumer-only; representation mặc định của họ resolve working Draft v1.0 đã bootstrap khi chưa có bản Approved.

**Test/DoD**

- Backend từ chối tạo hoặc sử dụng Glossary nghiệp vụ ngoài Data Dictionary qua các API thuộc phạm vi tính năng này.
- Admin/Steward/Proposer/owner/Reviewer có quyền working mở được route mặc định và nhận Draft v1.0 đã bootstrap; không bị chuyển sang 404 chỉ vì chưa có published snapshot.
- Bootstrap chỉ tạo identity và working Draft v1.0, không tạo snapshot/published head `Approved` giả. Bootstrap chạy một lần theo migration/initialization marker, restart không tạo trùng hoặc ghi đè dữ liệu; trạng thái thiếu một nửa identity/working làm initialization fail-fast thay vì tự sửa ngầm.
- Term không thể cấu hình workflow khác Data Dictionary cha.
- Không tạo, đọc hoặc hiển thị cây CDE/sub-term; API thuộc tính năng từ chối quan hệ CDE cha — CDE con.
- UI và API chỉ triển khai trực tiếp luồng Data Dictionary/CDE, không có nhánh cấu hình lựa chọn hành vi.

### F01 — Consumer xem Approved mới nhất

**Phạm vi**

- Chỉ Consumer-only (`canViewPublished = true`, `canViewWorking = false`) bị giới hạn published-only. Không phân loại published-only chỉ dựa trên việc người dùng có role `BasicConsumer`/`DataConsumer` nếu họ đồng thời có quyền quản trị, soạn thảo, owner hoặc Reviewer assignment.
- GET mặc định resolve published head cho Consumer-only; entity chưa publish không được fallback sang identity hoặc working payload.
- Sidebar của Consumer-only chỉ trả Data Dictionary đã có published snapshot.
- Với người dùng không phải Consumer-only, GET/list và UI giữ nguyên hành vi identity/working/published và route mặc định của OpenMetadata; khi chưa có bản Approved, người có quyền working nhận Draft v1.0 đã bootstrap.
- F01 không thêm redirect, bộ lọc published-only hoặc representation fallback mới cho người dùng không phải Consumer-only.
- Trang Glossary/CDE của Consumer-only luôn read-only; không render action trong lúc chờ permission.

**Test/DoD**

- Consumer vẫn thấy v1.0 khi v1.1 đang Draft, InReview hoặc Rejected.
- Consumer-only gọi working endpoint hoặc FQN chưa publish nhận 403/404 và không lộ payload.
- Admin/Steward/Proposer/owner/Reviewer giữ nguyên kết quả và điều hướng mặc định của OpenMetadata khi chưa có published snapshot.
- Owner/Reviewer có quyền working không bị nhận nhầm là Consumer-only dù đồng thời mang role Consumer.
- Khi chưa có bản Approved, người dùng có quyền working thấy Draft v1.0 đã bootstrap và action theo quyền; Consumer-only nhận danh sách rỗng hoặc 403/404 khi truy cập trực tiếp, không lộ working payload.
- Có E2E Consumer xem Data Dictionary và CDE Approved.

### F02 — Lịch sử Approved theo businessVersion và deep link

**Phạm vi**

- `businessVersion` là định danh version của entity hiện tại; mọi browser URL mở CDE bắt buộc dùng thêm `parentBusinessVersion` để xác định version Data Dictionary cha. UI, frontend business model và business API/response không dùng alias `version`/`nativeVersion`, đồng thời không ánh xạ `publicationSequence` thành version nghiệp vụ.
- Data Dictionary dùng URL `?businessVersion={businessVersion}`; frontend lấy danh sách qua `GET /v1/glossaries/{id}/published` và lấy chi tiết qua `GET /v1/glossaries/{id}/published/{businessVersion}`.
- CDE là con trực tiếp của Data Dictionary và dùng URL `?businessVersion={businessVersion}&parentBusinessVersion={parentBusinessVersion}`. `businessVersion` là version CDE; `parentBusinessVersion` là version Data Dictionary cha. Lịch sử CDE được lấy qua `GET /v1/glossaryTerms/{id}/published` và `/published/{businessVersion}`.
- URL CDE thiếu `businessVersion`, thiếu `parentBusinessVersion` hoặc thiếu cả hai trả `404` và không lộ payload. Không hỗ trợ CDE độc lập, không tự resolve param còn thiếu và không suy diễn Data Dictionary version từ CDE version hoặc ngược lại. Khi có đủ hai param, CDE version phải thuộc snapshot Data Dictionary; không khớp trả `404`. Không áp dụng quy tắc này cho CDE cha — CDE con vì quan hệ đó không tồn tại.
- Query param của trình duyệt chỉ là routing state; không truyền thành query `version` của endpoint theo FQN.
- Selector và badge dùng `businessVersion` của CDE; breadcrumb và URL dùng đồng thời `businessVersion` của CDE và `parentBusinessVersion` của Data Dictionary cha. Historical snapshot luôn read-only. Danh sách version sắp xếp giảm dần theo từng đoạn số.
- F02 chỉ đọc dữ liệu Approved đã tồn tại; không triển khai publish. Cơ chế version kỹ thuật nội bộ và hành vi OpenMetadata mặc định của người dùng không phải Consumer-only không bị thay đổi.

**Test/DoD**

- F5, bookmark và back/forward trên CDE giữ đúng cả `businessVersion`, `parentBusinessVersion` và nội dung snapshot.
- URL CDE thiếu một trong hai param bắt buộc, version không tồn tại, chưa Approved hoặc không khớp Data Dictionary snapshot trả `404` và không lộ payload.
- `1.10` sắp trước `1.2` bằng comparator theo từng đoạn số.
- UI và business API/response dùng `businessVersion` cho entity hiện tại; URL CDE bắt buộc dùng thêm `parentBusinessVersion` cho ngữ cảnh cha; không có field/param `version` hoặc `nativeVersion`, và không ánh xạ từ `publicationSequence`.
- URL Data Dictionary mặc định không có business version giữ hành vi F01: Consumer-only nhận Approved mới nhất; người dùng khác giữ nguyên representation mặc định của OpenMetadata. Quy tắc fallback này không áp dụng cho URL CDE.

### F07 — Lưu Draft Data Dictionary khởi tạo sẵn

**Tiền điều kiện và invariant**

- F00 đã tạo nguyên tử đúng một Data Dictionary identity và một working record đầu tiên. Working representation ban đầu phải trả về `name = "Data Dictionary"`, `displayName = "Từ điển dữ liệu dùng chung"`, `businessVersion = "1.0"`, `entityStatus = Draft`, `workingRevision = 1` và `termRevisions = []`.
- Identity, technical name, display name, versioning mode và business version đầu tiên là dữ liệu hệ thống; F07 không cung cấp API hoặc UI để tạo thêm, đổi tên hay cấu hình lại Data Dictionary.
- Không hiển thị nút `Tạo Từ điển dữ liệu dùng chung` và không dùng `POST /v1/glossaries` từ UI. Nếu bootstrap identity hoặc working record bị thiếu, UI hiển thị lỗi vận hành và backend fail-fast; không tự tạo hoặc tự sửa dữ liệu ngầm.
- Draft v1.0 chưa phải published content: bootstrap/F07 không tạo snapshot, published head, publication outbox hoặc trạng thái `Approved`. Consumer-only không nhìn thấy Data Dictionary cho tới khi F09 publish thành công.
- `termRevisions` ban đầu luôn là array rỗng. F07 không tự khám phá, sao chép hoặc gắn CDE; mutation thêm/bớt CDE revision thuộc F08.
- `POST /v1/glossaries/{id}/working` không dùng trong F07; endpoint này chỉ tạo working business version kế tiếp ở F10 sau khi đã có bản Approved và không còn working version.

**API Save Draft và validation**

- Người có `canViewWorking` mở route Data Dictionary mặc định không có query business version; frontend resolve identity ổn định rồi gọi `GET /v1/glossaries/{id}/working` và hiển thị working representation.
- `GET /v1/glossaries/{id}/working` không fallback sang identity hoặc published payload nếu working record không tồn tại.
- `PATCH /v1/glossaries/{id}/working` nhận request typed gồm `expectedRevision` và full mutable business payload; không dùng kiểu JSON extension tổng quát làm contract công khai.
- `expectedRevision` bắt buộc là integer từ 1 trở lên. Thiếu hoặc sai kiểu trả `400 Bad Request`; working record không tồn tại trả `404 Not Found`.
- Chỉ working record có `entityStatus = Draft` được sửa. `InReview` và `Rejected` đều không được PATCH; bản `Rejected` phải được reopen về `Draft` ở F09 trước khi sửa.
- Các field được sửa trong F07 gồm description, owners, reviewers, domains, tags và extension. Payload là trạng thái đầy đủ của nhóm field này; array bị bỏ trống được chuẩn hóa thành array rỗng theo schema.
- Các field `id`, `name`, `displayName`, `fullyQualifiedName`, `versioningMode`, `businessVersion`, `workingRevision`, `entityStatus`, native `version`, publication metadata và audit metadata do server quản lý. Payload cố thay đổi các field này trả `400`.
- F07 không cho phép PATCH trực tiếp `termRevisions`; backend giữ nguyên giá trị hiện tại. Mutation thêm/bớt CDE revision chỉ được thực hiện qua contract của F08.
- Backend validate reference của owners, reviewers, domains, tags và schema của extension; không tin entity reference hoặc custom property chỉ vì frontend đã validate.
- Save thành công cập nhật working record tại chỗ, giữ nguyên `businessVersion = "1.0"`, tăng `workingRevision` đúng một đơn vị và trả working representation mới.
- Update dùng compare-and-set theo `expectedRevision`. Revision cũ trả `409 Conflict` và không thay đổi payload, revision hoặc audit metadata.
- Save Draft không ghi hoặc thay đổi identity, published snapshot, published head, publication outbox hay CDE snapshot; không gọi direct native PATCH để lưu business content.
- Mỗi Save thành công ghi `updatedBy/updatedAt` từ principal backend, không nhận actor/timestamp từ client.

**Authorization và UI**

- Backend quyết định quyền theo capability hiệu lực: đọc Draft yêu cầu `canViewWorking`, Save yêu cầu `canEditWorking`. Frontend không suy quyền chỉ từ tên role.
- Consumer-only và Reviewer mặc định không được xem hoặc sửa Draft. Reviewer/owner chỉ được thao tác nếu policy hiệu lực cấp capability tương ứng.
- Người có quyền truy cập Data Dictionary được đưa thẳng tới Draft v1.0 đã bootstrap; Header hiển thị badge `Draft`, business version `1.0` chỉ đọc và nút `Lưu nháp` theo quyền.
- Save disable action và hiển thị loading trong khi request đang chạy; chặn double-submit. Sau thành công, UI thay state bằng response backend và dùng `workingRevision` mới cho lần Save tiếp theo.
- Khi nhận `409`, UI giữ dữ liệu chưa lưu, không đóng form và không tự retry. UI hiển thị conflict cùng hành động tải bản mới nhất; trước khi reload phải cảnh báo dữ liệu chưa lưu sẽ bị thay thế.
- Luồng tổng thể tiếp theo là `Draft → Gửi duyệt → Phê duyệt` hoặc `Từ chối → Chỉnh sửa lại`. Các action Gửi duyệt/Phê duyệt/Từ chối/Chỉnh sửa lại thuộc F09; thêm/bớt CDE thuộc F08.
- Sau khi một version đã Approved và không còn working version, F10 mới hiển thị `Tạo bản nháp` để người dùng nhập business version kế tiếp trên cùng identity.

**Test/DoD**

- Bootstrap integration test trên database sạch tạo đúng một identity và một working record có `name = "Data Dictionary"`, `displayName = "Từ điển dữ liệu dùng chung"`, `businessVersion = "1.0"`, `entityStatus = Draft`, `workingRevision = 1` và `termRevisions = []`.
- Inject failure giữa insert identity và insert working chứng minh transaction rollback toàn bộ và không phát index/event cho dữ liệu thất bại.
- Chạy lại initialization/restart không tạo trùng, không tăng revision và không ghi đè nội dung Draft hiện có.
- Trạng thái chỉ có identity hoặc chỉ có working record làm initialization fail-fast với lỗi vận hành rõ ràng; không tự repair.
- API/UI không cung cấp thao tác tạo Data Dictionary thứ hai; request tạo hoặc vận hành Glossary nghiệp vụ khác bị từ chối.
- Manager có quyền mở route mặc định và nhận đúng Draft v1.0; Consumer-only nhận danh sách rỗng hoặc 403/404 và không lộ working payload.
- Save nhiều lần giữ nguyên `businessVersion = "1.0"` và tăng revision tuần tự `1 → 2 → 3`.
- Hai writer dùng cùng revision: đúng một writer thành công; writer còn lại nhận `409`, và payload/audit của writer thành công không bị ghi đè.
- PATCH thiếu/sai `expectedRevision` trả `400`; working không tồn tại trả `404`; PATCH `InReview` hoặc `Rejected` bị từ chối và không đổi dữ liệu.
- Test chứng minh client không thể thay đổi field server-owned hoặc `termRevisions` qua Save Draft.
- Save Draft không tạo hoặc thay đổi snapshot, published head, publication outbox hay CDE snapshot.
- Authorization integration test bao phủ Admin/policy holder, Proposer được cấp quyền, Consumer-only, Reviewer mặc định và user đồng thời có nhiều role.
- Frontend test bao phủ tải Draft bootstrap, không hiển thị nút tạo Data Dictionary, loading, double-submit, cập nhật revision từ response và conflict `409` giữ dữ liệu chưa lưu.
- E2E: khởi động môi trường sạch → mở Data Dictionary Draft v1.0 → Save nhiều lần → restart/reload, vẫn resolve đúng một identity và một Draft với revision/nội dung mới nhất.

### F03 — Tạo và lưu Draft CDE

**Ranh giới chức năng và invariant**

- F03 tạo CDE business version đầu tiên. Một lần tạo thành công sinh đúng một `GlossaryTerm` identity thuộc Data Dictionary và đúng một working record có `businessVersion = "1.0"`, `entityStatus = Draft`, `workingRevision = 1`.
- `businessVersion = "1.0"` của lần tạo đầu tiên do server gán cố định; client không được gửi hoặc lựa chọn version khác. `POST /v1/glossaryTerms/{id}/working` không tham gia luồng tạo mới F03 và chỉ được dùng để tạo business version kế tiếp ở F06.
- Identity và working record phải được ghi trong cùng database transaction. Nếu bất kỳ bước nào thất bại thì rollback toàn bộ; không để lại identity mồ côi, working record mồ côi, relationship, index document hoặc event cho dữ liệu thất bại.
- Native `GlossaryTerm` identity chỉ cung cấp định danh kỹ thuật và quan hệ nền của OpenMetadata. Working record là nguồn business content có thẩm quyền; Create/Save Draft không dùng direct native PATCH để lưu business content và không dùng native metadata version làm business version.
- Mỗi CDE có đúng Data Dictionary làm cha nghiệp vụ trực tiếp. Payload phải trỏ tới Data Dictionary identity đã bootstrap và không được có `parent` là một CDE; backend từ chối sub-term, Glossary khác và mọi cấu hình workflow/versioning riêng trên CDE.
- Tạo CDE thiết lập quan hệ sở hữu kỹ thuật với Data Dictionary nhưng không tự thêm revision vào `termRevisions`, không tăng `workingRevision` của Data Dictionary và không tạo snapshot. F08 chịu trách nhiệm đưa/bỏ một CDE revision vào gói phát hành Data Dictionary.
- Trước khi được thêm vào gói phát hành ở F08, Draft CDE chỉ được mở trong editor có ngữ cảnh Data Dictionary bởi người có `canViewWorking`; UI không điều hướng nó vào published/historical deep-link và Consumer không thể phát hiện identity hoặc working payload này.
- Một identity chỉ có tối đa một working version. Tên kỹ thuật/FQN phải duy nhất trong Data Dictionary; retry sau create đã commit trả conflict rõ ràng thay vì tạo bản ghi thứ hai.

**API Create và validation**

- UI gọi duy nhất `POST /v1/glossaryTerms` để tạo mới; backend không yêu cầu frontend gọi tiếp `POST /v1/glossaryTerms/{id}/working`. Response là working representation vừa tạo, không phải native identity projection.
- Create request dùng typed `CreateGlossaryTerm` contract. Các field nghiệp vụ được hỗ trợ trong F03 gồm `name`, `displayName`, `description`, `owners`, `reviewers`, `domains`, `tags` và `extension`; `name` chỉ được nhập khi create và trở thành định danh bất biến sau khi identity được tạo.
- `glossary` bắt buộc resolve đúng Data Dictionary bằng định danh ổn định. `parent` phải absent/null. Các field native ngoài phạm vi sản phẩm như sub-term hierarchy, workflow config, `versioningMode`, `provider`, publication/audit metadata và các field server-owned không được client điều khiển.
- Backend validate canonical `name`, uniqueness của FQN, reference của owners/reviewers/domains/tags và schema Custom Properties của `extension`; không tin dữ liệu đã được frontend validate.
- Create thành công trả ít nhất `id`, `name`, `fullyQualifiedName`, `glossary`, toàn bộ business payload, `businessVersion = "1.0"`, `entityStatus = Draft`, `workingRevision = 1`, `updatedBy` và `updatedAt` lấy từ principal/backend clock.
- Duplicate name/FQN hoặc concurrent create cùng identity trả `409 Conflict`; payload sai schema, có `parent`, trỏ sai Glossary hoặc cố gán field server-owned trả `400 Bad Request`; không có quyền tạo trả `403 Forbidden`.
- Index/change event cần thiết cho identity chỉ được phát sau commit và phải idempotent. Không phát published outbox, không tạo published head hoặc CDE snapshot trong F03.

**API Save Draft**

- `GET /v1/glossaryTerms/{id}/working` yêu cầu `canViewWorking`, chỉ trả working representation và trả `404 Not Found` nếu working record không tồn tại; không fallback sang identity hoặc published snapshot.
- F03 cung cấp truy vấn authoring tối thiểu qua `GET /v1/glossaryTerms?glossary={dataDictionaryFqn}` để người có `canViewWorking` tìm lại CDE có working record sau reload. Backend resolve mỗi row thành working representation và lọc quyền trước khi trả; đây không phải bảng lịch sử/flat list đầy đủ của F11 và không làm CDE trở thành thành viên của `termRevisions`.
- `PATCH /v1/glossaryTerms/{id}/working` dùng typed request gồm `expectedRevision` và full mutable business payload; không dùng `entityExtension`/`GlossaryTerm` tổng quát làm public mutation contract.
- `expectedRevision` bắt buộc là integer từ 1 trở lên. Thiếu, sai kiểu hoặc ngoài miền hợp lệ trả `400 Bad Request`.
- Full mutable payload của Save gồm `displayName`, `description`, `owners`, `reviewers`, `domains`, `tags` và `extension`. Các array bắt buộc hiện diện và dùng `[]` để xóa toàn bộ; `extension` bắt buộc hiện diện nhưng được phép `null` để xóa toàn bộ Custom Properties. Field bị thiếu hoặc ngoài allowlist trả `400`, không được hiểu là “giữ nguyên”.
- Các field `id`, `name`, `fullyQualifiedName`, `glossary`, `parent`, `businessVersion`, `workingRevision`, `entityStatus`, native `version`, workflow/versioning config, publication metadata và audit metadata do server quản lý. Payload cố thay đổi chúng trả `400`.
- Chỉ working record ở `Draft` được PATCH. `InReview` và `Rejected` đều bị từ chối và không thay đổi payload/revision/audit; bản `Rejected` phải qua `reopen` của F04 để trở lại `Draft` trước khi sửa.
- Save thành công cập nhật working record tại chỗ, giữ nguyên identity và `businessVersion = "1.0"`, tăng `workingRevision` đúng một đơn vị, ghi `updatedBy/updatedAt` từ backend và trả working representation mới.
- Save dùng compare-and-set theo `expectedRevision`. Revision cũ trả `409 Conflict`; request thất bại không thay đổi payload, revision, audit metadata, Data Dictionary working record hoặc bất kỳ snapshot/head/outbox nào.

**Authorization và UI**

- Vì CDE chưa tồn tại tại thời điểm Create, backend kiểm tra quyền tạo trên Data Dictionary cha bằng capability/policy hiệu lực. Save kiểm tra `canEditWorking` trên CDE; xem Draft kiểm tra `canViewWorking`. Frontend chỉ render action theo capability backend trả về, không suy quyền từ tên role.
- Admin/policy holder và Proposer/owner được cấp capability phù hợp có thể tạo/sửa. Consumer-only không được xem, tạo hoặc sửa. Reviewer được gán có thể được cấp quyền xem working để duyệt ở F04 nhưng mặc định không được tạo hoặc sửa Draft.
- Form Create và Save disable action, hiển thị loading và chặn double-submit trong khi request đang chạy. Sau Create/Save thành công, UI thay state bằng response backend và dùng `workingRevision` trả về cho mutation tiếp theo.
- Khu vực authoring của Data Dictionary hiển thị các CDE working mà người dùng được phép xem, kể cả khi chưa thuộc `termRevisions`, với nhãn rõ ràng `Chưa thêm vào gói phát hành`. Chọn row mở editor trong context Data Dictionary; reload vẫn tìm lại được Draft qua truy vấn authoring tối thiểu.
- Khi Save nhận `409`, UI giữ dữ liệu chưa lưu, không đóng editor và không tự retry. UI hiển thị conflict cùng hành động tải bản mới nhất; trước khi thay state phải cảnh báo dữ liệu chưa lưu sẽ bị mất.
- UI không hiển thị control tạo sub-term hoặc chọn Glossary cha; Data Dictionary được lấy từ context hiện tại. Hủy hoặc lỗi Create không chèn CDE giả vào bảng/cache phía client.

**Test/DoD**

- Integration test Create trên database sạch tạo đúng một identity và một working Draft v1.0, trả `workingRevision = 1`, không tạo published snapshot/head/outbox và không đổi `termRevisions` hay revision của Data Dictionary.
- Inject failure giữa insert identity, relationship và insert working chứng minh transaction rollback toàn bộ; không có identity/working mồ côi, index document hoặc event cho transaction thất bại.
- Hai request Create đồng thời với cùng Data Dictionary/name: đúng một request thành công, request còn lại nhận `409`; retry không tạo thêm identity hoặc working record.
- Test từ chối Glossary khác, `parent` CDE/sub-term, workflow config riêng, field server-owned, reference không tồn tại, tag/custom property sai schema và FQN không hợp lệ.
- Save nhiều lần giữ nguyên `businessVersion = "1.0"` và tăng revision tuần tự `1 → 2 → 3`; restart/reload vẫn trả đúng một identity và working payload mới nhất.
- Hai writer dùng cùng revision: đúng một writer thành công; writer còn lại nhận `409`, payload/audit của writer thành công không bị ghi đè.
- PATCH thiếu/sai `expectedRevision`, thiếu field bắt buộc hoặc có field ngoài allowlist trả `400`; working không tồn tại trả `404`; PATCH `InReview` hoặc `Rejected` bị từ chối và không đổi dữ liệu.
- Test chứng minh client không thể đổi `name`, FQN, Glossary, parent, business version, status, revision hoặc actor/timestamp qua Save Draft; không dùng `workingRevision` hay native `version` làm fallback cho `businessVersion`.
- Authorization integration test bao phủ Admin/policy holder, Proposer/owner được cấp quyền, Viewer có `canViewWorking` nhưng không có `canEditWorking`, Reviewer mặc định, Consumer-only và user đồng thời có nhiều role.
- Test truy vấn authoring chứng minh maker tìm lại được Draft chưa thuộc `termRevisions` sau reload, kết quả đã lọc theo quyền và Consumer không nhận identity/working row.
- Frontend test bao phủ single-request Create, loading/double-submit, không gửi `parent`, thay state/revision từ response, validation failure, Create failure không để cache row giả và conflict `409` giữ dữ liệu chưa lưu.
- E2E: mở Data Dictionary Draft → tạo CDE → sửa và Save nhiều lần → reload/restart → Draft vẫn có version `1.0`, revision/nội dung đúng; Consumer không nhìn thấy và Data Dictionary `termRevisions` vẫn không đổi cho tới F08.

### F04 — Submit, Reject và Reopen CDE

**Ranh giới chức năng và state machine**

- F04 chỉ triển khai ba transition trên working version của CDE: `Draft → InReview` qua `submit`, `InReview → Rejected` qua `reject` và `Rejected → Draft` qua `reopen`. `approve` và việc tạo published snapshot thuộc F05, không nằm trong F04.
- Transition chỉ thay đổi trạng thái workflow, revision và transition metadata. Không thay đổi `businessVersion` hoặc business payload; không tạo native metadata version, published snapshot, published head hay publication outbox.
- Không có transition tắt hoặc idempotent success: gọi action khi working record không ở đúng source state bị từ chối và không thay đổi dữ liệu. Working record không tồn tại trả `404 Not Found`.
- `InReview` khóa toàn bộ business field. `Rejected` vẫn chỉ đọc cho tới khi `reopen` thành công; sau đó CDE trở lại `Draft` và mới được Save qua contract F03.
- `reject` không nhận lý do từ chối trong F04, thống nhất với thiết kế UI hiện tại.

**API contract và optimistic locking**

- Dùng ba endpoint `POST /v1/glossaryTerms/{id}/working/submit`, `/reject` và `/reopen`; frontend gọi wrapper hiện có `transitionGlossaryTermWorkflow`, không tạo API client mới.
- Cả ba endpoint nhận typed request `{ "expectedRevision": <integer> }`. `expectedRevision` bắt buộc là integer từ 1 trở lên; thiếu, sai kiểu, ngoài miền hoặc có field ngoài allowlist trả `400 Bad Request`.
- Frontend lấy `expectedRevision` từ `workingRevision` của working representation gần nhất. Backend không nhận `workingRevision`, actor, timestamp, source status hoặc target status từ client.
- Mutation dùng compare-and-set nguyên tử theo cả source state và `expectedRevision`. Revision cũ hoặc state đã bị request khác thay đổi trả `409 Conflict`; request thất bại không thay đổi status, revision, payload hoặc transition metadata.
- Thành công tăng `workingRevision` đúng một đơn vị và trả working representation mới, gồm status/revision mới cùng transition metadata để UI thay state. Frontend không tự tính revision hoặc status.
- Sai transition do client gọi action không phù hợp với trạng thái hiện tại trả `409 Conflict`. Payload/schema request không hợp lệ trả `400`; không đủ quyền trả `403 Forbidden`.

**Authorization, validation và audit metadata**

- Backend kiểm tra capability hiệu lực trên working payload hiện tại, bao gồm owners/reviewers đã được Save ở F03; không dựa vào quan hệ native có thể đã cũ và không suy quyền chỉ từ tên role.
- `submit` yêu cầu `canSubmit`; `reject` yêu cầu `canReject`; `reopen` yêu cầu `canEditWorking`. Assigned Reviewer chỉ được reject khi được gán hoặc policy hiệu lực cho phép; Reviewer không mặc nhiên được submit/reopen. Proposer không được reject nếu không có capability review. Admin/Steward/policy holder tuân theo capability backend trả về.
- Trước `submit`, backend validate lại working payload và các entity reference theo cùng invariant F03. F04 không bổ sung field nghiệp vụ bắt buộc mới và không bắt buộc danh sách reviewer phải khác rỗng vì Admin/Steward hoặc policy holder vẫn có thể review.
- Mọi transition ghi `updatedBy/updatedAt` từ principal/backend clock. `submit` đồng thời ghi `submittedBy/submittedAt`; `reject` ghi `rejectedBy/rejectedAt`. `reopen` giữ lại metadata lần reject gần nhất để UI còn truy vết người từ chối; `updatedBy/updatedAt` của response thể hiện actor/time reopen. Client không được gửi hoặc sửa các field này.
- Working response phải expose `updatedBy`, `updatedAt`, `submittedBy`, `submittedAt`, `rejectedBy` và `rejectedAt` khi có giá trị. Lịch sử transition append-only và màn hình audit đầy đủ thuộc F16.
- Consumer-only không được xem working payload và không được gọi bất kỳ transition nào. Transition không làm CDE xuất hiện trong published read model.

**UI**

- Draft chỉ hiển thị `Gửi duyệt` khi `canSubmit`; InReview chỉ hiển thị `Từ chối` khi `canReject`; Rejected chỉ hiển thị `Chỉnh sửa lại` khi `canEditWorking`. UI dùng capability backend, không suy quyền từ role.
- Submit và reject có modal xác nhận; reject không có ô nhập lý do. Trong khi request chạy, action bị disable, có loading và chặn double-submit.
- Sau thành công, UI thay working state bằng response backend, cập nhật badge/form lock và dùng `workingRevision` mới cho mutation tiếp theo. Rejected hiển thị `rejectedBy/rejectedAt`.
- Khi nhận `409`, UI giữ state hiện tại, không tự retry hoặc tự đổi badge/revision; hiển thị conflict và hành động tải working version mới nhất. Lỗi `403/404/5xx` không để lại optimistic state giả.

**Test/DoD**

- Integration test đủ ba transition hợp lệ: `Draft → InReview`, `InReview → Rejected`, `Rejected → Draft`; mỗi lần giữ nguyên business version/payload, tăng revision đúng một và ghi đúng transition actor/time.
- Test mọi action từ sai source state nhận `409` và không đổi dữ liệu; working không tồn tại nhận `404`; request thiếu/sai `expectedRevision` hoặc có field ngoài allowlist nhận `400`.
- Hai request dùng cùng revision: đúng một request thành công, request còn lại nhận `409`; không có lost update hoặc transition kép.
- Authorization integration test bao phủ Admin/Steward/policy holder, Proposer, owner, assigned Reviewer, Reviewer không được gán, Consumer-only và user đồng thời có nhiều role. Đặc biệt Proposer không có quyền review và Reviewer không có capability edit không thể `reopen`.
- Test chứng minh transition đọc owners/reviewers từ working payload mới nhất, không dùng assignment native đã cũ.
- Test chứng minh F04 không thay đổi business payload/business version và không tạo native version, snapshot, published head hoặc publication outbox; Consumer không nhìn thấy CDE InReview/Rejected.
- API response test bao phủ status/revision mới và các field `updated*`, `submitted*`, `rejected*`; reopen vẫn giữ metadata lần reject gần nhất.
- Frontend test bao phủ action visibility theo state/capability, modal, loading, double-submit, request mang `expectedRevision`, thay state từ response, form lock/unlock và conflict `409` không tạo optimistic state giả.
- E2E: Draft revision N → submit → InReview revision N+1 → reject → Rejected revision N+2 có rejector → reopen → Draft revision N+3 có thể tiếp tục Save; Consumer không nhìn thấy ở mọi bước.

### F05 — Approve và publish CDE

**Ranh giới chức năng và invariant**

- F05 publish một CDE working version từ `InReview` thành một published snapshot có `entityStatus = Approved`. Không tạo hoặc giữ working record ở trạng thái `Approved`; working record chỉ bị xóa khi toàn bộ publication transaction thành công.
- Approve không thay đổi native `GlossaryTerm` identity, native metadata version, `businessVersion` hoặc business payload đã được submit. Snapshot là representation có thẩm quyền của bản CDE đã ban hành.
- Approve không tự thêm, tự thay thế hoặc tự loại CDE revision trong working/latest Data Dictionary và không tăng revision của Data Dictionary. Quản lý membership `(termId, termBusinessVersion)` thuộc F08; publish Data Dictionary thuộc F09.
- Một CDE snapshot đã Approved là **đủ điều kiện công bố** nhưng chỉ xuất hiện với Consumer trong ngữ cảnh một Data Dictionary version khi snapshot đó được Data Dictionary version tương ứng tham chiếu. F05 không phá invariant URL/membership của F02 để cung cấp chế độ xem CDE độc lập.
- Approved snapshot bất biến về business payload và publication metadata cốt lõi. F16 có thể bổ sung lifecycle metadata như `archivedAt/archivedBy`, nhưng không được sửa snapshot payload, `businessVersion`, `publicationSequence`, `publishedAt`, `publishedBy` hoặc `contentHash`.
- F05 chỉ publish một CDE. Không triển khai tạo business version kế tiếp của F06, quản lý Data Dictionary membership của F08, publish Data Dictionary của F09 hoặc màn hình audit đầy đủ của F16.

**API contract và optimistic locking**

- Dùng endpoint `POST /v1/glossaryTerms/{id}/working/approve`; frontend gọi wrapper hiện có `transitionGlossaryTermWorkflow(id, 'approve', request)`, không tạo API client song song.
- Request dùng cùng typed contract tối thiểu như các transition F04 và chỉ gồm `{ "expectedRevision": <integer> }`. `expectedRevision` bắt buộc là integer từ 1 trở lên; thiếu, sai kiểu, ngoài miền hoặc có field ngoài allowlist trả `400 Bad Request`.
- Client không được gửi `businessVersion`, business payload, `workingRevision`, actor, timestamp, source status, target status, snapshot ID, publication sequence hoặc publication metadata.
- Backend đọc `expectedRevision` từ working representation gần nhất. Revision cũ, source state không còn `InReview` hoặc business version đã được publish trả `409 Conflict` và không thay đổi working/snapshot/head/outbox. Working record không tồn tại trả `404 Not Found`; không đủ quyền trả `403 Forbidden`.
- Thành công trả published representation gồm ít nhất `id`, `name`, `fullyQualifiedName`, `glossary`, toàn bộ business payload, `businessVersion`, `entityStatus = Approved`, `snapshotId`, `publicationSequence`, `publishedAt` và `publishedBy`. Published response không trả hoặc tái sử dụng `workingRevision`; frontend không tự tính status, sequence hoặc publication metadata.

**Authorization và validation tại thời điểm publish**

- Approve yêu cầu capability hiệu lực `canApprove`. Backend tính capability từ working payload mới nhất và policy hiện hành, bao gồm owners/reviewers đã được Save trước Submit; không dựa vào native relationship có thể đã cũ và không suy quyền chỉ từ tên role.
- Assigned Reviewer chỉ được approve khi vẫn được gán trong working payload hoặc policy hiệu lực cho phép. Proposer/owner không mặc nhiên được approve; Consumer-only không được xem working payload hoặc gọi approve. Admin/Steward/policy holder vẫn phải đi qua cùng capability resolver.
- Sau khi khóa working record và trước khi ghi snapshot, backend validate lại toàn bộ invariant CDE của F03/F04: CDE thuộc đúng Data Dictionary identity, không có `parent`, business payload đúng schema, owners/reviewers/domains/tags còn resolve hợp lệ và `extension` còn đúng Custom Property schema. Không giả định payload vẫn hợp lệ chỉ vì đã validate lúc Submit.
- `publishedBy` lấy từ authenticated principal và `publishedAt` lấy từ backend clock. Client không được điều khiển hoặc ghi đè audit metadata.

**Atomic publication transaction**

- Backend khóa working row của CDE theo entity bằng cơ chế tương đương `SELECT ... FOR UPDATE` trước khi kiểm tra revision, state, quyền và validation. Mọi bước ghi publication dùng cùng database handle/transaction.
- Trong đúng một transaction, thực hiện theo thứ tự logic: khóa và đọc working → kiểm tra `expectedRevision` và `InReview` → authorization/validation → tạo Approved snapshot payload → cấp `publicationSequence` kế tiếp → tính `contentHash` → insert snapshot → cập nhật published head → insert outbox idempotent → xóa working row bằng compare-and-set.
- Bất kỳ lỗi nào trước commit, bao gồm lỗi insert snapshot, update head, insert outbox hoặc delete working, phải rollback toàn bộ. Không được tồn tại snapshot mồ côi, head trỏ sai, outbox thiếu, working bị xóa sớm hoặc manager/published index phản ánh dữ liệu chưa commit.
- Published head chỉ được trỏ tới snapshot vừa commit có publication sequence mới nhất của cùng CDE. Unique constraint trên `(entityType, entityId, businessVersion)` và `(entityType, entityId, publicationSequence)` là lớp bảo vệ cuối cùng; lỗi constraint do race được ánh xạ thành `409 Conflict`, không trả `500` chung chung.
- Không phát native metadata version hoặc external event trực tiếp bên trong transaction. Side effect ngoài database chỉ được kích hoạt từ outbox sau commit và phải idempotent.

**Content hash, read model và outbox**

- `contentHash` là SHA-256 dạng lowercase hex của canonical immutable snapshot JSON mã hóa UTF-8. Canonicalization phải ổn định giữa MySQL/PostgreSQL và không phụ thuộc thứ tự key do serializer hoặc kiểu lưu `json/jsonb` trả về.
- Hash bao phủ toàn bộ immutable snapshot payload dùng để phục vụ published read, gồm business content và publication metadata cốt lõi. Lifecycle metadata có thể thay đổi ở F16 như `archivedAt/archivedBy` nằm ngoài payload/hash; archive không được làm thay đổi hash cũ.
- Database published snapshot/head là nguồn sự thật ngay sau commit. Published detail/history API đọc được snapshot vừa publish mà không phụ thuộc search indexing.
- Search/index/event sử dụng transactional outbox và có eventual consistency. Lỗi xử lý outbox sau commit không biến Approve đã commit thành thất bại, không xóa snapshot và không rollback head; event giữ trạng thái pending/error để retry idempotent theo cơ chế vận hành. Xử lý lặp cùng event không được tạo document hoặc event nghiệp vụ trùng.
- Consumer search/list không được fallback sang mutable/native index khi published index đang chậm. UI sau Approve dùng response backend hoặc published detail API, không dùng search index để quyết định publication đã thành công hay chưa.

**UI**

- Chỉ hiển thị `Phê duyệt` khi CDE có `entityStatus = InReview`, không phải historical/version view và backend trả `canApprove = true`. UI không suy quyền từ role, owner hoặc reviewer phía client.
- Approve có modal xác nhận. Trong khi request chạy, action có loading, bị disable và chặn double-submit; request hợp lệ gửi đúng một `expectedRevision` hiện tại.
- Sau thành công, UI thay state bằng published response, hiển thị badge `Approved`, chuyển toàn bộ nội dung sang read-only, cập nhật version selector và không giữ state/cache working giả.
- Nếu CDE snapshot đã thuộc Data Dictionary version của context hiện tại, UI điều hướng tới published deep link có đủ `businessVersion` và `parentBusinessVersion`. Không tự suy diễn một trong hai version và không tạo URL published thiếu context cha.
- Nếu snapshot chưa thuộc Data Dictionary version nào có thể mở, UI giữ manager/authoring context ở chế độ read-only và hiển thị rõ `Approved — Chưa được thêm vào gói phát hành Data Dictionary`; không giả vờ Consumer đã có thể truy cập. Sau F08/F09, điều hướng published tuân theo invariant membership của F02.
- Khi nhận `409`, UI giữ state hiện tại, không tự retry hoặc tự đổi badge/revision; hiển thị conflict và hành động tải representation mới nhất. Lỗi `403/404/5xx` dừng loading, hiển thị lỗi phù hợp và không để optimistic Approved state.

**Test/DoD**

- Integration happy path `InReview revision N → Approve` tạo đúng một snapshot `Approved`, một published head và một outbox event, xóa working record, giữ nguyên identity/businessVersion/business payload và trả đầy đủ published representation không có `workingRevision`.
- Failure injection sau từng boundary insert snapshot, update head, insert outbox và delete working chứng minh transaction rollback toàn bộ; published API, manager index và Consumer index không quan sát dữ liệu thất bại.
- Hai request Approve cùng revision: đúng một request thành công và chỉ có một snapshot/head/outbox; request còn lại nhận `409` nếu quan sát conflict trong transaction hoặc `404` nếu chạy sau khi working đã bị xóa, không trả thành công idempotent giả.
- Race Approve với Reject dùng cùng revision: chỉ đúng một mutation thành công; mutation còn lại nhận `409/404`. Không tồn tại đồng thời published snapshot và working `Rejected` của cùng business version.
- Test source state sai, revision cũ, business version đã publish, working không tồn tại, request thiếu/sai `expectedRevision` và field ngoài allowlist; mọi trường hợp thất bại không thay đổi snapshot/head/outbox/working.
- Authorization integration test bao phủ Admin/Steward/policy holder, Proposer, owner, assigned Reviewer, Reviewer đã bị gỡ assignment, Reviewer không được gán, Consumer-only và user đồng thời có nhiều role. Test chứng minh Approve dùng working owners/reviewers mới nhất thay vì native assignment cũ.
- Test xóa hoặc làm mất hợp lệ owners/reviewers/domains/tags/Custom Property sau Submit nhưng trước Approve làm publication thất bại toàn bộ; sửa native identity hoặc trỏ sai Data Dictionary/parent cũng bị từ chối.
- Recompute hash từ canonical snapshot payload đọc lại từ cả MySQL và PostgreSQL phải khớp `contentHash` đã lưu. Save/version/publish tương lai và archive metadata không được thay đổi payload/hash của snapshot cũ.
- Outbox test bao phủ xử lý thành công, lỗi index để event pending/error, retry thành công và xử lý lặp idempotent. Published detail/history vẫn đọc được ngay khi index đang lỗi; Consumer search không lộ working/native payload.
- Test chứng minh Approve không tạo native metadata version, không tự thay đổi Data Dictionary `termRevisions`/revision và không tự thay thế CDE version đã được Data Dictionary chọn.
- Frontend test bao phủ action visibility theo capability/state, modal, loading, double-submit, request chỉ có `expectedRevision`, state từ response, conflict reload và hai nhánh điều hướng có/không có Data Dictionary membership.
- E2E phạm vi F05: Draft → Submit → Approve → published detail/history API đọc được snapshot; manager thấy Approved read-only và nhãn chưa thuộc gói phát hành khi chưa có membership.
- E2E Consumer đầy đủ được nghiệm thu ở F08/F09: sau khi CDE snapshot được thêm vào một Data Dictionary version mà Consumer truy cập được, Consumer mới tìm/mở CDE qua URL có đủ `businessVersion` và `parentBusinessVersion`.

### F06 — Tạo business version CDE kế tiếp

**Phạm vi**

- Version canonical, chưa tồn tại và lớn hơn latest published.
- Draft mới chỉ giữ id, name, FQN và liên kết Glossary.
- Business fields, tags, owners, domains và extension bắt đầu rỗng.
- Chỉ một working version tại một thời điểm.

**Test/DoD**

- Version trùng, thấp hơn hoặc sai định dạng bị từ chối.
- Không copy nhầm business fields.
- E2E publish v1.0 → tạo v1.1 Draft → Consumer vẫn xem v1.0.

### F08 — Thêm/bớt CDE revision trong working hoặc latest Data Dictionary

**Phạm vi**

- Working Data Dictionary và Data Dictionary Approved mới nhất cho phép người có quyền thêm/bớt CDE thuộc đúng Data Dictionary; historical Data Dictionary luôn khóa.
- Latest Data Dictionary được phép tham chiếu CDE `Draft`, `InReview`, `Rejected` hoặc `Approved`. Consumer read model chỉ trả CDE `Approved`; manager nhận các trạng thái theo quyền.
- Lưu cặp termId và termBusinessVersion, không chỉ termId.
- Add/remove dùng optimistic locking.
- Mọi mutation latest ghi audit actor/revision và không đổi `businessVersion`.

**Test/DoD**

- Không thêm CDE của Glossary khác; Consumer không thấy CDE Draft/InReview/Rejected đã được thêm vào latest.
- Add/remove conflict trả 409.
- CDE version mới không tự thay thế version đã chọn.
- Reload giữ đúng revisions và display order.
- Add/remove trên historical Data Dictionary bị từ chối.

### F09 — Workflow và publish Data Dictionary

**Phạm vi**

- Submit, Reject, Reopen, Approve và authorization tương tự CDE.
- Trước approve, validate mọi term revision còn tồn tại và thuộc đúng Data Dictionary; trạng thái CDE được bảo vệ ở read model theo quyền.
- Snapshot Data Dictionary và liên kết CDE snapshots ghi trong cùng transaction.
- InReview và historical Approved khóa add/remove; Approved latest cho phép add/remove theo F08.

**Test/DoD**

- Data Dictionary v1.0 vẫn trả CDE v1.0 sau khi CDE v1.1 được publish.
- Một term revision không tồn tại hoặc thuộc Data Dictionary khác làm approve thất bại toàn bộ.
- Reviewer assignment và concurrency có integration test.
- E2E publish Data Dictionary có nhiều CDE revisions.

### F10 — Tạo business version Data Dictionary kế tiếp

**Phạm vi**

- Version lớn hơn latest published.
- termRevisions luôn rỗng; không kế thừa ngầm CDE list.
- Giữ identity fields; khi version mới được Approved, Approved cũ được chốt thành historical snapshot bất biến và tiếp tục phục vụ Consumer.

**Test/DoD**

- Không copy term revisions từ bản trước.
- Không đổi published head trước khi bản mới Approved.
- E2E v1.0 Approved → tạo v2.0 Draft trống.

### F11 — Bảng flat mọi CDE business version

**Phạm vi**

- Backend read model trả một row cho termId, businessVersion và status.
- Manager nhận working + published theo quyền; Consumer chỉ nhận published.
- Total count tính sau authorization.
- Row key gồm termId và businessVersion; click row tạo URL có đủ `businessVersion` của CDE và `parentBusinessVersion` của Data Dictionary cha.

**Test/DoD**

- Fixture gồm Approved 1.0, Approved 1.1, Rejected 1.2 và Draft 2.0.
- Consumer thấy 1.0/1.1; manager thấy đủ bốn dòng.
- Pagination không trùng hoặc mất row.
- Không client-side N+1 để hydrate lịch sử.

### F12 — Search, filter, sort và pagination

**Phạm vi**

- Search name + displayName, debounce 500 ms.
- Multi-status gồm Rejected cho manager.
- Domain, DataSource, Owner và DataClassification.
- Điều kiện kết hợp AND.
- Page size 10/15/25/50; đổi điều kiện reset trang đầu.

**Test/DoD**

- Contract test từng filter và tổ hợp.
- Consumer gửi status Draft vẫn chỉ nhận Approved.
- Response cũ trả chậm không ghi đè response mới.
- Có query-count và performance test; không N+1.

### F13 — Export theo quyền và bộ lọc

**Phạm vi**

- Export dùng chung filter DTO, query builder và authorization với F11/F12.
- Async export lưu actor và filter trong audit.
- Frontend gửi search/filter/sort context và hiển thị progress/error.

**Test/DoD**

- List/export parity test cùng điều kiện.
- Consumer export không chứa non-Approved.
- Test CSV escaping, Unicode tiếng Việt và Markdown.

### F14 — Import vào Draft

**Phạm vi**

- Parse/validate preview trước khi ghi.
- Mọi mutation dùng optimistic locking.
- Chốt atomic toàn file hoặc partial success có báo cáo; ưu tiên atomic cho file nhỏ.
- Không import vào historical/Approved snapshot.

**Test/DoD**

- File hợp lệ, sai schema, trùng version, sai reference và conflict preview/commit.
- Import lỗi không tạo Approved hoặc working data nửa vời ngoài chính sách.
- UAT bằng file thực tế, lỗi chỉ rõ từng dòng.

### F15 — CDE Overview và Assets

**Phạm vi**

- Overview gồm basic fields, owners, reviewers, domains, tags và 5 custom properties.
- Chỉ ẩn restricted tabs với CDE thuộc Data Dictionary.
- Assets dùng đúng CDE identity; chốt mapping là hiện hành hay snapshot-aware.

**Test/DoD**

- Historical Approved view read-only.
- Test date, enum và Markdown custom properties.
- GlossaryTerm thường vẫn giữ tab hiện hữu.
- Assets có pagination, empty và error states.

### F16 — Archive/delete, audit và vận hành

**Phạm vi**

- Delete chỉ cho Draft/Rejected theo policy.
- Archive chỉ cho Admin/Steward phù hợp; snapshot vẫn còn để audit.
- Audit transition, actor, revision và business version.
- Theo dõi 403/409/5xx, publish failure, latency và outbox lag.
- Có runbook rollback bản triển khai, backup/restore và xử lý outbox lỗi.

**Test/DoD**

- Test quyền và confirm modal delete/archive.
- Archived snapshot không là latest nhưng vẫn truy vết theo chính sách.
- Diễn tập rollback bản triển khai và restore; không làm mất snapshot.
- Có UAT sign-off, dashboard, alert và rollback runbook.

## 5. Quy trình cho mỗi chức năng

1. Chốt acceptance criteria và API contract.
2. Viết backend test thất bại.
3. Triển khai backend và authorization.
4. Chạy integration và non-regression tests.
5. Viết frontend API/hook test.
6. Triển khai UI và component tests.
7. Thêm một E2E hành trình chính.
8. Triển khai ở dev/UAT và review bằng chứng rồi mới làm chức năng tiếp theo.

Checklist bắt buộc cho mỗi PR:

- [ ] Chỉ Data Dictionary và CDE được đi qua business workflow.
- [ ] Backend không dựa vào UI để bảo vệ dữ liệu.
- [ ] Có positive và negative authorization tests.
- [ ] Có test 409 nếu là mutation.
- [ ] Có negative test chứng minh Native Glossary không được expose qua UI hoặc business API.
- [ ] Không trộn `businessVersion`, `workingRevision` và lịch sử metadata kỹ thuật nội bộ.
- [ ] UI có loading, empty, error và stale-request handling.
- [ ] Có thể rollback bản triển khai mà không xóa dữ liệu.

## 6. Các mốc phát hành

- **Milestone A — Tra cứu an toàn:** F00–F02.
- **Milestone B — Vòng đời CDE:** F03–F06.
- **Milestone C — Bản phát hành Từ điển dữ liệu dùng chung:** F07–F10.
- **Milestone D — Khai thác dữ liệu:** F11–F15.
- **Milestone E — Production-ready:** F16 và full regression/security/performance suite.

Không cần chờ Milestone D mới pilot Milestone A. Đây là lợi ích chính của triển khai theo từng chức năng.
