# TÀI LIỆU ĐẶC TẢ KỸ THUẬT API (API SPECIFICATION DOCUMENT)
## HỆ THỐNG QUẢN TRỊ METADATA NGÂN HÀNG (AGRIBANK METADATA PLATFORM)
### PHÂN HỆ: TỪ ĐIỂN DỮ LIỆU DÙNG CHUNG (CDE), CHẤT LƯỢNG DỮ LIỆU (DQ) VÀ TỪ ĐIỂN KỸ THUẬT (TECHNICAL DICTIONARY)

---

## THÔNG TIN KIỂM SOÁT TÀI LIỆU

| Thuộc tính | Giá trị |
| :--- | :--- |
| Tên tài liệu | Đặc tả kỹ thuật API Hệ thống Quản trị Metadata Ngân hàng |
| Đơn vị chủ trì | Trung tâm Quản lý Dữ liệu (TT QLDL) |
| Phân loại | Nội bộ Agribank |
| Phiên bản tài liệu | 0.9 |
| Trạng thái | Dự thảo kỹ thuật phục vụ rà soát và nghiệm thu |
| Phiên bản nền tảng | OpenMetadata Core 1.13.3, có tùy biến của dự án |
| Ngày đối chiếu mã nguồn | 06/10/2026 |
| Phạm vi | Từ điển dữ liệu dùng chung, Quy tắc chất lượng dữ liệu, Từ điển kỹ thuật và xác thực OIDC qua IAM Backend |

### Lịch sử sửa đổi

| Phiên bản | Ngày | Nội dung | Trạng thái |
| :---: | :---: | :--- | :--- |
| 0.9 | 06/10/2026 | Chuẩn hóa danh mục API as-built; bổ sung OIDC/IAM; đồng bộ ma trận phân quyền theo Phương án triển khai; ghi nhận sai khác cần đóng; chuẩn hóa nguồn Markdown để xuất DOCX. | Dự thảo |

### Thẩm định và phê duyệt

| Vai trò | Đơn vị | Trạng thái |
| :--- | :--- | :--- |
| Người lập | TT QLDL / Nhóm triển khai | Chờ xác nhận |
| Người rà soát kỹ thuật | Đơn vị phát triển và vận hành hệ thống | Chờ xác nhận |
| Người phê duyệt nghiệp vụ | Lãnh đạo TT QLDL | Chờ phê duyệt |

## MỤC LỤC

1. Tổng quan tài liệu và quy chuẩn chung.
2. Tiêu chuẩn kỹ thuật, bảo mật và mã lỗi.
3. Phân hệ Từ điển dữ liệu dùng chung.
4. Phân hệ Danh mục Quy tắc chất lượng dữ liệu.
5. Phân hệ Từ điển kỹ thuật.
6. Phụ lục ví dụ tích hợp hệ thống.
7. Sai khác và điều kiện phát hành tài liệu.

<!--
Khi tạo DOCX:
- Dùng bộ chuyển đổi hiểu Markdown (ví dụ Pandoc); không mở trực tiếp file .md bằng LibreOffice vì cú pháp Markdown sẽ thành văn bản thô.
- Thay mục lục tĩnh trên bằng mục lục tự động từ Heading 1-3 và bật cập nhật số trang.
- Dùng khổ ngang cho ma trận tương thích OIDC, ma trận phân quyền và bảng Schema 16 thuộc tính CDE; lặp hàng tiêu đề khi bảng sang trang.
- Dùng style monospace cho inline code/code block và bật Keep with next cho các Heading.
-->

---

## 1. TỔNG QUAN TÀI LIỆU & QUY CHUẨN CHUNG

### 1.1. Mục đích tài liệu
Tài liệu này đặc tả chi tiết toàn bộ giao diện lập trình ứng dụng (RESTful APIs) phục vụ 3 phân hệ quản trị metadata trọng yếu của Agribank:
1. **Từ điển dữ liệu dùng chung (Data Dictionary) & Thành tố dữ liệu dùng chung (CDE - Critical Data Elements)**.
2. **Danh mục Quy tắc Chất lượng dữ liệu (Data Quality - DQ Rules Glossary)**.
3. **Từ điển Kỹ thuật (Technical Dictionary)**, không phiên bản, gắn với Từ điển dữ liệu đang hiệu lực.

Tài liệu được biên soạn theo tiêu chuẩn kỹ thuật ngân hàng, đóng vai trò là dự thảo hợp đồng giao tiếp (API Contract) giữa Backend (OpenMetadata Core Server - JAX-RS / Dropwizard), Frontend (React Single Page Application), và các hệ sinh thái tích hợp bên ngoài (Data Pipeline, Ingestion Bots, DWH/Data Lakehouse). Tài liệu trở thành baseline chính thức sau khi các sai khác được phân loại, các điều kiện nghiệm thu được đóng và bảng phê duyệt được hoàn tất.

**Trạng thái tài liệu:** Dự thảo kỹ thuật phiên bản `0.9`, kết hợp contract nghiệp vụ mục tiêu và hành vi as-built được đối chiếu ngày `2026-10-06`.

**Nguồn sự thật theo từng loại nội dung:**

1. **Phạm vi nghiệp vụ và phân quyền mục tiêu:** *Phương án triển khai phần mềm quản lý siêu dữ liệu_20260910* và các phê duyệt nghiệp vụ bổ sung.
2. **Contract xác thực phía IAM:** tài liệu `tai-lieu-dac-ta-api.docx` và discovery document thực tế của IAM Backend.
3. **API as-built của OpenMetadata:** JAX-RS resource, Authentication Servlet trong `openmetadata-service`, JSON Schema trong `openmetadata-spec` và Swagger build từ cùng revision.
4. **Cách Frontend gọi API:** REST wrapper trong `openmetadata-ui`; đây không phải nguồn để mở rộng quyền hoặc route backend.
5. **Tài liệu thiết kế trong `docs/design`:** mô tả ý định kiến trúc và sai khác mục tiêu; không thay thế contract runtime đã kiểm chứng.

Khi các nguồn mâu thuẫn, tài liệu phải trình bày tách biệt **Yêu cầu nghiệp vụ**, **Hành vi as-built** và **Điều kiện cần đạt trước nghiệm thu**. Không được mô tả yêu cầu chưa triển khai như hành vi đang hoạt động, và không được dùng hành vi runtime rộng hơn để thay đổi ma trận quyền đã được phê duyệt.

Tài liệu này đặc tả **danh mục quy tắc Chất lượng dữ liệu** dưới dạng Governed Glossary. Các API vận hành kiểm thử dữ liệu gốc của OpenMetadata như `/dataQuality/testCases`, `/testSuites` và `/testCaseResults` nằm ngoài phạm vi tài liệu này.

### 1.2. Đối tượng sử dụng
- **Kỹ sư phát triển Backend & Frontend:** Căn cứ lập trình đúng endpoint, tham số, kiểu dữ liệu, ràng buộc khóa lạc quan và mã phản hồi.
- **Kỹ sư Đảm bảo chất lượng (QA/QC/Testers):** Thiết kế kịch bản kiểm thử tự động (API Automation Testing), kiểm thử bảo mật và tải.
- **Kiến trúc sư giải pháp & Quản trị hệ thống (Architects & DevOps/SecOps):** Rà soát tuân thủ kiến trúc, phân quyền RBAC và an toàn thông tin ngân hàng.

### 1.3. Bảng thuật ngữ và chữ viết tắt
| Viết tắt / Khái niệm | Tên đầy đủ / Định nghĩa | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| **CDE** | Critical Data Element | Thành tố dữ liệu dùng chung có giá trị nghiệp vụ trọng yếu trong ngân hàng. |
| **DQ** | Data Quality | Chất lượng dữ liệu (tính chính xác, đầy đủ, kịp thời, nhất quán, hợp lệ, duy nhất). |
| **TD** | Technical Dictionary | Từ điển kỹ thuật quản lý metadata vật lý của các cột dữ liệu từ hệ thống nguồn. |
| **Scope / Parent Version** | Governance Scope (`N`) | Kỳ/Phạm vi quản trị dữ liệu dạng số nguyên (`1`, `2`, `3`...), đóng vai trò là không gian cô lập phiên bản. |
| **Business Version** | Business Version (`N.MINOR`) | Phiên bản nghiệp vụ của CDE hoặc DQ Rule thuộc Scope `N`; record Từ điển kỹ thuật không có business version riêng. |
| **Working Version** | Working / Draft State | Bản ghi đang trong chu trình soạn thảo, phê duyệt (`Draft`, `In Review`, `Rejected`). |
| **Published Version** | Published Snapshot | Bản ghi đã phê duyệt (`Approved`), đóng băng bất biến (Immutable), phục vụ khai thác chính thức. |
| **FQN** | Fully Qualified Name | Tên định danh toàn cầu duy nhất của một thực thể trong OpenMetadata. |
| **OIDC** | OpenID Connect | Lớp định danh trên OAuth 2.0, được dùng để đăng nhập một lần (SSO). |
| **IdP** | Identity Provider | Vai trò do IAM Backend đảm nhiệm: xác thực người dùng và phát hành token OIDC. |
| **IAM Backend** | Identity and Access Management Backend | OIDC Provider/Authorization Server của Agribank mà OpenMetadata tích hợp để đăng nhập SSO. |
| **JWKS** | JSON Web Key Set | Tập khóa công khai dùng để kiểm tra chữ ký JWT do IAM Backend phát hành. |
| **PKCE** | Proof Key for Code Exchange | Cơ chế ràng buộc authorization code với phiên khởi tạo đăng nhập. |
| **RBAC** | Role-Based Access Control | Cơ chế kiểm soát truy cập dựa trên vai trò người dùng (Consumer, Proposer, Steward, Admin). |
| **Optimistic Locking** | Khóa lạc quan | Kiểm soát xung đột cập nhật đồng thời dựa trên số hiệu hiệu chỉnh `workingRevision`. |

Các trường audit của Governed Workflow như `createdAt`, `updatedAt`, `submittedAt`, `rejectedAt`, `publishedAt`, `archivedAt` dùng Unix epoch milliseconds (`int64`). Riêng `expiresAt` của import session là chuỗi ISO-8601 UTC.

---

### 1.4. Quy chuẩn Phân tầng Kiến trúc URL (Architecture & URL Layering)
Hệ thống tuân thủ nghiêm ngặt mô hình 4 tầng định tuyến để đảm bảo tính nhất quán giữa UI, API Client và Wire Network:

| Tầng | Thành phần | Ví dụ tuyến Từ điển dữ liệu | Ví dụ tuyến Từ điển kỹ thuật |
| :---: | :--- | :--- | :--- |
| 1 | UI Route trên trình duyệt | `/glossary/DataDictionary` | `/technical-dictionary` |
| 2 | Frontend API Client/SDK Wrapper | `APIClient.get('/glossaries')` | `APIClient.get('/glossaryTerms/search')` |
| 3 | HTTP request trên mạng | `GET /api/v1/glossaries` | `GET /api/v1/glossaryTerms/search` |
| 4 | Backend Controller | `@Path('/v1/glossaries') GlossaryResource` | `@Path('/v1/glossaryTerms') GlossaryTermResource` |

Luồng định tuyến thống nhất: **UI Route → Frontend API Client → `/api/v1` trên mạng → Backend Controller**.

* **Quy tắc vàng:**
  - Base URL của API server: `http(s)://<domain_or_ip>:<port>/api/v1`.
  - Frontend `APIClient` đã cấu hình ngầm `baseURL = '/api/v1'`. Khi gọi trong wrapper, không thêm tiền tố `/api/v1` để tránh sinh lỗi `404 Not Found` (do trùng lặp thành `/api/v1/api/v1/...`).
  - Mọi thao tác Mutation trên phiên bản nghiệp vụ phải được xác thực authoritative tại Database, không tin cậy trạng thái suy diễn từ Search Index (OpenSearch/Elasticsearch).

### 1.5. Quy ước trạng thái trong tài liệu

| Nhãn | Ý nghĩa sử dụng |
| :--- | :--- |
| **Contract** | Hành vi API đã triển khai và được dùng làm hợp đồng tích hợp. |
| **Yêu cầu nghiệp vụ** | Hành vi/quyền bắt buộc phải đạt để nghiệm thu, kể cả khi runtime hiện chưa đáp ứng. |
| **Sai khác cần xử lý** | Khoảng cách đã xác định giữa runtime và yêu cầu nghiệp vụ; không được hiểu là chức năng đã hoàn thành. |
| **Ngoài phạm vi** | Route hoặc chức năng không thuộc contract của tài liệu này. |

### 1.6. Quy ước ví dụ và tài liệu tham chiếu

- Các giá trị đặt trong dấu `<...>`, `{...}`, UUID, tên người dùng, hostname và token trong ví dụ chỉ là placeholder hoặc dữ liệu minh họa; không được sao chép sang production như thông tin thật.
- URL `http://localhost:8585` chỉ dùng cho môi trường phát triển. UAT và production bắt buộc dùng hostname đã được phê duyệt qua HTTPS.
- Khi tài liệu tham chiếu và runtime khác nhau, áp dụng nguyên tắc phân loại tại mục 1.1 và ghi sai khác tại mục 7; không tự chọn một hành vi làm contract chính thức.

| Mã | Tài liệu / Nguồn tham chiếu | Mục đích sử dụng |
| :--- | :--- | :--- |
| `TL-01` | *Phương án triển khai phần mềm quản lý siêu dữ liệu_20260910* | Phạm vi nghiệp vụ và ma trận phân quyền mục tiêu. |
| `TL-02` | *tai-lieu-dac-ta-api.docx* của IAM Backend | Contract OIDC phía IAM được cung cấp để đối chiếu. |
| `TL-03` | *technical-dictionary-design.md* | Thiết kế và vòng đời Từ điển kỹ thuật. |
| `TL-04` | JAX-RS resources, JSON Schema, Authentication Servlet, Swagger/OpenAPI và frontend REST wrappers tại revision đối chiếu | Kiểm chứng danh mục API và hành vi as-built. |

---

## 2. TIÊU CHUẨN KỸ THUẬT, BẢO MẬT & MÃ LỖI

### 2.1. Xác thực & Phân quyền RBAC (Authentication & RBAC)

Hệ thống sử dụng **IAM Backend của Agribank làm OIDC Provider/Authorization Server**, còn OpenMetadata là OIDC confidential client và resource server. OpenMetadata giữ `client_secret` ở phía server và chỉ giữ refresh token trong session nếu IAM Backend có phát hành; trình duyệt không được nhận `client_secret` hoặc tự gọi token endpoint của IAM Backend.

