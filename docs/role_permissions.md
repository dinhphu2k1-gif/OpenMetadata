# BẢNG TỔNG HỢP PHÂN QUYỀN VÀ PHẠM VI XEM/THAO TÁC CỦA CÁC ROLE TRONG HỆ THỐNG OPENMETADATA (AGRIBANK)

> **Mục đích tài liệu:** Tài liệu này tổng hợp chi tiết toàn bộ các vai trò (Roles), chính sách truy cập (Policies), quyền xem (Read/View), quyền thao tác (Edit/Create/Delete/Approve) và giao diện điều hướng (UI Navigation/Sidebar) hiện tại trên hệ thống OpenMetadata của Agribank.  
> **Dùng làm căn cứ:** Kiểm tra, đối soát quyền thực tế và làm cơ sở điều chỉnh cấu hình RBAC (Role-Based Access Control) sau này.

---

## I. TỔNG QUAN VỀ KIẾN TRÚC PHÂN QUYỀN (RBAC & UI)

Cơ chế phân quyền của hệ thống bao gồm 3 lớp đồng bộ:
1. **Lớp RBAC Backend (Roles & Policies JSON):** Quy định chính xác theo chuẩn least-privilege những tài nguyên (`resources`) và hành động (`operations`) mà người dùng được phép thực thi hoặc bị từ chối (`allow` / `deny`).
2. **Lớp Giao diện (Frontend Menu & Persona Navigation):** Ẩn/hiện các mục sidebar hoặc tab chức năng tương ứng với vai trò/persona để người dùng không thấy những menu ngoài phạm vi nghiệp vụ.
3. **Lớp Quy trình Quản trị (Maker - Checker Workflow):** Tách bạch rõ vai trò người tạo đề xuất (`DataProposer`) và người phê duyệt (`DataSteward`).

---

## II. MA TRẬN PHÂN QUYỀN TỔNG THỂ GIỮA CÁC ROLE

