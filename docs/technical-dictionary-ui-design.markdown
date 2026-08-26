# Thiết kế giao diện Từ điển kỹ thuật

> Trạng thái: Bản thiết kế để review  
> Phạm vi: Desktop, màn danh sách và màn chi tiết  
> Nguồn dữ liệu tham chiếu: `input/TuDienKyThuat.xlsx`  
> Giao diện tham chiếu: trang Glossary gốc của OpenMetadata và giao diện CDE hiện có

## 1. Mục tiêu

Thiết kế một giao diện riêng cho glossary **Từ điển kỹ thuật**, đồng nhất với OpenMetadata đang chạy trong dự án. Giao diện giúp người dùng:

- Tìm, lọc và so sánh nhanh các thành tố dữ liệu kỹ thuật.
- Mở một thành tố để xem đầy đủ ngữ cảnh nghiệp vụ, nguồn hệ thống và đặc tả kỹ thuật.
- Chuẩn bị sẵn cấu trúc để bổ sung thao tác tạo, chỉnh sửa và phân quyền trong giai đoạn triển khai.

Thiết kế không thay đổi shell của OpenMetadata. Top bar, thanh điều hướng icon, sidebar Thuật ngữ, header glossary, tab, màu sắc và nhịp khoảng cách phải dùng lại từ sản phẩm hiện tại.

### Ngoài phạm vi bản thiết kế này

- Giao diện mobile/tablet.
- Luồng import Excel, tạo mới và chỉnh sửa dữ liệu.
- Thay đổi API hoặc schema phía backend.
- Thiết kế đồ thị quan hệ, tài sản liên quan và luồng hoạt động.

## 2. Nguyên tắc thiết kế đã chốt

- Màu thương hiệu lấy từ theme hiện tại: primary `#AE1C3F`, hover `#D03A5F`, selected `#8A1531`.
- Nền ứng dụng xám rất nhạt; card và bảng màu trắng; viền xám mảnh; shadow nhẹ.
- Không tạo thanh điều hướng đỏ mới. Thanh icon ngoài cùng phải giữ nền trắng như giao diện gốc.
- Sidebar **Thuật ngữ** luôn hiện và mục **Từ điển kỹ thuật** ở trạng thái được chọn.
- Màn danh sách dùng tập cột mặc định gọn, kết hợp chức năng **Tùy chỉnh cột**.
- Màn chi tiết là một trang **Tổng quan** chia theo các khối thông tin; không chia các trường kỹ thuật thành nhiều tab.
- Trường không có dữ liệu hiển thị dấu `—`, không tự suy diễn giá trị.
- Mã, tên bảng và tên trường giữ nguyên kiểu chữ/ký tự từ nguồn; tên kỹ thuật có thể dùng font monospace.

## 3. Mockup

### 3.1. Danh sách

![Mockup danh sách Từ điển kỹ thuật](./assets/technical-dictionary/technical-dictionary-list.png)

### 3.2. Chi tiết

![Mockup chi tiết thành tố kỹ thuật](./assets/technical-dictionary/technical-dictionary-detail.png)

## 4. Màn danh sách

### 4.1. Cấu trúc trang

1. **Shell OpenMetadata**
   - Top bar gồm tìm kiếm toàn cục, loại tài sản, miền, ngôn ngữ, thông báo, trợ giúp và tài khoản.
   - Thanh icon điều hướng ngoài cùng và sidebar Thuật ngữ giữ nguyên component hiện tại.
2. **Header glossary**
   - Eyebrow: `Glossaries`.
   - Tiêu đề và mô tả ngắn: `Từ điển kỹ thuật`.
   - CTA chính: `Thêm thuật ngữ`.
   - Các nút reaction và menu khác giữ hành vi mặc định của OpenMetadata.
3. **Tab điều hướng**
   - `Thuật ngữ` là tab mặc định.
   - `Đồ thị quan hệ` và `Luồng hoạt động & Nhiệm vụ` giữ nguyên.