- **Cơ chế xác thực API:** Mọi API nghiệp vụ (ngoại trừ endpoint khởi tạo/callback công khai được mô tả tại mục 2.1.2) bắt buộc phải truyền JWT trong header:
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  ```

> **Quan trọng — Token sử dụng:** Trong implementation confidential-client hiện tại, giá trị frontend nhận dưới tên `id_token` và gửi trong header `Authorization` là **OIDC ID Token**. Trường `accessToken` của API refresh cũng đang chứa ID Token. Tên placeholder `<JWT_ACCESS_TOKEN>` trong các ví dụ nghiệp vụ vì vậy có nghĩa là bearer JWT được OpenMetadata chấp nhận, không khẳng định đó là OAuth access token do IAM Backend phát hành.

#### 2.1.1. Luồng đăng nhập OIDC

| Bước | Nguồn | Đích | Trao đổi |
| :---: | :--- | :--- | :--- |
| 1 | Người dùng | OpenMetadata SPA | Mở ứng dụng hoặc chọn Đăng nhập. |
| 2 | SPA | OpenMetadata Server | `GET /api/v1/auth/login?redirectUri={origin}/auth/callback`. |
| 3 | OpenMetadata Server | Trình duyệt | Trả `302 Found` tới `authorization_endpoint` của IAM và thiết lập `JSESSIONID`. |
| 4 | Người dùng | IAM Backend | Xác thực trên trang đăng nhập tập trung của IAM. |
| 5 | IAM Backend | OpenMetadata Server | Redirect `GET /callback?code=...&state=...`. |
| 6 | OpenMetadata Server | IAM Backend | `POST /api/v1/oidc/token` với authorization code và client credentials. |
| 7 | IAM Backend | OpenMetadata Server | Trả ID Token, access token và refresh token nếu IAM hỗ trợ. |
| 8 | OpenMetadata Server | Trình duyệt | Trả `302 Found` tới `/auth/callback?id_token=...&email=...&name=...`. |
| 9 | SPA | Token storage/service worker | Lưu bearer JWT. |
| 10 | SPA | OpenMetadata API | Gọi API nghiệp vụ với `Authorization: Bearer {id_token}`; server áp dụng RBAC. |

Hai callback không được cấu hình lẫn nhau:

- `OIDC_CALLBACK`/redirect URI đã đăng ký tại IAM Backend là URL công khai của backend OpenMetadata, kết thúc bằng **`/callback`**. IAM Backend trả authorization code về URL này.
- `redirectUri` của `GET /api/v1/auth/login` là callback cuối của SPA, kết thúc bằng **`/auth/callback`**. Backend chuyển ID Token cho SPA tại URL này sau khi đổi code thành công.
- `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `issuer` và `jwks_uri` là endpoint của **IAM Backend**, lấy từ `OIDC_DISCOVERY_URI`; chúng không phải API nghiệp vụ của OpenMetadata.

#### 2.1.2. Contract API đăng nhập và quản lý phiên OIDC

Các endpoint dưới đây là Authentication Servlet as-built, không phải JAX-RS resource và không được cộng vào danh mục API nghiệp vụ của ba phân hệ tại mục 3-5.

##### OIDC-01: Khởi tạo đăng nhập

- **Method & Endpoint:** `GET /api/v1/auth/login`
- **Xác thực đầu vào:** Công khai; chưa yêu cầu bearer token.
- **Query Parameter:**
  - `redirectUri` (URI, bắt buộc đối với web client): callback cuối của SPA. Giá trị chuẩn là `https://<openmetadata-host>/auth/callback`.
- **Hành vi:** Tạo/tiếp tục HTTP session, lưu `redirectUri`, sinh `state`, sinh `nonce` khi `OIDC_USE_NONCE=true`, sinh PKCE challenge khi `OIDC_DISABLE_PKCE=false`, sau đó chuyển trình duyệt đến `authorization_endpoint` của IAM Backend.
- **Phản hồi thành công:** `302 Found`, header `Location` trỏ đến IAM Backend và cookie phiên `JSESSIONID` có `HttpOnly`; cookie có `Secure` và `SameSite=None` khi chạy HTTPS hoặc bật `FORCE_SECURE_SESSION_COOKIE=true`.
- **Mẫu Request:**
  ```http
  GET /api/v1/auth/login?redirectUri=https%3A%2F%2Fmetadata.example.vn%2Fauth%2Fcallback HTTP/1.1
  Host: metadata.example.vn
  ```
- **Mẫu Response:**
  ```http
  HTTP/1.1 302 Found
  Set-Cookie: JSESSIONID=<opaque>; Path=/; HttpOnly; Secure; SameSite=None
  Location: https://<iam-backend-host>/<authorization-path>?response_type=code&client_id=<client-id>&redirect_uri=https%3A%2F%2Fmetadata.example.vn%2Fcallback&scope=openid%20email%20profile&state=<opaque>&nonce=<opaque>
  ```

`redirectUri` phải được reverse proxy/application gateway giới hạn về origin tin cậy và route `/auth/callback`; không chuyển tiếp tùy ý giá trị do client ngoài cung cấp.

##### OIDC-02: Nhận authorization callback từ IAM Backend

- **Method & Endpoint:** `GET /callback` (**không có** tiền tố `/api/v1`).
- **Caller:** Trình duyệt do IAM Backend redirect; frontend và hệ thống tích hợp không tự gọi endpoint này.
- **Query Parameters thành công:** `code` và `state`; IAM Backend có thể trả `iss` theo metadata. Trường hợp thất bại dùng các tham số lỗi chuẩn OIDC như `error`, `error_description`.
- **Hành vi:** Khôi phục session bằng `JSESSIONID`, kiểm tra `state`, đổi authorization code tại `token_endpoint`, kiểm tra `nonce` khi bật, tạo/cập nhật người dùng OpenMetadata theo policy, lưu OIDC credentials trong session và redirect đến SPA callback đã lưu.
- **Phản hồi thành công:** `302 Found` đến `{redirectUri}?id_token=...&email=...&name=...`.
- **Phản hồi lỗi as-built:** `500 Internal Server Error`, `Content-Type: text/html` khi session bị mất, state/nonce sai, IAM Backend từ chối hoặc token exchange thất bại.

> **Cảnh báo bảo mật:** Implementation hiện tại truyền ID Token trong query string khi redirect sang `/auth/callback`. Gateway, access log, APM và browser analytics phải loại bỏ/redact query của route này; đặt `Referrer-Policy: no-referrer`, chỉ sử dụng HTTPS và không ghi token vào log. Đây là dữ liệu xác thực, không phải tham số nghiệp vụ để lưu hoặc chia sẻ.

##### OIDC-03: Làm mới bearer JWT từ phiên OIDC

- **Method & Endpoint:** `GET /api/v1/auth/refresh` (servlet cũng chấp nhận `POST`; frontend hiện dùng `GET`).
- **Xác thực đầu vào:** Cookie `JSESSIONID`; không truyền refresh token trong request body và không lưu refresh token tại browser.
- **Hành vi OpenMetadata:** Đọc OIDC credentials phía server, dùng refresh token gọi IAM Backend và trả ID Token đã làm mới dưới tên `accessToken`.
- **Mẫu Request:**
  ```http
  GET /api/v1/auth/refresh HTTP/1.1
  Host: metadata.example.vn
  Cookie: JSESSIONID=<opaque>
  ```
- **Mẫu Response (200 OK):**
  ```json
  {
    "accessToken": "<OIDC_ID_TOKEN>",
    "refreshToken": null,
    "tokenType": "Bearer ",
    "expiryDuration": 1791262800
  }
  ```
- `expiryDuration` as-built là thời điểm hết hạn dạng Unix epoch seconds, không phải số giây còn lại. `refreshToken` phải rỗng/không được sử dụng ở client.
- **Giới hạn với IAM Backend hiện tại:** Contract IAM được cung cấp không có `refresh_token` trong response của `/api/v1/oidc/token`. Vì `AuthenticationCodeFlowHandler` yêu cầu refresh token để làm mới credentials, OIDC-03 sẽ không duy trì được phiên nếu IAM không bổ sung `refresh_token` hoặc OpenMetadata không đổi chiến lược session/token.
- **Phản hồi khi phiên không dùng được:** `500 Internal Server Error` nếu không còn session; có thể `302 Found` sang logout nếu session còn tồn tại nhưng không còn credentials/refresh token. Client phải xóa trạng thái đăng nhập cục bộ và khởi tạo lại OIDC login.

##### OIDC-04: Đăng xuất phiên OIDC

- **Method & Endpoint:** `GET /api/v1/auth/logout` (servlet cũng chấp nhận `POST`; frontend hiện dùng `GET`).
- **Xác thực đầu vào:** Cookie `JSESSIONID`.
- **Hành vi:** Ghi audit logout, hủy HTTP session và redirect đến `${OIDC_SERVER_URL}/logout`.
- **Phản hồi thành công có session:** `302 Found`.
- **Lưu ý:** As-built chưa tự động lấy `end_session_endpoint` từ discovery document. Contract IAM được cung cấp cũng chưa mô tả endpoint logout OIDC. `${OIDC_SERVER_URL}/logout` phải được IAM Backend/gateway hỗ trợ; nếu không phải thay đổi implementation OpenMetadata.

#### 2.1.3. Contract OIDC do IAM Backend cung cấp

Base URL logic của IAM Backend là `https://<iam-backend-host>/api/v1`. Các endpoint sau thuộc IAM Backend, không thuộc OpenMetadata và không dùng ma trận RBAC nghiệp vụ tại mục 2.1.5.

##### IAM-OIDC-01: Xác thực người dùng và phát hành authorization code

- **Method & Endpoint theo tài liệu IAM:** `POST /api/v1/oidc/login`
- **Xác thực endpoint:** Public.
- **Content-Type:** `application/json`.
- **Request Body tham chiếu:**
  ```json
  {
    "username": "nguyenvana",
    "password": "<RSA_ENCRYPTED_PASSWORD>",
    "clientId": "openmetadata",
    "redirectUri": "https://metadata.example.vn/callback",
    "scope": "openid+profile+email",
    "state": "<STATE_FROM_OPENMETADATA>",
    "nonce": "<NONCE_FROM_OPENMETADATA>",
    "isLdap": 1
  }
  ```
- `password` không phải plaintext; client IAM mã hóa RSA và IAM giải mã bằng private key cấu hình.
- `isLdap = 1` yêu cầu IAM xác thực người dùng qua LDAP; nếu không, IAM dùng kho tài khoản nội bộ theo cấu hình.
- `state`/`nonce` trống thì IAM tự sinh UUID. Đối với OpenMetadata, IAM phải bảo toàn chính xác `state` và `nonce` do OpenMetadata gửi để callback validation thành công.
- **Response theo tài liệu IAM:** chứa `redirectUrl` dạng `<redirectUri>?code=...&state=...`.
- Authorization code được IAM lưu một lần, TTL 120 giây; client phải đổi code trước khi hết hạn.

##### IAM-OIDC-02: Đổi authorization code lấy token

- **Method & Endpoint:** `POST /api/v1/oidc/token`
- **Xác thực endpoint:** Client authentication bằng `client_id` và `client_secret`.
- **Content-Type:** `application/x-www-form-urlencoded`.
- **Form fields:**
  ```text
  grant_type=authorization_code
  code=<ONE_TIME_AUTHORIZATION_CODE>
  client_id=openmetadata
  client_secret=<OPENMETADATA_CLIENT_SECRET>
  redirect_uri=https://metadata.example.vn/callback
  ```
- `client_id` và `redirect_uri` phải khớp client đăng ký tại IAM Backend. Authorization code bị đọc-xóa khi sử dụng, không được replay.
- **Response JSON thuần:**
  ```json
  {
    "access_token": "<IAM_OIDC_ACCESS_TOKEN>",
    "id_token": "<IAM_OIDC_ID_TOKEN>",
    "token_type": "Bearer",
    "expires_in": 3600,
    "scope": "openid profile email"
  }
  ```
- Tài liệu IAM hiện không mô tả `refresh_token`.

##### IAM-OIDC-03: Lấy thông tin người dùng

- **Method & Endpoint:** `GET /api/v1/oidc/userinfo`
- **Header:** `Authorization: Bearer <IAM_OIDC_ACCESS_TOKEN>`.
- Chỉ chấp nhận token có claim `tokenType = "OIDC_ACCESS"`; JWT HS256 nội bộ và ID Token không phải token hợp lệ cho endpoint này.
- **Response JSON thuần:**
  ```json
  {
    "id": "<USER_ID>",
    "username": "nguyenvana",
    "email": "nguyenvana@agribank.com.vn",
    "fullName": "Nguyễn Văn A",
    "brcd": "<BRANCH_CODE>",
    "roles": ["<IAM_ROLE>"]
  }
  ```
- IAM lấy role từ IDAS qua Feign client; nếu IDAS lỗi thì fallback sang role lưu trong database IAM.

##### IAM-OIDC-04: Discovery và khóa công khai

