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
| F09 | Workflow, active membership và cutover/archive Data Dictionary | F01, F05, F07 | Vòng đời Dictionary |
| F10 | Tạo business version Data Dictionary kế tiếp | F09 | Nhiều version Dictionary |
| F11 | Bảng flat mọi CDE business version trong một Dictionary scope | F02, F05, F06, F09, F10 | Tra cứu đầy đủ |
| F12 | Search, filter và custom sort trên flat read model | F11 | Khai thác dữ liệu |
| F13 | Export theo quyền và bộ lọc | F12 | Export |
| F14 | Import vào Draft | F03, F07 | Import |
| F15 | CDE Overview và Assets | F02, F05 | Chi tiết CDE |
| F16 | Archive/delete, audit và vận hành | F05, F09 | Production-ready |

**Quyết định thay đổi:** F08 (thêm/bớt CDE revision thủ công) đã bị loại khỏi phạm vi. Giữ nguyên mã các chức năng còn lại để không làm mất truy vết lịch sử; F09 tự động tổng hợp các CDE `Approved` có tiền tố version đúng bằng Data Dictionary đang publish. Tuyệt đối không copy, fallback hoặc kế thừa CDE từ Data Dictionary version trước.

F00 bootstrap nguyên tử Data Dictionary identity và working Draft `1` trước khi các chức năng đọc/ghi được sử dụng. F01–F02 triển khai read-only trên nền đó; Consumer-only vẫn không thấy Data Dictionary cho tới khi có bản Approved. F07 phải hoàn thành trước F03 để khóa luồng xem/lưu Draft Data Dictionary trước khi tạo CDE. Sau F07, F03–F06 phải hỗ trợ CDE head/working theo `parentBusinessVersion`; F09–F10 triển khai active membership và cutover mà không kế thừa chéo scope.

F01 chỉ bổ sung ràng buộc published-only dành cho **Consumer-only**. Các role khác tiếp tục sử dụng route và representation mặc định của OpenMetadata theo quyền hiện có, bao gồm working Data Dictionary Draft `1` đã bootstrap; F01 không thay đổi hành vi của nhóm này.

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
| F09 | §3; §4; §5.1 term revisions tự động; §6.2; §8; §9.3.4 |
| F10 | §5.2 Data Dictionary version mới là bản trắng; §6.2; §8 |
| F11 | §6.3 Flat List và quyền xem |
| F12 | §6.3 Search, filters và custom sort |
| F13 | §6.3 Export theo filter/quyền; §8 Export; §9.3.5 |
| F14 | §4.2–4.3 quyền Import; §6.2; §8 Import |
| F15 | §7.1 Overview, custom properties và Assets; §9.5–9.6 |
| F16 | §4.3 Delete/thu hồi; §6.2–7.1 action; §8 optimistic locking; §9.7 |

## 4. Chi tiết từng chức năng

### F00 — BusinessWorkflow foundation và safety baseline

**Phạm vi**

- Data Dictionary là Glossary nghiệp vụ duy nhất, có vòng đời Draft → InReview → Approved/Rejected và business version.
- Khi khởi tạo môi trường mới, F00 bootstrap nguyên tử một Data Dictionary identity và working record đầu tiên. Identity có `name = "Data Dictionary"`, `displayName = "Từ điển dữ liệu dùng chung"`, `versioningMode = BusinessWorkflow`; working record có `businessVersion = "1"`, `entityStatus = Draft`, `workingRevision = 1` và `termRevisions = []`.
- CDE kế thừa workflow và vòng đời từ Data Dictionary, không có cấu hình workflow riêng.
- Persistence của CDE bắt buộc lưu `parentBusinessVersion` tường minh. Mỗi scope Data Dictionary tạo CDE identity riêng: cùng mã ở `N` và `N+1` có `termId` khác nhau. Working/head của một identity chỉ thuộc một parent scope; Data Dictionary vẫn chỉ có tối đa một working version kế tiếp.
- Active Data Dictionary/CDE records và archived history là hai read model khác nhau: active Dictionary membership thay đổi theo trạng thái CDE cùng scope; archive manifest chỉ được đóng băng khi successor Dictionary được Approved.
- Migration phải thêm unique key nghiệp vụ `(glossaryId, parentBusinessVersion, normalizedName)`, index list theo `(glossaryId, parentBusinessVersion, entityStatus)` và giữ unique business version trong từng CDE identity. Native FQN được scope hóa thành `{glossaryFqn}.{escapedName}@v{N}` để hai identity khác scope không xung đột. Row Data Dictionary dùng `parentBusinessVersion = null` và invariant một working duy nhất.
- Migration dữ liệu legacy phải tách mọi `termId` đang được dùng ở nhiều `parentBusinessVersion`: scope có `parentBusinessVersion` nhỏ nhất giữ UUID cũ, mỗi scope còn lại nhận UUID mới; working, snapshot, published head và `glossary_snapshot_term` được rewrite nguyên tử sang identity tương ứng. Mọi identity, kể cả scope gốc, được gán scoped FQN mới.
- Việc tách identity không được nhân bản quan hệ asset/tag của identity legacy sang scope mới. Quan hệ hiện hữu ở lại identity scope gốc; identity được tách chỉ giữ business payload đã thực sự được ghi trong snapshot/working của chính scope đó. Migration chạy theo marker, idempotent, reindex/outbox một lần cho mỗi identity bị đổi và rollback toàn glossary nếu bất kỳ bước rewrite nào lỗi.
- Khóa mô hình một cấp: Data Dictionary là cha, CDE là con trực tiếp; từ chối mọi payload gán một CDE làm `parent` của CDE khác.
- Tạo resolver backend dùng chung để nhận diện Data Dictionary bằng định danh ổn định, không hard-code display name rải rác.
- Giữ nguyên các entry point, route và hành vi quản trị mặc định của OpenMetadata cho người dùng không phải Consumer-only; representation mặc định của họ resolve working Data Dictionary Draft `1` đã bootstrap khi chưa có bản Approved.

**Test/DoD**

- Backend từ chối tạo hoặc sử dụng Glossary nghiệp vụ ngoài Data Dictionary qua các API thuộc phạm vi tính năng này.
- Admin/Steward/Proposer/owner/Reviewer có quyền working mở được route mặc định và nhận Data Dictionary Draft `1` đã bootstrap; không bị chuyển sang 404 chỉ vì chưa có published snapshot.
- Bootstrap chỉ tạo identity và working Data Dictionary Draft `1`, không tạo snapshot/published head `Approved` giả. Bootstrap chạy một lần theo migration/initialization marker, restart không tạo trùng hoặc ghi đè dữ liệu; trạng thái thiếu một nửa identity/working làm initialization fail-fast thay vì tự sửa ngầm.
- Term không thể cấu hình workflow khác Data Dictionary cha.
- Không tạo, đọc hoặc hiển thị cây CDE/sub-term; API thuộc tính năng từ chối quan hệ CDE cha — CDE con.
- UI và API chỉ triển khai trực tiếp luồng Data Dictionary/CDE, không có nhánh cấu hình lựa chọn hành vi.
- Migration/integration test chứng minh hai CDE cùng mã ở scope `1` và `2` có `termId`/FQN khác nhau; duplicate trong cùng scope bị từ chối và query không bao giờ trả row sai `parentBusinessVersion` trên MySQL/PostgreSQL.
- Fixture legacy dùng chung một `termId` qua hai scope được tách ổn định khi migration chạy lần đầu; chạy lại không cấp UUID/FQN mới, không nhân đôi relation/outbox và asset relation cũ chỉ còn ở identity scope gốc.

### F01 — Consumer xem Approved mới nhất

**Phạm vi**

- Chỉ Consumer-only (`canViewPublished = true`, `canViewWorking = false`) bị giới hạn published-only. Không phân loại published-only chỉ dựa trên việc người dùng có role `BasicConsumer`/`DataConsumer` nếu họ đồng thời có quyền quản trị, soạn thảo, owner hoặc Reviewer assignment.
- GET mặc định resolve published head cho Consumer-only; entity chưa publish không được fallback sang identity hoặc working payload.
- Sidebar của Consumer-only chỉ trả Data Dictionary đã có published snapshot.
- Với người dùng không phải Consumer-only, GET/list và UI giữ nguyên hành vi identity/working/published và route mặc định của OpenMetadata; khi chưa có bản Approved, người có quyền working nhận Data Dictionary Draft `1` đã bootstrap.
- F01 không thêm redirect, bộ lọc published-only hoặc representation fallback mới cho người dùng không phải Consumer-only.
- Trang Glossary/CDE của Consumer-only luôn read-only; không render action trong lúc chờ permission.

**Test/DoD**

- Consumer vẫn thấy v1.0 khi v1.1 đang Draft, InReview hoặc Rejected.
- Consumer-only gọi working endpoint hoặc FQN chưa publish nhận 403/404 và không lộ payload.
- Admin/Steward/Proposer/owner/Reviewer giữ nguyên kết quả và điều hướng mặc định của OpenMetadata khi chưa có published snapshot.
- Owner/Reviewer có quyền working không bị nhận nhầm là Consumer-only dù đồng thời mang role Consumer.
- Khi chưa có bản Approved, người dùng có quyền working thấy Data Dictionary Draft `1` đã bootstrap và action theo quyền; Consumer-only nhận danh sách rỗng hoặc 403/404 khi truy cập trực tiếp, không lộ working payload.
- Có E2E Consumer xem Data Dictionary và CDE Approved.

### F02 — Active/Archived history theo businessVersion và deep link

**Phạm vi**

- `businessVersion` là định danh version của entity hiện tại; mọi browser URL mở CDE bắt buộc dùng thêm `parentBusinessVersion` để xác định version Data Dictionary cha. UI, frontend business model và business API/response không dùng alias `version`/`nativeVersion`, đồng thời không ánh xạ `publicationSequence` thành version nghiệp vụ.
- Data Dictionary dùng canonical positive integer `N` (`1`, `2`, `3`, ...). CDE dùng canonical `N.MINOR`; phần `N` bắt buộc bằng chính `parentBusinessVersion` và `MINOR` là số nguyên không âm không có leading zero. Data Dictionary `N` không bao giờ chứa hoặc resolve CDE có version khác tiền tố `N`.
- Data Dictionary dùng URL `?businessVersion={businessVersion}`; frontend lấy danh sách qua `GET /v1/glossaries/{id}/published` và lấy chi tiết qua `GET /v1/glossaries/{id}/published/{businessVersion}`.
- CDE là con trực tiếp của Data Dictionary và dùng route chứa scoped FQN hoặc `termId`, kèm `?businessVersion={businessVersion}&parentBusinessVersion={parentBusinessVersion}`. `businessVersion` là version CDE; `parentBusinessVersion` là version Data Dictionary cha. Lịch sử CDE được lấy qua `GET /v1/glossaryTerms/{id}/published` và `/published/{businessVersion}`.
- URL CDE thiếu `businessVersion`, thiếu `parentBusinessVersion` hoặc thiếu cả hai trả `404` và không lộ payload. Không hỗ trợ CDE độc lập, không tự resolve param còn thiếu và không suy diễn Data Dictionary version từ CDE version hoặc ngược lại. Khi có đủ hai param, CDE version phải thuộc snapshot Data Dictionary; không khớp trả `404`. Không áp dụng quy tắc này cho CDE cha — CDE con vì quan hệ đó không tồn tại.
- Query param của trình duyệt chỉ là routing state; không truyền thành query native `version`. Lookup theo FQN bắt buộc dùng scoped FQN `{glossaryFqn}.{escapedName}@v{N}`; FQN không-scope không được resolve mơ hồ khi nhiều scope có cùng mã.
- Selector và badge dùng `businessVersion` của CDE; breadcrumb và URL dùng đồng thời `businessVersion` của CDE và `parentBusinessVersion` của Data Dictionary cha. Data Dictionary/CDE Archived luôn read-only. Data Dictionary version sắp xếp theo số nguyên; CDE version sắp xếp theo `(parent integer, minor integer)`.
- F02 đọc Data Dictionary/CDE Approved trong active scope và Archived trong historical scope theo quyền; không triển khai mutation/cutover. Consumer-only mặc định chỉ nhận active Approved.