4. **Toolbar của bảng**
   - Tìm kiếm theo mã, tên thành tố, tên bảng hoặc tên trường.
   - Bộ lọc: Hệ thống nguồn, Chủ sở hữu, Loại dữ liệu, Loại thành tố.
   - Bộ chọn cột: `Tùy chỉnh cột`.
   - Hiển thị tổng số bản ghi theo kết quả hiện tại.
5. **Bảng dữ liệu**
   - Header sticky khi cuộn dọc.
   - Có scrollbar ngang khi chiều rộng các cột vượt viewport.
   - Có phân trang và lựa chọn số hàng trên trang.

### 4.2. Cột mặc định

| Thứ tự | Cột | Cách hiển thị | Hành vi |
|---:|---|---|---|
| 1 | Mã CDE | Link màu primary, cố định bên trái | Mở trang chi tiết |
| 2 | Tên thành tố | Tối đa 2–3 dòng, tooltip khi bị cắt | Có thể sort |
| 3 | Hệ thống nguồn | Text hoặc `—` | Có thể lọc |
| 4 | Chủ sở hữu | Avatar nhỏ và tên | Có thể lọc |
| 5 | Tên bảng | Monospace | Có thể sort |
| 6 | Tên trường | Monospace | Có thể sort |
| 7 | Loại dữ liệu | Pill xanh nhạt | Có thể lọc |
| 8 | Loại thành tố | Pill tím nhạt | Có thể lọc |
| 9 | Thời gian | Text hoặc pill xanh khi có giá trị | Có thể sort |

Mã CDE là cột luôn hiển thị. Các cột còn lại có thể bật/tắt bằng `Tùy chỉnh cột`; lựa chọn của người dùng được lưu theo preference key riêng của Từ điển kỹ thuật.

### 4.3. Cột tùy chọn

- Định nghĩa thành tố.
- Báo cáo / Màn hình / Chức năng.
- Chủ sở hữu hệ thống.
- Owner.
- Mô tả trường dữ liệu.
- Độ dài trường.
- Chữ số sau dấu phẩy.
- Loại trường dữ liệu.
- Phương thức tạo dữ liệu.
- Tài liệu liên quan.
- Ghi chú.
- Trạng thái và hành động theo chuẩn Glossary Term.

### 4.4. Hành vi tương tác

- Tìm kiếm debounce khoảng 300–500 ms; Enter thực hiện ngay.
- Các bộ lọc hỗ trợ xóa riêng lẻ và `Xóa tất cả` khi có từ hai điều kiện trở lên.
- Thay đổi filter/search đưa phân trang về trang đầu.
- Mã CDE và click hàng đều mở trang chi tiết; click các control trong hàng không kích hoạt điều hướng.
- Cột kỹ thuật hiển thị tooltip khi nội dung bị cắt.
- Trạng thái loading dùng skeleton của bảng; không làm biến mất toolbar.
- Empty state do không có dữ liệu và empty state do tìm kiếm không có kết quả phải dùng nội dung khác nhau.

## 5. Màn chi tiết

### 5.1. Header và tab

- Breadcrumb: `Từ điển kỹ thuật / {Mã CDE}`.
- Hiển thị mã CDE, tên thành tố, trạng thái workflow và các hành động được cấp quyền.
- Tab mặc định: `Tổng quan`.
- Các tab tiếp theo: `Tài sản liên quan`, `Đồ thị quan hệ`, `Luồng hoạt động & Nhiệm vụ`.

### 5.2. Các khối thông tin

| Khối | Trường |
|---|---|
| Thông tin nghiệp vụ | Tên thành tố; Định nghĩa thành tố; Mô tả ý nghĩa |
| Hệ thống và nguồn dữ liệu | Hệ thống nguồn; Báo cáo / Màn hình / Chức năng; Chủ sở hữu hệ thống; Owner |
| Đặc tả kỹ thuật | Tên bảng; Tên trường; Mô tả trường dữ liệu; Loại dữ liệu; Độ dài trường; Chữ số sau dấu phẩy |
| Đặc tính dữ liệu | Loại thành tố dữ liệu; Loại trường dữ liệu; Phương thức tạo dữ liệu; Thời gian sẵn sàng |
| Tài liệu và ghi chú | Tài liệu liên quan; Ghi chú |