| Method | Endpoint | Mục đích |
| :---: | :--- | :--- |
| `GET` | `/api/v1/oidc/.well-known/openid-configuration` | Discovery document để OpenMetadata lấy `issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `jwks_uri` và capability. |
| `GET` | `/api/v1/oidc/jwks` | JWKS chứa khóa RSA công khai và `kid` để OpenMetadata kiểm tra JWT RS256. |

Token IAM OIDC dùng RS256:

- Access token: `tokenType="OIDC_ACCESS"`, có `iss`, `aud`, `sub` (username), `app`, `auth`.
- ID Token: `tokenType="ID"`, có `sub` (user ID), `preferred_username`, `name`, `email`, `nonce`; tài liệu IAM chưa thể hiện claim `roles` trong ID Token.

#### 2.1.4. Cấu hình và điều kiện tương thích IAM–OpenMetadata

| Biến cấu hình | Yêu cầu / Ý nghĩa |
| :--- | :--- |
| `AUTHENTICATION_PROVIDER=custom-oidc` | Chọn IAM Backend qua provider OIDC tùy biến. |
| `AUTHENTICATION_CLIENT_TYPE=confidential` | Bắt buộc để các Authentication Servlet dùng Authorization Code Flow phía server. |
| `CUSTOM_OIDC_AUTHENTICATION_PROVIDER_NAME="IAM Backend"` | Tên nhà cung cấp hiển thị/cấu hình của custom OIDC. |
| `OIDC_CLIENT_ID=openmetadata` | Client ID riêng do IAM Backend đăng ký cho OpenMetadata; không dùng lại client `superset`. |
| `OIDC_CLIENT_SECRET` | Client secret chỉ được nạp từ secret manager/runtime; không commit vào `.env.example`, tài liệu, log hoặc frontend bundle. |
| `OIDC_DISCOVERY_URI` | URL `${IAM_BASE_URL}/api/v1/oidc/.well-known/openid-configuration`; discovery phải công bố tối thiểu `issuer`, `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint` và `jwks_uri`. |
| `OIDC_CALLBACK` | URL public của OpenMetadata kết thúc bằng `/callback`, phải khớp tuyệt đối redirect URI đăng ký tại IAM Backend. Portal chạy trên origin khác phải đăng ký thêm callback riêng; dùng client riêng nếu policy IAM yêu cầu. |
| `AUTHENTICATION_CALLBACK_URL` | Callback cấp authentication configuration; giữ cùng giá trị public `/callback` với `OIDC_CALLBACK` để tránh sai lệch cấu hình. |
| `AUTHENTICATION_PUBLIC_KEYS` | Danh sách chứa `${IAM_BASE_URL}/api/v1/oidc/jwks`, dùng để kiểm tra JWT RS256 tại các API nghiệp vụ. |
| `AUTHENTICATION_AUTHORITY` | Phải bằng `issuer` mà IAM Backend công bố trong discovery document. |
| `OIDC_SCOPE` | Dùng giá trị cấu hình `openid email profile`; thư viện OIDC chịu trách nhiệm URL-encode thành wire format IAM chấp nhận. Không cấu hình dấu `+` như một ký tự literal nếu chưa kiểm thử discovery/client library. |
| `OIDC_USE_NONCE=true` | Bật kiểm tra nonce chống replay. |
| `OIDC_DISABLE_PKCE` | Chỉ đặt `false` khi discovery IAM công bố hỗ trợ PKCE S256; tên biến có ngữ nghĩa phủ định. Default source OpenMetadata hiện là `true`. |
| `OIDC_CLIENT_AUTH_METHOD=client_secret_post` | Phù hợp contract IAM `/oidc/token` hiện mô tả `client_id`/`client_secret` trong form body. |
| `OIDC_SESSION_EXPIRY` | Thời gian sống/inactive timeout của `JSESSIONID`, đơn vị giây, tối thiểu 3.600; mặc định 604.800 (7 ngày). |
| `FORCE_SECURE_SESSION_COOKIE=true` | Bắt buộc khi TLS kết thúc tại reverse proxy/load balancer nhưng OpenMetadata nhận kết nối HTTP nội bộ. |
| `AUTHENTICATION_JWT_PRINCIPAL_CLAIMS` | Thứ tự claim nhận diện người dùng; mặc định `[email,preferred_username,sub]`. |
| `AUTHENTICATION_ENABLE_SELF_SIGNUP` | Cho phép tạo user local khi đăng nhập OIDC lần đầu; production phải kết hợp allowlist domain hoặc tắt để cấp phát trước. |

Backend kiểm tra chữ ký và hạn JWT bằng JWKS của IAM Backend, ánh xạ principal từ claim, sau đó mới áp dụng policy/RBAC nội bộ. Với `AUTHORIZER_USE_ROLES_FROM_PROVIDER=true`, OpenMetadata hiện đọc claim tên `roles`; claim `auth` của IAM access token không tự động được dùng. `AUTHORIZER_DEFAULT_OAUTH_ROLE` là role mặc định cho user OIDC mới, không thay thế ma trận quyền dưới đây.

##### Ma trận tương thích phải hoàn tất trước UAT

<!-- DOCX_LAYOUT: Bảng dưới đây nên được đặt trên trang khổ ngang. -->

| Hạng mục | Contract IAM được cung cấp | OpenMetadata as-built | Kết luận / Điều kiện tích hợp |
| :--- | :--- | :--- | :--- |
| Authorization endpoint | `POST /api/v1/oidc/login`, nhận JSON username/password và trả `redirectUrl` | Redirect browser bằng `GET authorization_endpoint?...` | **Chưa tương thích trực tiếp theo tài liệu.** IAM phải cung cấp authorization endpoint chuẩn GET có UI đăng nhập/redirect, hoặc phải phát triển adapter/custom authenticator cho OpenMetadata. |
| Client registration | Tài liệu chỉ nêu cấu hình `oidc.client.superset.*` | Gửi `client_id=openmetadata` và callback `/callback` | IAM phải đăng ký client `openmetadata`, client secret và từng callback của OM/Portal; không dùng cấu hình Superset. |
| Token response | Có `access_token`, `id_token`; chưa có `refresh_token` | Session refresh yêu cầu refresh token | IAM bổ sung refresh-token grant hoặc OpenMetadata phải đổi cơ chế refresh/re-login. |
| Bearer gọi API OM | OpenMetadata UI đang gửi ID Token | `JwtFilter` chấp nhận JWT ký bởi JWKS | IAM ID Token phải có `kid`, `exp`, principal claim hợp lệ; cần cưỡng chế thêm `iss`/`aud` như cảnh báo dưới đây. |
| Đồng bộ role | `auth` nằm trong access token; `roles` chỉ được mô tả ở `/userinfo` | Đọc claim `roles` từ bearer ID Token khi `AUTHORIZER_USE_ROLES_FROM_PROVIDER=true` | IAM phải phát hành claim `roles` trong ID Token với tên role OM, hoặc OM phải ánh xạ `auth`/userinfo sang role local. Nếu chưa có, tắt đồng bộ role từ provider và cấp role trong OM. |
| Logout | Chưa mô tả OIDC logout/end-session | Redirect `${OIDC_SERVER_URL}/logout` | IAM/gateway phải cung cấp route này hoặc OpenMetadata phải dùng `end_session_endpoint` thực tế. |

Do discovery IAM tại môi trường nội bộ không truy cập được trong lần đối chiếu tài liệu này, các trường `authorization_endpoint`, `issuer`, `grant_types_supported`, `code_challenge_methods_supported` và `token_endpoint_auth_methods_supported` phải được kiểm tra lại trực tiếp trên UAT; không suy diễn chỉ từ đường dẫn cấu hình.

> **Rủi ro cần xử lý trước go-live:** `JwtFilter` as-built kiểm tra `exp`, chữ ký và khóa `kid` từ JWKS nhưng chưa kiểm tra tường minh claim `iss` và `aud` cho từng request API. Trước go-live phải bổ sung/kiểm chứng kiểm tra `iss = issuer` và `aud`/`azp = OIDC_CLIENT_ID`; chỉ cấu hình `AUTHENTICATION_AUTHORITY` không đồng nghĩa hai claim này đã được cưỡng chế. Tương tự, code hiện chỉ kiểm tra `redirectUri` khác rỗng, chưa tự allowlist origin — yêu cầu giới hạn tại gateway ở OIDC-01 là bắt buộc cho đến khi backend được harden.

#### 2.1.5. Vai trò và ma trận quyền

Ma trận dưới đây lấy nguyên tắc quyền từ mục **“4. Phân quyền truy cập, truy xuất dữ liệu”** của tài liệu *Phương án triển khai phần mềm quản lý siêu dữ liệu_20260910*. Tên role kỹ thuật trong OpenMetadata chỉ là ánh xạ triển khai; tên vai trò nghiệp vụ và phạm vi quyền trong tài liệu nguồn là chuẩn ưu tiên.

Đối với kiểm thử nghiệm thu API, ma trận này là contract bắt buộc: thao tác có ký hiệu `-` phải trả `403 Forbidden` (hoặc `404 Not Found` khi cần che giấu sự tồn tại của tài nguyên). Nếu runtime hiện trả thành công do quyền superuser, Owner/Reviewer hoặc policy kế thừa thì đó là sai khác triển khai, không làm thay đổi ma trận chuẩn.

| Vai trò nghiệp vụ trong tài liệu nguồn | Role triển khai OpenMetadata | Đơn vị đầu mối | Phạm vi mặc định |
| :--- | :--- | :--- | :--- |
| Quản trị viên hệ thống (Admin System) | `Admin` | TT QLDL | Quản trị tài khoản/phân quyền (`C`) và tra cứu (`R`) theo ma trận; không có quyền đề xuất hoặc phê duyệt chỉ vì là Admin. |
| Người phê duyệt (Lãnh đạo) | `DataSteward` | TT QLDL | Đọc và phê duyệt (`R`, `A`) theo từng phân hệ được giao. |
| Người đề xuất yêu cầu (Nhân viên) | `DataProposer` | TT QLDL | Đọc, đề xuất/tạo mới/sửa đổi (`R`, `W`); không phê duyệt. |
| Người dùng (TT QLDL) | `DataConsumer` | TT QLDL | Tra cứu (`R`) Từ điển kỹ thuật, Từ điển nghiệp vụ và Quy tắc chất lượng dữ liệu. |
| Người dùng (Các ban TSC, Chi nhánh) | `BasicConsumer` | TSC, CN | Chỉ tra cứu (`R`) Từ điển nghiệp vụ và Quy tắc chất lượng dữ liệu; không được tra cứu Từ điển kỹ thuật. |

Ký hiệu quyền:

- `R` (Read): Xem/tra cứu.
- `W` (Write/Proposal): Đề xuất, tạo mới, sửa đổi hoặc bổ sung.
- `A` (Approve): Phê duyệt.
- `C` (Create/Admin): Tạo tài khoản và phân quyền quản trị.
- `-`: Không được phép/không có quyền từ vai trò đó.

##### Ma trận phân quyền chuẩn

<!-- DOCX_LAYOUT: Bảng dưới đây nên được đặt trên trang khổ ngang. -->

| Nhóm chức năng / Tác vụ chi tiết | Admin System (`Admin`) | Người phê duyệt (`DataSteward`) | Người đề xuất (`DataProposer`) | Người dùng TT QLDL (`DataConsumer`) | Người dùng TSC/CN (`BasicConsumer`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Quản trị tài khoản & Phân quyền** |  |  |  |  |  |
| Cấp và phân quyền người dùng tại Trụ sở chính (Ủy ban, Ban, Trung tâm, VPĐD, ĐVSN, CN) | C | - | - | - | - |
| Cấp/tạo và phân quyền Admin cơ sở tại Chi nhánh | C | - | - | - | - |
| **2. Từ điển dữ liệu kỹ thuật** |  |  |  |  |  |
| Tra cứu Từ điển dữ liệu kỹ thuật | R | R | R | R | - |
| Đề xuất thêm mới Từ điển dữ liệu kỹ thuật | - | - | W | - | - |
| Đề xuất sửa đổi, bổ sung Từ điển dữ liệu kỹ thuật | - | - | W | - | - |
| Phê duyệt yêu cầu Từ điển dữ liệu kỹ thuật | - | A | - | - | - |
| **3. Phân loại dữ liệu** |  |  |  |  |  |
| Đề xuất thêm mới, sửa đổi, bổ sung Phân loại dữ liệu | - | - | W | - | - |
| Phê duyệt Phân loại dữ liệu | - | A | - | - | - |
| **4. Từ điển dữ liệu nghiệp vụ (Từ điển dữ liệu dùng chung/CDE)** |  |  |  |  |  |
| Tra cứu Từ điển dữ liệu nghiệp vụ | R | R | R | R | R |
| Đề xuất thêm mới, thay đổi, bổ sung Từ điển dữ liệu nghiệp vụ | - | - | W | - | - |
| Phê duyệt Từ điển dữ liệu nghiệp vụ | - | A | - | - | - |
| **5. Quy tắc chất lượng dữ liệu** |  |  |  |  |  |
| Tra cứu Quy tắc chất lượng dữ liệu | R | R | R | R | R |
| Đề xuất thêm mới, thay đổi, bổ sung Quy tắc chất lượng dữ liệu | - | - | W | - | - |
| Phê duyệt Quy tắc chất lượng dữ liệu | - | A | - | - | - |

> **Nguyên tắc bắt buộc:** Một người dùng có thể mang nhiều role, nhưng quyền hiệu lực phải tuân thủ nguyên tắc Maker–Checker: tài khoản có quyền `A` tuyệt đối không đồng thời có quyền `W` trên cùng một phân hệ và ngược lại. Role `Admin` cấp `C` và các quyền `R` ghi trong ma trận, nhưng không cấp `W` hoặc `A`; muốn đề xuất hay phê duyệt, tài khoản quản trị phải được gán thêm role phù hợp và vẫn phải bảo đảm tách biệt Maker–Checker. Mọi cơ chế superuser/bypass rộng hơn ma trận này là sai khác triển khai cần được loại bỏ hoặc phê duyệt riêng.

> **Lưu ý về phạm vi đọc:** Quyền `R` chỉ cho phép đọc dữ liệu đã được ban hành (`Approved`) và lịch sử được phép công bố. `DataProposer` được xem working version để thực hiện quyền `W`; `DataSteward` được xem bản `In Review` để thực hiện quyền `A`. Việc là Owner/Reviewer không tự động cấp quyền vượt ma trận. Đối với `BasicConsumer`, quyền `R` không áp dụng cho Từ điển dữ liệu kỹ thuật.

Các thao tác `Export`, `Import`, `Reject`, `Reopen`, `Archive/Thu hồi`, tạo Scope và Cutover không được nêu thành quyền độc lập trong ma trận nguồn. Không được tự suy ra các quyền này cho Admin hoặc Consumer: export chỉ được phép khi có `R` trên đúng phân hệ; import/tạo Scope chỉ được phép khi được phê duyệt là một phương thức thực hiện `W`; reject/reopen/archive/cutover phải có policy nghiệp vụ riêng được phê duyệt.


### 2.2. Kiểm soát đồng thời bằng Khóa lạc quan (Optimistic Locking)
Để ngăn chặn tình trạng ghi đè mất dữ liệu (Lost Updates) khi nhiều người dùng cùng thao tác:
- Mọi API cập nhật nháp (`PATCH /working`) hoặc chuyển trạng thái workflow (`POST /working/{action}`) bắt buộc phải truyền thuộc tính `expectedRevision` trong payload.
- Backend đối chiếu `expectedRevision` với `workingRevision` hiện tại trong Database:
  - Nếu khớp: Cập nhật thành công và tăng `workingRevision` lên 1 đơn vị.
  - Nếu không khớp: Từ chối giao dịch, trả về HTTP status `409 Conflict`.

### 2.3. Cấu trúc phản hồi lỗi

HTTP status là tín hiệu bắt buộc để client xử lý lỗi. Các lỗi miền nghiệp vụ của Từ điển kỹ thuật có contract ổn định dạng:

```json
{
  "code": "TD_COLUMN_ALREADY_DECLARED",
  "message": "Column 'ipcas.core.public.customer.customer_id' is already declared in the Technical Dictionary"
}
```

Các lỗi nền tảng/validation kế thừa OpenMetadata có thể dùng envelope chung của server và chứa `message` hoặc `responseMessage`. Client không được giả định mọi lỗi đều có `timestamp`, `path` hoặc `errorCode`; phải ưu tiên HTTP status, sau đó đọc `code` (nếu có) và thông điệp lỗi.

### 2.4. Bảng mã phản hồi HTTP (HTTP Status Codes)
| HTTP Code | Mã lỗi chuẩn | Ý nghĩa & Ngữ cảnh áp dụng |
| :--- | :--- | :--- |
| **200 OK** | `SUCCESS` | Yêu cầu đọc/xử lý thành công. |
| **201 Created** | `CREATED` | Khởi tạo thành công bản ghi mới (Identity, Version). |
| **400 Bad Request** | `INVALID_PAYLOAD` / `MISSING_PARAM` | Thiếu tham số bắt buộc, sai kiểu dữ liệu, vi phạm ràng buộc miền giá trị. |
| **401 Unauthorized** | `AUTH_TOKEN_EXPIRED` / `UNAUTHORIZED` | Thiếu hoặc token JWT không hợp lệ/hết hạn. |
| **403 Forbidden** | `PERMISSION_DENIED` | Người dùng không đủ quyền thực hiện thao tác (Maker duyệt bài, Consumer xem Draft). |
| **404 Not Found** | `ENTITY_NOT_FOUND` | Không tìm thấy entity, hoặc bản ghi ở trạng thái người dùng không có quyền nhìn thấy. |
| **409 Conflict** | `OPTIMISTIC_LOCK_CONFLICT` / `DUPLICATE_KEY` | Xung đột phiên bản khóa lạc quan hoặc trùng lặp mã duy nhất trong cùng Scope. |
| **413 Payload Too Large** | `FILE_SIZE_EXCEEDED` | File tải lên vượt giới hạn: CDE import tối đa 5 MiB/5.000 dòng; Technical Dictionary import tối đa 20 MiB/70.000 dòng. |
| **503 Service Unavailable** | `TD_INDEX_UNAVAILABLE` | Search index riêng của Từ điển kỹ thuật không sẵn sàng; không tự động fallback sang truy vấn toàn bộ PostgreSQL. |
| **500 Internal Server Error** | `INTERNAL_SERVER_ERROR` | Lỗi máy chủ nội bộ không mong muốn. Không để lộ stack trace ra client. |

### 2.5. Phạm vi danh mục API as-built

Danh mục tại các mục 3-5 đã được đối chiếu với JAX-RS resource hiện tại (`GlossaryResource`, `GlossaryTermResource`, `TechnicalDictionaryResource`, `TechnicalDictionaryImportResource`) và Swagger được build từ source. Đây là contract tích hợp cho ba phân hệ governed, không phải bản sao toàn bộ API glossary upstream của OpenMetadata.

Một số route upstream vẫn xuất hiện trong Swagger nhưng không thuộc contract này. Đặc biệt, direct `PATCH /api/v1/glossaries/{id}`, direct `PATCH /api/v1/glossaryTerms/{id}`, `PUT` upsert và native bulk create bị backend từ chối đối với luồng governed; client phải dùng `/working`, workflow hoặc import nguyên tử được mô tả trong tài liệu. Các API native history, vote, relation, move, delete/restore và CSV upstream chỉ được dùng khi có đặc tả nghiệp vụ riêng, không được suy ra là API của ba phân hệ này chỉ vì route xuất hiện trong Swagger.

---

## 3. PHÂN HỆ 1: TỪ ĐIỂN DỮ LIỆU DÙNG CHUNG (CDE / DATA DICTIONARY)

Phân hệ quản lý duy nhất một thực thể Từ điển dữ liệu nghiệp vụ (`Data Dictionary`) đóng vai trò là Scope cha, và các Thành tố dữ liệu dùng chung (`CDE`) là các nút con trực tiếp.

| Trạng thái hiện tại | Thao tác | Trạng thái tiếp theo | Ghi chú |
| :--- | :--- | :--- | :--- |
| Chưa tồn tại | Tạo mới `N.0` hoặc nâng phiên bản `N.MINOR` | `Draft` | Người đề xuất thực hiện theo quyền `W`. |
| `Draft` | `submit` | `In Review` | Gửi người phê duyệt xem xét. |
| `In Review` | `approve` | `Approved` | Người phê duyệt thực hiện theo quyền `A`. |
| `In Review` | `reject` | `Rejected` | Chỉ áp dụng khi policy từ chối đã được nghiệp vụ phê duyệt riêng. |
| `In Review` | `reopen` | `Draft` | Runtime hỗ trợ; quyền sử dụng phải được phê duyệt riêng. |
| `Rejected` | `reopen` | `Draft` | Mở lại soạn thảo. |
| `Approved` | Chuyển sang Scope Data Dictionary mới | `Archived` | Bản phát hành cũ trở thành lịch sử chỉ đọc. |

Contract JSON chính thức sử dụng giá trị `"In Review"`, tương ứng với `EntityStatus.IN_REVIEW` ở Java và `EntityStatus.InReview` ở TypeScript. `Pending` không phải trạng thái workflow hợp lệ; giá trị lưu trữ nội bộ không phải contract công khai.

### 3.1. Nhóm API Quản lý Scope Từ điển Dữ liệu (Glossary Level)

#### API 3.1.1: Lấy danh sách Từ điển dữ liệu (Sidebar/List)
- **Method & Endpoint:** `GET /api/v1/glossaries`
- **Mô tả:** Backend hiện chỉ trả hai governed glossary `Data Dictionary` và `Data Quality`; glossary `Technical Dictionary` không nằm trong danh sách này.
- **Query Parameters:**
  - `fields` (string, tùy chọn): Danh sách trường quan hệ cần nạp (ví dụ: `owners,tags,reviewers`).
  - `limit` (integer, mặc định `10`, miền kiểm tra hiện tại `0..1.000.000`): Số lượng bản ghi mỗi trang.
  - `before`, `after` (string, tùy chọn): Cursor phân trang; không dùng `offset` tại endpoint này.
  - `include` (string, mặc định `non-deleted`): `all`, `deleted` hoặc `non-deleted`.
- **Quy tắc phân quyền:**
  - `Consumer-only`: Chỉ trả về thực thể nếu có bản ghi `Approved`. Nếu chỉ có bản `Draft`, trả về danh sách rỗng.
  - User có `canViewWorking=true`: Trả về thực thể kèm bản ghi nháp hiện hành trong phạm vi được cấp.
- **Mẫu Request:**
  ```http
  GET /api/v1/glossaries?fields=owners,tags HTTP/1.1
  Host: localhost:8585
  Authorization: Bearer <TOKEN>
  ```
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
        "name": "Data Dictionary",
        "displayName": "Từ điển dữ liệu dùng chung",
        "fullyQualifiedName": "Data Dictionary",
        "versioningMode": "BusinessWorkflow",
        "businessVersion": "1",
        "entityStatus": "Approved",
        "owners": [
          {
            "id": "2d242416-65bb-4aa7-9252-87da77ec23f8",
            "type": "team",
            "name": "TrungTamQuanLyDuLieu",
            "displayName": "Trung tâm Quản lý Dữ liệu"
          }
        ]
      }
    ],
    "paging": {
      "total": 1
    }
  }
  ```