**Test/DoD**

- F5, bookmark và back/forward trên CDE giữ đúng cả `businessVersion`, `parentBusinessVersion` và nội dung snapshot.
- URL CDE thiếu một trong hai param bắt buộc, version không tồn tại, chưa Approved hoặc không khớp Data Dictionary snapshot trả `404` và không lộ payload.
- Data Dictionary `10` sắp trước `2`; CDE `2.10` sắp trước `2.2`, và mọi CDE được nhóm đúng `parentBusinessVersion`.
- UI và business API/response dùng `businessVersion` cho entity hiện tại; URL CDE bắt buộc dùng thêm `parentBusinessVersion` cho ngữ cảnh cha; không có field/param `version` hoặc `nativeVersion`, và không ánh xạ từ `publicationSequence`.
- URL Data Dictionary mặc định không có business version giữ hành vi F01: Consumer-only nhận Approved mới nhất; người dùng khác giữ nguyên representation mặc định của OpenMetadata. Quy tắc fallback này không áp dụng cho URL CDE.

### F07 — Lưu Draft Data Dictionary khởi tạo sẵn

**Tiền điều kiện và invariant**

- F00 đã tạo nguyên tử đúng một Data Dictionary identity và một working record đầu tiên. Working representation ban đầu phải trả về `name = "Data Dictionary"`, `displayName = "Từ điển dữ liệu dùng chung"`, `businessVersion = "1"`, `entityStatus = Draft`, `workingRevision = 1` và `termRevisions = []`.
- Identity, technical name, display name, versioning mode và business version đầu tiên là dữ liệu hệ thống; F07 không cung cấp API hoặc UI để tạo thêm, đổi tên hay cấu hình lại Data Dictionary.
- Không hiển thị nút `Tạo Từ điển dữ liệu dùng chung` và không dùng `POST /v1/glossaries` từ UI. Nếu bootstrap identity hoặc working record bị thiếu, UI hiển thị lỗi vận hành và backend fail-fast; không tự tạo hoặc tự sửa dữ liệu ngầm.
- Data Dictionary Draft `1` chưa phải published content: bootstrap/F07 không tạo snapshot, published head, publication outbox hoặc trạng thái `Approved`. Consumer-only không nhìn thấy Data Dictionary cho tới khi F09 publish thành công.
- `termRevisions` của working Data Dictionary luôn là array rỗng và do server quản lý. Không có API/UI thêm, bớt hoặc chọn CDE thủ công; F09 tự dựng `termRevisions` từ các published head CDE khi publish Data Dictionary.
- `POST /v1/glossaries/{id}/working` không dùng trong F07; endpoint này chỉ tạo working business version kế tiếp ở F10 sau khi đã có bản Approved và không còn working version.

**API Save Draft và validation**

- Người có `canViewWorking` mở route Data Dictionary mặc định không có query business version; frontend resolve identity ổn định rồi gọi `GET /v1/glossaries/{id}/working` và hiển thị working representation.
- `GET /v1/glossaries/{id}/working` không fallback sang identity hoặc published payload nếu working record không tồn tại.
- `PATCH /v1/glossaries/{id}/working` nhận request typed gồm `expectedRevision` và full mutable business payload; không dùng kiểu JSON extension tổng quát làm contract công khai.
- `expectedRevision` bắt buộc là integer từ 1 trở lên. Thiếu hoặc sai kiểu trả `400 Bad Request`; working record không tồn tại trả `404 Not Found`.
- Chỉ working record có `entityStatus = Draft` được sửa. `InReview` và `Rejected` đều không được PATCH; bản `Rejected` phải được reopen về `Draft` ở F09 trước khi sửa.
- Các field được sửa trong F07 gồm description, owners, reviewers, domains, tags và extension. Payload là trạng thái đầy đủ của nhóm field này; array bị bỏ trống được chuẩn hóa thành array rỗng theo schema.
- Các field `id`, `name`, `displayName`, `fullyQualifiedName`, `versioningMode`, `businessVersion`, `workingRevision`, `entityStatus`, native `version`, publication metadata và audit metadata do server quản lý. Payload cố thay đổi các field này trả `400`.
- F07 không cho phép PATCH trực tiếp `termRevisions`; payload cố gửi field này trả `400`. Danh sách chỉ được tạo bởi transaction publish của F09.
- Backend validate reference của owners, reviewers, domains, tags và schema của extension; không tin entity reference hoặc custom property chỉ vì frontend đã validate.
- Save thành công cập nhật working record tại chỗ, giữ nguyên `businessVersion = "1"`, tăng `workingRevision` đúng một đơn vị và trả working representation mới.
- Update dùng compare-and-set theo `expectedRevision`. Revision cũ trả `409 Conflict` và không thay đổi payload, revision hoặc audit metadata.
- Save Draft không ghi hoặc thay đổi identity, published snapshot, published head, publication outbox hay CDE snapshot; không gọi direct native PATCH để lưu business content.
- Mỗi Save thành công ghi `updatedBy/updatedAt` từ principal backend, không nhận actor/timestamp từ client.

**Authorization và UI**

- Backend quyết định quyền theo capability hiệu lực: đọc Draft yêu cầu `canViewWorking`, Save yêu cầu `canEditWorking`. Frontend không suy quyền chỉ từ tên role.
- Theo policy mặc định, chỉ Admin và Data Proposer được sửa Draft. Data Steward, Reviewer, owner và Consumer-only không được sửa; Data Steward/Reviewer được gán chỉ xem working để kiểm duyệt. Backend luôn tính capability từ policy hiệu lực, không hard-code tên role để vô hiệu hóa policy tùy chỉnh.
- Người có quyền truy cập Data Dictionary được đưa thẳng tới Draft `1` đã bootstrap; Header hiển thị badge `Draft`, business version `1` chỉ đọc và nút `Lưu nháp` theo quyền.
- Save disable action và hiển thị loading trong khi request đang chạy; chặn double-submit. Sau thành công, UI thay state bằng response backend và dùng `workingRevision` mới cho lần Save tiếp theo.
- Khi nhận `409`, UI giữ dữ liệu chưa lưu, không đóng form và không tự retry. UI hiển thị conflict cùng hành động tải bản mới nhất; trước khi reload phải cảnh báo dữ liệu chưa lưu sẽ bị thay thế.
- Luồng tổng thể tiếp theo là `Draft → Gửi duyệt → Phê duyệt` hoặc `Từ chối → Chỉnh sửa lại`. Các action Gửi duyệt/Phê duyệt/Từ chối/Chỉnh sửa lại và việc tự động chốt danh sách CDE thuộc F09; UI không có thao tác thêm/bớt CDE.
- Sau khi một version đã Approved và không còn working version, F10 mới hiển thị `Tạo phiên bản mới` cho Admin/Data Proposer để nhập business version kế tiếp trên cùng identity.

**Test/DoD**

- Bootstrap integration test trên database sạch tạo đúng một identity và một working record có `name = "Data Dictionary"`, `displayName = "Từ điển dữ liệu dùng chung"`, `businessVersion = "1"`, `entityStatus = Draft`, `workingRevision = 1` và `termRevisions = []`.
- Inject failure giữa insert identity và insert working chứng minh transaction rollback toàn bộ và không phát index/event cho dữ liệu thất bại.
- Chạy lại initialization/restart không tạo trùng, không tăng revision và không ghi đè nội dung Draft hiện có.
- Trạng thái chỉ có identity hoặc chỉ có working record làm initialization fail-fast với lỗi vận hành rõ ràng; không tự repair.
- API/UI không cung cấp thao tác tạo Data Dictionary thứ hai; request tạo hoặc vận hành Glossary nghiệp vụ khác bị từ chối.
- Manager có quyền mở route mặc định và nhận đúng Data Dictionary Draft `1`; Consumer-only nhận danh sách rỗng hoặc 403/404 và không lộ working payload.
- Save nhiều lần giữ nguyên `businessVersion = "1"` và tăng revision tuần tự `1 → 2 → 3`.
- Hai writer dùng cùng revision: đúng một writer thành công; writer còn lại nhận `409`, và payload/audit của writer thành công không bị ghi đè.
- PATCH thiếu/sai `expectedRevision` trả `400`; working không tồn tại trả `404`; PATCH `InReview` hoặc `Rejected` bị từ chối và không đổi dữ liệu.
- Test chứng minh client không thể thay đổi field server-owned hoặc `termRevisions` qua Save Draft.
- Save Draft không tạo hoặc thay đổi snapshot, published head, publication outbox hay CDE snapshot.
- Authorization integration test bao phủ Admin, Data Proposer, Data Steward, Consumer-only, Reviewer mặc định và user đồng thời có nhiều role; chỉ Admin/Data Proposer có capability tạo hoặc chỉnh sửa.
- Frontend test bao phủ tải Draft bootstrap, không hiển thị nút tạo Data Dictionary, loading, double-submit, cập nhật revision từ response và conflict `409` giữ dữ liệu chưa lưu.
- E2E: khởi động môi trường sạch → mở Data Dictionary Draft `1` → Save nhiều lần → restart/reload, vẫn resolve đúng một identity và một Draft với revision/nội dung mới nhất.

### F03 — Tạo và lưu Draft CDE

**Ranh giới chức năng và invariant**

