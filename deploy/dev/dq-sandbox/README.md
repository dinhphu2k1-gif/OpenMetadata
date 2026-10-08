# Sandbox Oracle để thử kiểm thử theo quy tắc CLDL

Oracle Database 21c Enterprise nhỏ làm **nguồn dữ liệu**: OpenMetadata ingest metadata từ đây, rồi pipeline kiểm thử chạy
lên đây. Image `container-registry.oracle.com/database/enterprise:21.3.0.0` phải được pull sẵn (cần đăng nhập Oracle
Container Registry).

```bash
cd deploy/dev
docker compose -f docker-compose.dev.yml --profile dq-sandbox up -d dq-sandbox-oracle
docker logs -f dq-sandbox-oracle        # chờ dòng "DATABASE IS READY TO USE!" (lần đầu 15-30 phút)
```

Xóa để tạo lại từ đầu (xóa cả volume dữ liệu `dq-sandbox-oradata`, lần sau tạo database lại từ đầu):

```bash
docker compose -f docker-compose.dev.yml --profile dq-sandbox rm -sfv dq-sandbox-oracle
docker volume rm dev_dq-sandbox-oradata   # tên volume: <tên project compose>_dq-sandbox-oradata, xem bằng `docker volume ls`
```

Script `oracle-setup/02-ms1-schema.sql` chỉ chạy **một lần**, ngay sau khi database được tạo. Sửa script thì phải xóa
volume để chạy lại.

| Thông số | Giá trị |
| --- | --- |
| Host cho OpenMetadata và Airflow (cùng `omd_network`) | `dq-sandbox-oracle`, cổng `1521` |
| Host từ máy chủ | `127.0.0.1`, cổng `1521` |
| Service name (PDB) | `MISDB` |
| Tài khoản chỉ đọc (dùng cho service OpenMetadata) | `dq_reader` / `dq_reader_pw` |
| Quản trị | `sys` / `Oracle_pw1` (as SYSDBA), đổi bằng `DQ_SANDBOX_ORACLE_PWD` |

## Bộ nhớ

Oracle chạy cùng server OpenMetadata, UI, Airflow và OpenSearch nên bị giới hạn:

| Biến (`.env`) | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `DQ_SANDBOX_ORACLE_SGA_MB` | 1280 | SGA của Oracle (MB) |
| `DQ_SANDBOX_ORACLE_PGA_MB` | 256 | PGA của Oracle (MB) |
| `DQ_SANDBOX_ORACLE_MEM_LIMIT` | 2560m | Trần bộ nhớ container; vượt trần thì Oracle bị dừng thay vì làm tràn RAM máy |

SGA/PGA chỉ áp dụng khi tạo database lần đầu. Không dùng thì dừng để trả RAM:
`docker stop dq-sandbox-oracle` (dữ liệu vẫn còn trong volume, `docker start dq-sandbox-oracle` để chạy lại).

## Dữ liệu

| Bảng | Cột | Kiểu | Số dòng | Vi phạm cố ý |
| --- | --- | --- | --- | --- |
| `ms1.TBCM_GENERAL` | `IDNONATL` | VARCHAR2(20) | 1000 | 30 sai định dạng 12 số (10 có chữ, 10 thiếu số, 10 NULL) |
| `ms1.TBCM_CUSTID` | `IDNO` | VARCHAR2(20) | 1000 | Như trên. Các bảng `ms1` khác chỉ có cấu trúc |

## Các bước thử

Cần Airflow đang chạy (Kiểm thử kết nối, ingest metadata và Chạy ngay đều qua Airflow). Với local-dev: chạy
`./local-dev.sh ingestion` và chạy server bằng `WITH_INGESTION=true ./local-dev.sh server` (xem `../README.md` §7.1).

1. **Service:** Settings → Services → Database → thêm **Oracle**: Host and Port `dq-sandbox-oracle:1521`, Oracle
   Connection Type **Oracle Service Name** = `MISDB`, Username `dq_reader`, Password `dq_reader_pw`. Chạy ingestion
   metadata, lọc schema `ms1` để bỏ qua các schema hệ thống của Oracle.
2. **Từ điển dữ liệu:** tạo CDE `CDE1 · Số CCCD` trong Data Dictionary và Approve phiên bản.
3. **Từ điển kỹ thuật:** khai báo 3 cột `kh.cccd`, `customer.id_no`, `holder.cccd` và gắn vào CDE1.
4. **Chất lượng dữ liệu:** tạo Rule `DQ3.1`, liên kết CDE1, thêm các khai báo bên dưới rồi Submit và Approve.
5. **Lịch / Chạy ngay:** vào tab *Kết quả kiểm thử* của Rule, bấm **Chạy ngay** (hoặc đặt lịch).

## Khai báo gợi ý cho Rule `DQ3.1`

| Tên | Loại | Cấu hình | Ngưỡng riêng | Kết quả mong đợi |
| --- | --- | --- | --- | --- |
| Không trống | Thư viện `columnValuesToBeNotNull`, bật *Tính tỷ lệ đạt* | | `count = 0` | `kh`, `customer`, `holder` đều Không đạt (mỗi bảng 1 NULL) |
| Đúng 12 chữ số | Thư viện `columnValuesToMatchRegex`, `regex = ^[0-9]{12}$`, bật *Tính tỷ lệ đạt* | | `>= 80%` | `kh` và `customer` Đạt (khoảng 85–90% tùy cách validator gốc tính NULL); `holder` dự kiến **Không áp dụng** vì kiểu NUMBER |
| Định dạng (SQL) | SQL | `SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} IS NULL OR NOT REGEXP_LIKE({{ column_name }}, '^[0-9]{12}$')` | `count <= 3` | **Lỗi thực thi** trên Oracle (xem dưới) |

**Khai báo SQL chưa chạy được trên Oracle.** Validator SQL gốc ghép `{{ table_name }}` thành `database.schema.table`, với
Oracle là `default.core_kh.kh`, sai cú pháp (DQT-13). Sandbox này dùng để thấy rõ giới hạn đó; khai báo Thư viện chạy
bình thường.