---

#### API 3.1.2: Lấy chi tiết Từ điển theo FQN
- **Method & Endpoint theo FQN:** `GET /api/v1/glossaries/name/{glossaryFqn}`
- **Endpoint tương đương theo ID:** `GET /api/v1/glossaries/{id}`
- **Path Parameters:**
  - `glossaryFqn` (string): FQN của Từ điển dữ liệu (ví dụ: `Data Dictionary`).
  - `id` (UUID): ID identity của governed glossary khi dùng endpoint theo ID.
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
    "name": "Data Dictionary",
    "displayName": "Từ điển dữ liệu dùng chung",
    "fullyQualifiedName": "Data Dictionary",
    "businessVersion": "1",
    "entityStatus": "Approved",
    "description": "Từ điển dữ liệu nghiệp vụ dùng chung toàn hệ thống Agribank.",
    "owners": [
      {
        "id": "2d242416-65bb-4aa7-9252-87da77ec23f8",
        "type": "team",
        "name": "TrungTamQuanLyDuLieu",
        "displayName": "Trung tâm Quản lý Dữ liệu"
      }
    ]
  }
  ```

Quyền hiệu lực không nằm trong response này. Client lấy riêng qua `GET /api/v1/glossaries/{id}/permissions`; response là object boolean phẳng gồm `canViewWorking`, `canViewPublished`, `canEditWorking`, `canSubmit`, `canCreateVersion`, `canApprove`, `canReject`, `canArchive`, `canImportCdeDrafts`, `isConsumer`.

---

#### API 3.1.3: Lấy bản Approved mới nhất của Từ điển
- **Method & Endpoint:** `GET /api/v1/glossaries/{id}/published/latest`
- **Path Parameters:**
  - `id` (UUID): ID định danh của Từ điển dữ liệu.
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
    "name": "Data Dictionary",
    "displayName": "Từ điển dữ liệu dùng chung",
    "businessVersion": "1",
    "entityStatus": "Approved",
    "publishedAt": 1767254400000,
    "publishedBy": "admin"
  }
  ```

---

#### API 3.1.4: Lấy danh sách các phiên bản Approved đã phát hành
- **Method & Endpoint:** `GET /api/v1/glossaries/{id}/published`
- **Mẫu Phản hồi (200 OK):** Backend trả trực tiếp JSON array.
  ```json
  [
      {
        "businessVersion": "1",
        "entityStatus": "Approved",
        "publishedAt": 1767254400000
      }
  ]
  ```

---

#### API 3.1.5: Lấy chi tiết phiên bản Approved cụ thể
- **Method & Endpoint:** `GET /api/v1/glossaries/{id}/published/{businessVersion}`
- **Path Parameters:**
  - `id` (UUID): ID Từ điển.
  - `businessVersion` (string): Số hiệu phiên bản (ví dụ: `1`).
- **Mẫu Phản hồi (200 OK):** Tương tự API 3.1.3.

---

#### API 3.1.6: Lấy bản ghi nháp hiện hành (Draft/Working) của Từ điển
- **Method & Endpoint:** `GET /api/v1/glossaries/{id}/working`
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
    "name": "Data Dictionary",
    "displayName": "Từ điển dữ liệu dùng chung",
    "businessVersion": "2",
    "entityStatus": "Draft",
    "workingRevision": 3,
    "description": "Từ điển dữ liệu dùng chung áp dụng cho kỳ kế hoạch 2026-2027."
  }
  ```

---

#### API 3.1.7: Xem trước CDE sẽ tự động phát hành khi Cutover (Publish Preview)

> **Lưu ý:** Response bổ sung `technicalDictionary: { declaredColumns, mappedColumns }` để cảnh báo số cột Từ điển kỹ thuật sẽ bị làm mới khi phê duyệt (mục 5.6).
- **Method & Endpoint:** `GET /api/v1/glossaries/{id}/working/publish-preview?limit={n}&after={cursor}`
- **Mô tả:** Trả về danh sách revision CDE `Approved` trong scope mới sẽ được công bố. `limit` từ 1 đến 100; `after` là cursor do server trả.
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "data": [
      {
        "termId": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
        "termSnapshotId": "b95bfc06-02a1-4f46-bbe7-a82b91f0252d",
        "termBusinessVersion": "2.0",
        "displayOrder": 0
      }
    ],
    "paging": {"after": "25"},
    "termCount": 1420,
    "evaluatedAt": 1790640000000
  }
  ```

---

#### API 3.1.8: Lưu nháp Từ điển dữ liệu tại chỗ (In-place Save Draft)
- **Method & Endpoint:** `PATCH /api/v1/glossaries/{id}/working`
- **Mẫu Request Body:**
  ```json
  {
    "expectedRevision": 3,
    "payload": {
      "description": "Cập nhật định hướng quản trị từ điển dữ liệu kỳ 2.",
      "owners": [],
      "reviewers": [],
      "domains": [],
      "tags": []
    }
  }
  ```
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
    "workingRevision": 4,
    "updatedAt": 1790661300000
  }
  ```

---

#### API 3.1.9: Thao tác Vòng đời Từ điển dữ liệu (Workflow Actions)
- **Method & Endpoint chuyển trạng thái:** `POST /api/v1/glossaries/{id}/working/{action}`
- **Endpoint tạo version kế tiếp:** `POST /api/v1/glossaries/{id}/working` với body `{"businessVersion":"N+1"}`.
- **Path Actions:**
  - `submit`: Gửi thẩm định toàn bộ Scope từ điển (`Draft` → `In Review`).
  - `approve`: Glossary working bắt buộc đang `In Review`. Trong một transaction, backend phát hành
    toàn bộ working term thuộc đúng glossary/scope (không kiểm tra trạng thái riêng của từng term),
    tạo manifest và phát hành glossary. Khi glossary là `Data Dictionary`, transaction đồng thời
    chụp/reset Từ điển kỹ thuật theo mục 5.6; thao tác này không phải phê duyệt từng record kỹ thuật.
  - `reject`: Từ chối thẩm định (`In Review` → `Rejected`).
  - `reopen`: Mở lại bản nháp để chỉnh sửa (`Rejected` → `Draft`).
- **Mẫu Request (Approve Cutover):**
  ```http
  POST /api/v1/glossaries/e305e5d3-883a-44ba-8ca4-f655848bb21f/working/approve HTTP/1.1
  Host: localhost:8585
  Authorization: Bearer <TOKEN>
  Content-Type: application/json

  {"expectedRevision": 4}
  ```
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
    "businessVersion": "2",
    "entityStatus": "Approved",
    "snapshotId": "3b581a70-c52d-4c35-9df9-e038d4971515",
    "publicationSequence": 2,
    "publishedAt": 1790661300000,
    "publishedBy": "checker@example.com"
  }
  ```

---

#### API 3.1.10: Danh sách term trong snapshot và thu hồi bản phát hành

```http
GET  /api/v1/glossaries/{id}/published/{businessVersion}/terms
POST /api/v1/glossaries/{id}/published/latest/archive
```

