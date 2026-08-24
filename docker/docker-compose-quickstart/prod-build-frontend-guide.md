Op

# 🚀 Hướng Dẫn Build & Chạy Môi Trường Production (Frontend) Cho OpenMetadata

Tài liệu này cung cấp quy trình chuẩn để build giao diện Frontend (React/Vite) mà bạn đã tùy chỉnh, sau đó đóng gói thành một Docker Image hoàn chỉnh để chạy trên môi trường Production.

---

## ⚡ Cách Nhanh Nhất: Chạy 1 Lệnh Duy Nhất (All-in-One Script)

Nếu bạn muốn thực hiện toàn bộ quy trình 4 bước tự động chỉ với 1 lần bấm, hãy mở Terminal tại thư mục gốc của project và chạy:

```bash
chmod +x build-prod-frontend.sh
./build-prod-frontend.sh
```

> [!TIP]
> **Các tùy chọn bổ sung:**
>
> - `./build-prod-frontend.sh --skip-install` : Bỏ qua bước `yarn install` (chạy cực nhanh nếu không thêm package mới).
> - `./build-prod-frontend.sh --skip-start` : Chỉ build và đóng gói image, không tự khởi động lại Docker.
> - `./build-prod-frontend.sh --no-cache` : Build Docker image không dùng cache.

---

## 🛑 Bước 0: Dừng Services Để Giải Phóng Tài Nguyên (RAM & CPU)

Trước khi tiến hành build Frontend và Docker Image, bạn nên tắt các container đang chạy để tránh tràn RAM/CPU và giúp quá trình build nhanh hơn:

```bash
docker compose -f docker/docker-compose-quickstart/docker-compose.dev.yml down
```

---

## 🛠 Bước 1: Build Giao Diện Frontend (Vite)

Đầu tiên, bạn cần build mã nguồn React thành các file tĩnh (HTML, CSS, JS) để tối ưu hóa hiệu suất cho Production.

Mở Terminal tại thư mục gốc của project, sau đó di chuyển vào thư mục UI:

```bash
cd openmetadata-ui/src/main/resources/ui/

# 1. Cài đặt các thư viện phụ thuộc (chỉ cần nếu có thay đổi trong package.json)
yarn install --ignore-engines

# 2. Tiến hành build code giao diện
yarn build
```

Sau lệnh này, toàn bộ code tĩnh sẽ được tạo ra và nằm gọn trong thư mục `openmetadata-ui/src/main/resources/ui/dist`.

---

## 📦 Bước 2: Đóng Gói Giao Diện Vào Backend (Repackage)

Vì kiến trúc của OpenMetadata yêu cầu Backend (Java/Dropwizard) phục vụ (serve) trực tiếp giao diện Frontend, chúng ta phải chèn thư mục `dist` vừa build vào bên trong file `.jar` của backend.

Quay lại thư mục gốc của dự án và chạy script đóng gói đã được chuẩn bị sẵn:

```bash
# Quay lại thư mục gốc của dự án
cd ../../../../../
# (Đường dẫn hiện tại sẽ là: /home/dinhphu/Documents/openmetadata/OpenMetadata)

# Cấp quyền thực thi cho script (nếu bạn chưa cấp)
chmod +x repackage_ui.sh

# Chạy script đóng gói tự động
./repackage_ui.sh
```

> [!NOTE]
> **Script này làm gì?**
> Script sẽ sao lưu file nén gốc, giải nén `openmetadata-1.13.3.tar.gz`, trích xuất file `.jar`, đè các file từ thư mục `dist` vào trong thư mục `assets` của file `.jar`, và cuối cùng nén toàn bộ lại thành file `.tar.gz` sẵn sàng cho Docker.

---

## 🐳 Bước 3: Build Custom Docker Image

Sau khi file `tar.gz` gốc đã được "bơm" phần Frontend tùy chỉnh vào, ta tiến hành build ra Docker Image cho Server.

Vẫn tại thư mục gốc của project, hãy chạy lệnh:

```bash
docker build -f docker/development/Dockerfile -t openmetadata/server:custom-1.13.3 .
```

> [!TIP]
> - `docker/development/Dockerfile`: File Docker này được cấu hình riêng để đọc file `.tar.gz` từ thư mục local thay vì tải từ Github về.
> - `-t openmetadata/server:custom-1.13.3`: Gắn tag này để khớp với `docker-compose.dev.yml` mà bạn đang dùng.

---

## 🚀 Bước 4: Khởi Động dev Server

Cuối cùng, hệ thống đã sẵn sàng với Image `custom-1.13.3`. Hãy khởi động lại toàn bộ service:

```bash
# Nếu hệ thống đang chạy, hãy down trước
docker compose -f docker/docker-compose-quickstart/docker-compose.dev.yml down

# Khởi động lại ở chế độ ngầm (Daemon)
docker compose -f docker/docker-compose-quickstart/docker-compose.dev.yml up -d
```

> [!IMPORTANT]
> **Kiểm Tra Trạng Thái:**
>
> - Xem logs khởi động để đảm bảo Server lên thành công: `docker logs -f openmetadata_server`
> - Khi hệ thống báo *Started OpenMetadataApplication*, hãy truy cập vào domain (ví dụ: `http://metadata.agribank.com.vn`) để xem thành quả Frontend tùy chỉnh của bạn!
