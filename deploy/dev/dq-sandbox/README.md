# Sandbox MySQL để thử kiểm thử theo quy tắc CLDL

MySQL 8 nhỏ làm **nguồn dữ liệu**: OpenMetadata ingest metadata từ đây, rồi pipeline kiểm thử chạy SQL lên đây.

```bash
cd deploy/dev
docker compose -f docker-compose.dev.yml --profile dq-sandbox up -d dq-sandbox-mysql   # cổng máy chủ 3307
docker compose -f docker-compose.dev.yml --profile dq-sandbox rm -sfv dq-sandbox-mysql  # xóa để nạp lại từ init/
```

Container nằm trong `omd_network` cùng OpenMetadata và Airflow nên truy cập được bằng tên.

| Thông số | Giá trị |
| --- | --- |
| Host cho OpenMetadata và Airflow (cùng `omd_network`) | `dq-sandbox-mysql`, cổng `3306` |
| Host từ máy chủ | `127.0.0.1`, cổng `3307` |
| Tài khoản chỉ đọc (dùng cho service OpenMetadata) | `dq_reader` / `dq_reader_pw` |
| Tài khoản quản trị | `root` / `root_pw` |

## Dữ liệu

| Bảng | Cột | Kiểu | Số dòng | Vi phạm cố ý |
| --- | --- | --- | --- | --- |
| `core_kh.kh` | `cccd` | VARCHAR(20) | 20 | 3 sai định dạng 12 số (1 NULL, 1 có chữ, 1 thiếu số) |
| `crm.customer` | `id_no` | VARCHAR(20) | 15 | 2 sai định dạng (1 NULL, 1 dài 13 số); 1 nhóm trùng giá trị |
| `card.holder` | `cccd` | **BIGINT** | 5 | 1 NULL. Kiểu số nên kiểm thử Regex là **Không áp dụng** |
| `other.branch` | `name` | VARCHAR | 2 | Không gắn CDE, để đối chiếu |

## Các bước thử

1. **Service:** Settings → Services → Database → thêm MySQL với host/tài khoản ở trên, chạy ingestion metadata. Kết quả có
   bảng `mysql_service.default.core_kh.kh`, `...crm.customer`, `...card.holder`.
2. **Từ điển dữ liệu:** tạo CDE `CDE1 · Số CCCD` trong Data Dictionary và Approve phiên bản.
3. **Từ điển kỹ thuật:** khai báo 3 cột `kh.cccd`, `customer.id_no`, `holder.cccd` và gắn vào CDE1.
4. **Chất lượng dữ liệu:** tạo Rule `DQ3.1`, liên kết CDE1, thêm các khai báo bên dưới rồi Submit và Approve.
5. **Lịch / Chạy ngay:** vào tab *Kết quả kiểm thử* của Rule, bấm **Chạy ngay** (hoặc đặt lịch).

## Khai báo gợi ý cho Rule `DQ3.1`

| Tên | Loại | Cấu hình | Ngưỡng riêng | Kết quả mong đợi |
| --- | --- | --- | --- | --- |
| Không trống | Thư viện `columnValuesToBeNotNull`, bật *Tính tỷ lệ đạt* | | `count = 0` | `kh` Không đạt (1 NULL), `customer` Không đạt (1 NULL), `holder` Không đạt (1 NULL) |
| Đúng 12 chữ số | Thư viện `columnValuesToMatchRegex`, `regex = ^[0-9]{12}$`, bật *Tính tỷ lệ đạt* | | `>= 80%` | `kh` và `customer` Đạt (khoảng 85–90% tùy cách validator gốc tính dòng NULL); `holder` dự kiến **Không áp dụng** vì kiểu BIGINT |
| Định dạng (SQL) | SQL | `SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} IS NULL OR NOT REGEXP_LIKE({{ column_name }}, '^[0-9]{12}$')` | `count <= 3` | `kh` 3 vi phạm Đạt; `customer` 2 Đạt; `holder` 1 NULL (bảng số: `REGEXP_LIKE` trên số vẫn chạy) |
| Không trùng (SQL) | SQL | `SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} IS NOT NULL GROUP BY {{ column_name }} HAVING COUNT(*) > 1` | `count = 0` | `kh` Đạt, `customer` Không đạt (1 nhóm trùng), `holder` Đạt |

Tên bảng trong SQL do validator thay: với MySQL là `schema.table` (ví dụ `core_kh.kh`).

Các câu đếm đã chạy thử trực tiếp trên sandbox: định dạng sai `kh`=3, `customer`=2; nhóm trùng `customer`=1; NULL `holder`=1.