- `GET .../terms` trả trực tiếp JSON array các revision term thuộc manifest của snapshot glossary. Với snapshot mới nhất chưa archive và actor không phải consumer-only, backend còn ghép các working term cùng scope vào kết quả.
- `POST .../archive` không có request body. Endpoint yêu cầu `canArchive=true`, archive bản published mới nhất và tạo lại một working record trạng thái `Rejected` để sửa đổi. Ma trận nghiệp vụ nguồn không mặc nhiên cấp thao tác này; chỉ sử dụng khi quyền thu hồi được phê duyệt riêng.

---

### 3.2. Nhóm API Quản lý CDE (Critical Data Elements)

#### Schema 16 Thuộc tính chuẩn của CDE:

<!-- DOCX_LAYOUT: Bảng dưới đây nên được đặt trên trang khổ ngang. -->
| STT | Tên trường API | Tên hiển thị tiếng Việt | Kiểu dữ liệu | Bắt buộc | Mô tả & Ràng buộc giá trị |
| :---: | :--- | :--- | :--- | :---: | :--- |
| 1 | `name` | Mã CDE | `string` | **Có** | Mã định danh duy nhất (ví dụ: `CDE_CUST_ID`). Không dấu, không khoảng trắng. |
| 2 | `domains` | Khối / Miền nghiệp vụ | `Array<string>` khi create; `Array<EntityReference>` khi đọc/cập nhật | Không | Danh sách Domain phân cấp trong hệ thống. |
| 3 | `displayName` | Tên thuật ngữ nghiệp vụ | `string` | Không theo JSON Schema hiện tại | Tên chuẩn hóa tiếng Việt (ví dụ: `Mã khách hàng`). |
| 4 | `tags` (Data Source) | Hệ thống nguồn | `Array<Tag>` | Không | Tag thuộc Classification `DataSource` (ví dụ: `CoreBanking`). |
| 5 | `description` | Ý nghĩa nghiệp vụ | `markdown` | **Có** | Định nghĩa chi tiết ý nghĩa và mục đích sử dụng. |
| 6 | `extension.entityRelationship` | Mối quan hệ với thực thể | `markdown` | Không | Quan hệ liên kết logic giữa thực thể CDE với các đối tượng dữ liệu khác. |
| 7 | `owners` | Chủ sở hữu dữ liệu | `Array<EntityReference>` | Không | Nhóm (Team) hoặc cá nhân (User) phụ trách sở hữu dữ liệu. |
| 8 | `tags` (Classification) | Phân loại dữ liệu | `Array<Tag>` | Không | Nhãn bảo mật (Công khai, Nội bộ, Bảo mật, Tối mật). |
| 9 | `tags` (Personal Data) | Dữ liệu cá nhân | `Array<Tag>` | Không | Phân loại dữ liệu định danh khách hàng (PII). |
| 10 | `extension.relatedRegulatoryDocuments` | Văn bản quy định liên quan | `markdown` | Không | Căn cứ văn bản, luật định, thông tư của NHNN hoặc nội bộ ban hành. |
| 11 | `extension.dataQualityRules` | Quy định chất lượng dữ liệu | `Array<string>` | Không theo JSON Schema hiện tại | Danh sách 1 giá trị: `["Y"]` (Có) hoặc `["N"]` (Không). |
| 12 | `businessVersion` | Phiên bản | `string` | **Auto** khi tạo CDE đầu tiên; bắt buộc ở API tạo minor | Số hiệu phiên bản nghiệp vụ dạng `N.MINOR` (ví dụ: `1.0`, `1.1`). |
| 13 | `extension.releaseVersionType` | Loại phiên bản phát hành | `Array<string>` | **Auto** | Hệ thống tự tính: `Bản chính` nếu là `N.0`, `Bản phụ` nếu là `N.MINOR` với `MINOR ≥ 1`. |
| 14 | `extension.releaseLevel` | Cấp phát hành | `Array<string>` | Không theo JSON Schema hiện tại | Danh sách một giá trị: `CEO` (Tổng Giám đốc) hoặc `TTQLDL` (Trung tâm QLDL). |
| 15 | `extension.effectiveDate` | Ngày hiệu lực | `string (date)` | Không | Định dạng chuẩn `yyyy-MM-dd`. |
| 16 | `extension.expirationDate` | Ngày hết hiệu lực | `string (date)` | Không | Định dạng `yyyy-MM-dd`. Ràng buộc: không sớm hơn `effectiveDate`. |

Ngoài 16 thuộc tính nghiệp vụ trên, `POST /api/v1/glossaryTerms` bắt buộc có `glossary`, `name`, `description`, `parentBusinessVersion`. Client không gửi `businessVersion` khi tạo CDE đầu tiên; backend sinh phiên bản `N.0`. Các trường được nghiệp vụ yêu cầu nhưng JSON Schema chưa đánh dấu bắt buộc phải được coi là khoảng trống validation cần xử lý, không được mô tả là backend đã cưỡng chế.

---

#### API 3.2.1: Truy vấn danh sách CDE dạng phẳng (Flat List Table)
- **Method & Endpoint:** `GET /api/v1/glossaryTerms`
- **Query Parameters:**
  - `glossary` (UUID, bắt buộc): ID Từ điển.
  - `parentBusinessVersion` (string, bắt buộc): Scope kỳ quản trị (ví dụ: `1`, `2`).
  - `limit` (integer, mặc định `10`, chỉ nhận `10`, `15`, `25`, `50`), `offset` (integer, mặc định `0`, phải `>= 0`).
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
        "name": "CDE_CUST_ID",
        "displayName": "Mã khách hàng",
        "fullyQualifiedName": "Data Dictionary.CDE_CUST_ID@v1",
        "parentBusinessVersion": "1",
        "businessVersion": "1.0",
        "entityStatus": "Approved",
        "recordType": "published",
        "description": "Mã định danh duy nhất của khách hàng trên toàn hệ thống Agribank.",
        "extension": {
          "releaseVersionType": ["Bản chính"],
          "releaseLevel": ["CEO"],
          "dataQualityRules": ["Y"],
          "effectiveDate": "2026-01-01",
          "expirationDate": "2030-12-31"
        },
        "owners": [
          {
            "id": "2d242416-65bb-4aa7-9252-87da77ec23f8",
            "type": "team",
            "name": "KhoiQLRR",
            "displayName": "Khối Quản lý Rủi ro"
          }
        ]
      }
    ],
    "paging": {
      "total": 1250,
      "limit": 25,
      "offset": 0
    }
  }
  ```

---

#### API 3.2.2: Tìm kiếm và Lọc CDE theo đa tiêu chí (Authoritative Search & Filter)
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/search`
- **Query Parameters:** `glossary`, `parentBusinessVersion`, `q`, `statuses`, `domainIds`, `ownerIds`, `dataSourceTags`, `classificationTags`, `sortField`, `sortOrder`, `limit`, `offset`. `limit` mặc định `50` và chỉ nhận `10`, `15`, `25`, `50`; `offset` mặc định `0`.
- **Mẫu Phản hồi (200 OK):** Cùng định dạng với API 3.2.1.

---

#### API 3.2.3: Lấy representation hiện hành theo Identity FQN
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/name/{identityFqn}`
- **Path Parameters:**
  - `identityFqn`: FQN identity lưu trong `glossary_term_entity`, ví dụ `Data Dictionary.CDE_CUST_ID`.
- **Mẫu Phản hồi (200 OK):** Trả working representation cho actor có quyền nếu working tồn tại; nếu không trả latest published. Response có thể project `fullyQualifiedName` dạng scoped `Data Dictionary.CDE_CUST_ID@v1`.

Không dùng scoped FQN trong response để lookup identity. Deep link cần version chính xác phải mang `termId`, `businessVersion`, `parentBusinessVersion` và gọi API `/published/{businessVersion}` hoặc `/working` tương ứng.

---

#### API 3.2.4: Lấy danh sách các phiên bản Approved của CDE trong Scope
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/{id}/published?parentBusinessVersion={N}`
- **Mẫu Phản hồi (200 OK):** Backend trả trực tiếp một JSON array, không bọc trong `{ "data": ... }`.
  ```json
  [
      {
        "businessVersion": "1.1",
        "entityStatus": "Approved",
        "extension": {"releaseVersionType": ["Bản phụ"]},
        "publishedAt": 1773565200000
      },
      {
        "businessVersion": "1.0",
        "entityStatus": "Approved",
        "extension": {"releaseVersionType": ["Bản chính"]},
        "publishedAt": 1767254400000
      }
  ]
  ```

---

#### API 3.2.5: Lấy chi tiết phiên bản Approved cụ thể của CDE
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/{id}/published/{businessVersion}?parentBusinessVersion={N}`
- **Mẫu Phản hồi (200 OK):** Trả về snapshot bất biến của CDE tại phiên bản tương ứng.

---

#### API 3.2.6: Lấy bản nháp hiện hành (Draft/Working) của CDE
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/{id}/working?parentBusinessVersion={N}`
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
    "name": "CDE_CUST_ID",
    "displayName": "Mã khách hàng",
    "parentBusinessVersion": "1",
    "businessVersion": "1.2",
    "entityStatus": "Draft",
    "workingRevision": 2,
    "description": "Bản nháp cập nhật mô tả quy định liên quan."
  }
  ```

---

#### API 3.2.7: Tạo mới CDE (Bản khởi tạo `N.0`)
- **Method & Endpoint:** `POST /api/v1/glossaryTerms`
- **Mẫu Request Body:**
  ```json
  {
    "glossary": "Data Dictionary",
    "parentBusinessVersion": "1",
    "name": "CDE_ACC_NO",
    "displayName": "Số tài khoản thanh toán",
    "description": "Số tài khoản thanh toán nội bảng của khách hàng mở tại Agribank.",
    "extension": {
      "releaseLevel": ["TTQLDL"],
      "dataQualityRules": ["Y"],
      "effectiveDate": "2026-03-01",
      "entityRelationship": "Liên kết 1-N với bảng Thông tin khách hàng",
      "relatedRegulatoryDocuments": "Thông tư 23/2014/TT-NHNN"
    },
    "tags": [
      {
        "tagFQN": "DataSource.CoreBanking",
        "source": "Classification"
      },
      {
        "tagFQN": "SecurityClassification.Confidential",
        "source": "Classification"
      }
    ]
  }
  ```
- **Mẫu Phản hồi (201 Created):**
  ```json
  {
    "id": "a9812e11-1244-4902-8812-78129aa123bb",
    "name": "CDE_ACC_NO",
    "displayName": "Số tài khoản thanh toán",
    "parentBusinessVersion": "1",
    "businessVersion": "1.0",
    "entityStatus": "Draft",
    "workingRevision": 1
  }
  ```

---

#### API 3.2.8: Nâng phiên bản CDE mới (`N.MINOR`)
- **Method & Endpoint:** `POST /api/v1/glossaryTerms/{id}/working`
- **Mẫu Request Body:**
  ```json
  {
    "parentBusinessVersion": "1",
    "businessVersion": "1.1"
  }
  ```
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
    "parentBusinessVersion": "1",
    "businessVersion": "1.1",
    "entityStatus": "Draft",
    "workingRevision": 1
  }
  ```

---

#### API 3.2.9: Lưu nháp CDE tại chỗ (In-place Save Draft)
- **Method & Endpoint:** `PATCH /api/v1/glossaryTerms/{id}/working?parentBusinessVersion={N}`
- **Mẫu Request Body:**
  ```json
  {
    "expectedRevision": 1,
    "displayName": "Mã khách hàng chuẩn hóa",
    "description": "Ý nghĩa nghiệp vụ được cập nhật lại chuẩn mực hơn.",
    "owners": [],
    "domains": [],
    "tags": [],
    "relatedTerms": [],
    "extension": {
      "releaseLevel": ["CEO"],
      "dataQualityRules": ["Y"],
      "effectiveDate": "2026-01-01",
      "expirationDate": "2032-12-31"
    }
  }
  ```
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
    "workingRevision": 2,
    "updatedAt": 1790661600000
  }
  ```

---

#### API 3.2.10: Chuyển trạng thái Workflow CDE (Maker - Checker)
- **Method & Endpoint:** `POST /api/v1/glossaryTerms/{id}/working/{action}?parentBusinessVersion={N}`
- **Path Actions:** `submit`, `approve`, `reject`, `reopen`.
- **Lưu ý phân quyền:** `reject` và `reopen` tồn tại trong runtime nhưng không được ma trận nghiệp vụ nguồn mặc nhiên cấp; chỉ bật khi có phê duyệt nghiệp vụ/policy riêng.
- **Mẫu Request Body:**
  ```json
  {"expectedRevision": 2}
  ```
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
    "entityStatus": "In Review",
    "workingRevision": 3,
    "submittedAt": 1790640000000,
    "submittedBy": "maker@example.com"
  }
  ```

---

#### API 3.2.10a: Sửa phiên bản Approved (tạo bản nháp sửa)
- **Method & Endpoint:** `POST /api/v1/glossaryTerms/{id}/published/{businessVersion}/correction?parentBusinessVersion={N}`
- **Request Body:** không có.
- **Hành vi:** Tạo working `Draft` cùng `businessVersion`, payload sao chép từ snapshot Approved đó. Bản nháp đi qua `submit`/`approve`/`reject`/`reopen` như API 3.2.10. Khi `approve`, backend chép nội dung cũ sang bảng lịch sử rồi ghi đè snapshot, giữ nguyên `snapshotId` và published head (thiết kế CDE §5.6). Áp dụng cho CDE và DQ Rule.
- **Mã lỗi:** `403` thiếu `CreateVersion`; `404` version không thuộc scope; `409` version đã Archived, CDE đã có working version, hoặc tạo đồng thời.
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "id": "c1f7a4e2-623b-4830-a15d-5ff36f2f3981",
    "businessVersion": "1.1",
    "parentBusinessVersion": "1",
    "entityStatus": "Draft",
    "workingRevision": 1,
    "capabilities": { "canEditWorking": true, "canSubmit": true }
  }
  ```

#### API 3.2.10b: Lịch sử nội dung đã bị ghi đè của một version
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/{id}/published/{businessVersion}/history?parentBusinessVersion={N}`
- **Hành vi:** Danh sách nội dung Approved trước các lần sửa, mới nhất trước. Quyền xem như API chi tiết bản phát hành.
- **Mẫu Phản hồi (200 OK):**
  ```json
  [
    {
      "historyId": "5b0c...",
      "snapshotId": "9e1d...",
      "businessVersion": "1.1",
      "contentHash": "ab12...",
      "publishedAt": 1790640000000,
      "publishedBy": "checker@example.com",
      "supersededAt": 1790726400000,
      "supersededBy": "checker2@example.com",
      "displayName": "Mã chi nhánh"
    }
  ]
  ```

