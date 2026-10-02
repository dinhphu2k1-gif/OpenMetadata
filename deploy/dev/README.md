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
