# Hướng Dẫn Deploy Môi Trường Dev (OpenMetadata)

Tài liệu hướng dẫn cách triển khai và vận hành OpenMetadata trên Server Dev bằng Docker Compose.

---

## 1. Chuẩn bị

Tạo file cấu hình môi trường `.env` từ file mẫu:

```bash
cd deploy/dev
cp .env.example .env
```

*(Mặc định sử dụng tài khoản Basic Auth: `admin@open-metadata.org` / `admin`).*

---

## 2. Build Docker Image (Khi có cập nhật mã nguồn)

Nếu cần build lại image từ mã nguồn mới nhất:

- **Build Image Server (gom ca giao dien):**

  ```bash
  cd deploy/dev
  ./build-server-image.sh                 # build UI roi build Server
  SKIP_UI_BUILD=true ./build-server-image.sh   # dung lai ui/dist da build
  ```

  OpenMetadata Server phuc vu luon giao dien web, nen khong con image Frontend/Nginx rieng.

---

## 3. Khởi động hệ thống

Khởi chạy toàn bộ stack dịch vụ bằng Docker Compose:

```bash
cd deploy/dev
docker compose -f docker-compose.dev.yml up -d
```

---

## 4. Thông tin truy cập

| Dịch vụ                  | URL                                     | Thông tin đăng nhập                 |
| :------------------------- | :-------------------------------------- | :-------------------------------------- |
| **OpenMetadata UI + API (Admin)** | `http://<SERVER_IP>:${OPENMETADATA_UI_PORT:-80}` (cũng phục vụ ở `:8585`) | `admin@open-metadata.org` / `admin` |
| **Portal** | `http://<SERVER_IP>:${PORTAL_UI_PORT:-8595}` | Tài khoản OpenMetadata của `DataSteward`, `DataProposer`, `DataConsumer`, `BasicConsumer` |
| **Ingestion (Airflow)** | `http://<SERVER_IP>:8080`          | `admin` / `admin`                       |
| **Swagger API Docs** | `http://<SERVER_IP>:8585/docs`        | -                                       |
| **Healthcheck**      | `http://<SERVER_IP>:8586/healthcheck` | -                                       |

---

## 5. Khởi tạo lại từ đầu

Môi trường dev chưa lên PROD nên được khởi tạo lại thay vì nâng cấp. Thứ tự bắt buộc, vì Portal không tạo schema
và không tạo dữ liệu khởi tạo:

```bash
cd deploy/dev
docker compose -f docker-compose.dev.yml down -v        # xóa cả volume OpenSearch và Ingestion
sudo rm -rf docker-volume/db-data-postgres              # thư mục thuộc quyền user của container

./local-dev.sh infra      # PostgreSQL + OpenSearch
./local-dev.sh migrate    # tạo schema
./local-dev.sh server     # chờ healthcheck :8586; server OM tạo dữ liệu khởi tạo
# đăng nhập OM bằng admin, tạo user và gán role (DATA_STEWARD, DATA_PROPOSER, DATA_CONSUMER, BASIC_CONSUMER)
./local-dev.sh portal     # rồi ui, ui-portal
```

Nếu Explore trống thì chạy `./local-dev.sh reindex`. Với Docker, compose tự giữ thứ tự `execute-migrate-all`,
`openmetadata-server`, `portal`. Chi tiết: `docs/design/public-admin-split-deployment-architecture.md` §6.3.

---

## 6. Portal

Service `portal` chạy cùng image với `openmetadata-server`, bật `OM_PORTAL_ENABLED=true`:

- dành cho `DataSteward`, `DataProposer`, `DataConsumer`, `BasicConsumer`; **được ghi** theo RBAC của OpenMetadata;
- phục vụ bản build UI Portal (`yarn build:portal`, thư mục `ui/dist-portal`), menu theo persona của user;
- đăng nhập, user, role, policy và search giống hệt OpenMetadata (cùng PostgreSQL, OpenSearch, cùng user database);
- không chạy việc nền, không tạo dữ liệu khởi tạo, không kết nối Ingestion (Airflow), không bật MCP;
- pipeline tạo hoặc sửa trên Portal (test case, quy tắc CLDL, chạy ngay, bật/tắt, xóa) được ghi vào outbox, và
  `openmetadata-server` deploy lên Airflow trong tối đa 60 giây.

Server OM phải chạy ít nhất một lần trước Portal để tạo dữ liệu khởi tạo. Khi dùng OIDC, đặt
`PORTAL_AUTHENTICATION_CALLBACK_URL` là địa chỉ `/callback` của Portal.

OpenMetadata UI chỉ dành cho Admin: đặt `OM_ADMIN_ONLY=true` cho `openmetadata-server` (mặc định `false` ở DEV để thử
mọi role). Khi bật, chỉ Admin và bot đăng nhập và gọi API được; user khác nhận `403`. Portal bỏ qua cờ này.

---

## 7. Kiểm thử theo quy tắc chất lượng dữ liệu

