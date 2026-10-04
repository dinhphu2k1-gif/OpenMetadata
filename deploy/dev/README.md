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
| **Giao diện UI + API** | `http://<SERVER_IP>:${OPENMETADATA_UI_PORT:-80}` (cũng phục vụ ở `:8585`) | `admin@open-metadata.org` / `admin` |
| **Portal (chỉ đọc)** | `http://<SERVER_IP>:${PORTAL_UI_PORT:-8595}` | Tài khoản OpenMetadata, ví dụ user có role `BasicConsumer` |
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

./local-dev.sh infra      # PostgreSQL + OpenSearch, tạo user portal_ro
./local-dev.sh migrate    # tạo schema
./local-dev.sh server     # chờ healthcheck :8586; server OM tạo dữ liệu khởi tạo
# đăng nhập OM bằng admin, tạo user và gán role BASIC_CONSUMER
./local-dev.sh portal     # rồi ui, ui-portal
```

Nếu Explore trống thì chạy `./local-dev.sh reindex`. Với Docker, compose tự giữ thứ tự `execute-migrate-all`,
`openmetadata-server`, `portal`. Chi tiết: `docs/design/public-admin-split-deployment-architecture.md` §6.4.

---

## 6. Portal

Service `portal` chạy cùng image với `openmetadata-server`, bật `OM_PORTAL_ENABLED=true`:

- phục vụ bản build UI Portal (`yarn build:portal`, thư mục `ui/dist-portal`), menu cố định như persona BasicConsumer;
- đăng nhập, user, role, policy và search giống hệt OpenMetadata (cùng PostgreSQL, OpenSearch);
- kết nối PostgreSQL bằng user `portal_ro`, **chỉ có quyền đọc** (`postgres-init/portal-read-only-role.sql`);
- từ chối mọi request ghi (trả `403`), trừ đăng nhập, đăng xuất và `search/aggregate`;
- không chạy việc nền, không tạo dữ liệu khởi tạo, không kết nối Ingestion, không bật MCP.

Server OM phải chạy ít nhất một lần trước Portal để tạo dữ liệu khởi tạo, và người dùng phải được tạo sẵn trong OM.

Volume PostgreSQL mới tự tạo `portal_ro` (mật khẩu `PORTAL_RO_PASSWORD`, mặc định `portal_ro_password`). Với database đã có:

```bash
docker exec -i openmetadata_postgresql psql -U postgres -v portal_password=portal_ro_password \
  < postgres-init/portal-read-only-role.sql
```

Khi dùng OIDC, đặt `PORTAL_AUTHENTICATION_CALLBACK_URL` là địa chỉ `/callback` của Portal.

---

## 7. Kiểm thử theo quy tắc chất lượng dữ liệu

Tính năng khai báo kiểm thử trên DQ Rule, tự sinh testcase trên các cột của CDE, đặt lịch và Chạy ngay theo Rule.
Không có cờ bật/tắt: tính năng luôn hoạt động trên `openmetadata-server`. `portal` chỉ đọc nên không chạy việc nền.

Yêu cầu khi deploy:

1. Build lại image server (`./build-server-image.sh`). Ingestion (Airflow) dùng image gốc, không cần build.
   Khai báo kiểm thử kiểu SQL chưa chạy được trên nguồn Oracle/DB2 (DQT-13).
2. Bảng mới nằm trong migration `1.13.3`; `execute-migrate-all` tự tạo khi khởi động.

Nguồn dữ liệu thử nghiệm (MySQL nhỏ, có vi phạm cố ý, tài khoản chỉ đọc `dq_reader`):

```bash
docker compose -f docker-compose.dev.yml --profile dq-sandbox up -d dq-sandbox-mysql
docker compose -f docker-compose.dev.yml --profile dq-sandbox rm -sfv dq-sandbox-mysql    # xóa để nạp lại dữ liệu
```

Trong OpenMetadata khai báo service MySQL với host `dq-sandbox-mysql`, cổng `3306`, tài khoản `dq_reader` /
`dq_reader_pw`. Dữ liệu và kịch bản thử: `dq-sandbox/README.md`.

### 7.1. Chạy thử bằng local-dev (không build image)

"Kiểm thử kết nối", ingest metadata và pipeline kiểm thử đều do **Airflow** chạy, không do server. Ở chế độ local-dev
Airflow tắt mặc định, nên phải bật thêm. Thứ tự, mỗi lệnh server/UI một terminal:

```bash
cd deploy/dev
./local-dev.sh infra                                                       # PostgreSQL + OpenSearch
./local-dev.sh migrate                                                     # tạo bảng (lần đầu, hoặc khi sửa migration)
docker compose -f docker-compose.dev.yml --profile dq-sandbox up -d dq-sandbox-mysql   # MySQL thử nghiệm
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
| Không kết nối được MySQL | Sandbox chưa chạy hoặc sai host | `docker ps` thấy `dq-sandbox-mysql`; host phải là `dq-sandbox-mysql:3306` (không dùng `localhost`) |
| Approve Rule xong không có testcase | Lỗi reconcile | `GET /api/v1/glossaryTerms/dataQuality/reconcile/status` (admin) xem `outboxPending`, `errors`; log server tìm "Data Quality test outbox" |
| Testcase SQL ra "Lỗi thực thi" | SQL sai cú pháp, dùng `COUNT(*)`, hoặc nguồn Oracle/DB2 | Xem log task trong Airflow; SQL phải trả về các dòng vi phạm (DQT-13) |