- F03 tạo CDE business version đầu tiên trong Data Dictionary working `N`. Một lần tạo thành công sinh đúng một `GlossaryTerm` identity thuộc Data Dictionary và đúng một working record có `businessVersion = "N.0"`, `entityStatus = Draft`, `workingRevision = 1`.
- `businessVersion = "N.0"` của lần tạo đầu tiên do server suy từ `parentBusinessVersion = N`; target `N` phải là Data Dictionary Approved active hoặc working kế tiếp chưa Archived. Client gửi parent scope nhưng không được chọn CDE version khác. `POST /v1/glossaryTerms/{id}/working` không tham gia luồng tạo identity mới F03 và chỉ dùng cho identity đã tồn tại ở F06.
- F03 không tìm hoặc tái sử dụng identity cùng mã ở scope cũ. Ví dụ `alo1` trong Dictionary `1` và `alo1` trong Dictionary `2` phải có hai `termId` và scoped FQN khác nhau; nội dung, workflow, assets và audit độc lập.
- Identity và working record phải được ghi trong cùng database transaction. Nếu bất kỳ bước nào thất bại thì rollback toàn bộ; không để lại identity mồ côi, working record mồ côi, relationship, index document hoặc event cho dữ liệu thất bại.
- Native `GlossaryTerm` identity chỉ cung cấp định danh kỹ thuật và quan hệ nền của OpenMetadata. Working record là nguồn business content có thẩm quyền; Create/Save Draft không dùng direct native PATCH để lưu business content và không dùng native metadata version làm business version.
- Mỗi CDE có đúng Data Dictionary làm cha nghiệp vụ trực tiếp. Payload phải trỏ tới Data Dictionary identity đã bootstrap và không được có `parent` là một CDE; backend từ chối sub-term, Glossary khác và mọi cấu hình workflow/versioning riêng trên CDE.
- Tạo CDE thiết lập quan hệ sở hữu kỹ thuật với Data Dictionary working `N` nhưng không ghi `termRevisions`, không tăng `workingRevision` của Data Dictionary và không tạo snapshot. Sau khi CDE `N.x` được Approved, nó chỉ đủ điều kiện cho lần publish chính Data Dictionary `N`; không được carry sang `N+1`.
- Draft CDE chỉ được mở trong editor có ngữ cảnh Data Dictionary bởi người có `canViewWorking`; UI không điều hướng nó vào published/historical deep-link và Consumer không thể phát hiện identity hoặc working payload này.
- Một identity chỉ có tối đa một working version. Mã CDE chỉ duy nhất trong scope `(glossaryId, parentBusinessVersion)`; cùng mã ở scope khác được phép và tạo identity mới. FQN kỹ thuật có hậu tố `@v{N}` để duy nhất toàn hệ thống; retry sau create đã commit trả conflict rõ ràng thay vì tạo bản ghi thứ hai trong cùng scope.

**API Create và validation**

- UI gọi duy nhất `POST /v1/glossaryTerms` để tạo mới; backend không yêu cầu frontend gọi tiếp `POST /v1/glossaryTerms/{id}/working`. Response là working representation vừa tạo, không phải native identity projection.
- Create request dùng typed contract có required `parentBusinessVersion`; backend tự gán `N.0`. Các field nghiệp vụ gồm `name`, `displayName`, `description`, `owners`, `reviewers`, `domains`, `tags` và `extension`; `name` trở thành định danh bất biến sau create.
- `glossary` bắt buộc resolve đúng Data Dictionary bằng định danh ổn định. `parent` phải absent/null. Các field native ngoài phạm vi sản phẩm như sub-term hierarchy, workflow config, `versioningMode`, `provider`, publication/audit metadata và các field server-owned không được client điều khiển.
- Backend validate canonical `name`, uniqueness của `(glossaryId, parentBusinessVersion, normalizedName)`, scoped FQN, reference của owners/reviewers/domains/tags và schema Custom Properties của `extension`; không tin dữ liệu đã được frontend validate.
- Create thành công trả ít nhất `id`, `name`, `fullyQualifiedName`, `glossary`, toàn bộ business payload, `businessVersion = "N.0"`, `entityStatus = Draft`, `workingRevision = 1`, `updatedBy` và `updatedAt` lấy từ principal/backend clock.
- Duplicate name trong cùng parent scope, scoped FQN trùng hoặc concurrent create cùng scope trả `409 Conflict`; cùng name ở scope khác phải tạo thành công với `termId` mới. Payload sai schema, có `parent`, trỏ sai Glossary hoặc cố gán field server-owned trả `400 Bad Request`; không có quyền tạo trả `403 Forbidden`.
- Index/change event cần thiết cho identity chỉ được phát sau commit và phải idempotent. Không phát published outbox, không tạo published head hoặc CDE snapshot trong F03.

**API Save Draft**

- `GET /v1/glossaryTerms/{id}/working?parentBusinessVersion={N}` yêu cầu scope cha và `canViewWorking`; thiếu/sai scope trả `400/404`, working scoped không tồn tại trả `404`; không fallback sang identity, scope khác hoặc published snapshot.
- F03 cung cấp truy vấn authoring tối thiểu qua `GET /v1/glossaryTerms?glossary={dataDictionaryFqn}` để người có `canViewWorking` tìm lại CDE có working record sau reload. Backend resolve mỗi row thành working representation và lọc quyền trước khi trả; đây không phải bảng lịch sử/flat list đầy đủ của F11 và không ghi CDE vào `termRevisions` của working Data Dictionary.
- `PATCH /v1/glossaryTerms/{id}/working?parentBusinessVersion={N}` dùng typed request gồm `expectedRevision` và full mutable business payload; scope là bắt buộc và không dùng DTO tổng quát.
- `expectedRevision` bắt buộc là integer từ 1 trở lên. Thiếu, sai kiểu hoặc ngoài miền hợp lệ trả `400 Bad Request`.
- Full mutable payload của Save gồm `displayName`, `description`, `owners`, `reviewers`, `domains`, `tags` và `extension`. Các array bắt buộc hiện diện và dùng `[]` để xóa toàn bộ; `extension` bắt buộc hiện diện nhưng được phép `null` để xóa toàn bộ Custom Properties. Field bị thiếu hoặc ngoài allowlist trả `400`, không được hiểu là “giữ nguyên”.
- Các field `id`, `name`, `fullyQualifiedName`, `glossary`, `parent`, `businessVersion`, `workingRevision`, `entityStatus`, native `version`, workflow/versioning config, publication metadata và audit metadata do server quản lý. Payload cố thay đổi chúng trả `400`.
- Chỉ working record ở `Draft` được PATCH. `InReview` và `Rejected` đều bị từ chối và không thay đổi payload/revision/audit; bản `Rejected` phải qua `reopen` của F04 để trở lại `Draft` trước khi sửa.
- Save thành công cập nhật CDE working record tại chỗ, giữ nguyên identity và `businessVersion = "N.MINOR"`, tăng `workingRevision` đúng một đơn vị, ghi `updatedBy/updatedAt` từ backend và trả working representation mới.
- Save dùng compare-and-set theo `expectedRevision`. Revision cũ trả `409 Conflict`; request thất bại không thay đổi payload, revision, audit metadata, Data Dictionary working record hoặc bất kỳ snapshot/head/outbox nào.

**Authorization và UI**

- Vì CDE chưa tồn tại tại thời điểm Create, backend kiểm tra quyền tạo trên Data Dictionary cha bằng capability/policy hiệu lực. Save kiểm tra `canEditWorking` trên CDE; xem Draft kiểm tra `canViewWorking`. Frontend chỉ render action theo capability backend trả về, không suy quyền từ tên role.
- Theo policy mặc định, chỉ Admin và Data Proposer có thể tạo/sửa. Data Steward, owner và Reviewer không được tạo hoặc sửa Draft; Data Steward/Reviewer được gán có thể xem working để duyệt ở F04. Consumer-only không được xem working, tạo hoặc sửa. Capability vẫn phải phản ánh policy hiệu lực thay vì hard-code tên role.
- Form Create và Save disable action, hiển thị loading và chặn double-submit trong khi request đang chạy. Sau Create/Save thành công, UI thay state bằng response backend và dùng `workingRevision` trả về cho mutation tiếp theo.
- Khu vực authoring của Data Dictionary hiển thị các CDE working mà người dùng được phép xem với nhãn trạng thái rõ ràng. CDE chưa Approved hiển thị `Chưa đủ điều kiện phát hành`; CDE Approved hiển thị `Sẽ được lấy ở lần phát hành Data Dictionary tiếp theo`. Chọn row mở editor trong context Data Dictionary; reload vẫn tìm lại được Draft qua truy vấn authoring tối thiểu.
- Khi Save nhận `409`, UI giữ dữ liệu chưa lưu, không đóng editor và không tự retry. UI hiển thị conflict cùng hành động tải bản mới nhất; trước khi thay state phải cảnh báo dữ liệu chưa lưu sẽ bị mất.
- UI không hiển thị control tạo sub-term hoặc chọn Glossary cha; Data Dictionary được lấy từ context hiện tại. Hủy hoặc lỗi Create không chèn CDE giả vào bảng/cache phía client.

**Test/DoD**

- Integration test Create trong Data Dictionary working `N` tạo đúng một identity và một working Draft `N.0`, trả `workingRevision = 1`, không tạo published snapshot/head/outbox và không đổi `termRevisions` hay revision của Data Dictionary.
- Inject failure giữa insert identity, relationship và insert working chứng minh transaction rollback toàn bộ; không có identity/working mồ côi, index document hoặc event cho transaction thất bại.
- Hai request Create đồng thời với cùng Data Dictionary/name: đúng một request thành công, request còn lại nhận `409`; retry không tạo thêm identity hoặc working record.
- Test từ chối Glossary khác, `parent` CDE/sub-term, workflow config riêng, field server-owned, reference không tồn tại, tag/custom property sai schema và FQN không hợp lệ.
- Save nhiều lần giữ nguyên `businessVersion = "N.0"` và tăng revision tuần tự `1 → 2 → 3`; restart/reload vẫn trả đúng một identity và working payload mới nhất.
- Hai writer dùng cùng revision: đúng một writer thành công; writer còn lại nhận `409`, payload/audit của writer thành công không bị ghi đè.
- PATCH thiếu/sai `expectedRevision`, thiếu field bắt buộc hoặc có field ngoài allowlist trả `400`; working không tồn tại trả `404`; PATCH `InReview` hoặc `Rejected` bị từ chối và không đổi dữ liệu.
- Test chứng minh client không thể đổi `name`, FQN, Glossary, parent, business version, status, revision hoặc actor/timestamp qua Save Draft; không dùng `workingRevision` hay native `version` làm fallback cho `businessVersion`.
- Authorization integration test bao phủ Admin, Data Proposer, Data Steward, owner, Viewer có `canViewWorking` nhưng không có `canEditWorking`, Reviewer và Consumer-only. Chỉ Admin/Data Proposer có capability create/edit/submit.
- Test truy vấn authoring chứng minh maker tìm lại được Draft sau reload, kết quả đã lọc theo quyền và Consumer không nhận identity/working row.
- Frontend test bao phủ single-request Create, loading/double-submit, không gửi `parent`, thay state/revision từ response, validation failure, Create failure không để cache row giả và conflict `409` giữ dữ liệu chưa lưu.
- E2E: mở Data Dictionary `N` Draft → tạo CDE → sửa và Save nhiều lần → reload/restart → CDE Draft vẫn có version `N.0`, revision/nội dung đúng; Consumer không nhìn thấy và working Data Dictionary không tự ghi `termRevisions`.

### F04 — Submit, Reject và Reopen CDE

**Ranh giới chức năng và state machine**

