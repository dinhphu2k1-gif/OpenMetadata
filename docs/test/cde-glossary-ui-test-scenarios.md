| ID | Thao tác | Kết quả mong đợi |
|---|---|---|
| F00-UI-01 | Manager mở Data Dictionary trên môi trường sạch | Hiển thị “Từ điển dữ liệu dùng chung”, badge Draft, business version `1.0`; không có chức năng tạo Glossary thứ hai |
| F00-UI-02 | Mở danh sách và form CDE | Tất cả CDE ngang hàng; không có cây, chọn parent CDE hoặc tạo sub-term |
| F07-UI-01 | Manager sửa Data Dictionary Draft và nhấn “Lưu nháp” | Chỉ gửi một PATCH; version giữ `1.0`; revision tăng một |
| F07-UI-02 | Hai tab lưu cùng revision | Tab lưu sau nhận 409, giữ dữ liệu chưa lưu và cho tải bản mới |
| F07-UI-03 | Viewer và Consumer-only mở Data Dictionary Draft | Viewer chỉ xem; Consumer không nhận working payload |
| F03-UI-01 | Manager mở form tạo CDE | Data Dictionary lấy từ context; không có chọn Glossary cha, parent CDE, workflow hoặc business version |
| F03-UI-02 | Nhập dữ liệu hợp lệ và tạo CDE | Chỉ gửi một POST; trả Draft v1.0, revision 1 và nhãn “Chưa thêm vào gói phát hành” |
| F03-UI-03 | Bật throttling và double-click nút tạo | Chỉ gửi một request; nút loading/disabled; không tạo row trùng |
| F03-UI-04 | Nhập name sai, reference sai hoặc name trùng | Hiển thị lỗi phù hợp; lỗi 400/409 không để lại row giả |
| F03-UI-05 | Sửa và lưu CDE Draft hai lần | Version giữ `1.0`; revision tăng `1 → 2 → 3`; mỗi lần chỉ gửi một PATCH |
| F03-UI-06 | Hai tab cùng sửa một revision | Tab lưu sau nhận 409, giữ dữ liệu chưa lưu và không tự retry |
| F03-UI-07 | Reload khi CDE Draft chưa được đóng gói | CDE vẫn hiện trong khu vực authoring; Consumer không nhìn thấy |
| F04-UI-01 | Proposer gửi duyệt CDE Draft | Chuyển sang InReview; form bị khóa |
| F04-UI-02 | Reviewer được gán từ chối CDE InReview | Chuyển sang Rejected; hiển thị người, lý do và thời gian từ chối |
| F04-UI-03 | Người có quyền chọn “Chỉnh sửa lại” trên CDE Rejected | Chuyển về Draft và form sửa được |
| F04-UI-04 | Người không có quyền thực hiện transition | Action không hiển thị hoặc request bị từ chối; trạng thái không đổi |
| F05-UI-01 | Reviewer phê duyệt CDE InReview | Chuyển sang Approved chỉ đọc; Consumer có thể đọc snapshot sau khi Data Dictionary được publish |
| F05-UI-02 | Double-click phê duyệt khi mạng chậm | Chỉ gửi một request; không tạo snapshot thứ hai |
| F06-UI-01 | Tạo business version CDE kế tiếp từ bản Approved | Tạo một working version trên cùng identity; business fields bắt đầu rỗng |
| F06-UI-02 | Nhập version sai định dạng, trùng hoặc nhỏ hơn latest | UI/server từ chối; không tạo working record mới |
| F06-UI-03 | Consumer truy cập khi CDE version mới chưa Approved | Không thấy version mới; vẫn dùng bản Approved thuộc Data Dictionary đã publish |
| F08-UI-01 | Manager thêm một CDE version vào gói phát hành | Lưu đúng termId/businessVersion; Dictionary revision tăng; reload giữ đúng row |
| F08-UI-02 | Manager loại một CDE version khỏi gói | Chỉ revision đã chọn bị bỏ; CDE không bị xóa; Dictionary version không đổi |
| F08-UI-03 | Publish CDE version mới sau khi gói đã chọn version cũ | Gói vẫn giữ version đã chọn; không tự nâng lên latest |
| F08-UI-04 | Thêm CDE Glossary khác hoặc sửa historical Dictionary | Mutation bị từ chối; historical view luôn bị khóa |
| F09-UI-01 | Manager gửi duyệt Data Dictionary Draft | Chuyển sang InReview; form và add/remove bị khóa |
| F09-UI-02 | Reviewer từ chối rồi Manager chỉnh sửa lại | Trạng thái chuyển `InReview → Rejected → Draft`; lý do từ chối được lưu |
| F09-UI-03 | Reviewer phê duyệt Data Dictionary | Data Dictionary và liên kết CDE snapshot chuyển Approved nhất quán; Consumer đọc được |
| F09-UI-04 | Phê duyệt gói có CDE revision không hợp lệ | Hiển thị lỗi; không chuyển nửa vời sang Approved |
| F10-UI-01 | Tạo Draft Data Dictionary kế tiếp từ latest Approved | Tạo working version trên cùng identity; `termRevisions` rỗng |
| F10-UI-02 | Nhập version sai, trùng hoặc nhỏ hơn latest | UI/server từ chối; published head không đổi |
| F10-UI-03 | Consumer mở route mặc định khi version mới chưa Approved | Vẫn hiển thị latest Approved trước đó |
| F01-UI-01 | Consumer-only mở Data Dictionary đã publish không có query param | Hiển thị bản Approved mới nhất ở chế độ chỉ đọc; không có action mutation |
| F01-UI-02 | Consumer-only truy cập CDE Draft/InReview/Rejected | Nhận 403/404; không thấy identity, working row hoặc payload chưa publish |
| F01-UI-03 | Người vừa có role Consumer vừa có `canViewWorking` mở route mặc định | Hiển thị working view theo capability; không bị ép sang published-only |
| F02-UI-01 | Mở Data Dictionary lịch sử, đổi version, F5 và dùng Back/Forward | Hiển thị đúng snapshot; historical view chỉ đọc; version sắp xếp `1.10`, `1.2`, `1.0` |
| F02-UI-02 | Mở CDE với đủ `businessVersion` và `parentBusinessVersion` | Nội dung, badge, breadcrumb và Data Dictionary context đúng hai version |
| F02-UI-03 | Mở CDE thiếu param, version không tồn tại hoặc cặp version không khớp | Hiển thị 404; không fallback, không tự suy diễn param và không lộ payload |
| F02-UI-04 | Quan sát Network khi đổi version | Dùng endpoint `/published/{businessVersion}`; không gửi `version` hoặc `nativeVersion` |
| F11-UI-01 | Manager mở bảng có nhiều version và trạng thái CDE | Hiển thị mỗi termId/businessVersion thành một row ngang hàng; không có cây |
| F11-UI-02 | Consumer mở cùng bảng | Chỉ thấy CDE Approved; total count không tính row bị ẩn |
| F11-UI-03 | Click một row lịch sử | URL có đúng `businessVersion` và `parentBusinessVersion` |
| F11-UI-04 | Duyệt qua các trang | Không trùng hoặc mất row; không phát sinh request N+1 cho từng row |
| F12-UI-01 | Gõ nhanh trong ô tìm kiếm | Chỉ gửi request sau khoảng 500 ms; tìm theo name/displayName; reset về trang 1 |
| F12-UI-02 | Kết hợp status, Domain, DataSource, Owner và DataClassification | Các nhóm filter kết hợp AND; UI và request có cùng điều kiện |
| F12-UI-03 | Đổi sort và page size 10/15/25/50 | Thứ tự và số row đúng; đổi điều kiện reset về trang đầu |
| F12-UI-04 | Request cũ trả về sau request mới | Response cũ không ghi đè kết quả mới |
| F12-UI-05 | Kiểm tra loading, empty và API error | Hiển thị đúng từng trạng thái và có thể retry |
| F13-UI-01 | Thiết lập bộ lọc rồi chọn Export | Export dùng đúng search/filter/sort hiện tại; UI hiển thị tiến độ và lỗi |
| F13-UI-02 | Consumer export dữ liệu | File không chứa CDE non-Approved |
| F13-UI-03 | Export dữ liệu có dấu phẩy, xuống dòng, Markdown và tiếng Việt | File escape đúng, không lỗi Unicode và giữ đúng nội dung |
| F14-UI-01 | Chọn file import hợp lệ vào Draft | Hiển thị preview trước khi ghi dữ liệu |
| F14-UI-02 | Chọn file sai schema, trùng version hoặc sai reference | Hiển thị đúng dòng/cột/lý do; không tạo dữ liệu nửa vời |
| F14-UI-03 | Revision thay đổi sau preview rồi commit import | Hiển thị conflict; không tự ghi đè; yêu cầu preview lại |
| F14-UI-04 | Import vào Approved hoặc historical view | Action không hiển thị hoặc request bị từ chối |
| F15-UI-01 | Mở CDE có đầy đủ thông tin và custom properties | Hiển thị đúng basic fields, owners, reviewers, domains, tags, date, enum và Markdown |
| F15-UI-02 | Mở CDE Approved lịch sử | Overview chỉ đọc; breadcrumb giữ đúng Data Dictionary context |
| F15-UI-03 | Mở tab Assets ở trạng thái có dữ liệu, rỗng và lỗi | Pagination, loading, empty, error và retry hoạt động đúng |
| F16-UI-01 | Xóa CDE Draft hoặc Rejected | Hiển thị modal xác nhận đúng đối tượng/version; xóa xong cập nhật danh sách |
| F16-UI-02 | Thử xóa CDE InReview, Approved hoặc historical | Action không hiển thị hoặc request bị từ chối; dữ liệu còn nguyên |
| F16-UI-03 | Admin/Steward archive latest | Bản archive không còn là latest; lịch sử và audit vẫn truy vết được |
| F16-UI-04 | Mở audit sau các thao tác workflow | Hiển thị đúng action, actor, thời gian, business version và revision |
| F16-UI-05 | Giả lập lỗi 403, 409 và 5xx | Hiển thị đúng loại lỗi; không báo thành công giả; state không bị hỏng |
| REG-UI-01 | Kiểm tra label, URL và payload trong các luồng | Không dùng lẫn `businessVersion`, `workingRevision` và native version |
| REG-UI-02 | Làm chậm permission API khi mở trang bằng user hạn chế | Action nhạy cảm không xuất hiện trước khi xác định quyền |
| REG-UI-03 | Dùng F5, bookmark và Back/Forward trên working/latest/historical | Mỗi route phục hồi đúng state và version |