| Tiêu chí / Khu vực | Basic Consumer (`user1`) | Data Consumer (`user2`) | Data Proposer (`user3` - Maker) | Data Steward (`user4` - Checker) | Admin (`admin`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mục đích vai trò** | Người dùng nghiệp vụ cơ bản, chỉ tra cứu thuật ngữ & DQ | Người dùng nội bộ tra cứu toàn bộ tài sản dữ liệu | Chuyên viên quản trị dữ liệu: soạn thảo, đề xuất CDE/thuật ngữ | Cán bộ kiểm soát: phê duyệt, từ chối, xuất bản thuật ngữ | Quản trị viên toàn quyền hệ thống |
| **Tài liệu nghiệp vụ (Glossary, Data Product, Domain, Tag)** | ✅ **Chỉ xem bản ghi ĐÃ DUYỆT (Approved)** (Bị chặn Draft/In Review) | ✅ **Chỉ xem bản ghi ĐÃ DUYỆT (Approved)** (Bị chặn Draft/In Review) | ✅ **Xem** + Soạn thảo/tạo Draft | ✅ **Xem** + Phê duyệt/từ chối | ✅ Toàn quyền |
| **Tài sản kỹ thuật (Database, Schema, Table, Pipeline, Service)** | ❌ **Bị CHẶN hoàn toàn** | ✅ **Xem** (Chỉ đọc) | ✅ **Xem** + Đề xuất mô tả/tag | ✅ **Xem** + Phê duyệt trạng thái | ✅ Toàn quyền |
| **Dòng chảy dữ liệu (Lineage)** | ❌ Bị chặn xem | ✅ Xem Lineage kỹ thuật | ✅ Xem Lineage kỹ thuật | ✅ Xem Lineage kỹ thuật | ✅ Toàn quyền (chỉnh sửa) |
| **Chất lượng dữ liệu (Data Quality: TestCase, TestSuite)** | ✅ **Chỉ xem quy tắc ĐÃ DUYỆT (Approved)** | ✅ **Chỉ xem quy tắc ĐÃ DUYỆT (Approved)** | ✅ **Xem** + Tạo mới Test Case | ✅ **Xem** + Quản trị/duyệt Test | ✅ Toàn quyền |
| **Thảo luận & Luồng đề xuất (Feed, Task, Workflow)** | ❌ Bị chặn | ✅ Xem Feed/Thread | ✅ Tạo & Phản hồi Task/Feed | ✅ Xử lý/Đóng Task duyệt | ✅ Toàn quyền |
| **Tạo mới thuật ngữ (Glossary Term)** | ❌ Không | ❌ Không | ✅ **Được tạo (Trạng thái Draft)** | ❌ Không trực tiếp soạn | ✅ Toàn quyền |
| **Phê duyệt xuất bản (Status = Approved)** | ❌ Không | ❌ Không | ❌ **Bị CHẶN (Chống tự duyệt)** | ✅ **Duyệt / Từ chối / Thu hồi** | ✅ Toàn quyền |
| **Quản trị hệ thống (Settings, Role, Policy, Ingestion, Bots)** | ❌ Bị chặn | ❌ Bị chặn | ❌ Bị chặn | ❌ Bị chặn | ✅ Toàn quyền |

---

## III. CHI TIẾT TỪNG ROLE: ĐƯỢC XEM & THAO TÁC NHỮNG GÌ

### 1. Basic Consumer (Người dùng nghiệp vụ cơ bản)
* **Tài khoản kiểm thử:** `user1@agribank.com.vn` (Mật khẩu: `Agribank@123`)
* **Role gắn kèm:** `BasicConsumer` (Policy: `BasicConsumerPolicy.json`, Persona: `BasicConsumerPersona`)
* **Triết lý:** Least-privilege tuyệt đối cho khối nghiệp vụ/kinh doanh; **chỉ được xem các tài sản nghiệp vụ & quy tắc chất lượng đã được phê duyệt (`Approved`)**, không xem bản nháp/đang duyệt (`Draft`, `In Review`) và không thấy hệ thống kỹ thuật.

#### A. Những gì ĐƯỢC XEM (`ViewAll`, `ViewBasic` - Chỉ đối với bản ghi ĐÃ PHÊ DUYỆT)
1. **Thuật ngữ & Khái niệm nghiệp vụ:**
   - Thuật ngữ nghiệp vụ (`glossaryTerm`): **Chỉ xem các bản ghi đã Approved** (Hệ thống tự động áp dụng bộ lọc trạng thái `Approved` bắt buộc đối với vai trò Consumer; các bộ lọc chọn xem `Draft`/`In Review` bị vô hiệu hóa).
   - Danh mục từ điển (`glossary`), Phân loại & Nhãn dán (`classification`, `tag`), Miền dữ liệu (`domain`), Sản phẩm dữ liệu (`dataProduct`), Tài liệu (`document`).
2. **Quy tắc chất lượng dữ liệu:**
   - Bộ quy tắc kiểm thử chất lượng (`testCase`, `testSuite`): **Chỉ xem các Test Case đã Approved**.
3. **Thông tin định danh:**
   - Nhóm người dùng (`team`), Thông tin người dùng (`user`), Persona (`persona`).

#### B. Những gì BỊ CHẶN XEM & BỊ CẤM THAO TÁC (`Deny`)
- **Tài nguyên chưa phê duyệt (`Draft`, `In Review`):** Bị ẩn hoàn toàn trên giao diện và API truy vấn dữ liệu của Consumer.
- **Tất cả tài sản kỹ thuật:** Cơ sở dữ liệu (`database`, `databaseSchema`, `databaseService`), Bảng dữ liệu (`table`), Cột dữ liệu, Pipeline (`pipeline`, `pipelineService`), Dashboard, Topic, Storage, SearchIndex,...
- **Dòng chảy dữ liệu kỹ thuật:** Lineage (`lineage`, `Platform Lineage`).
- **Thảo luận & Tác vụ:** Feed, Thread, Task.
- **Tất cả hành động sửa đổi:** Cấm Create, Edit, Delete, Deploy, Kill,... trên mọi tài nguyên (trừ phi là Owner của đối tượng đó).
- **Phần quản trị nền tảng:** Settings, Roles, Policies, Ingestion Pipelines, Bots, Application Marketplace.

#### C. Menu hiển thị trên giao diện (Left Sidebar)
- Ẩn menu **Settings** (Cài đặt hệ thống).
- Ẩn mục **Technical Dictionary** (Từ điển kỹ thuật) trong menu Quản trị.
- Ẩn mục **Phân loại / Classification** (`/tags`) theo cấu hình Persona.
- Ẩn mục **Overview** trong Data Marketplace.
- Nhìn thấy:
  - **Trang chủ** (`Home`)
  - **Data Marketplace** -> Chỉ thấy Domain & Data Product (đã ẩn Overview)
  - **Governance (Quản trị)** -> Glossary, Test Library.

---

### 2. Data Consumer (Người xem nội bộ kỹ thuật & nghiệp vụ)
* **Tài khoản kiểm thử:** `user2@agribank.com.vn` (Mật khẩu: `Agribank@123`)
* **Role gắn kèm:** `DataConsumer` (Policy: `DataConsumerPolicy.json`)
* **Triết lý:** Read-only toàn bộ tài sản siêu dữ liệu trong ngân hàng, phục vụ phân tích/tra cứu; **chỉ được xem các thuật ngữ và quy tắc kiểm thử đã được phê duyệt (`Approved`)**, không xem các bản thảo/đề xuất đang chờ duyệt (`Draft`/`In Review`).

#### A. Những gì ĐƯỢC XEM (`ViewAll`, `ViewBasic` - Allow)
1. **Tất cả tài sản dữ liệu:**
   - Toàn bộ cơ sở dữ liệu (`database`, `databaseSchema`, `table`, stored procedures).
   - Toàn bộ Pipeline dữ liệu, Dashboard, Topic truyền tin, Search Index.
   - Thuật ngữ nghiệp vụ (`glossaryTerm`) & Kiểm thử chất lượng (`testCase`): **Chỉ xem khi đã Approved** (giao diện và truy vấn tìm kiếm tự động lọc chỉ trả về bản ghi `Approved`).
   - Danh mục từ điển (`glossary`), Phân loại (`tag`, `classification`), Miền dữ liệu (`domain`).
2. **Dòng chảy dữ liệu (Lineage):** Xem đầy đủ quan hệ nguồn - đích giữa các bảng và pipeline.
3. **Thảo luận & Cộng tác:** Xem luồng trao đổi thảo luận (`feed`, `thread`).

#### B. Những gì BỊ CHẶN XEM & THAO TÁC (`Deny`)
- **Tài nguyên chưa phê duyệt (`Draft`, `In Review`):** Tự động lọc ẩn hoàn toàn khỏi kết quả tra cứu của Consumer.
- **Tất cả hành động chỉnh sửa/tạo/xóa:** Bị chặn `Create`, `EditAll`, `EditDescription`, `EditTags`, `Delete`, `Deploy`, `Trigger`... (chỉ xem, không được sửa trừ khi là Owner).
- **Quản trị hệ thống & Bảo mật:** Bị từ chối truy cập `role`, `policy`, `bot`, `ingestionPipeline`, `eventsubscription`, `securityService`, `mcpServer`, `notificationTemplate`.
- **Cấm các hành vi nguy hiểm:** `GenerateToken`, `Impersonate`, `EditUsers`, `EditTeams`, `EditRole`, `EditPolicy`.

#### C. Menu hiển thị trên giao diện (Left Sidebar)
- Thấy các menu tra cứu tiêu chuẩn:
  - **Trang chủ (`Home`)**
  - **Khám phá (`Explore`)** (Tìm kiếm bảng, dashboard, pipeline,...)
  - **Dòng dữ liệu (`Lineage`)**
  - **Giám sát (`Observability`)** (Data Quality, Incident Manager, Alert)
  - **Marketplace & Governance** (Xem chi tiết Glossary, Data Product, Domain - đã ẩn Phân loại / Classification `/tags` theo Persona)
- Ẩn nút **Cài đặt (`Settings`)** vì không phải Admin.

---

### 3. Data Proposer (Maker / Người soạn thảo & đề xuất)
* **Tài khoản kiểm thử:** `user3@agribank.com.vn` (Mật khẩu: `Agribank@123`)
* **Role gắn kèm:** `DataProposer` (Policy: `DataProposerPolicy.json`)
* **Triết lý:** Người chịu trách nhiệm soạn thảo thuật ngữ CDE, thiết lập quy tắc chất lượng dữ liệu (DQ), đề xuất tag/mô tả cho các bảng dữ liệu, nhưng **tuyệt đối không được tự phê duyệt**.

#### A. Những gì ĐƯỢC XEM (`ViewAll` - Allow)
- Xem toàn bộ hệ thống metadata như Data Consumer (Glossary, Tables, Lineage, DQ, Metrics, Domains,...).

#### B. Những gì ĐƯỢC THAO TÁC / TẠO MỚI (Allow)
1. **Tạo mới & Soạn thảo (Drafting):**
   - Tạo mới thuật ngữ nghiệp vụ (`glossaryTerm`) với trạng thái ban đầu là `Draft`.
   - Tạo mới bộ quy tắc kiểm thử chất lượng dữ liệu (`testSuite`, `testCase`).
   - Cập nhật, sửa đổi, xóa các thuật ngữ/test case **khi chúng chưa được duyệt** (`condition: notApproved()`).
   - Khởi tạo bản thảo sửa đổi (Draft upgrade) từ thuật ngữ đã duyệt trước đó (`EditCustomFields`, `EditStatus` để tạo version mới).
2. **Đề xuất đóng góp Metadata (Collaborative Proposals):**
   - Đề xuất mô tả (`EditDescription`), tên hiển thị (`EditDisplayName`), nhãn dán (`EditTags`), liên kết thuật ngữ (`EditGlossaryTerms`), gán Tier (`EditTier`) cho các bảng dữ liệu, schema, pipeline, dashboard.
3. **Thảo luận & Tác vụ (Collaboration):**
   - Tạo thảo luận, gửi ticket/yêu cầu phê duyệt (`feed`, `suggestion`, `task`, `thread`).

#### C. Những gì BỊ CẤM (`Deny`)
- ❌ **Chống tự phê duyệt (Segregation of Duties):** Bị chặn `EditCertification`, cấm tự chuyển trạng thái sang `Approved` hoặc tự gán/sửa người duyệt (`EditReviewers`).
- ❌ **Hạ tầng & Cấu hình:** Bị chặn can thiệp `databaseService`, `storageService`, cấm `Delete`, `Deploy`, `Kill`.
- ❌ **Quản trị hệ thống:** Bị chặn các tài nguyên quản trị nền tảng (`policy`, `role`, `bot`, `ingestionPipeline`,...).

---

### 4. Data Steward (Checker / Người kiểm soát & phê duyệt)
* **Tài khoản kiểm thử:** `user4@agribank.com.vn` (Mật khẩu: `Agribank@123`)
* **Role gắn kèm:** `DataSteward` (Policy: `DataStewardPolicy.json`)
* **Triết lý:** Người kiểm soát độc lập, chịu trách nhiệm thẩm định các đề xuất, có toàn quyền **Phê duyệt (`Approve`), Từ chối (`Reject`) hoặc Thu hồi (`Revoke`)** trạng thái thuật ngữ và siêu dữ liệu; **hạn chế tự ý sửa nội dung** để bảo toàn tính minh bạch của Maker - Checker.

#### A. Những gì ĐƯỢC XEM (`ViewAll` - Allow)
- Xem toàn bộ hệ thống siêu dữ liệu (nghiệp vụ, kỹ thuật, chất lượng dữ liệu, lineage, báo cáo).

#### B. Những gì ĐƯỢC THAO TÁC (Allow)
1. **Kiểm duyệt trạng thái (`EditStatus`):**
   - Được quyền duyệt, từ chối, thay đổi trạng thái đối với: `glossaryTerm`, `glossary`, `table`, `databaseSchema`, `database`, `testCase`, `testSuite`, `dataProduct`, `domain`, `classification`, `tag`, `pipeline`,...
2. **Quản lý phê duyệt & Quy trình công việc (Task & Workflow):**
   - Toàn quyền (`All`) trên `task`, `workflow`, `workflowInstance`, `workflowInstanceState`, `suggestion`, `thread`, `feed` để xử lý các yêu cầu do Proposer gửi lên.
3. **Kích hoạt tự động hóa:** Quyền `Trigger` chạy các workflow tự động hóa metadata.

#### C. Những gì BỊ CẤM (`Deny`)
- ❌ **Tách bạch Maker - Checker:** Bị từ chối tự ý tạo mới hoặc chỉnh sửa trực tiếp nội dung (`Create`, `EditAll`, `EditDescription`, `EditDisplayName`, `EditGlossaryTerms`, `EditTags`, `EditTier`, `EditOwners`,...). Khi nội dung chưa đạt, Steward sẽ **Reject** hoặc yêu cầu Proposer sửa đổi, không tự biên tập lại.
- ❌ **Phá hủy hạ tầng:** Bị chặn `Delete`, `Deploy`, `Kill` trên các dịch vụ kết nối cơ sở dữ liệu (`databaseService`, `apiService`, `pipelineService`,...).
- ❌ **Quản trị hệ thống:** Bị chặn chỉnh sửa phân quyền hệ thống (`role`, `policy`, `bot`, `ingestionPipeline`,...).

---

### 5. Administrator (Quản trị viên hệ thống)
* **Tài khoản:** `admin@open-metadata.org` (Mật khẩu mặc định hệ thống)
* **Role gắn kèm:** `Admin` (Cờ hệ thống: `isAdmin = true`)
* **Phạm vi quyền hạn:**
  - Toàn quyền xem, sửa, tạo, xóa toàn bộ các đối tượng trong ngân hàng.
  - Quản lý cấu hình tích hợp hạ tầng, kết nối Data Source, cấu hình Ingestion Pipeline, chạy sync dữ liệu.
  - Quản trị người dùng, phân quyền Role, Persona, cấp Token và cấu hình bảo mật.
  - Truy cập toàn bộ menu và mục **Cài đặt (`Settings`)** trên thanh Sidebar.

---

## IV. CÁC TỆP NGUỒN CẤU HÌNH LIÊN QUAN TRONG HỆ THỐNG

Nếu cần kiểm tra, tinh chỉnh hoặc bổ sung quyền trong tương lai, tham khảo các tệp cấu hình sau:

| Thành phần | Đường dẫn tệp mã nguồn |
| :--- | :--- |
| **Chính sách Basic Consumer** | `OpenMetadata/openmetadata-service/src/main/resources/json/data/policy/BasicConsumerPolicy.json` |
| **Chính sách Data Consumer** | `OpenMetadata/openmetadata-service/src/main/resources/json/data/policy/DataConsumerPolicy.json` |
| **Chính sách Data Proposer** | `OpenMetadata/openmetadata-service/src/main/resources/json/data/policy/DataProposerPolicy.json` |
| **Chính sách Data Steward** | `OpenMetadata/openmetadata-service/src/main/resources/json/data/policy/DataStewardPolicy.json` |
| **Chính sách Tổ chức chung** | `OpenMetadata/openmetadata-service/src/main/resources/json/data/policy/OrganizationPolicy.json` |
| **Cấu hình Role JSON** | `OpenMetadata/openmetadata-service/src/main/resources/json/data/role/*.json` |
| **Điều hướng Sidebar theo Persona** | `OpenMetadata/openmetadata-ui/src/main/resources/ui/src/utils/Persona/BasicConsumerNavigation.ts` |
| **Menu Sidebar chính** | `OpenMetadata/openmetadata-ui/src/main/resources/ui/src/constants/LeftSidebar.constants.ts` |
| **Script khởi tạo Test Users** | `openmetadata-python-client/prepare/0_create_test_users.py` |
| **Script đồng bộ Policy tự động** | `openmetadata-python-client/prepare/sync_policies.py` |

---

## V. HƯỚNG DẪN CẬP NHẬT HOẶC CHỈNH SỬA PHÂN QUYỀN SAU NÀY

1. **Thay đổi quyền Backend:**
   - Chỉnh sửa trực tiếp tại các file JSON trong thư mục `OpenMetadata/openmetadata-service/src/main/resources/json/data/policy/`.
   - Chạy script đồng bộ quyền lên hệ thống mà không cần restart service:
     ```bash
     python3 openmetadata-python-client/prepare/sync_policies.py
     ```
2. **Ẩn / Hiện thêm menu giao diện:**
   - Với các role chuyên biệt (như Basic Consumer): điều chỉnh logic tại `BasicConsumerNavigation.ts` và hook `useSidebarItems.ts`.
   - Với toàn hệ thống: điều chỉnh cấu hình tại `LeftSidebar.constants.ts`.