> Không còn endpoint hủy duyệt: `POST /api/v1/glossaries/{id}/published/latest/archive` và `POST /api/v1/glossaryTerms/{id}/published/latest/archive` đã bị gỡ.

---

#### API 3.2.11: Lấy ma trận quyền thao tác trên CDE (Version Permissions)
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/{id}/permissions`
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "canViewPublished": true,
    "canViewWorking": true,
    "canEditWorking": true,
    "canSubmit": true,
    "canCreateVersion": true,
    "canApprove": false,
    "canReject": false,
    "canArchive": false,
    "canImportCdeDrafts": true,
    "isConsumer": false
  }
  ```

---

#### API 3.2.12: Lấy danh sách Tài sản metadata liên kết (Tab Assets)

> **Lưu ý:** Tab Assets của CDE dùng `GET /api/v1/glossaryTerms/{id}/technicalAssets` (mục 5.5): danh sách cột hiện hành khi phiên bản DD của CDE đang hiệu lực, bản chụp tại thời điểm cutover khi đã bị thay thế. Endpoint dưới đây (tìm theo tag) không còn được UI dùng cho CDE.
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/{id}/assets?limit=15&offset=0`
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "89ab12cd-ef34-5678-9012-123456789abc",
        "entityType": "table",
        "name": "CUSTOMER",
        "fullyQualifiedName": "CoreBanking.COREDB.dbo.CUSTOMER",
        "description": "Bảng thông tin khách hàng gốc",
        "columnName": "CUST_ID"
      }
    ],
    "paging": {
      "total": 12
    }
  }
  ```

---

#### API 3.2.13: Latest published, thu hồi và workflow hàng loạt

```http
GET  /api/v1/glossaryTerms/{id}/published/latest
POST /api/v1/glossaryTerms/{id}/published/latest/archive
POST /api/v1/glossaryTerms/bulk/{submit|approve|reject}
```

- `GET .../published/latest` chỉ áp dụng cho CDE thuộc `Data Dictionary` và trả representation Approved mới nhất.
- `POST .../archive` không có body, yêu cầu `canArchive=true`; endpoint dùng chung cho governed CDE/DQ Rule và trả working representation trạng thái `Rejected`. Quyền này không được suy ra từ `A` nếu chưa được nghiệp vụ phê duyệt riêng.
- Bulk workflow dùng cho cả CDE và DQ Rule. Body chọn record bằng `termIds`, `criteria` hoặc kết hợp cả hai:

  ```json
  {
    "glossaryId": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
    "parentBusinessVersion": "2",
    "termIds": ["c1f7a4e2-623b-4830-a15d-5ff36f2f3981"],
    "criteria": {"statuses": "Draft", "q": "customer"},
    "dryRun": false,
    "offset": 0,
    "limit": 500
  }
  ```

`limit` bulk mặc định `500`, tối đa `1.000`. Mỗi record chạy trong transaction riêng; response báo `matched`, `eligible`, `attempted`, `succeeded`, `failedCount`, `failures`, `remaining`. Đây không phải thao tác nguyên tử toàn lô.

---

### 3.3. Nhóm API Xuất & Nhập Excel CDE (Export & Import)

Ma trận nguồn không định nghĩa quyền import/export riêng. Trong contract này, export yêu cầu `R` trên Từ điển dữ liệu nghiệp vụ; import preview/commit yêu cầu `W` và dữ liệu nhập phải đi qua phê duyệt `A` trước khi có hiệu lực. Không cấp import chỉ dựa trên role `Admin`, `DataConsumer` hoặc `BasicConsumer`.

#### API 3.3.1: Xuất dữ liệu CDE ra Excel (.xlsx)
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/export?glossary={glossaryId}&parentBusinessVersion={N}`
- **Headers:** `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Tên file tải về:** `Agribank_CDE_Danh_Tu_Dien_Du_Lieu_v{N}_YYYYMMDD_HHmm.xlsx`

---

#### API 3.3.2: Tải file mẫu Nhập CDE (Import Template)
- **Method & Endpoint:** `GET /api/v1/glossaryTerms/import/template`
- **Headers:** `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Mô tả:** Tải file Excel gồm đúng 14 cột nghiệp vụ chuẩn phục vụ soạn thảo nhập liệu hàng loạt.

---

#### API 3.3.3: Thẩm định và xem trước file Nhập (Import Preview)
- **Method & Endpoint:** `POST /api/v1/glossaryTerms/import/preview?glossary={id}&parentBusinessVersion={N}&existingCodePolicy={policy}`
- **Content-Type:** `multipart/form-data`
- **Parameters:** `existingCodePolicy` nhận `SKIP_EXISTING` hoặc `OVERWRITE_EXISTING`.
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "importSessionId": "89a3f2b4-7123-4567-8901-abcdef123456",
    "expiresAt": "2026-09-29T09:15:00.000Z",
    "fileHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "scope": {
      "glossaryId": "e305e5d3-883a-44ba-8ca4-f655848bb21f",
      "parentBusinessVersion": "2"
    },
    "existingCodePolicy": "OVERWRITE_EXISTING",
    "summary": {
      "total": 150,
      "CREATE": 120,
      "UPDATE_DRAFT": 30,
      "error": 0,
      "warning": 2
    },
    "rows": [
      {
        "rowNumber": 2,
        "cdeCode": "CDE_CUST_ID",
        "action": "UPDATE_DRAFT",
        "warnings": [],
        "errors": []
      }
    ],
    "canCommit": true
  }
  ```

---

#### API 3.3.4: Xác nhận Nhập dữ liệu nguyên tử (Atomic Commit)
- **Method & Endpoint:** `POST /api/v1/glossaryTerms/import/{importSessionId}/commit`
- **Mẫu Phản hồi (200 OK):**
  ```json
  {
    "importSessionId": "89a3f2b4-7123-4567-8901-abcdef123456",
    "committed": 150,
    "skipped": 0,
    "parentBusinessVersion": "2"
  }
  ```
- **Kênh tiến độ:** kết nối Socket.IO qua path `/api/v1/push/feed` với query `userId={currentUserId}`, sau đó lắng nghe event `cdeImportChannel`. Payload dùng `jobId={importSessionId}` để client lọc đúng phiên import; `cdeImportChannel` là tên event, không phải một WebSocket URL riêng.

---

## 4. PHÂN HỆ 2: DANH MỤC QUY TẮC CHẤT LƯỢNG DỮ LIỆU (DATA QUALITY - DQ GLOSSARY)

Phân hệ quản lý quy tắc CLDL nghiệp vụ bằng profile Governed Glossary `DATA_QUALITY`. Profile được backend xác định từ Glossary có tên hệ thống `Data Quality`; client **không gửi** query parameter `profile`.

Trừ khi một API ghi rõ khác đi, toàn bộ endpoint ở mục này kế thừa cơ chế bearer JWT tại mục 2.1, ma trận quyền `R/W/A` tại mục 2.1.5, khóa lạc quan tại mục 2.2 và contract lỗi tại mục 2.3-2.4. Các bảng route dạng rút gọn vẫn là contract về method, path và tham số; request/response dùng cùng schema Governed Glossary được mô tả tại mục 4.1.

### 4.1. Mô hình dữ liệu và ràng buộc

| Trường | Kiểu | Quy tắc |
| :--- | :--- | :--- |
| `name` | `string` | Mã quy tắc, duy nhất trong Data Quality Glossary. |
| `displayName` | `string/null` | Tên hiển thị của quy tắc. |
| `description` | `markdown` | Nội dung quy tắc nghiệp vụ. |
| `owners`, `domains` | `EntityReference[]` | Đơn vị sở hữu và miền dữ liệu. |
| `relatedTerms` / `versionedRelatedTerms` | `TermRelation[]` | Đúng một CDE chuẩn thuộc Data Dictionary cùng `parentBusinessVersion`. Chỉ gửi `term.id`; không gửi `versionContext`. Liên kết bao trùm mọi version `N.x` của CDE, nội dung CDE trong response được resolve theo bản `Approved` mới nhất của scope. |
| `tags` | `TagLabel[]` | Các nhóm `DataQualityDimension`, `DataQualityTargetPopulation`, `DataQualityMethod`, `DataQualityFrequency`. |
| `extension.ruleExplanation` | `string` | Diễn giải công thức/logic. |
| `extension.otherConstraints` | `string` | Ràng buộc hoặc ngoại lệ. |
| `extension.relatedRegulatoryDocuments` | `string` | Văn bản quy định liên quan. |
| `extension.qualityThreshold` | `string` | Ngưỡng đạt, ví dụ `>= 99.5%`. |
| `extension.releaseLevel` | `string[]` | Một cấp phát hành theo cấu hình nghiệp vụ. |
| `extension.effectiveDate`, `extension.expirationDate` | `yyyy-MM-dd` | Khoảng hiệu lực; ngày hết hiệu lực không trước ngày hiệu lực. |
| `extension.releaseVersionType` | `string[]` | Server-owned, suy từ `businessVersion`; client không gửi giá trị này. |

Một DQ Rule phải là con trực tiếp của Data Quality Glossary, phải có `name`, và phải tham chiếu đúng một CDE chuẩn. Backend kiểm tra lại CDE và scope; không tin `cdeCode`/`cdeName` lưu trong extension cũ.

### 4.2. API đọc danh sách, tìm kiếm và chi tiết

| Chức năng | Method và endpoint | Tham số chính |
| :--- | :--- | :--- |
| Flat list trong một scope | `GET /api/v1/glossaryTerms` | `glossary={dqGlossaryId}`, `parentBusinessVersion=N`; `limit` nhận `10`, `15`, `25` hoặc `50` (mặc định `10`); `offset >= 0` |
| Tìm kiếm/lọc | `GET /api/v1/glossaryTerms/search` | Các tham số trên cộng `q`, `statuses`, `domainIds`, `ownerIds`, `dataSourceTags`, `classificationTags`, `sortField`, `sortOrder`; `limit` mặc định `50` |
| Chi tiết hiện hành | `GET /api/v1/glossaryTerms/{id}` | `fields` tùy chọn; trả working nếu có quyền và tồn tại, nếu không trả latest published |
| Working version | `GET /api/v1/glossaryTerms/{id}/working` | `parentBusinessVersion=N` bắt buộc |
| Lịch sử published | `GET /api/v1/glossaryTerms/{id}/published` | `parentBusinessVersion=N` để giới hạn scope |
| Published cụ thể | `GET /api/v1/glossaryTerms/{id}/published/{businessVersion}` | `parentBusinessVersion=N` |
| Lịch sử sửa của một version | `GET /api/v1/glossaryTerms/{id}/published/{businessVersion}/history` | `parentBusinessVersion=N` |
| Tạo bản nháp sửa | `POST /api/v1/glossaryTerms/{id}/published/{businessVersion}/correction` | `parentBusinessVersion=N` bắt buộc |
| Quyền hiệu lực | `GET /api/v1/glossaryTerms/{id}/permissions` | Không có query `profile` |

Ví dụ:

```http
GET /api/v1/glossaryTerms/search?glossary=7bd5c86d-87ad-4d9c-b1b8-0e57b10be637&parentBusinessVersion=2&q=customer&statuses=Draft,In%20Review&classificationTags=DataQualityDimension.Accuracy&limit=25&offset=0
Authorization: Bearer <TOKEN>
```

Response flat-list/search có dạng `{ "data": [...], "paging": { "total", "limit", "offset" } }`. Consumer-only chỉ nhận representation published; người có `canViewWorking` có thể nhận working representation theo quyền từng record.

### 4.3. Tạo và cập nhật DQ Rule

#### 4.3.1. Tạo Draft đầu tiên

```http
POST /api/v1/glossaryTerms
Content-Type: application/json
```

```json
{
  "glossary": "Data Quality",
  "parentBusinessVersion": "2",
  "name": "DQ_ACC_STATUS_01",
  "displayName": "Kiểm tra trạng thái tài khoản",
  "description": "Trạng thái tài khoản phải thuộc tập giá trị hợp lệ.",
  "versionedRelatedTerms": [
    {
      "relationType": "relatedTo",
      "term": {
        "id": "a9812e11-1244-4902-8812-78129aa123bb",
        "type": "glossaryTerm"
      }
    }
  ],
  "tags": [
    {
      "tagFQN": "DataQualityDimension.Accuracy",
      "source": "Classification",
      "labelType": "Manual",
      "state": "Confirmed"
    }
  ],
  "owners": [],
  "domains": [],
  "extension": {
    "qualityThreshold": ">= 99.9%",
    "ruleExplanation": "ACCOUNT.STATUS IN ('ACTIVE','CLOSED')",
    "releaseLevel": ["TTQLDL"],
    "effectiveDate": "2026-10-01"
  }
}
```

Thành công trả `201 Created` với working representation, gồm `businessVersion`, `parentBusinessVersion`, `entityStatus="Draft"` và `workingRevision`.

#### 4.3.2. Tạo minor working version

```http
POST /api/v1/glossaryTerms/{id}/working
```

```json
{
  "businessVersion": "2.1",
  "parentBusinessVersion": "2"
}
```

Request chỉ nhận đúng hai trường trên; `comment`, `payload`, `expectedRevision` và trường identity bị từ chối.

#### 4.3.3. Lưu Draft tại chỗ

```http
PATCH /api/v1/glossaryTerms/{id}/working?parentBusinessVersion=2
```

```json
{
  "expectedRevision": 3,
  "displayName": "Kiểm tra trạng thái tài khoản",
  "description": "Nội dung đầy đủ sau chỉnh sửa.",
  "owners": [],
  "domains": [],
  "tags": [],
  "relatedTerms": [
    {
      "term": {
        "id": "a9812e11-1244-4902-8812-78129aa123bb",
        "type": "glossaryTerm"
      }
    }
  ],
  "extension": {
    "qualityThreshold": "100%",
    "otherConstraints": "Áp dụng từ quý IV/2026"
  }
}
```

Đây là **full mutable payload**, không có wrapper `payload`. `description`, `owners`, `domains`, `tags` và `expectedRevision` là bắt buộc theo JSON Schema. Backend tăng `workingRevision`; revision cũ trả `409 Conflict`.

### 4.4. Workflow

```http
POST /api/v1/glossaryTerms/{id}/working/{submit|approve|reject|reopen}?parentBusinessVersion=N
Content-Type: application/json

{"expectedRevision": 4}
```

