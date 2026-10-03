-- Ba schema, mỗi schema một bảng chứa số CCCD, để một CDE "Số CCCD" gắn vào ba cột ở ba bảng.
-- Dữ liệu cố ý có vi phạm; số lượng ghi ở comment để đối chiếu với kết quả kiểm thử.

CREATE DATABASE core_kh  CHARACTER SET utf8mb4;
CREATE DATABASE crm      CHARACTER SET utf8mb4;
CREATE DATABASE card     CHARACTER SET utf8mb4;
CREATE DATABASE other    CHARACTER SET utf8mb4;

-- 1) core_kh.kh.cccd: VARCHAR, 20 dòng
--    sai định dạng 12 chữ số: 3 dòng (1 NULL, 1 có chữ, 1 thiếu số); trùng: 0
CREATE TABLE core_kh.kh (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  ten       VARCHAR(100) NOT NULL,
  cccd      VARCHAR(20)
);
INSERT INTO core_kh.kh (ten, cccd) VALUES
 ('Nguyen Van A', '001201000001'), ('Tran Thi B',  '001201000002'),
 ('Le Van C',     '001201000003'), ('Pham Thi D',  '001201000004'),
 ('Hoang Van E',  '001201000005'), ('Vu Thi F',    '001201000006'),
 ('Dang Van G',   '001201000007'), ('Bui Thi H',   '001201000008'),
 ('Do Van I',     '001201000009'), ('Ngo Thi K',   '001201000010'),
 ('Duong Van L',  '001201000011'), ('Ly Thi M',    '001201000012'),
 ('Phan Van N',   '001201000013'), ('Vo Thi O',    '001201000014'),
 ('Truong Van P', '001201000015'), ('Dinh Thi Q',  '001201000016'),
 ('Ta Van R',     '001201000017'),
 ('Khong CCCD',   NULL),
 ('Co chu',       '00120100ABCD'),
 ('Thieu so',     '0012010');

-- 2) crm.customer.id_no: VARCHAR, 15 dòng
--    sai định dạng: 2 dòng (1 NULL, 1 dài 13 số); trùng: 1 nhóm giá trị xuất hiện 2 lần
CREATE TABLE crm.customer (
  customer_id INT PRIMARY KEY AUTO_INCREMENT,
  full_name   VARCHAR(100) NOT NULL,
  id_no       VARCHAR(20)
);
INSERT INTO crm.customer (full_name, id_no) VALUES
 ('KH 01', '079301000001'), ('KH 02', '079301000002'), ('KH 03', '079301000003'),
 ('KH 04', '079301000004'), ('KH 05', '079301000005'), ('KH 06', '079301000006'),
 ('KH 07', '079301000007'), ('KH 08', '079301000008'), ('KH 09', '079301000009'),
 ('KH 10', '079301000010'), ('KH 11', '079301000011'),
 ('KH trung 1', '079301000099'), ('KH trung 2', '079301000099'),
 ('KH null', NULL),
 ('KH dai',  '0793010000123');

-- 3) card.holder.cccd: BIGINT (kiểu số), 5 dòng
--    Kiểu dữ liệu không thuộc nhóm chuỗi: kiểm thử Regex sẽ bị đánh dấu "Không áp dụng", kiểm thử SQL vẫn chạy
CREATE TABLE card.holder (
  holder_id INT PRIMARY KEY AUTO_INCREMENT,
  cccd      BIGINT
);
INSERT INTO card.holder (cccd) VALUES
 (201201000001), (201201000002), (201201000003), (201201000004), (NULL);

-- Bảng không gắn CDE, để so sánh
CREATE TABLE other.branch (
  branch_id INT PRIMARY KEY AUTO_INCREMENT,
  name      VARCHAR(100)
);
INSERT INTO other.branch (name) VALUES ('Chi nhanh 1'), ('Chi nhanh 2');

-- Tài khoản chỉ đọc cho OpenMetadata (ingest metadata và chạy pipeline kiểm thử)
CREATE USER 'dq_reader'@'%' IDENTIFIED BY 'dq_reader_pw';
GRANT SELECT, SHOW VIEW ON core_kh.* TO 'dq_reader'@'%';
GRANT SELECT, SHOW VIEW ON crm.*     TO 'dq_reader'@'%';
GRANT SELECT, SHOW VIEW ON card.*    TO 'dq_reader'@'%';
GRANT SELECT, SHOW VIEW ON other.*   TO 'dq_reader'@'%';
FLUSH PRIVILEGES;