Hai khối đầu nằm trên cùng một hàng desktop; hai khối đặc tả nằm ở hàng tiếp theo. **Tài liệu và ghi chú** chiếm toàn bộ chiều rộng. Trường có nội dung dài phải tự tăng chiều cao, không cắt mất dữ liệu ở trang chi tiết.

### 5.3. Chỉnh sửa và phân quyền

- Nút `Chỉnh sửa` toàn trang xuất hiện khi người dùng có quyền chỉnh Glossary Term.
- Icon bút chì tại từng khối chỉ xuất hiện nếu khối đó có thể chỉnh sửa với quyền hiện tại.
- View version là read-only và không hiển thị hành động chỉnh sửa.
- Owner/reviewer dùng component chọn user/team hiện có khi dữ liệu đã được resolve thành entity reference.

## 6. Đọc và ánh xạ dữ liệu Excel

### 6.1. Quy ước đọc file

- Sheet sử dụng: `Tudien_KT`.
- Hàng 1 là diễn giải/hướng dẫn nhập liệu; **không phải yêu cầu giao diện và không import thành dữ liệu**.
- Hàng 2 mô tả bắt buộc/tùy chọn; dùng làm metadata validation cho luồng import sau này.
- Hàng 3 là tên cột.
- Dữ liệu bắt đầu từ hàng 4.
- Cần nhận diện cột bằng tên header đã chuẩn hóa, không dựa hoàn toàn vào vị trí, vì file có các cột Việt/Anh xen kẽ và một số bản ghi không điền đủ cột.

### 6.2. Ánh xạ logic đề xuất

| Trường giao diện | Header Excel tiếng Việt | Lưu trữ đề xuất trong GlossaryTerm |
|---|---|---|
| Mã CDE | Mã CDE | `name` |
| Tên thành tố | Tên Thành Tố | `displayName` |
| Định nghĩa thành tố | Định Nghĩa Thành Tố | `description` |
| Hệ thống nguồn | Hệ Thống nguồn | custom property `he_thong_nguon` |
| Báo cáo / Màn hình / Chức năng | Báo cáo/ Màn hình/ Chức năng | custom property `bao_cao_man_hinh_chuc_nang` |
| Chủ sở hữu hệ thống | Chủ Sở Hữu Hệ Thống | custom property `chu_so_huu_he_thong` |
| Owner | Owner | `owners` nếu resolve được; đồng thời giữ raw value khi import |
| Tên bảng | Tên Bảng | custom property `ten_bang` |
| Tên trường | Tên Trường | custom property `ten_truong` |
| Mô tả trường dữ liệu | Mô tả trường dữ liệu | custom property `mo_ta_truong_du_lieu` |
| Loại dữ liệu | Loại Dữ Liệu | custom property hoặc classification `loai_du_lieu` |
| Độ dài trường | Độ Dài Trường | custom property `do_dai_truong` |
| Chữ số sau dấu phẩy | Chữ Số Sau Dấu Phẩy | custom property `chu_so_sau_dau_phay` |
| Loại thành tố dữ liệu | Loại Thành Tố Dữ Liệu | classification `loai_thanh_to_du_lieu` |
| Loại trường dữ liệu | Loại Trường Dữ Liệu (Trong Hệ Thống) | classification `loai_truong_du_lieu` |
| Phương thức tạo dữ liệu | Phương Thức Tạo Dữ Liệu | classification `phuong_thuc_tao_du_lieu` |
| Thời gian sẵn sàng | Thời Gian | custom property `thoi_gian_san_sang` |
| Tài liệu liên quan | Tài Liệu Liên Quan | custom property `tai_lieu_lien_quan` |
| Ghi chú | Notes | custom property `ghi_chu` |

Các tên custom property/classification ở trên là contract đề xuất cho giai đoạn triển khai. Importer phải chuẩn hóa giá trị nhưng vẫn lưu được raw value để kiểm tra các dòng có hiện tượng lệch cột.

## 7. Trạng thái và trường hợp biên