- F04 chỉ triển khai ba transition trên working version của CDE: `Draft → InReview` qua `submit`, `InReview → Rejected` qua `reject` và `Rejected → Draft` qua `reopen`. `approve` và việc tạo published snapshot thuộc F05, không nằm trong F04.
- Transition chỉ thay đổi trạng thái workflow, revision và transition metadata. Không thay đổi `businessVersion` hoặc business payload; không tạo native metadata version, published snapshot, published head hay publication outbox.
- Không có transition tắt hoặc idempotent success: gọi action khi working record không ở đúng source state bị từ chối và không thay đổi dữ liệu. Working record không tồn tại trả `404 Not Found`.
- `InReview` khóa toàn bộ business field. `Rejected` vẫn chỉ đọc cho tới khi `reopen` thành công; sau đó CDE trở lại `Draft` và mới được Save qua contract F03.
- `reject` không nhận lý do từ chối trong F04, thống nhất với thiết kế UI hiện tại.

**API contract và optimistic locking**

- Dùng ba endpoint `POST /v1/glossaryTerms/{id}/working/submit|reject|reopen?parentBusinessVersion={N}`; scope cha bắt buộc trong mọi transition và frontend wrapper phải truyền xuyên suốt.
- Cả ba endpoint nhận typed request `{ "expectedRevision": <integer> }`. `expectedRevision` bắt buộc là integer từ 1 trở lên; thiếu, sai kiểu, ngoài miền hoặc có field ngoài allowlist trả `400 Bad Request`.
- Frontend lấy `expectedRevision` từ `workingRevision` của working representation gần nhất. Backend không nhận `workingRevision`, actor, timestamp, source status hoặc target status từ client.
- Mutation dùng compare-and-set nguyên tử theo cả source state và `expectedRevision`. Revision cũ hoặc state đã bị request khác thay đổi trả `409 Conflict`; request thất bại không thay đổi status, revision, payload hoặc transition metadata.
- Thành công tăng `workingRevision` đúng một đơn vị và trả working representation mới, gồm status/revision mới cùng transition metadata để UI thay state. Frontend không tự tính revision hoặc status.
- Sai transition do client gọi action không phù hợp với trạng thái hiện tại trả `409 Conflict`. Payload/schema request không hợp lệ trả `400`; không đủ quyền trả `403 Forbidden`.

**Authorization, validation và audit metadata**

- Backend kiểm tra capability hiệu lực trên working payload hiện tại, bao gồm owners/reviewers đã được Save ở F03; không dựa vào quan hệ native có thể đã cũ và không suy quyền chỉ từ tên role.
- `submit` yêu cầu `canSubmit`; `reject` yêu cầu `canReject`; `reopen` yêu cầu `canEditWorking`. Chỉ Admin/Data Proposer được submit/reopen. Data Steward và assigned Reviewer chỉ được reject; Proposer không được reject.
- Trước `submit`, backend validate lại working payload và các entity reference theo cùng invariant F03. F04 không bổ sung field nghiệp vụ bắt buộc mới và không bắt buộc danh sách reviewer phải khác rỗng vì Admin/Data Steward vẫn có thể review.
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
- Approve CDE không sửa status, payload hoặc revision Data Dictionary. Nó cập nhật CDE snapshot/head trong đúng `parentBusinessVersion`; nếu parent đang Approved active thì CDE xuất hiện ngay cho Consumer, nếu parent còn working thì chỉ Manager thấy cho tới cutover.
- CDE snapshot chỉ được đọc trong đúng scope cha và prefix version. Không có chế độ CDE độc lập và không có fallback/carry-forward sang Data Dictionary version khác.
- Approved snapshot bất biến về business payload và publication metadata cốt lõi. F16 có thể bổ sung lifecycle metadata như `archivedAt/archivedBy`, nhưng không được sửa snapshot payload, `businessVersion`, `publicationSequence`, `publishedAt`, `publishedBy` hoặc `contentHash`.
- F05 chỉ publish một CDE trong đúng scope cha. Không triển khai tạo version kế tiếp của F06, cutover/archive Data Dictionary của F09 hoặc màn hình audit đầy đủ của F16.

**API contract và optimistic locking**

- Dùng endpoint `POST /v1/glossaryTerms/{id}/working/approve?parentBusinessVersion={N}`; frontend wrapper bắt buộc truyền scope cha, không resolve working chỉ bằng `id`.
- Request dùng cùng typed contract tối thiểu như các transition F04 và chỉ gồm `{ "expectedRevision": <integer> }`. `expectedRevision` bắt buộc là integer từ 1 trở lên; thiếu, sai kiểu, ngoài miền hoặc có field ngoài allowlist trả `400 Bad Request`.
- Client không được gửi `businessVersion`, business payload, `workingRevision`, actor, timestamp, source status, target status, snapshot ID, publication sequence hoặc publication metadata.
- Backend đọc `expectedRevision` từ working representation gần nhất. Revision cũ, source state không còn `InReview` hoặc business version đã được publish trả `409 Conflict` và không thay đổi working/snapshot/head/outbox. Working record không tồn tại trả `404 Not Found`; không đủ quyền trả `403 Forbidden`.
- Thành công trả published representation gồm ít nhất `id`, `name`, `fullyQualifiedName`, `glossary`, toàn bộ business payload, `businessVersion`, `entityStatus = Approved`, `snapshotId`, `publicationSequence`, `publishedAt` và `publishedBy`. Published response không trả hoặc tái sử dụng `workingRevision`; frontend không tự tính status, sequence hoặc publication metadata.

**Authorization và validation tại thời điểm publish**

- Approve yêu cầu capability hiệu lực `canApprove`. Backend tính capability từ working payload mới nhất và policy hiện hành, bao gồm owners/reviewers đã được Save trước Submit; không dựa vào native relationship có thể đã cũ và không suy quyền chỉ từ tên role.
- Assigned Reviewer chỉ được approve khi vẫn được gán trong working payload hoặc policy hiệu lực cho phép. Proposer/owner không mặc nhiên được approve; Consumer-only không được xem working payload hoặc gọi approve. Admin/Data Steward vẫn phải đi qua cùng capability resolver và không nhận capability chỉnh sửa từ quyền kiểm duyệt.
- Sau khi khóa working record và trước khi ghi snapshot, backend validate lại toàn bộ invariant CDE của F03/F04: CDE thuộc đúng Data Dictionary identity, không có `parent`, `parentBusinessVersion = N` còn là scope active hoặc working chưa Archived, `businessVersion` khớp `N.MINOR`, business payload đúng schema và mọi reference/extension còn hợp lệ.
- `publishedBy` lấy từ authenticated principal và `publishedAt` lấy từ backend clock. Client không được điều khiển hoặc ghi đè audit metadata.

**Atomic publication transaction**

- Trước khi khóa working row CDE, backend khóa row identity ổn định của Data Dictionary cha bằng cơ chế tương đương `SELECT id FROM glossary_entity WHERE id = :glossaryId FOR UPDATE`. Mọi mutation làm thay đổi published head CDE của Data Dictionary đó, gồm approve và archive/restore khi được bổ sung, phải lấy cùng parent lock trước; thứ tự khóa thống nhất là Data Dictionary identity → CDE working/head để tránh deadlock với F09.
- Sau parent lock, backend khóa working row của CDE theo `(entityId, parentBusinessVersion)` trước khi kiểm tra revision, state, quyền và validation. Mọi bước ghi publication dùng cùng database handle/transaction.
- Trong đúng một transaction, thực hiện theo thứ tự logic: khóa và đọc working → kiểm tra `expectedRevision` và `InReview` → authorization/validation → tạo Approved snapshot payload → cấp `publicationSequence` kế tiếp → tính `contentHash` → insert snapshot → cập nhật published head → insert outbox idempotent → xóa working row bằng compare-and-set.
- Bất kỳ lỗi nào trước commit, bao gồm lỗi insert snapshot, update head, insert outbox hoặc delete working, phải rollback toàn bộ. Không được tồn tại snapshot mồ côi, head trỏ sai, outbox thiếu, working bị xóa sớm hoặc manager/published index phản ánh dữ liệu chưa commit.
- Published head chỉ được trỏ tới snapshot vừa commit có publication sequence mới nhất của cùng CDE trong đúng `parentBusinessVersion`. Head/working uniqueness phải có scope cha; constraint trên version vẫn ngăn trùng tuyệt đối. Lỗi constraint do race được ánh xạ thành `409 Conflict`.
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
- Nếu scope cha đang Approved active, CDE vừa Approved xuất hiện ngay cho Consumer trong Data Dictionary cùng `parentBusinessVersion`; UI điều hướng bằng đủ cặp version. Nếu scope cha mới chỉ Draft/InReview, CDE giữ nhãn `Approved — Chờ Data Dictionary N được phê duyệt` và chưa lộ cho Consumer.
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
- Test chứng minh Approve CDE không đổi status/revision của Data Dictionary: trong scope active nó chỉ cập nhật scoped CDE read model; trong scope working nó chưa lộ cho Consumer. Không có fallback hoặc mutation sang scope khác.
- Frontend test bao phủ action visibility theo capability/state, modal, loading, double-submit, request chỉ có `expectedRevision`, state từ response, conflict reload và hai nhánh điều hướng có/chưa có Data Dictionary snapshot tham chiếu.
- E2E phạm vi F05: CDE `N.x` Draft → Submit → Approve; nếu Dictionary `N` active thì Consumer thấy ngay, nếu `N` còn working thì chỉ Manager thấy cho tới cutover. URL luôn có đủ `businessVersion` và `parentBusinessVersion`.

### F06 — Tạo business version CDE trong đúng scope Data Dictionary

**API contract**

- Dùng `POST /v1/glossaryTerms/{id}/working`. Request chỉ gồm `{ "businessVersion": "N.MINOR", "parentBusinessVersion": "N" }`; từ chối `payload`, `expectedRevision`, `entityStatus` và field identity. Backend bắt buộc đối chiếu prefix với parent scope.
- Response là working representation vừa tạo, có `entityStatus = Draft`, `workingRevision = 1`, audit metadata và capability do backend tính.
- Request sai cấu trúc hoặc version sai định dạng trả `400 Bad Request`; conflict về state, version hoặc concurrency trả `409 Conflict`; không đủ quyền trả `403 Forbidden`; CDE không tồn tại hoặc không thuộc Data Dictionary trả `404 Not Found`.

**Tiền điều kiện và phân quyền**