Body chỉ cho phép `expectedRevision >= 1`; `comment` và mọi field khác bị từ chối. State machine hợp lệ: `Draft -> In Review`, `In Review -> Approved|Rejected`, `Rejected -> Draft`.

Workflow hàng loạt dùng endpoint `POST /api/v1/glossaryTerms/bulk/{submit|approve|reject}` và request/response tại API 3.2.13. Runtime hiện có cả `reject` và `reopen`; ma trận nghiệp vụ nguồn chỉ mặc nhiên quy định `W` và `A`, vì vậy quyền từ chối/thu hồi phải được nghiệp vụ phê duyệt riêng trước khi cấp policy.

### 4.5. Trạng thái import/export DQ hiện tại

As-built chưa có server API chuyên biệt cho DQ import/export. Cụ thể:

- `GET /api/v1/glossaryTerms/export` trả `400` khi Glossary profile là `DATA_QUALITY`.
- `/api/v1/glossaryTerms/import/template`, `/api/v1/glossaryTerms/import/preview` và `/api/v1/glossaryTerms/import/{sessionId}/commit` là contract dành cho CDE, không nhận `profile=DATA_QUALITY`.
- UI hiện tạo template/xuất Excel, đọc và kiểm tra file tại trình duyệt, sau đó gọi API create/update từng DQ Rule. Luồng này không phải atomic server transaction.

Hệ thống tích hợp không được gọi các endpoint DQ import/export giả định. Nếu cần import nguyên tử, phải bổ sung contract backend riêng trước khi công bố cho bên ngoài.

## 5. PHÂN HỆ 3: TỪ ĐIỂN KỸ THUẬT (TECHNICAL DICTIONARY)

Từ điển kỹ thuật **không có business version** nhưng có workflow maker-checker. Record mới đi qua
`Draft → In Review → Approved/Rejected`; sửa hoặc xóa record Approved dùng change request riêng để bản đang
có hiệu lực tiếp tục phục vụ Consumer. Chỉ approve mới thay đổi `technical_record`, search values và Column projection.

PostgreSQL (`technical_record`) là nguồn sự thật cho ghi; `technical_dictionary_search_index` là read model cho danh sách, lọc, thống kê và export. Mọi endpoint bên dưới **không có** tham số `glossary`, `parentBusinessVersion`, `versionView` hay `statuses`. Các endpoint `/api/v1/glossaries/{id}/working*`, `/api/v1/glossaries/{id}/published*`, `/api/v1/glossaryTerms/{id}/working*`, `/api/v1/glossaryTerms/{id}/published*`, `/api/v1/glossaryTerms/{id}/permissions` và `/api/v1/glossaryTerms/bulk/*` không còn áp dụng cho Từ điển kỹ thuật; `POST`/`DELETE /api/v1/glossaryTerms` trên glossary này không tạo/xóa record.

Toàn bộ endpoint mục 5 yêu cầu bearer JWT và trả lỗi theo mục 2.3-2.4. Quyền runtime `canView/canEdit/canImport/canExport` chỉ được dùng để mô tả và kiểm thử hành vi as-built; yêu cầu nghiệm thu vẫn là ma trận `R/W/A` tại mục 2.1.5 và các sai khác tại mục 5.1, mục 7.

### 5.1. Phân quyền

#### 5.1.1. Yêu cầu nghiệp vụ theo ma trận nguồn

Phân hệ này áp dụng nguyên ma trận phân quyền chuẩn tại mục 2.1.5: Admin System, Người phê duyệt, Người đề xuất và Người dùng TT QLDL có `R`; Người dùng các ban TSC/Chi nhánh không có quyền truy cập. Chỉ Người đề xuất có `W` và chỉ Người phê duyệt có `A`; Admin System không có `W` hoặc `A`. Dữ liệu do Người đề xuất tạo mới hoặc sửa đổi phải chờ Người phê duyệt phê duyệt trước khi có hiệu lực.

#### 5.1.2. Runtime hiện tại

API trả năm capability `canView`, `canEdit`, `canApprove`, `canImport`, `canExport`. Record mới và thay đổi
record Approved đều qua maker-checker; các sai khác RBAC tổ chức còn lại được theo dõi riêng ở mục 7.

| Sai khác | Hành vi hiện tại | Yêu cầu cần đạt trước nghiệm thu |
| :--- | :--- | :--- |
| Tách người đề xuất/người phê duyệt | Có `canEdit`/`canApprove`, submit/approve/reject và chặn tự duyệt | Tiếp tục kiểm thử policy để người phê duyệt thuần không nhận `canEdit` ngoài ý muốn |
| Phạm vi Admin System | OpenMetadata Admin có toàn quyền `canEdit` và `canImport` | Role quản trị nghiệp vụ chỉ có `C` đối với tài khoản/phân quyền và `R` đối với Từ điển kỹ thuật; không có `W` hoặc `A` |
| Phạm vi xem của Các Ban liên quan | `canView` được suy ra từ policy `ViewBasic` trên glossary `Technical Dictionary`; policy consumer dùng chung có thể làm lộ phân hệ | Policy theo phân hệ/tổ chức phải từ chối toàn bộ endpoint Từ điển kỹ thuật đối với user Các Ban liên quan |
| API `/{cdeId}/technicalAssets` | Endpoint hiện chỉ kiểm tra quyền nhìn thấy CDE qua `versionEntity`, chưa kiểm tra `TechnicalDictionaryAccess.canView` | Bắt buộc kiểm tra thêm quyền xem Từ điển kỹ thuật trước khi trả dữ liệu cột/mapping kỹ thuật |
| Hiệu lực thay đổi | Approved edit/delete tạo proposal; Consumer tiếp tục đọc bản Approved | Đã đáp ứng ở tầng dữ liệu/API; cần kiểm thử RBAC phủ định |

> **Cảnh báo về runtime:** Bảng capability hiện tại bên dưới chỉ mô tả runtime để tích hợp và kiểm thử sai khác; không phải ma trận nghiệp vụ được chấp thuận.

| Capability runtime hiện tại | Điều kiện hiện tại |
| :--- | :--- |
| `canEdit` | Admin, role `DataSteward`, hoặc policy `EditWorking` trên glossary `Technical Dictionary` (role `DataProposer` có policy này) |
| `canView` | `canEdit` hoặc policy `ViewBasic` trên glossary `Technical Dictionary` |
| `canApprove` | Admin, role `DataSteward`, hoặc policy `ApproveWorking` |
| `canImport` | Bằng `canEdit` |
| `canExport` | Bằng `canView` |

Consumer không nhận nội dung hoặc metadata proposal. Người có `canEdit`/`canApprove` thấy badge proposal và
đọc được diff qua change-request API. Mọi thao tác ghi được kiểm tra quyền lại ở server.

### 5.2. Ngữ cảnh và phiên bản DD đang gắn

```http
GET /api/v1/glossaryTerms/technical/context
```

```json
{
  "glossaryId": "72b9cc8a-b13b-43f2-9d7b-574f84993f94",
  "dataDictionaryVersion": "2",
  "previousDataDictionaryVersion": "1",
  "resetAt": 1790640000000,
  "resetBy": "admin",
  "capabilities": { "canView": true, "canEdit": true, "canImport": true, "canExport": true }
}
```

`dataDictionaryVersion` là `null` khi chưa có DD nào được phê duyệt; khi đó khai báo, sửa và import trả `409 TD_DATA_DICTIONARY_NOT_ACTIVE`.

### 5.3. Danh sách và thống kê

```http
GET /api/v1/glossaryTerms/technical/search
  ?q=customer
  &sourceServices=ipcas
  &cdeMapping=MAPPED
  &cdeTermIds={uuid},{uuid}
  &systemOwnerIds={uuid}
  &sourceStatuses=Available,Unavailable
  &elementTypes=DataElementType.AtomicDataElement
  &generationTypes=FieldGenerationType.SystemGenerated
  &creationMethods=DataCreationMethod.Parameterised
  &timeliness=DataTimeliness.T1
  &limit=25&offset=0
```

`limit` chỉ nhận `10`, `15`, `25`, `50`. Filter nhiều giá trị dùng CSV: OR trong một nhóm, AND giữa các nhóm. `cdeMapping` nhận `MAPPED`, `UNMAPPED`. Phân trang tối đa 10.000 kết quả đầu. Khi index không sẵn sàng: `503 TD_INDEX_UNAVAILABLE`, không fallback quét PostgreSQL.

Mỗi phần tử `data` là một dòng phẳng, cũng là hình dạng của `GET /api/v1/glossaryTerms/technical/records/{id}`, bản chụp và export:

```json
{
  "termId": "e3910764-2ddf-422c-9b51-b30b00b6873f",
  "columnKey": "3f1c…",
  "columnFqn": "ipcas.core.public.customer.customer_id",
  "service": "ipcas", "database": "core", "schema": "public", "table": "customer", "column": "customer_id",
  "dataType": "VARCHAR", "description": "Mã khách hàng",
  "sourceStatus": "Available",
  "dataDictionaryVersion": "2",
  "revision": 3,
  "cde": { "id": "a9812e11-…", "code": "CDE_CUSTOMER_ID", "name": "Mã khách hàng", "businessVersion": "2.1",
           "assignedAt": 1790640000000, "assignedBy": "steward" },
  "dataOwners": [{ "id": "…", "name": "Ban KHCL" }],
  "rank": 1,
  "elementType": { "fqn": "DataElementType.AtomicDataElement", "label": "Dữ liệu nguyên tố" },
  "generationType": { "fqn": "…", "label": "…" },
  "creationMethod": { "fqn": "…", "label": "…" },
  "timeliness": { "fqn": "DataTimeliness.T1", "label": "T+1" },
  "systemOwner": { "id": "…", "name": "Ban CNTT" },
  "createdAt": 1790640000000, "createdBy": "steward", "updatedAt": 1790640000000, "updatedBy": "steward"
}
```

`sourceStatus` là `Available` hoặc `Unavailable` (Column nguồn bị xóa hoặc đổi tên). Khối `cde` và `dataOwners` chỉ có khi đã gán CDE.

```http
GET /api/v1/glossaryTerms/technical/stats
```

```json
{ "totalColumns": 1250, "totalTables": 83, "totalSources": 6, "mapped": 940 }
```

### 5.4. Khai báo, sửa, xóa

```http
GET /api/v1/glossaryTerms/technical/columns?q=customer&limit=20     # canEdit; limit 1..50, mặc định 20
POST /api/v1/glossaryTerms/technical/records                        # canEdit
GET /api/v1/glossaryTerms/technical/records/{id}                    # canView
PATCH /api/v1/glossaryTerms/technical/records/{id}                  # canEdit
DELETE /api/v1/glossaryTerms/technical/records/{id}?expectedRevision=3   # canEdit
GET /api/v1/glossaryTerms/technical/records/{id}/history?limit=20&offset=0   # canView
POST   /api/v1/glossaryTerms/technical/records/{id}/change-request
GET    /api/v1/glossaryTerms/technical/records/{id}/change-request
PATCH  /api/v1/glossaryTerms/technical/records/{id}/change-request
DELETE /api/v1/glossaryTerms/technical/records/{id}/change-request?expectedRevision=1
POST   /api/v1/glossaryTerms/technical/records/{id}/change-request/submit
POST   /api/v1/glossaryTerms/technical/records/{id}/change-request/approve
POST   /api/v1/glossaryTerms/technical/records/{id}/change-request/reject
```

`POST` chỉ bắt buộc `columnFqn`; backend đọc Column từ `table_entity`:

```json
{
  "columnFqn": "ipcas.core.public.customer.customer_id",
  "cde": "a9812e11-1244-4902-8812-78129aa123bb",
  "rank": 1,
  "elementType": "DataElementType.AtomicDataElement",
  "generationType": "FieldGenerationType.SystemGenerated",
  "creationMethod": "DataCreationMethod.Parameterised",
  "timeliness": "DataTimeliness.T1",
  "systemOwnerId": "2d242416-65bb-4aa7-9252-87da77ec23f8"
}
```

`PATCH /records/{id}` gửi toàn bộ giá trị sửa được cho record chưa Approved. Gọi endpoint này với record
Approved trả `409 TD_APPROVED_EDIT_REQUIRES_CHANGE_REQUEST`. Với Approved, POST/PATCH change request lưu
payload riêng; search và Column projection tiếp tục dùng bản Approved. Chỉ `/change-request/approve` mới áp
dụng UPDATE hoặc DELETE trong transaction, sau khi kiểm tra `baseRevision`, maker-checker, CDE và Thứ hạng.

Quy tắc kiểm tra: `rank` từ `1` đến `999`; có `cde` thì bắt buộc có `rank`, không có `cde` thì `rank` phải trống; `cde` phải là CDE `Approved` của DD đang gắn; `rank` duy nhất trong cùng CDE trên các record `Available`; tag phải thuộc đúng classification (`DataElementType`, `FieldGenerationType`, `DataCreationMethod`, `DataTimeliness`); `systemOwnerId` là một Team tồn tại.

`history` trả `{data:[{id, action, actor, at, dataDictionaryVersion, changes:[{field, oldValue, newValue}]}], paging}` mới nhất trước. Ngoài action của record mới, vòng đời proposal dùng `CREATE_CHANGE`, `UPDATE_CHANGE`,
`SUBMIT_CHANGE`, `RESUBMIT_CHANGE`, `APPROVE_CHANGE`, `REJECT_CHANGE`, `CANCEL_CHANGE`, `RESET_CHANGE`.
Consumer không nhận các audit lifecycle chứa giá trị proposal chưa duyệt; `APPROVE_CHANGE` được phép xuất hiện
vì đây là thay đổi đã có hiệu lực.

### 5.5. Export, import, bản chụp

```http
GET  /api/v1/glossaryTerms/technical/export
GET  /api/v1/glossaryTerms/import/technical/template
POST /api/v1/glossaryTerms/import/technical/preview          # multipart/form-data, part "file"
POST /api/v1/glossaryTerms/import/technical/{importSessionId}/commit
GET  /api/v1/glossaryTerms/technical/snapshots
GET  /api/v1/glossaryTerms/technical/snapshots/{dataDictionaryVersion}/export
GET  /api/v1/glossaryTerms/technical/snapshots/{dataDictionaryVersion}/records
GET  /api/v1/glossaryTerms/{cdeId}/technicalAssets?limit=15&offset=0
POST /api/v1/glossaryTerms/technical/index/rebuild           # Admin
```