- **Không có dữ liệu:** hiển thị empty state cùng CTA `Thêm thuật ngữ` nếu có quyền.
- **Không có kết quả tìm kiếm:** giữ toolbar và hiển thị hướng dẫn xóa filter/từ khóa.
- **Thiếu giá trị:** hiển thị `—`; không thay bằng dữ liệu suy đoán từ bảng hoặc mã trường.
- **Nội dung dài:** danh sách cắt dòng có tooltip; chi tiết hiển thị đầy đủ.
- **Nhiều owner:** hiển thị tối đa hai avatar/tên và `+N`; chi tiết hiển thị toàn bộ.
- **Lỗi tải:** dùng ErrorPlaceholder hiện có và nút thử lại.
- **Không có quyền xem custom field:** ẩn trường/khối bị hạn chế thay vì hiển thị giá trị rỗng.
- **Tên bảng hoặc trường chứa ký tự đặc biệt:** hiển thị nguyên văn và không tự đổi chữ hoa/thường.

## 8. Hướng triển khai đề xuất

- Bổ sung hàm nhận diện riêng cho glossary **Từ điển kỹ thuật**; không mở rộng `isDataDictionaryGlossary` theo cách khiến UI CDE được áp dụng cho cả hai loại glossary.
- Tái sử dụng luồng tải dữ liệu, phân trang, search, column preference và permission trong `GlossaryTermTab`; thêm bộ cột kỹ thuật và preference key riêng.
- Tạo phần summary/overview kỹ thuật riêng cho `GlossaryTermsV1`, nhưng tái sử dụng component owner, status, custom property và edit permission hiện có.
- Bổ sung nhãn tiếng Việt vào locale thay vì hard-code text trong component.
- Mở rộng style hiện có trong `glossaryV1.less`, giới hạn bằng class của Từ điển kỹ thuật để không ảnh hưởng glossary thường và CDE.

Các khu vực mã nguồn dự kiến:

- `openmetadata-ui/src/main/resources/ui/src/constants/Glossary.contant.ts`
- `openmetadata-ui/src/main/resources/ui/src/components/Glossary/GlossaryTermTab/`
- `openmetadata-ui/src/main/resources/ui/src/components/Glossary/GlossaryTerms/`
- `openmetadata-ui/src/main/resources/ui/src/components/Glossary/glossaryV1.less`
- `openmetadata-ui/src/main/resources/ui/src/locale/languages/vi-vn.json`

## 9. Tiêu chí nghiệm thu UI

- Shell, sidebar và header không khác cấu trúc trang Glossary gốc.
- Chỉ glossary Từ điển kỹ thuật nhận giao diện tùy biến mới.
- Danh sách có đủ 9 cột mặc định, bộ lọc, tìm kiếm, tùy chỉnh cột, phân trang và scrollbar ngang.
- Tùy chỉnh cột được lưu và khôi phục độc lập với bảng CDE.
- Trang chi tiết bao phủ đầy đủ 19 trường logic trong file Excel.
- Giá trị rỗng hiển thị `—`; không có dữ liệu giả định.
- Text tiếng Việt đúng dấu; tên bảng và tên trường giữ nguyên.
- Loading, empty, error, no-permission và long-content đều có kiểm thử.
- Giao diện không gây regression cho glossary thường và Từ điển dữ liệu dùng chung/CDE.
- Bảng hoạt động tốt ở viewport desktop từ 1280 px trở lên.

## 10. Checklist review thiết kế

- [ ] Bố cục danh sách phù hợp với quy trình tra cứu thực tế.
- [ ] Chín cột mặc định là đủ để nhận diện và so sánh thành tố.
- [ ] Cách nhóm trường ở màn chi tiết dễ đọc.
- [ ] Thuật ngữ tiếng Việt và tên nhóm thông tin đã chính xác.
- [ ] Màu pill cho loại dữ liệu/loại thành tố phù hợp.
- [ ] Quy tắc hiển thị dữ liệu trống bằng `—` được chấp nhận.
- [ ] Ánh xạ GlossaryTerm/custom property/classification được chấp nhận trước khi implement.