- CDE identity phải được tạo trong đúng scope `N` và target Data Dictionary `N` phải đang là bản Approved active hoặc working Draft/InReview/Rejected chưa cutover. F06 chỉ tạo minor version kế tiếp của identity trong chính scope đó; không được chuyển identity từ `N` sang `N+1` và không được tạo version cho Data Dictionary Archived.
- Một CDE identity có tối đa một working version và đúng một `parentBusinessVersion`. Hai CDE cùng mã ở scope `1` và `2` là hai identity độc lập; API lookup và authorization luôn kiểm tra `termId` thuộc đúng parent scope.
- Backend kiểm tra capability riêng `canCreateVersion`; UI không suy quyền từ role hoặc chỉ tái sử dụng `canEditWorking` làm điều kiện duy nhất. Các capability workflow ánh xạ trực tiếp tới operation explicit-grant-only (`ViewWorking`, `EditWorking`, `SubmitWorking`, `CreateVersion`, `ApproveWorking`, `RejectWorking`, `ArchivePublished`), nên `All`/`EditAll` từ policy khác không tự động cấp quyền workflow.
- Policy mặc định chỉ cấp quyền tạo version cho Admin và Data Proposer. Data Steward, owner, Consumer-only và Reviewer mặc định không được tạo; backend suy `canCreateVersion` từ policy hiệu lực thay vì hard-code tên role.
- Business field `owners` của Draft mới vẫn bắt đầu rỗng, nhưng Admin/Data Proposer tạo Draft được giữ quyền xem, sửa và submit working version qua workflow authorization metadata/`createdBy`.

**Quy tắc business version**

- `businessVersion` dùng canonical `N.MINOR`, khớp `^[1-9]\d*\.(0|[1-9]\d*)$`; `N` bắt buộc bằng `parentBusinessVersion` của Data Dictionary target. Prefix sai trả `400 Bad Request`, không tự đổi số hoặc di chuyển scope.
- Trong cùng scope `N`, version mới phải lớn hơn high-water CDE `N.x` theo numeric minor. UI gợi ý tăng minor (`2.9 → 2.10`); CDE chưa có version trong scope `N` bắt đầu ở `N.0`.
- Khi chuẩn bị Dictionary `N+1`, người dùng tạo CDE `N+1.0` qua F03 như một identity mới, kể cả khi scope `N` đã có CDE cùng mã. Không copy `termId`, FQN, `displayName`, description, tags, owners, reviewers, domains, extension, assets hoặc bất kỳ business content nào từ CDE `N.x`.

**Khởi tạo Draft**

- Backend tự dựng payload từ server-owned identity trong scope hiện tại; không dùng payload do client gửi và không copy snapshot ở scope khác.
- F06 chỉ giữ `id`, `name`, scoped `fullyQualifiedName`, liên kết `glossary` và `parentBusinessVersion` của chính identity. Khi tăng minor bên trong cùng scope `N`, `displayName` cùng toàn bộ business content vẫn bắt đầu trắng.
- `description`, tags, owners, reviewers, domains, extension và toàn bộ Custom Properties bắt đầu rỗng theo một quy ước `null`/empty thống nhất với schema.
- Không giữ hoặc tạo `parent`; không copy Assets, quan hệ CDE, publication audit, `snapshotId`, `publicationSequence` hoặc native metadata history.
- Các field kỹ thuật như `href` hoặc native version, nếu cần trong response, phải được server tính lại thay vì copy từ snapshot cũ.
- Việc dựng Draft dùng allowlist để field nghiệp vụ bổ sung trong tương lai không vô tình được kế thừa. Snapshot Approved cũ, published head, `contentHash` và native entity không bị thay đổi.

**Transaction và concurrency**

- Trong một transaction: khóa Data Dictionary identity/scope của CDE → khóa CDE identity/head → xác nhận identity thuộc đúng scope, kiểm tra quyền, high-water/working absence → dựng Draft trắng → insert working revision 1 → commit.
- Không chỉ dựa vào `SELECT ... FOR UPDATE` trên working row chưa tồn tại vì thao tác đó không serialize được hai request tạo đồng thời. Unique constraint trên working entity/version là lớp bảo vệ cuối cùng.
- Hai request đồng thời trên cùng identity chỉ một request thành công. CDE cùng mã nhưng khác identity/scope không khóa hoặc ghi đè nhau. Constraint race ánh xạ thành `409`, không trả `500`.
- Bất kỳ lỗi nào trước commit phải rollback toàn bộ. Refresh manager index chỉ chạy sau commit; lỗi index sau commit không được xóa working version đã tạo hoặc biến kết quả đã commit thành thất bại.

**Quan hệ Data Dictionary và UI**

- Tạo CDE version mới không đổi trạng thái Data Dictionary hoặc bất kỳ CDE hiện hành nào. Trong scope active `N`, Consumer tiếp tục thấy latest Approved `N.x` cho tới khi version mới cùng scope được Approved; trong scope working `N+1`, Consumer chưa thấy CDE cho tới khi Dictionary `N+1` active.
- Không fallback chéo scope: CDE `2.0` Draft không làm Dictionary `2` hiển thị CDE `1.x`, và Dictionary `1` không hiển thị CDE `2.x`.
- Action chỉ hiện khi có `canCreateVersion`, target scope chưa Archived và scope đó chưa có working cho CDE. Historical/archive view không có action này.
- Modal prefill version gợi ý, validation inline, loading, disable và chống double-submit. Sau thành công, UI dùng response backend làm state, mở authoring/manager context và hiển thị `Draft — Chưa đủ điều kiện phát hành`.
- Không tạo published deep link hoặc gọi published endpoint cho Draft. Lỗi `400/403/404/409/5xx` không được tạo optimistic Draft giả; với `409`, UI giữ state hiện tại và cung cấp hành động tải representation mới nhất.

**Test/DoD**

- Happy path F06 chỉ gồm `2.0 Approved → tạo 2.1 Draft` trên cùng identity. Trường hợp scope `1` có `alo1` và scope `2` cần `alo1 2.0` phải đi qua F03, tạo `termId` mới và payload business độc lập.
- Test chứng minh `description`, tags, owners, reviewers, domains, extension và mọi Custom Property không bị copy; các field publication/native/membership cũng không bị copy. Field nghiệp vụ mới thêm vào schema không tự động được kế thừa ngoài allowlist.
- Test target scope active/working/Archived, identity-parent mismatch, working đã tồn tại, version malformed/trùng/thấp hơn và CDE không thuộc parent scope. Test riêng xác nhận không thể gọi F06 bằng `termId` của scope `1` để tạo version trong scope `2`.
- Authorization integration test bao phủ Admin, Data Proposer, Data Steward, owner, assigned Reviewer, Reviewer thuần túy, Consumer-only và user đồng thời có nhiều role. Chỉ Admin/Data Proposer nhận `canCreateVersion = true`; Data Steward chỉ có capability phê duyệt, từ chối và hủy phê duyệt. Test riêng chứng minh creator hợp lệ không mất quyền xem/sửa/submit Draft vừa tạo dù `owners` bắt đầu rỗng.
- Hai request đồng thời cùng scope: một thành công, một `409`; hai request ở scope `N` và `N+1` hợp lệ có thể tạo hai scoped working độc lập.
- Failure injection tại các boundary trong transaction chứng minh rollback toàn bộ; snapshot/head/hash, Data Dictionary membership/revision, native entity và outbox không thay đổi.
- Frontend test bao phủ capability, latest-vs-historical, version prefill/validation, modal, loading, double-submit, state từ response, authoring context và xử lý conflict/reload.
- E2E: Dictionary `1` có `alo1 1.x` → tạo Dictionary `2` → dùng “Thêm thuật ngữ” tạo `alo1 2.0` với `termId` mới → sửa/approve `2.0`; hai scope chỉ thấy identity của mình và không có nội dung/asset/quan hệ nào được kế thừa.

### F09 — Workflow, Data Dictionary đang hoạt động và cutover sang version mới

**Invariant vòng đời và phạm vi version**

- Data Dictionary dùng version nguyên dương `N`; CDE của nó chỉ dùng version `N.MINOR`. Data Dictionary `N` tuyệt đối không copy, fallback, đổi số hoặc tham chiếu CDE `M.x` khi `M != N`.
- Data Dictionary `Approved` mới nhất là bản **đang hoạt động**, không phải manifest CDE bất biến. Sau khi Data Dictionary `N` được Approved và trước khi `N+1` được Approved, người dùng có quyền vẫn được tạo, sửa và đưa CDE `N.x` qua Draft/InReview/Rejected/Approved; trạng thái Data Dictionary `N` vẫn là `Approved`.
- Consumer của Data Dictionary `N` chỉ thấy active CDE `N.x` đã `Approved`. Manager thấy cả CDE `N.x` Draft, InReview, Rejected và Approved theo quyền. Một CDE `N.x` vừa được Approved tự xuất hiện trong read model của Data Dictionary `N` mà không cần publish lại Data Dictionary.
- Có thể đồng thời tồn tại Data Dictionary `N` Approved đang hoạt động và Data Dictionary `N+1` Draft/InReview. Tạo `N+1` hoặc tạo CDE `N+1.x` không thay đổi trạng thái/nội dung của `N` hay CDE `N.x`.
- Data Dictionary `N+1` bắt đầu trắng. Chỉ CDE `N+1.x` được người dùng tạo riêng và được Approved mới xuất hiện trong `N+1`; không có carry-forward tự động từ `N`.
- Khi `N+1` được Approved, trong cùng cutover transaction: Data Dictionary `N` và mọi CDE `N.x` Approved của nó chuyển `Archived`; mọi CDE `N.x` Draft/InReview/Rejected bị xóa khỏi working store; Data Dictionary `N` bị khóa vĩnh viễn; `N+1` trở thành bản Approved đang hoạt động. Identity kỹ thuật dùng chung không bị xóa nếu còn version ở scope khác.

**API contract và state machine**

- Dùng các endpoint `POST /v1/glossaries/{id}/working/submit`, `/reject`, `/reopen` và `/approve`. Tạo schema `glossaryWorkflowTransitionRequest.json` dùng riêng cho bốn endpoint, chỉ gồm required `{ "expectedRevision": <integer> }` và `additionalProperties = false`; không tái sử dụng `GlossaryWorkingVersionRequest` vốn còn cho phép `businessVersion`/`payload`. Thiếu/sai kiểu/ngoài miền hoặc gửi thêm `businessVersion`, `payload`, `termRevisions`, actor, timestamp hay target status trả `400 Bad Request`.
- State hợp lệ là `Draft → InReview` qua Submit, `InReview → Rejected` qua Reject, `Rejected → Draft` qua Reopen và `InReview → Approved` qua Approve. Sai source state hoặc revision cũ trả `409 Conflict`; working không tồn tại trả `404`; thiếu capability trả `403`.
- Submit yêu cầu `canSubmit`, Reject yêu cầu `canReject`, Reopen yêu cầu `canEditWorking`, Approve yêu cầu `canApprove`. Capability được tính lại từ working payload và policy hiện hành sau khi row đã khóa; UI không suy quyền từ role.
- Submit/Reject/Reopen thành công tăng `workingRevision` đúng một và trả working representation mới. Approve thành công xóa Data Dictionary working row, thực hiện cutover và trả representation của Data Dictionary mới có `entityStatus = Approved`, `businessVersion = N+1` và thống kê CDE `N+1.x`; không trả `workingRevision`.
- `GET /v1/glossaries/{id}/working/publish-preview?limit={n}&after={cursor}` yêu cầu `canViewWorking` và trả hai nhóm rõ ràng: các CDE `N+1.x` Approved sẽ hoạt động trong bản mới, và thống kê cleanup của bản `N` gồm số CDE Approved sẽ Archive cùng số Draft/InReview/Rejected sẽ bị xóa. Preview động, phân trang server-side và được tính lại trong transaction Approve.

