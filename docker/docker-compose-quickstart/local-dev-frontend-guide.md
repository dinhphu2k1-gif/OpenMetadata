# 🚀 Hướng Dẫn Chạy Môi Trường Dev (Frontend) Tối Ưu Cho OpenMetadata

Tài liệu này cung cấp các bước chuẩn xác nhất dành cho **Frontend Developer** để chạy môi trường lập trình OpenMetadata tại máy cá nhân (Localhost) một cách nhẹ nhàng, không bị quá tải RAM/CPU.

---

## 🛠 Yêu Cầu Hệ Thống (Pre-requisites)

Đảm bảo bạn đã cài đặt các công cụ sau:

- **Docker & Docker Compose**: Để chạy Backend API, Database, và Search Engine.
- **Node.js** (Khuyến nghị phiên bản 18.x trở lên).
- **Yarn**: Trình quản lý package (OpenMetadata sử dụng Yarn thay vì npm).

---

## 🏎 Bước 1: Khởi Động Backend (Chế Độ Siêu Nhẹ)

Thay vì bật toàn bộ các service (bao gồm cả Airflow/Ingestion rất nặng), chúng ta chỉ bật 3 thành phần cốt lõi để giao diện có thể gọi API.

Mở Terminal tại thư mục gốc của project (ví dụ: `/home/dinhphu/Documents/openmetadata/OpenMetadata`):

```bash
# Khởi động PostgreSQL, OpenSearch và OpenMetadata API Server dưới chế độ chạy ngầm (-d)
docker compose -f docker/docker-compose-quickstart/docker-compose.dev.yml up -d postgresql opensearch openmetadata-server
```

> [!TIP]
> **Tối ưu hóa RAM tối đa (Chỉ ~650MB tổng cộng):**
> File `docker-compose.dev.yml` đã được tinh chỉnh ép RAM xuống mức siêu nhẹ: OpenSearch tối đa 256MB (`-Xms128m -Xmx256m`) và OpenMetadata Server tối đa 384MB (`-Xms128m -Xmx384m`), giúp máy cá nhân chạy cực mượt mà không lo bị tràn bộ nhớ.

> [!NOTE]
> Lần khởi động đầu tiên có thể mất từ 1-3 phút để Database được khởi tạo xong. Bạn có thể dùng lệnh `docker ps` để kiểm tra trạng thái các container (cột Status hiện `Up`).

---

## 💻 Bước 2: Khởi Động Giao Diện Frontend (Vite)

Sau khi Backend API đã chạy, bước tiếp theo là khởi động giao diện. OpenMetadata UI được cấu trúc bằng React và sử dụng **Vite** để hỗ trợ Hot-Reload cực nhanh.

Mở một cửa sổ Terminal **mới**, trỏ tới thư mục chứa code UI:

```bash
cd openmetadata-ui/src/main/resources/ui/

# 1. Cài đặt các thư viện phụ thuộc (Chỉ cần chạy 1 lần hoặc khi có thay đổi package.json)
yarn install

# 2. Khởi động Dev Server
VITE_DEV_SERVER_TARGET=http://localhost:80/ yarn start
or
yarn start
```

Sau khi chạy xong, Vite sẽ thông báo địa chỉ truy cập (thường là `http://localhost:3000`). Mở trình duyệt và trải nghiệm giao diện! Mọi thay đổi trong code (ví dụ: đổi màu CSS, sửa nội dung file JSON Tiếng Việt) sẽ được tự động làm mới trên trình duyệt ngay lập tức.

---

## 🛑 Bước 3: Cách Tắt Môi Trường Khi Code Xong

Để giải phóng hoàn toàn bộ nhớ máy tính khi kết thúc ngày làm việc, hãy tắt các môi trường.

1. **Tắt Frontend:** Ở cửa sổ terminal đang chạy `yarn start`, bấm `Ctrl + C`.
2. **Tắt Backend:** Mở terminal ở thư mục gốc project và chạy:

```bash
docker compose -f docker/docker-compose-quickstart/docker-compose.dev.yml down
```

---

## 🆘 Khắc Phục Sự Cố Thường Gặp (Troubleshooting)

> [!WARNING]
> **Lỗi: "Network Error" hoặc "Cannot connect to server" trên giao diện**
>
> *Nguyên nhân:* Backend Server chưa chạy lên kịp, hoặc đang bị lỗi.
> *Cách xử lý:*
> Chạy lệnh `docker logs -f openmetadata_server` để xem chi tiết lỗi của server. Hãy đảm bảo terminal báo "Started OpenMetadataApplication" trước khi bạn sử dụng giao diện.

> [!IMPORTANT]
> **Lỗi: Thiếu dữ liệu mẫu trên UI**
>
> Vì chúng ta không chạy container `ingestion` để tối ưu tải, nên nếu database của bạn hoàn toàn trống, giao diện sẽ không có dữ liệu mẫu. Nếu bạn thật sự cần nạp dữ liệu mẫu ban đầu, hãy chạy lệnh gốc một lần duy nhất: `docker compose -f docker/docker-compose-quickstart/docker-compose.dev.yml up -d`. Sau khi dữ liệu mẫu nạp xong, hãy `down` và bật lại bằng "chế độ siêu nhẹ" ở Bước 1.
