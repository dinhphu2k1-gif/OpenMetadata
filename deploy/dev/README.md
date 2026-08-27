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

- **Build Image Backend:**

  ```bash
  cd deploy/dev
  ./build-backend-image.sh
  ```
- **Build Image Frontend:**

  ```bash
  cd deploy/dev
  ./build-frontend-image.sh
  ```

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
| **Giao diện UI**    | `http://<SERVER_IP>:3000`             | `admin@open-metadata.org` / `admin` |
| **Backend API**      | `http://<SERVER_IP>:8585`             | -                                       |
| **Swagger API Docs** | `http://<SERVER_IP>:8585/docs`        | -                                       |
| **Healthcheck**      | `http://<SERVER_IP>:8586/healthcheck` | -                                       |