**Read model CDE đang hoạt động và archive manifest**

- Published head/working của CDE mang `parentBusinessVersion` bất biến và `termId` chỉ thuộc một scope. Hai CDE cùng mã ở `N` và `N+1` có head/working độc lập vì là hai identity khác nhau; mọi query vẫn bắt buộc lọc parent scope để chống rò dữ liệu.
- Backend lưu `parentBusinessVersion` tường minh trên CDE working/snapshot/head và đồng thời validate nó bằng phần nguyên của `termBusinessVersion`; không chỉ suy từ chuỗi version khi query hoặc authorization.
- Khi đọc Data Dictionary `N` đang hoạt động, backend trả các CDE snapshot `N.x` Approved đúng scope theo contract bảng version; endpoint detail mặc định có thể resolve scoped head mới nhất. CDE chỉ có Draft/InReview/Rejected không hiển thị cho Consumer; tuyệt đối không fallback sang `N-1.x` hoặc scope khác.
- Khi cutover sang `N+1`, backend đóng băng toàn bộ danh sách Approved CDE snapshots `N.x` thành archive manifest bất biến của Data Dictionary `N`, rồi archive chính các snapshot đó. CDE `N.x` chưa Approved không thuộc archive manifest và bị xóa theo cleanup rule. Historical/archive read chỉ dùng manifest đã đóng băng, không query trạng thái live.
- Data Dictionary `N+1` có thể được Approved với 0 CDE. Sau cutover, người dùng vẫn có thể bổ sung và approve CDE `N+1.x`; chúng tự xuất hiện trong bản đang hoạt động.
- Cập nhật `glossaryTermRevisionReference.json` và regenerate Java/TypeScript types để mỗi reference public gồm đúng required `termId`, `termSnapshotId`, `termBusinessVersion` và `displayOrder`, với `additionalProperties = false`. `termSnapshotId` là khóa bất biến dùng để ghi quan hệ snapshot; loại `termNativeVersion` và `parentTermSnapshotId` vì native version không thuộc business contract và mô hình cấm CDE cha–con.
- Không được có hai reference cho cùng `termId` hoặc `termSnapshotId`. Backend sắp xếp trong application bằng `name.toLowerCase(Locale.ROOT)` → raw `name` → UUID `termId`, rồi gán `displayOrder` liên tục từ 0; không phụ thuộc collation MySQL/PostgreSQL hoặc thứ tự row từ database.
- Không cho người dùng ghim CDE scope cũ, đổi tiền tố version hoặc chọn carry-forward. Mọi active Approved CDE đúng scope đều xuất hiện; CDE scope khác luôn bị loại.

**Atomic cutover, hash và outbox**

- Mọi mutation CDE trong scope active hoặc scope kế tiếp phải lấy publication lock của Data Dictionary trước. Lock order thống nhất: Data Dictionary identity/publication scope → Data Dictionary working/head → scoped CDE working/heads theo thứ tự UUID để tránh deadlock.
- Với lần approve đầu tiên `N = 1`, transaction validate version/state/quyền, tạo Data Dictionary Approved active, update head, ghi outbox và xóa working; không có predecessor để cleanup.
- Với `N+1`, thứ tự transaction bắt buộc: khóa scope → khóa/read Data Dictionary working và predecessor head `N` → validate revision/state/quyền/version → batch-read toàn bộ CDE scope `N` và `N+1` → dựng final archive manifest từ Approved `N.x` → archive Data Dictionary `N` cùng Approved CDE `N.x` → xóa scoped working/snapshot chưa Approved `N.x` theo policy → tạo snapshot/head Data Dictionary `N+1` Approved active → ghi đầy đủ outbox archive/delete/activate → xóa Data Dictionary working bằng compare-and-set → commit.
- Business payload/hash đã phát hành không bị viết lại. Lifecycle metadata archive và archive manifest được lưu tách biệt, có hash riêng nếu cần audit. Active membership của `N+1` là read model động; không đưa danh sách CDE live vào immutable content hash của Data Dictionary.
- Bất kỳ lỗi nào trước commit rollback toàn bộ cutover: `N` vẫn Approved active, CDE `N.x` không bị archive/xóa, `N+1` vẫn InReview và head/outbox/index không quan sát trạng thái nửa chừng. Side effect ngoài database chỉ chạy idempotent sau commit.
- Batch query phải tránh N+1 và không truncate. Test tải với 10.000 CDE trên cả scope cũ và mới cho MySQL/PostgreSQL, bao gồm chi phí archive/delete/outbox và giới hạn transaction.

**Frontend và loại bỏ contract F08 cũ**

- Xóa endpoint `GET /v1/glossaries/{id}/working/terms`, wrapper `getWorkingGlossaryTerms` và mọi consumer của contract “exact revisions được chọn”; thay bằng publish-preview typed, paginated. Không giữ alias có semantics mơ hồ vì tính năng chưa phát hành rộng và không có backward-compatibility contract cho F08.
- Bỏ UI chọn package/carry-forward. Khu vực Data Dictionary active hiển thị CDE đúng scope: Consumer chỉ Approved, Manager đủ trạng thái theo quyền; badge Data Dictionary không đổi khi CDE được tạo hoặc chuyển trạng thái.
- Modal Approve Data Dictionary mới hiển thị version sẽ active, số CDE scope mới đã Approved, và cảnh báo có xác nhận về số CDE predecessor sẽ Archive/xóa. Không hiển thị nội dung CDE scope cũ như thể được kế thừa sang bản mới.
- Sau Approve, UI dùng response backend: Data Dictionary mới có badge Approved; predecessor và CDE Approved của nó có badge Archived; CDE predecessor chưa Approved biến mất khỏi working list. Lỗi `409` giữ màn hình InReview và không tạo optimistic cutover.

**Test/DoD**

- Test đầy đủ bốn transition, request allowlist, capability, source state, `expectedRevision`, double-submit và race Approve/Reject.
- Active read test: sau khi Data Dictionary `1` Approved, tạo CDE `1.0` Draft → Consumer không thấy → Approve CDE → Consumer thấy ngay trong Dictionary `1`, còn status Dictionary vẫn Approved.
- Scope isolation test: hai CDE cùng mã có `termId A/1.x` và `termId B/2.x`; Dictionary `1` chỉ resolve A, Dictionary `2` chỉ resolve B; không query/fallback/copy chéo scope và hai identity không đè nhau.
- Cutover test: trước Approve `2`, Dictionary `1` có Approved/Draft/InReview/Rejected; sau commit Dictionary `1` và Approved `1.x` đều Archived, non-Approved `1.x` bị xóa, Dictionary `2` Approved active và các CDE `2.x` giữ nguyên trạng thái.
- Race Approve Dictionary `2` với mutation CDE `1.x`/`2.x` được tuyến tính hóa: mutation commit trước lock được phản ánh đúng; mutation sau lock chờ rồi bị chấp nhận hoặc từ chối theo scope còn active, không có trạng thái nửa cutover.
- Failure injection tại từng boundary archive/delete/activate/head/outbox chứng minh rollback toàn bộ. Archive manifest khớp một-một với final Approved `1.x`, có thứ tự xác định và không chứa CDE non-Approved.
- Frontend test bao phủ manager/consumer visibility, preview cleanup counts, confirm destructive cleanup, loading, double-submit, stale response, `409` reload và badge Approved/Archived sau cutover.
- E2E: Dictionary `1` Approved → bổ sung nhiều CDE `1.x` ở đủ trạng thái → tạo Dictionary `2` trắng và CDE `2.x` riêng → Approve `2` → kiểm tra không kế thừa, cleanup/archive đúng và chỉ Consumer content scope `2` còn active.

### F10 — Tạo business version Data Dictionary kế tiếp

**API contract**

- Dùng `POST /v1/glossaries/{id}/working`. Tạo schema request riêng cho F10, chỉ gồm required `{ "businessVersion": "N" }` và `additionalProperties = false`; không tái sử dụng `GlossaryWorkingVersionRequest` tổng quát. Từ chối `payload`, `expectedRevision`, `termRevisions`, `termCount`, identity, status, actor, timestamp và mọi field ngoài allowlist bằng `400 Bad Request`.
- Thành công trả `201 Created`, header `Location: /v1/glossaries/{id}/working` và working representation vừa tạo có `entityStatus = Draft`, `workingRevision = 1`, `termRevisions = []`, `termCount = 0`, audit metadata cùng capability do backend tính. Response không có `snapshotId`, `publicationSequence`, `contentHash` hoặc publication metadata.
- Request sai schema hoặc version sai định dạng trả `400 Bad Request`; identity không tồn tại, đã soft-delete hoặc không phải canonical Data Dictionary trả `404 Not Found`; thiếu `canCreateVersion` trả `403 Forbidden`; chưa có active Approved head, đã có working, version không hợp lệ theo state hoặc conflict đồng thời trả `409 Conflict`.
- POST này không phải cơ chế bootstrap/repair và không tạo Glossary identity mới. Nếu F00 để lại trạng thái chỉ có identity, chỉ có working hoặc snapshot/head không nhất quán thì fail-fast với lỗi vận hành; không tự dựng lại version `1` hoặc sửa dữ liệu ngầm.

**Tiền điều kiện, state machine và phân quyền**

- F10 chỉ chạy sau khi F09 đã approve ít nhất Data Dictionary `1`. Tại thời điểm tạo phải có đúng một Data Dictionary Approved active `N` và chưa có Data Dictionary working kế tiếp ở Draft/InReview/Rejected.
- F10 tạo Data Dictionary working `N+1` trên cùng identity nhưng không archive, khóa hoặc thay đổi trạng thái Data Dictionary `N` và mọi CDE `N.x`. Sau khi tạo, F07 tiếp tục phụ trách `PATCH`/optimistic locking cho Draft mới và F09 phụ trách Submit, Reject, Reopen, Approve/cutover.
- Backend yêu cầu capability riêng `canCreateVersion` theo policy hiệu lực. Policy mặc định chỉ cấp cho Admin và Data Proposer; Data Steward, owner, assigned Reviewer, Reviewer thuần túy và Consumer-only không được tạo nếu không có explicit grant. UI chỉ dùng capability backend, không suy quyền từ tên role hoặc `canEditWorking`.
- Sau khi đã khóa state authoritative trong transaction, backend tính lại quyền trên Data Dictionary hiện hành trước khi insert để việc thu hồi quyền đồng thời không bị bỏ qua. Working response cũng tính capability từ working/actor hiện hành; creator hợp lệ phải tiếp tục xem, sửa và submit được Draft mới dù `owners` và `reviewers` bắt đầu rỗng.

**Quy tắc business version**

- Data Dictionary `businessVersion` chỉ nhận canonical positive integer, khớp `^[1-9]\d*$`, không whitespace/leading zero và dài tối đa 64 ký tự. Không chấp nhận `1.0`, `v2`, `0`, số âm hoặc decimal.
- Version mới bắt buộc bằng chính xác `N+1` của Data Dictionary Approved active; không cho bỏ số, tái sử dụng version archived hoặc chọn version tùy ý. Backend tính `N+1` bằng số nguyên không giới hạn và kiểm tra request trong transaction; UI chỉ hiển thị/prefill giá trị này.
- Trùng, thấp hơn, cao hơn `N+1`, version đã tồn tại hoặc stale do cutover đồng thời trả `409 Conflict` và không mutation.