- **Export**: file `TuDienKyThuat_Agribank_TDDLv{N}_YYYYMMDD_HHmm.xlsx`, sheet `Technical Dictionary`, 16 cột. Bản chụp: `TuDienKyThuat_Agribank_TDDLv{K}_banchup_YYYYMMDD_HHmm.xlsx`, cùng 16 cột, chỉ có cột đã gán CDE; Mã/Tên CDE lấy từ lúc chụp.
- **Import**: không có `updatePolicy`. Mỗi dòng match theo `Tên cơ sở dữ liệu + Tên Schema + Tên Bảng + Tên cột` (và `Nguồn` nếu có). `CREATE_RECORD` tạo record Draft; `UPDATE` trên record Approved tạo/cập nhật change request Draft và không đổi projection. Import không tự submit/approve. Proposal InReview trở thành lỗi của dòng ngay ở preview; session ghim cả record revision và change-request revision nên proposal thay đổi sau preview không bị ghi đè. Session gắn actor và `dataDictionaryVersion`, dùng một lần, hết hạn sau 30 phút; commit nguyên tử, kiểm tra lại quyền và revision từng dòng. File tối đa 20 MiB, 70.000 dòng, 32.000 ký tự/ô.
- **`snapshots`**: `{data:[{dataDictionaryVersion, bindings, frozenAt}]}`, mới nhất trước. Bản chụp giữ vĩnh viễn, không có API xóa.
- **`snapshots/{dataDictionaryVersion}/records`**: xem bản chụp trên bảng, chỉ đọc. Query `q` (khớp `columnFqn`, mã hoặc tên CDE), `limit` (1-100, mặc định 25), `offset`. Trả `{data:[bản ghi cùng dạng `/search`], paging:{total,limit,offset}}`; không có trường `hasPendingChange`.
- **`technicalAssets`** (tab Tài sản liên kết của CDE): `{source, dataDictionaryVersion, frozenAt, data, paging}`. `source = CURRENT` khi phiên bản DD của CDE đang hiệu lực (đọc index theo `cde.id`), `SNAPSHOT` khi đã bị thay thế (đọc bản chụp, chỉ đọc, kèm `frozenAt`), `NONE` khi phiên bản đang soạn (`data` rỗng). Không phụ thuộc phiên bản `N.x` của CDE.
- **`index/rebuild`**: dựng physical index mới từ PostgreSQL rồi chuyển alias; reader dùng index cũ trong lúc dựng. Sai quyền `403`; index lỗi `503 TD_INDEX_UNAVAILABLE`.

### 5.6. Tác động lên phê duyệt Từ điển dữ liệu

`GET /api/v1/glossaries/{ddId}/working/publish-preview` trả thêm `technicalDictionary: {declaredColumns, mappedColumns, pendingChangeRequests}` (null với glossary khác DD) để UI cảnh báo số cột sẽ bị xóa, số cột được lưu vào bản chụp và số proposal sẽ bị hủy.

### 5.7. Mã lỗi miền Từ điển kỹ thuật

| Mã lỗi | HTTP thường dùng | Ý nghĩa |
| :--- | :---: | :--- |
| `TD_DATA_DICTIONARY_NOT_ACTIVE` | 409 | Chưa có DD Approved đang hiệu lực. |
| `TD_RECORD_NOT_FOUND` | 404 | Record không tồn tại hoặc đã bị xóa khi làm mới. |
| `TD_RECORD_REVISION_CONFLICT` | 409 | `expectedRevision` lệch với `revision` hiện tại. |
| `TD_APPROVED_EDIT_REQUIRES_CHANGE_REQUEST` | 409 | UPDATE/DELETE trực tiếp record Approved. |
| `TD_CHANGE_REQUEST_NOT_FOUND` | 404 | Record không có proposal đang mở. |
| `TD_CHANGE_REQUEST_STALE` | 409 | Proposal hoặc `baseRevision` không còn khớp. |
| `TD_CHANGE_REQUEST_EXISTS` | 409 | Đã có proposal InReview, không được ghi đè. |
| `TD_CDE_SCOPE_NOT_ACTIVE` | 409 | CDE không thuộc DD đang gắn hoặc không còn phiên bản Approved. |
| `TD_RANK_REQUIRED`, `TD_RANK_DUPLICATE` | 400 / 409 | Thiếu Thứ hạng khi có CDE, hoặc trùng Thứ hạng trong cùng CDE. |
| `TD_INVALID_FIELD`, `TD_SERVER_OWNED_FIELD` | 400 | Giá trị field/tag/Team không hợp lệ. |
| `TD_COLUMN_NOT_FOUND` | 404 | Không tìm thấy physical Column. |
| `TD_COLUMN_ALREADY_DECLARED` | 409 | Column đã được khai báo. |
| `TD_IMPORT_ROW_NOT_MATCHED`, `TD_IMPORT_CONFLICT`, `TD_IMPORT_SESSION_INVALID` | 400 / 409 | Lỗi đối sánh, stale preview hoặc session import. |
| `TD_NOT_INITIALIZED` | 404 / 503 | Glossary `Technical Dictionary` chưa được khởi tạo. |
| `TD_INDEX_UNAVAILABLE` | 503 | Index riêng không sẵn sàng. |

## 6. PHỤ LỤC: VÍ DỤ TÍCH HỢP HỆ THỐNG (INTEGRATION EXAMPLES)

### 6.1. Kịch bản cURL: Quy trình Maker gửi duyệt CDE
```bash
# Bước 1: Tạo mới CDE
curl -X POST "http://localhost:8585/api/v1/glossaryTerms" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "glossary": "Data Dictionary",
    "parentBusinessVersion": "1",
    "name": "CDE_BRANCH_CODE",
    "displayName": "Mã chi nhánh mở tài khoản",
    "description": "Mã định danh duy nhất của chi nhánh Agribank nơi mở tài khoản thanh toán.",
    "extension": {
      "releaseLevel": ["TTQLDL"],
      "dataQualityRules": ["Y"],
      "effectiveDate": "2026-04-01"
    }
  }'

# Bước 2: Gửi thẩm định (Submit) với expectedRevision = 1
curl -X POST "http://localhost:8585/api/v1/glossaryTerms/{CDE_UUID}/working/submit?parentBusinessVersion=1" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"expectedRevision": 1}'
```

### 6.2. Kịch bản Python SDK: Kiểm tra xung đột khóa lạc quan (Optimistic Locking Handling)
```python
import requests

BASE_URL = "http://localhost:8585/api/v1"
HEADERS = {
    "Authorization": "Bearer YOUR_JWT_TOKEN",
    "Content-Type": "application/json"
}

def update_cde_safely(cde_id: str, parent_version: str, new_description: str):
    # 1. Lấy thông tin bản nháp hiện tại để nhận workingRevision
    get_res = requests.get(
        f"{BASE_URL}/glossaryTerms/{cde_id}/working?parentBusinessVersion={parent_version}",
        headers=HEADERS
    )
    get_res.raise_for_status()
    current_data = get_res.json()
    current_rev = current_data["workingRevision"]

    # 2. Cập nhật kèm expectedRevision
    # PATCH là full mutable payload, vì vậy phải carry-forward các trường
    # không đổi thay vì chỉ gửi riêng description.
    extension = dict(current_data.get("extension") or {})
    extension.pop("releaseVersionType", None)  # server-owned
    patch_payload = {
        "expectedRevision": current_rev,
        "displayName": current_data.get("displayName"),
        "description": new_description,
        "owners": current_data.get("owners") or [],
        "domains": current_data.get("domains") or [],
        "tags": current_data.get("tags") or [],
        "relatedTerms": current_data.get("relatedTerms") or [],
        "extension": extension,
    }
    patch_res = requests.patch(
        f"{BASE_URL}/glossaryTerms/{cde_id}/working?parentBusinessVersion={parent_version}",
        json=patch_payload,
        headers=HEADERS
    )

    if patch_res.status_code == 200:
        print("Cập nhật thành công! Revision mới:", patch_res.json().get("workingRevision"))
    elif patch_res.status_code == 409:
        print("CẢNH BÁO: Dữ liệu bị xung đột do người khác đã sửa đổi (409 Conflict).")
    else:
        print(f"Lỗi: {patch_res.status_code} - {patch_res.text}")

if __name__ == "__main__":
    update_cde_safely("c1f7a4e2-623b-4830-a15d-5ff36f2f3981", "1", "Mô tả mới đã chuẩn hóa.")
```

## 7. SAI KHÁC VÀ ĐIỀU KIỆN PHÁT HÀNH TÀI LIỆU

Các mục trong bảng dưới đây là sai khác đã biết hoặc quyết định còn thiếu tại thời điểm đối chiếu. Trạng thái `Mở` có nghĩa tài liệu vẫn sử dụng được để phát triển, đối chiếu và xây dựng test case, nhưng **chưa đủ điều kiện phát hành thành baseline nghiệm thu cuối cùng**.

| ID | Phạm vi | Sai khác / Quyết định cần đóng | Đơn vị đầu mối đề xuất | Bằng chứng đóng sai khác | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `GAP-OIDC-01` | OIDC | Contract IAM đang mô tả API đăng nhập `POST`, trong khi OpenMetadata cần browser authorization endpoint chuẩn OIDC qua `GET`. | IAM và Nhóm tích hợp | Discovery UAT và kiểm thử Authorization Code Flow thành công. | Mở |
| `GAP-OIDC-02` | OIDC | IAM chưa xác nhận `refresh_token`, cơ chế refresh/re-login và OIDC end-session/logout tương thích với OpenMetadata. | IAM và Nhóm tích hợp | Token response, grant hỗ trợ, logout endpoint và test hết hạn phiên. | Mở |
| `GAP-OIDC-03` | OIDC/RBAC | Claim role của IAM (`auth`/`roles`/userinfo) chưa khớp cơ chế đọc role từ bearer ID Token của OpenMetadata. | IAM, ATTT và TT QLDL | Mapping claim-role được phê duyệt; test đủ năm vai trò nghiệp vụ. | Mở |
| `GAP-OIDC-04` | Bảo mật | Runtime cần cưỡng chế `iss`, `aud`/`azp`, allowlist `redirectUri` và ngăn lộ ID Token trong URL/log. | Nhóm phát triển và ATTT | Code/config đã harden; kết quả kiểm thử bảo mật và log-redaction đạt. | Mở |
| `GAP-RBAC-01` | RBAC | Quyền `Reject`, `Reopen`, `Archive/Thu hồi`, tạo Scope, Import và Cutover chưa được tài liệu nguồn quy định độc lập. | TT QLDL | Policy nghiệp vụ bổ sung được phê duyệt và ánh xạ thành test case `200/403`. | Mở |
| `GAP-RBAC-02` | RBAC | Cơ chế Admin/superuser, Owner/Reviewer và policy kế thừa có thể cấp quyền rộng hơn ma trận chuẩn. | TT QLDL và Nhóm phát triển | Kiểm thử phủ định chứng minh role không được phép nhận `403`/`404`; không có bypass ngoài phê duyệt. | Mở |
| `GAP-CDE-01` | CDE | Một số thuộc tính nghiệp vụ bắt buộc trong Schema 16 thuộc tính chưa được JSON Schema/backend cưỡng chế đầy đủ. | TT QLDL và Nhóm phát triển | Danh sách field bắt buộc được chốt; schema và API validation test đạt. | Mở |
| `GAP-DQ-01` | DQ | Chưa có API server chuyên biệt cho import/export DQ nguyên tử; UI đang xử lý file và gọi API từng rule. | TT QLDL và Nhóm phát triển | Quyết định chấp nhận luồng hiện tại hoặc contract backend mới được đặc tả, triển khai và kiểm thử. | Mở |
| `GAP-TD-01` | Từ điển kỹ thuật | Runtime đã có Draft/Submit/Approve cho record mới và change request cho update/delete Approved. | TT QLDL và Nhóm phát triển | Test nguồn đã mô tả maker-checker; cần chạy bộ test trong giai đoạn xác minh. | Đã triển khai |
| `GAP-TD-02` | Từ điển kỹ thuật | Capability hiện tại cho Admin/DataSteward và phạm vi `canView` chưa khớp ma trận nguồn. | TT QLDL và Nhóm phát triển | Policy theo vai trò/đơn vị và bộ test RBAC đạt ma trận mục 2.1.5. | Mở |
| `GAP-TD-03` | Từ điển kỹ thuật | `GET /api/v1/glossaryTerms/{cdeId}/technicalAssets` chưa kiểm tra thêm quyền xem Từ điển kỹ thuật. | Nhóm phát triển và ATTT | Endpoint kiểm tra `TechnicalDictionaryAccess.canView`; test `BasicConsumer` bị từ chối. | Mở |
| `GAP-DOC-01` | Tài liệu/API | Danh mục as-built phải được đối chiếu lại với Swagger/OpenAPI sinh từ đúng revision dùng cho UAT sau khi các gap trên được xử lý. | Nhóm phát triển và QA | Báo cáo diff endpoint/method/schema bằng `0` hoặc có biên bản chấp thuận sai khác. | Mở |

### 7.1. Điều kiện chuyển trạng thái tài liệu sang chính thức

Tài liệu chỉ được đổi từ `Dự thảo` sang `Chính thức/Baseline nghiệm thu` khi đồng thời đáp ứng:

1. Mọi mục `GAP-*` đã chuyển sang `Đã đóng` hoặc có biên bản chấp thuận ngoại lệ, nêu rõ phạm vi và thời hạn xử lý.
2. Ma trận phân quyền mục 2.1.5 đã được chủ quản nghiệp vụ phê duyệt và kiểm thử đủ các trường hợp cho phép/từ chối.
3. Luồng OIDC đã được kiểm thử trên UAT với IAM Backend thực tế, gồm đăng nhập, refresh/re-login, logout, claim mapping và kiểm tra JWT.
4. Swagger/OpenAPI, schema runtime và danh mục endpoint trong tài liệu đã được đối chiếu trên cùng một revision phát hành.
5. Các ví dụ request/response và mã lỗi đã được chạy lại; mọi giá trị hostname, client ID và callback đã chuyển thành cấu hình môi trường được phê duyệt.
6. Bảng kiểm soát tài liệu được điền đủ người lập, người rà soát kỹ thuật và người phê duyệt nghiệp vụ.

---
*Đây là bản dự thảo kỹ thuật kết hợp yêu cầu nghiệp vụ và hành vi as-built trên nhánh OpenMetadata Core 1.13.3 tại ngày đối chiếu nêu ở mục 1.1. Các sai khác mục 7 phải được đóng hoặc chấp thuận ngoại lệ trước khi tài liệu trở thành baseline nghiệm thu chính thức.*