Tính năng khai báo kiểm thử trên DQ Rule, tự sinh testcase trên các cột của CDE, đặt lịch và Chạy ngay theo Rule.
Không có cờ bật/tắt: tính năng luôn hoạt động trên `openmetadata-server`. `portal` không chạy việc nền: việc cần Airflow (deploy pipeline, chạy ngay) đi qua outbox và do `openmetadata-server` xử lý.

Yêu cầu khi deploy:

1. Build lại image server (`./build-server-image.sh`). Ingestion (Airflow) dùng image gốc, không cần build.
   Khai báo kiểm thử kiểu SQL chưa chạy được trên nguồn Oracle/DB2 (DQT-13).
2. Bảng mới nằm trong migration `1.13.3`; `execute-migrate-all` tự tạo khi khởi động.

Nguồn dữ liệu thử nghiệm (Oracle 21c nhỏ, có vi phạm cố ý, tài khoản chỉ đọc `dq_reader`, giới hạn RAM):

```bash
docker compose -f docker-compose.dev.yml --profile dq-sandbox up -d dq-sandbox-oracle   # lần đầu tạo database 15-30 phút
docker stop dq-sandbox-oracle                                                         # trả RAM khi không dùng
```

Trong OpenMetadata khai báo service Oracle với host `dq-sandbox-oracle:1521`, service name `ORCLPDB1`, tài khoản
`dq_reader` / `dq_reader_pw`. Dữ liệu, giới hạn bộ nhớ và kịch bản thử: `dq-sandbox/README.md`.

### 7.1. Chạy thử bằng local-dev (không build image)

**Một lệnh cho tất cả** (PostgreSQL, OpenSearch, Airflow, Oracle sandbox trong Docker; server và UI chạy nền trên máy,
log trong `deploy/dev/.dev-run/`):

```bash
cd deploy/dev
./dev.sh up              # thêm --migrate khi có migration mới, --no-oracle để không chạy Oracle, --no-portal để không chạy Portal
./dev.sh status          # dịch vụ nào đang chạy, RAM từng thành phần
./dev.sh logs server     # hoặc: ui, portal, ui-portal
./dev.sh restart-server  # sau khi sửa backend (restart cả Portal nếu đang chạy; UI tự cập nhật)
./dev.sh down            # dừng hết, giữ dữ liệu
```

OpenMetadata UI: `http://localhost:3000`. Portal UI: `http://localhost:3001` (API Portal `:8595`). `up` chạy Portal sau khi server OM khỏe,
vì Portal không tự tạo dữ liệu khởi tạo.

Server hoặc UI đang chạy trong terminal riêng thì `dev.sh` để nguyên, không khởi động thêm; `down` không dừng chúng.

Các lệnh tương đương, chạy riêng từng phần:

"Kiểm thử kết nối", ingest metadata và pipeline kiểm thử đều do **Airflow** chạy, không do server. Ở chế độ local-dev
Airflow tắt mặc định, nên phải bật thêm. Thứ tự, mỗi lệnh server/UI một terminal:

```bash
cd deploy/dev
./local-dev.sh infra                                                       # PostgreSQL + OpenSearch
./local-dev.sh migrate                                                     # tạo bảng (lần đầu, hoặc khi sửa migration)
docker compose -f docker-compose.dev.yml --profile dq-sandbox up -d dq-sandbox-oracle  # Oracle thử nghiệm
./local-dev.sh ingestion                                                   # Airflow http://localhost:8080 (admin/admin)
WITH_INGESTION=true ./local-dev.sh server                                  # server :8585, gọi được Airflow
./local-dev.sh ui                                                          # UI http://localhost:3000
```

`WITH_INGESTION=true` cho server biết Airflow ở `localhost:8080`, và cho Airflow địa chỉ gọi lại server trên máy qua
gateway của `omd_network` (thường `172.16.239.1:8585`).

### 7.2. Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| "Kiểm thử kết nối thất bại" ngay cả khi thông tin đúng | Server chạy không có `WITH_INGESTION=true`, hoặc container `openmetadata_ingestion` chưa chạy | Chạy `./local-dev.sh ingestion`, rồi chạy lại server với `WITH_INGESTION=true` |
| Kiểm thử kết nối treo hoặc Airflow báo không gọi được OpenMetadata | Airflow không tới được server trên máy | Kiểm tra từ container: `docker exec openmetadata_ingestion curl -s http://172.16.239.1:8585/api/v1/system/version`; tường lửa máy phải cho cổng 8585 từ mạng Docker |
| Không kết nối được Oracle | Sandbox chưa chạy, database chưa tạo xong hoặc sai host | `docker logs dq-sandbox-oracle` có "DATABASE IS READY TO USE!"; host `dq-sandbox-oracle:1521` (không dùng `localhost`), service name `ORCLPDB1` |
| Approve Rule xong không có testcase | Lỗi reconcile | `GET /api/v1/glossaryTerms/dataQuality/reconcile/status` (admin) xem `outboxPending`, `errors`; log server tìm "Data Quality test outbox" |
| Testcase SQL ra "Lỗi thực thi" | SQL sai cú pháp, dùng `COUNT(*)`, hoặc nguồn Oracle/DB2 | Xem log task trong Airflow; SQL phải trả về các dòng vi phạm (DQT-13) |