**Khởi tạo Draft trắng**

- Backend tự dựng payload bằng allowlist từ identity kỹ thuật; không nhận payload từ client và **không copy bất kỳ business content hoặc CDE membership nào từ Data Dictionary `N`**. Chỉ giữ `id`, `name`, `displayName`, `fullyQualifiedName`, `versioningMode` và `provider` nếu đây là identity bắt buộc; `href`, native `version` và capability được tính lại.
- Các field nghiệp vụ do F07 quản lý bắt đầu trắng: `description = ""`, `owners = []`, `reviewers = []`, `domains = []`, `tags = []` và không có `extension` cho tới khi người dùng lưu giá trị. Field nghiệp vụ mới thêm vào schema trong tương lai không tự động được kế thừa nếu chưa được đưa vào allowlist có chủ đích.
- Backend luôn ghi `businessVersion` từ request đã canonicalize, `entityStatus = Draft`, `workingRevision = 1`, `termRevisions = []`, `termCount = 0` và audit metadata từ authenticated principal. Không copy `snapshotId`, `publicationSequence`, `contentHash`, `publishedAt/By`, `archivedAt/By`, outbox metadata hoặc quan hệ `glossary_snapshot_term`.
- `termRevisions = []` không phải placeholder cho dữ liệu kế thừa. Data Dictionary `N+1` chỉ có CDE khi người dùng tạo riêng CDE `N+1.x`; F09 không được lấy CDE `N.x` để lấp danh sách trống.

**Transaction, locking và concurrency**

- Trong một database transaction, dùng cùng lock order với F09/F16: khóa Data Dictionary identity/publication scope → đọc và khóa active published head cùng high-water version → xác nhận working absence → tính lại quyền và validate version → dựng payload allowlist → insert đúng một working row revision 1 → commit. Không đọc payload/version authoritative ngoài transaction rồi dùng lại sau khi lock.
- `SELECT ... FOR UPDATE` trên working row chưa tồn tại không đủ serialize hai request Create. Unique constraint `(entityType, entityId)` trên working store là lớp bảo vệ cuối cùng; mọi constraint race phải được ánh xạ thành `409 Conflict`, không trả `500` chung chung.
- Hai POST đồng thời chỉ có đúng một request tạo `N+1` thành công và chỉ tồn tại một Data Dictionary working row. Việc tạo working này không khóa lifecycle CDE scope `N`; người dùng vẫn có thể bổ sung/xử lý CDE `N.x` cho tới khi `N+1` được Approve và cutover.
- API không trả idempotent success giả. Retry sau khi response thành công bị mất sẽ nhận `409`; UI phải reload representation authoritative và không tự tạo Draft thứ hai. Double-click được chặn ở UI nhưng correctness không phụ thuộc client.
- Bất kỳ lỗi nào trước commit phải rollback toàn bộ; không thay đổi identity, snapshot, published head, hash, outbox, CDE membership hoặc native entity. Refresh manager index chỉ chạy sau commit; lỗi index sau commit được log/retry và không đảo kết quả tạo working đã commit.

**Quan hệ với F07, F09 và UI**

- Trong thời gian `N+1` Draft/InReview/Rejected, Data Dictionary `N` vẫn Approved active; Consumer tiếp tục thấy Approved CDE `N.x`, Manager tiếp tục xử lý đủ trạng thái `N.x`, đồng thời nhóm soạn thảo có thể tạo identity CDE `N+1.x` riêng, kể cả trùng mã với scope `N`. Không thao tác Create nào tự đổi status hiện hành.
- Chỉ F09 Approve `N+1` mới cutover: archive `N` và Approved CDE `N.x`, xóa non-Approved CDE `N.x`, activate `N+1`; CDE `N+1.x` giữ nguyên trạng thái đang có. Archived `N` đọc qua historical/audit route và không còn nhận mutation.
- UI chỉ hiển thị action `Tạo phiên bản mới` khi đang ở latest Approved view, không phải historical deep link, có `canCreateVersion = true` và không quan sát thấy working. Backend vẫn là nguồn quyết định cuối cùng cho mọi precondition.
- Modal prefill version gợi ý, validate inline, loading/disable và chống double-submit. Sau thành công UI dùng response backend làm state, bỏ query published version khỏi URL và mở authoring context của Draft. Không tạo published deep link hoặc optimistic Draft.
- Với `409`, UI giữ input/state hiện tại và cung cấp hành động reload authoritative representation; `400/403/404/5xx` dừng loading, hiển thị lỗi phù hợp và không đổi badge, published head hoặc local working state giả.

**Test/DoD**

- API contract test chứng minh request chỉ nhận `businessVersion`, response `201` đúng schema và mọi field ngoài allowlist—including `payload`, `expectedRevision`, `termRevisions`—bị từ chối mà không mutation.
- Test version bao phủ missing/null/blank, whitespace, `v2`, `0`, `01`, `1.0`, số âm, quá 64 ký tự, số rất lớn, trùng/thấp/cao hơn `N+1`, version archived và stale active head; MySQL/PostgreSQL cho cùng kết quả.
- Happy path `Data Dictionary 1 Approved → tạo 2 Draft` tạo đúng một working row revision 1 trên cùng identity; business fields và membership trắng; Data Dictionary `1` cùng mọi CDE `1.x` không đổi trạng thái/nội dung. Sau đó F07 PATCH Draft `2` thành công.
- Test precondition bao phủ chưa có published snapshot, không có active head, working đang Draft/InReview/Rejected, identity không tồn tại/soft-delete, sai Data Dictionary identity và trạng thái bootstrap/head bị hỏng; không trường hợp nào tự repair hoặc tạo working mồ côi.
- Authorization integration test bao phủ Admin, Data Proposer, Data Steward, owner, assigned Reviewer, Reviewer thuần túy, Consumer-only, explicit policy holder, user có nhiều role và race thu hồi quyền. Chỉ subject có `canCreateVersion` tại thời điểm transaction được phép tạo; creator hợp lệ vẫn xem/sửa/submit được Draft trắng.
- Hai request đồng thời cùng hoặc khác version: đúng một `201`, request còn lại `409`, chỉ một working row. Test thêm race với F09 Approve, archive và soft-delete; lock order không deadlock và kết quả tuyến tính hóa đúng trên MySQL/PostgreSQL.
- Failure injection tại các boundary sau lock, validation, dựng payload và insert chứng minh rollback toàn bộ. Lỗi manager index sau commit không đổi HTTP success hoặc xóa working đã tạo.
- Frontend test bao phủ capability, latest-vs-historical, prefill bắt buộc `N+1`, validation integer, modal, loading, double-submit, response-authoritative, conflict/reload và không tạo optimistic status change.
- E2E `Dictionary 1 Approved + alo1(termId A)/1.x → tạo Dictionary 2 trắng + tạo alo1(termId B)/2.0 qua F03 → F07 sửa/lưu → F09 Submit/Approve`: trước Approve, hai identity hoạt động độc lập; sau Approve, A/Approved 1.x Archived, predecessor non-Approved bị xóa, B thuộc scope `2` active và không kế thừa dữ liệu từ A.

### F11 — Bảng flat mọi CDE business version trong một Dictionary scope

**Phạm vi**

- Bảng luôn hoạt động trong đúng một Data Dictionary scope, được định danh bởi `glossaryId` và canonical `parentBusinessVersion`. Một request/response không bao giờ chứa CDE của nhiều parent scope; Manager chuyển giữa active, working hoặc historical Dictionary bằng version selector thay vì ghép nhiều scope vào cùng bảng.
- `GET /v1/glossaryTerms?glossary={dataDictionaryId}&parentBusinessVersion={N}&limit={limit}&offset={offset}` là contract flat-list cho Data Dictionary. `parentBusinessVersion` bắt buộc, `limit` chỉ nhận `10`, `15`, `25`, `50`, `offset >= 0`; thiếu/sai định dạng trả `400`. Scope không tồn tại hoặc actor không được xem trả `404` để không lộ trạng thái. Các caller legacy ngoài Data Dictionary không truyền `parentBusinessVersion` và giữ nguyên hành vi hiện hữu.
- Backend tự phân loại scope từ Data Dictionary authoritative thành `active`, `working` hoặc `archived`; client không được truyền `mode` để chọn read source. Active/working đọc business snapshot và working stores đúng scope. Archived dùng frozen manifest để xác định tập CDE identity, sau đó chỉ trả các published snapshots cùng `parentBusinessVersion`; không query live membership hoặc fallback sang scope khác.
- Backend dựng flat read model trực tiếp từ `glossary_business_snapshot` và `glossary_business_working`, với archive membership qua `glossary_snapshot_term`; không page native `glossary_term_entity` rồi hydrate lịch sử. Mỗi published snapshot hoặc working record có quyền xem là một row độc lập.
- DTO row tối thiểu gồm `termId`, `name`, scoped `fullyQualifiedName`, `parentBusinessVersion`, `businessVersion`, `entityStatus`, `recordType = working|published|archived` và các field bảng yêu cầu (`displayName`, `description`, `owners`, `reviewers`, `domains`, `tags`, `extension`). Response dùng `{ data, paging: { total, limit, offset } }`.
- Row identity/key là `(termId, parentBusinessVersion, businessVersion)`; `entityStatus` không thuộc key vì working row có thể đổi trạng thái. Click row tạo URL scoped FQN có đủ `businessVersion` và `parentBusinessVersion`; detail/history backend cũng phải kiểm tra identity thuộc đúng parent scope và trả `404` khi không khớp.
- Consumer-only chỉ nhận published `Approved` rows của Data Dictionary active. Consumer truy cập working hoặc archived scope nhận `404`. Manager nhận published và working rows đúng scope theo capability hiệu lực; actor có quyền history/audit nhận archived rows read-only. Không suy quyền từ tên role.
- Thứ tự xử lý bắt buộc là validate/authorize parent scope → xác định các `termId` actor được xem → dựng flat rows → tính `total` → sort → pagination. Không lọc authorization sau khi đã cắt page. Default order ổn định là normalized `name ASC` → business version giảm dần theo từng đoạn số → `termId ASC` → `recordType ASC`.
- F11 là authoritative default-list read path và luôn đọc database. F12 dùng OpenSearch projection theo từng CDE business-version row để thực hiện search, filters và custom sort. Hai chức năng dùng chung row DTO, authorization semantics, page-size allowlist và stable tie-breaker, nhưng không dùng chung persistence/query engine và không được fallback âm thầm giữa database với mutable search index.
- Frontend gọi đúng một flat-list request cho mỗi page và dùng `paging.total` từ backend; xóa luồng gọi history theo từng term, client-side expansion và client-side pagination của business-version rows. Khi đổi Dictionary scope hoặc có workflow mutation, reset trang đầu, xóa row scope cũ trong lúc loading và bỏ qua stale response.
- Với dataset không đổi giữa hai request, stable order và tie-breaker bảo đảm pagination không trùng/mất row. Nếu dữ liệu thay đổi do workflow mutation trong lúc chuyển trang, frontend reload trang đầu từ representation authoritative.

**Test/DoD**

- Fixture có Dictionary `1` active với identity A/CDE1 (`1.0 Approved`, `1.1 Approved`, `1.2 Rejected`) và Dictionary `2` working với identity B/CDE1 (`2.0 Approved`, `2.1 Draft`). A và B có `termId`/scoped FQN khác nhau dù cùng mã nghiệp vụ.
- Consumer request scope `1` chỉ nhận `1.0`, `1.1`; không nhận `1.2` hoặc `2.x`. Manager request scope `1` nhận đúng `1.x` theo quyền; request scope `2` nhận đúng `2.0`, `2.1` và không có `1.x`. Consumer request scope `2` working nhận `404`.
- Archived Dictionary dùng frozen manifest, chỉ trả published history của identity thuộc manifest/cùng scope, không đọc live head, working row hoặc identity scope khác; mọi row read-only.
- Thiếu/sai/non-canonical `parentBusinessVersion`, business-version prefix sai, scoped identity không khớp, parent không tồn tại và actor không có quyền đều được test với `400/404` đúng contract và không lộ payload.
- `total` bằng số row sau authorization và trước pagination. Test page size `10/15/25/50`, page đầu/cuối, empty/out-of-range offset, numeric version order (`1.10` trước `1.2`) và không trùng/mất row trên dataset cố định.
- Query-count test chứng minh số query không tăng theo số CDE; không client-side hoặc server-side N+1 để hydrate history. MySQL/PostgreSQL trả cùng row, total và thứ tự.
- Frontend component/API test chứng minh mỗi page chỉ dùng một flat-list request, row key/URL có đủ scope, loading/empty/error hoạt động, đổi scope reset page và response cũ trả chậm không ghi đè scope mới.
- Regression test chứng minh Native/DQ Glossary và các caller legacy không truyền `parentBusinessVersion` giữ nguyên hành vi hiện hữu.

### F12 — Search, filter và custom sort trên flat read model

**Phạm vi**

- F12 dùng `GET /v1/glossaryTerms/search` với `glossary`, canonical `parentBusinessVersion`, `q`, `statuses`, `domainIds`, `ownerIds`, `dataSourceTags`, `classificationTags`, `sortField`, `sortOrder`, `limit` và `offset`. Khi có `parentBusinessVersion`, endpoint bắt buộc dùng CDE business-version OpenSearch projection; caller Native/DQ không có parent scope giữ nguyên behavior hiện hữu.
- F12 không query index `glossaryTerm` hiện hữu vì index đó có document identity là `termId` và chỉ biểu diễn một projection hiện tại. Tạo `cdeBusinessVersion` và consumer-safe `cdeBusinessVersionPublished` trong cùng search cluster. Mỗi row F11 là một document, có stable `rowKey = (termId, parentBusinessVersion, businessVersion)` và document id là encoding/hash ổn định của row key; các business version cùng `termId` không được ghi đè nhau.
- Document tối thiểu gồm `rowKey`, `termId`, `glossaryId`, `parentBusinessVersion`, `businessVersion`, `businessVersionSortKey`, `recordType`, `scopeType`, `entityStatus`, `name`, `normalizedName`, `displayName`, `description`, `domainIds`, `ownerIds`, `reviewerIds`, tag FQN tách theo `DataSource`/`DataClassification`, authorization projection và các timestamp cần sort/audit. Filter dùng UUID/FQN ổn định, không dùng domain display name, owner name hoặc label có thể đổi/trùng.
- Search `q` là text literal sau trim/Unicode normalization, tối đa 200 ký tự, tìm đồng thời `name OR displayName`; client không được truyền raw OpenSearch DSL hoặc wildcard expression. Mapping dùng analyzer/ngram phù hợp thay vì leading wildcard không được kiểm soát. Frontend debounce 500 ms và nút clear đưa bảng về F11 default list.
- `statuses` hỗ trợ `Draft`, `In Review`, `Rejected`, `Approved`; `Archived` chỉ hợp lệ trong scope history/audit. Nhiều giá trị trong cùng một multi-select kết hợp `OR`; các nhóm search/status/domain/owner/tag kết hợp `AND`. Parameter rỗng sau trim được coi là absent; UUID/FQN/status/sort sai, CSV có phần tử rỗng hoặc vượt allowlist/giới hạn trả `400`.
- `sortField` chỉ nhận allowlist ban đầu `name`, `displayName`, `businessVersion`, `entityStatus`; `sortOrder` chỉ nhận `asc|desc`. Indexer sinh `businessVersionSortKey` bằng cùng numeric-segment normalization của F11 để `1.10 > 1.9 > 1.2`. Mọi custom sort luôn nối default tie-breaker `normalizedName ASC → businessVersionSortKey DESC → termId ASC → recordType ASC`; null ordering được cố định và test trên cả hai database nguồn.
- Thứ tự xử lý bắt buộc là validate request → resolve/authorize Dictionary scope authoritative từ database → dựng subject/effective-capability filter → query đúng OpenSearch alias → áp authorization/search/filters → tính `total` → stable sort → pagination. Không được page OpenSearch trước rồi lọc quyền trong application. Consumer-only luôn được route sang `cdeBusinessVersionPublished`, chỉ chứa published `Approved` rows của active Dictionary; gửi `Draft` hoặc `Rejected` không được mở rộng kết quả. Working/archived/unauthorized parent scope vẫn trả `404` như F11.
- Authorization projection phải biểu diễn đủ user/team/role/policy/capability cần thiết để OpenSearch loại row trước `total` và pagination, hoặc backend phải thêm authoritative allowed-row-key restriction vào chính OpenSearch query. Nếu không dựng được filter quyền đầy đủ thì fail closed; tuyệt đối không trả unfiltered hits, total hoặc facet rồi mới loại row.
- Database snapshot/working/manifest là source of truth và nguồn full reindex. Mọi create/update/submit/reject/reopen/approve/cutover/archive/delete phát transactional outbox sau commit để idempotently upsert/delete document. Index failure không rollback workflow transaction; retry queue, reconciliation và full reindex phải sửa được missing, stale và orphan documents. Cutover loại scope cũ khỏi published alias/index và đưa Approved rows của active scope mới vào consumer-safe projection.
- F11 và F12 trả cùng row DTO `{ data, paging: { total, limit, offset } }`, cùng page sizes `10/15/25/50` và cùng stable default order. F11 authoritative ngay sau commit; F12 có eventual consistency. Sau mutation UI dùng response/F11 authoritative, không dùng việc OpenSearch chưa thấy row để kết luận mutation thất bại và không fallback từ published sang mutable index.
- Frontend dùng F11 khi không có search/filter/custom sort; khi bất kỳ F12 criteria nào hoạt động thì gọi `/glossaryTerms/search`. Mọi thay đổi criteria hoặc page size reset `offset = 0`, xóa rows của request cũ trong lúc loading và dùng abort/request-generation token để response cũ không ghi đè state mới.

**Test/DoD**

- Contract/validation test từng parameter, empty/duplicate/unknown/oversized values, từng filter và tổ hợp `OR` trong nhóm/`AND` giữa nhóm; search bao phủ name, displayName, null, Unicode tiếng Việt và ký tự wildcard được coi là literal.
- Fixture cùng `termId A`, parent scope `1` có `1.0`, `1.1`, `1.2` tạo ba document/row độc lập; không document nào ghi đè document khác. Identity B cùng mã ở scope `2` không lọt vào query scope `1`.
- Consumer được route vào published projection, gửi `Draft` hoặc `Draft,Approved` vẫn chỉ nhận Approved active rows; không lộ working/archived row qua data, `total`, sort hoặc facet. Manager/partial Manager/history actor chỉ nhận row theo effective capability và parent scope.
- Sort test bao phủ mọi allowlist field/direction, null ordering, numeric version `1.11/1.10/1.9/1.2`, stable tie-breaker, page đầu/cuối/out-of-range và không trùng/mất row trên index generation cố định.
- Outbox test bao phủ create/update/status transition/approve/cutover/archive/delete, duplicate delivery, out-of-order retry, failure sau database commit và eventual recovery. Full reindex và incremental indexing phải tạo cùng document set; reconciliation phát hiện missing/stale/orphan rows.
- F11-vs-F12 parity test trên cùng committed/indexed dataset chứng minh cùng authorization, row DTO, default order và total khi F12 không có content filter. Native/DQ Glossary cùng index `glossaryTerm` hiện hữu không hồi quy.
- Frontend test chứng minh debounce 500 ms, reset trang khi criteria đổi, clear criteria quay lại F11, serialization UUID/FQN đúng, Consumer hard-lock Approved và response cũ trả chậm không ghi đè response mới.
- Có query-count/performance test trên dataset business-version đủ lớn; authorization và hydration không N+1. Test riêng search-index lag chứng minh detail/workflow/F11 vẫn đúng và UI không báo mutation thất bại giả.

### F13 — Export theo quyền và bộ lọc

**Phạm vi**

- Export dùng chung immutable filter/sort criteria và authorization semantics với F12. OpenSearch trả ordered authorized `rowKey`; backend bulk-hydrate payload authoritative từ database trước khi tạo file, không export trực tiếp `_source` và không N+1.
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
- Cho phép import tạo/cập nhật CDE Draft trong Data Dictionary Approved active `N` hoặc working `N+1` theo scope; không import vào Archived scope và không sửa trực tiếp Approved CDE snapshot/Data Dictionary business payload.

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

- Delete thủ công chỉ cho Draft/Rejected theo policy; cutover F09 được phép xóa toàn bộ CDE predecessor non-Approved sau cảnh báo/xác nhận ở bước Approve.
- Archive predecessor Data Dictionary và Approved CDE cùng scope là system transition bắt buộc của F09, không phải lựa chọn thủ công. Snapshot/archive manifest vẫn còn để audit và không được restore thành active khi đã có successor.
- Mọi archive/delete/approve CDE phải lấy publication lock theo thứ tự F05/F09 để không race với cutover.
- Audit transition, actor, revision và business version.
- Theo dõi 403/409/5xx, publish failure, latency và outbox lag.
- Có runbook rollback bản triển khai, backup/restore và xử lý outbox lỗi.

**Test/DoD**

- Test quyền và modal xác nhận cleanup/archive khi Approve successor.
- Test race mutation CDE với cutover chứng minh tuyến tính hóa đúng; mutation scope predecessor sau cutover bị từ chối.
- Archived scope không active/restore được nhưng vẫn truy vết theo chính sách audit.
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
- **Milestone C — Bản phát hành Từ điển dữ liệu dùng chung:** F07, F09–F10.
- **Milestone D — Khai thác dữ liệu:** F11–F15.
- **Milestone E — Production-ready:** F16 và full regression/security/performance suite.

Không cần chờ Milestone D mới pilot Milestone A. Đây là lợi ích chính của triển khai theo từng chức năng.
