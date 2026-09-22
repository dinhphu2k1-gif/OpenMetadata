# Kế hoạch bàn giao Từ điển dữ liệu dùng chung theo từng chức năng

## 1. Tài liệu nguồn và phạm vi

Kế hoạch này là kế hoạch triển khai của tài liệu [Thiết kế luồng Từ điển dữ liệu dùng chung và CDE theo Version, Workflow và Role](./cde-glossary-ui-design.md). Khi có khác biệt, tài liệu thiết kế là nguồn yêu cầu nghiệp vụ; kế hoạch này quy định thứ tự thực hiện, kiểm thử và bàn giao.

### Trong phạm vi

- Duy nhất Glossary có định danh nghiệp vụ **Data Dictionary**, hiển thị là **Từ điển dữ liệu dùng chung**.
- Các GlossaryTerm trực thuộc Data Dictionary, được gọi là **Thành tố dữ liệu dùng chung (CDE)**.
- Business version, working/published snapshot, maker-checker workflow, phân quyền, danh sách CDE, tìm kiếm/lọc, import/export và Assets được mô tả trong tài liệu thiết kế.
- Data Dictionary là Glossary nghiệp vụ duy nhất được hỗ trợ; toàn bộ GlossaryTerm của nó được xử lý như CDE theo BusinessWorkflow.

### Ngoài phạm vi

- Không cung cấp UI hoặc luồng nghiệp vụ Glossary gốc (`Native Glossary`) của OpenMetadata.
- Không hỗ trợ tạo thêm Glossary nghiệp vụ khác ngoài Data Dictionary.
- Không xóa entity kỹ thuật `Glossary`/`GlossaryTerm` và native metadata version ở tầng OpenMetadata vì đây vẫn là nền lưu trữ, quan hệ và REST contract của Data Dictionary/CDE.

Trong tài liệu này:

- “Data Dictionary” hoặc “Từ điển dữ liệu dùng chung” chỉ Glossary chuyên biệt nêu trên.
- “CDE” chỉ GlossaryTerm trực thuộc Data Dictionary.
- Từ “Glossary” trong tên class/API chỉ mô tả implementation OpenMetadata; ở tầng sản phẩm, nó luôn được biểu diễn là Data Dictionary hoặc CDE.

## 2. Cách chia

Mỗi mục bên dưới là một lát dọc có thể nghiệm thu độc lập, gồm backend contract, authorization, persistence/query, frontend API, UI và test. Một chức năng chưa hoàn thành nếu mới có API hoặc mới có giao diện.

Mỗi chức năng nên là một PR; chức năng lớn có thể tách PR backend và frontend nhưng chỉ tích hợp vào nhánh phát hành khi cả hai đã hoàn tất. Không trộn refactor ngoài phạm vi.

## 3. Thứ tự triển khai

| ID | Chức năng | Phụ thuộc | Mốc bàn giao |
| --- | --- | --- | --- |
| F00 | BusinessWorkflow foundation và safety baseline | Không | Nền tảng |
| F01 | Consumer xem Approved mới nhất | F00 | Read-only pilot |
| F02 | Lịch sử Approved và deep link | F01 | Read-only pilot |
| F03 | Tạo và lưu Draft CDE | F00 | CDE maker |
| F04 | Submit, Reject và Reopen CDE | F03 | CDE checker |
| F05 | Approve và publish CDE | F01, F04 | Vòng đời CDE |
| F06 | Tạo business version CDE kế tiếp | F05 | Nhiều version CDE |
| F07 | Tạo và lưu Draft Data Dictionary | F00 | Dictionary maker |
| F08 | Thêm/bớt CDE revision trong working Data Dictionary | F05, F07 | Soạn gói phát hành |
| F09 | Workflow và publish Data Dictionary | F01, F08 | Vòng đời Dictionary |
| F10 | Tạo business version Data Dictionary kế tiếp | F09 | Nhiều version Dictionary |
| F11 | Bảng flat mọi CDE business version | F02, F05 | Tra cứu đầy đủ |
| F12 | Search, filter, sort và pagination | F11 | Khai thác dữ liệu |
| F13 | Export theo quyền và bộ lọc | F12 | Export |
| F14 | Import vào Draft | F03, F07 | Import |
| F15 | CDE Overview và Assets | F02, F05 | Chi tiết CDE |
| F16 | Archive/delete, audit và vận hành | F05, F09 | Production-ready |

F01–F02 nên làm trước các mutation vì read-only ít rủi ro. Hai nhánh CDE F03–F06 và Data Dictionary F07–F10 có thể phát triển riêng, nhưng không publish Data Dictionary trước khi invariant tham chiếu CDE snapshot đã được kiểm chứng.

### Ma trận truy vết về tài liệu thiết kế

| ID | Mục thiết kế được hiện thực |
| --- | --- |
| F00 | §2.2–2.4 Phạm vi CDE/version; §3 Trạng thái; §9.7 Phân quyền backend |
| F01 | §4.2 Nội dung được thấy; §6.1–6.2 Glossary UI; §7.1 CDE UI; §9.3, §9.5 |
| F02 | §2.3 Business version; §6.2 và §7.1 URL/version selector; §9.3, §9.5 |
| F03 | §5.4 Snapshot CDE; §7.1 Draft UI; §8 Save Draft; §9.5.3 |
| F04 | §3 State machine; §4.3 Ma trận thao tác; §7.1; §8; §9.5.3 |
| F05 | §5.4 Snapshot bất biến; §7.1 Approved; §8 Approve; §9.5.3; §9.7 |
| F06 | §5.5 Tạo business version mới của CDE; §7.1; §8 |
| F07 | §5.1–5.2 Snapshot/working Data Dictionary; §6.2; §8; §9.3.4 |
| F08 | §5.1 term revisions; §6.2–6.3 quản lý CDE trong bản làm việc; §9.3.4 |
| F09 | §3; §4; §5.1; §6.2; §8; §9.3.4 |
| F10 | §5.2 Data Dictionary version mới là bản trắng; §6.2; §8 |
| F11 | §6.3 Flat List và quyền xem |
| F12 | §6.3 Search, filters, pagination |
| F13 | §6.3 Export theo filter/quyền; §8 Export; §9.3.5 |
| F14 | §4.2–4.3 quyền Import; §6.2; §8 Import |
| F15 | §7.1 Overview, custom properties và Assets; §9.5–9.6 |
| F16 | §4.3 Delete/thu hồi; §6.2–7.1 action; §8 optimistic locking; §9.7 |

## 4. Chi tiết từng chức năng

### F00 — BusinessWorkflow foundation và safety baseline

**Phạm vi**

- Data Dictionary là Glossary nghiệp vụ duy nhất, có vòng đời Draft → InReview → Approved/Rejected và business version.
- CDE kế thừa workflow và vòng đời từ Data Dictionary, không có cấu hình workflow riêng.
- Tạo resolver backend dùng chung để nhận diện Data Dictionary bằng định danh ổn định, không hard-code display name rải rác.
- Loại bỏ entry point và route của Native Glossary khỏi frontend.

**Test/DoD**

- Backend từ chối tạo hoặc sử dụng Glossary nghiệp vụ ngoài Data Dictionary qua các API thuộc phạm vi tính năng này.
- UI không hiển thị trang, action hoặc điều hướng sang Native Glossary.
- Term không thể cấu hình workflow khác Data Dictionary cha.
- UI và API chỉ triển khai trực tiếp luồng Data Dictionary/CDE, không có nhánh cấu hình lựa chọn hành vi.

### F01 — Consumer xem Approved mới nhất

**Phạm vi**

- GET mặc định resolve published head cho Consumer.
- Sidebar chỉ trả Glossary đã có published snapshot.
- Entity chưa publish không được fallback sang identity hoặc Draft.
- Trang Glossary/CDE read-only; không render action trong lúc chờ permission.

**Test/DoD**

- Consumer vẫn thấy v1.0 khi v1.1 đang Draft, InReview hoặc Rejected.
- Working endpoint hay FQN chưa publish trả 403/404 và không lộ payload.
- Có E2E Consumer xem Data Dictionary và CDE Approved.

### F02 — Lịch sử Approved và deep link

**Phạm vi**

- Không expose native history ở tầng sản phẩm; dùng `/published` cho business history.
- Data Dictionary hỗ trợ query version; CDE hỗ trợ `glossaryVersion` và `version` để giữ tương thích với REST contract kỹ thuật.
- Nếu chỉ có `glossaryVersion`, resolve CDE revision từ Data Dictionary snapshot.
- Selector, badge và breadcrumb đồng bộ URL; historical snapshot luôn read-only.

**Test/DoD**

- F5, bookmark và back/forward giữ đúng version.
- Version không tồn tại trả 404; Consumer trỏ vào non-Approved bị chặn.
- Version 1.10 sắp sau 1.2 bằng comparator số.
- Native version không xuất hiện trong UI hoặc business response.

### F03 — Tạo và lưu Draft CDE

**Phạm vi**

- Tạo identity và working record nhất quán.
- PATCH working bắt buộc expectedRevision integer; chỉ Draft được sửa.
- Save tăng workingRevision, không tăng native version.
- UI có loading/disabled; sau save dùng revision mới từ response.
- 409 yêu cầu reload, không tự retry ghi đè.

**Test/DoD**

- Create và save nhiều lần.
- Hai writer cùng revision: một thành công, một nhận 409.
- Không fallback từ workingRevision sang native version.
- Consumer/Reviewer mặc định không tạo hoặc sửa Draft.

### F04 — Submit, Reject và Reopen CDE

**Phạm vi**

- Draft → InReview qua submit.
- InReview → Rejected qua reject.
- Rejected → Draft qua reopen.
- Transition sai trạng thái bị từ chối.
- Reviewer phải được gán hoặc có policy; lưu actor và timestamp.
- InReview khóa form; Rejected hiển thị người từ chối.

**Test/DoD**

- Test transition hợp lệ và không hợp lệ.
- Reviewer không được gán và Proposer approve/reject đều bị 403.
- Consumer không nhìn thấy InReview/Rejected.
- E2E Draft → InReview → Rejected → Draft.

### F05 — Approve và publish CDE

**Phạm vi**

- InReview → Approved trong transaction.
- Ghi snapshot, content hash, publication sequence, published head và outbox.
- Chỉ xóa working record sau khi snapshot/head thành công.
- Không endpoint nào được sửa snapshot.
- UI chuyển sang published view sau approve.

**Test/DoD**

- Failure giữa insert snapshot và update head rollback toàn bộ.
- Snapshot payload/hash không đổi sau mutation tương lai.
- Approve cùng revision hai lần chỉ một lần thành công.
- E2E Draft → InReview → Approved → Consumer read.

### F06 — Tạo business version CDE kế tiếp

**Phạm vi**

- Version canonical, chưa tồn tại và lớn hơn latest published.
- Draft mới chỉ giữ id, name, FQN và liên kết Glossary.
- Business fields, tags, owners, domains và extension bắt đầu rỗng.
- Chỉ một working version tại một thời điểm.

**Test/DoD**

- Version trùng, thấp hơn hoặc sai định dạng bị từ chối.
- Không copy nhầm business fields.
- E2E publish v1.0 → tạo v1.1 Draft → Consumer vẫn xem v1.0.

### F07 — Tạo và lưu Draft Data Dictionary

**Phạm vi**

- Áp dụng optimistic locking như F03 ở cấp Data Dictionary.
- Working payload luôn có termRevisions hợp lệ.
- Bản đầu tiên giữ dữ liệu vừa nhập; Save không đổi published Data Dictionary.
- Header có Save Draft, badge và permission-driven actions.

**Test/DoD**

- Concurrent save trả 409.
- Save Draft không làm đổi term snapshot.
- Request tạo hoặc vận hành Glossary nghiệp vụ ngoài Data Dictionary bị từ chối rõ ràng.

### F08 — Thêm/bớt CDE revision trong working Data Dictionary

**Phạm vi**

- Chỉ thêm CDE snapshot Approved, tồn tại và thuộc đúng Data Dictionary.
- Lưu cặp termId và termBusinessVersion, không chỉ termId.
- Add/remove dùng optimistic locking.
- Nút Thêm CDE chỉ thao tác trên working version; Approved không bị mutate.

**Test/DoD**

- Không thêm Draft/Rejected CDE hoặc CDE của Glossary khác.
- Add/remove conflict trả 409.
- CDE version mới không tự thay thế version đã chọn.
- Reload giữ đúng revisions và display order.

### F09 — Workflow và publish Data Dictionary

**Phạm vi**

- Submit, Reject, Reopen, Approve và authorization tương tự CDE.
- Trước approve, validate mọi term revision còn tồn tại và Approved.
- Snapshot Data Dictionary và liên kết CDE snapshots ghi trong cùng transaction.
- InReview/historical Approved khóa add/remove.

**Test/DoD**

- Data Dictionary v1.0 vẫn trả CDE v1.0 sau khi CDE v1.1 được publish.
- Một term revision lỗi làm approve thất bại toàn bộ.
- Reviewer assignment và concurrency có integration test.
- E2E publish Data Dictionary có nhiều CDE revisions.

### F10 — Tạo business version Data Dictionary kế tiếp

**Phạm vi**

- Version lớn hơn latest published.
- termRevisions luôn rỗng; không kế thừa ngầm CDE list.
- Giữ identity fields; Approved cũ tiếp tục phục vụ Consumer.

**Test/DoD**

- Không copy term revisions từ bản trước.
- Không đổi published head trước khi bản mới Approved.
- E2E v1.0 Approved → tạo v2.0 Draft trống.

### F11 — Bảng flat mọi CDE business version

**Phạm vi**

- Backend read model trả một row cho termId, businessVersion và status.
- Manager nhận working + published theo quyền; Consumer chỉ nhận published.
- Total count tính sau authorization.
- Row key gồm termId và businessVersion; click row tạo URL đúng context.

**Test/DoD**

- Fixture gồm Approved 1.0, Approved 1.1, Rejected 1.2 và Draft 2.0.
- Consumer thấy 1.0/1.1; manager thấy đủ bốn dòng.
- Pagination không trùng hoặc mất row.
- Không client-side N+1 để hydrate lịch sử.

### F12 — Search, filter, sort và pagination

**Phạm vi**

- Search name + displayName, debounce 500 ms.
- Multi-status gồm Rejected cho manager.
- Domain, DataSource, Owner và DataClassification.
- Điều kiện kết hợp AND.
- Page size 10/15/25/50; đổi điều kiện reset trang đầu.

**Test/DoD**

- Contract test từng filter và tổ hợp.
- Consumer gửi status Draft vẫn chỉ nhận Approved.
- Response cũ trả chậm không ghi đè response mới.
- Có query-count và performance test; không N+1.

### F13 — Export theo quyền và bộ lọc

**Phạm vi**

- Export dùng chung filter DTO, query builder và authorization với F11/F12.
- Async export lưu actor và filter trong audit.
- Frontend gửi search/filter/sort context và hiển thị progress/error.

**Test/DoD**

- List/export parity test cùng điều kiện.
- Consumer export không chứa non-Approved.
- Test CSV escaping, Unicode tiếng Việt và Markdown.

### F14 — Import vào Draft

**Phạm vi**

- Parse/validate preview trước khi ghi.
- Mọi mutation dùng optimistic locking.
- Chốt atomic toàn file hoặc partial success có báo cáo; ưu tiên atomic cho file nhỏ.
- Không import vào historical/Approved snapshot.

**Test/DoD**

- File hợp lệ, sai schema, trùng version, sai reference và conflict preview/commit.
- Import lỗi không tạo Approved hoặc working data nửa vời ngoài chính sách.
- UAT bằng file thực tế, lỗi chỉ rõ từng dòng.

### F15 — CDE Overview và Assets

**Phạm vi**

- Overview gồm basic fields, owners, reviewers, domains, tags và 5 custom properties.
- Chỉ ẩn restricted tabs với CDE thuộc Data Dictionary.
- Assets dùng đúng CDE identity; chốt mapping là hiện hành hay snapshot-aware.

**Test/DoD**

- Historical Approved view read-only.
- Test date, enum và Markdown custom properties.
- GlossaryTerm thường vẫn giữ tab hiện hữu.
- Assets có pagination, empty và error states.

### F16 — Archive/delete, audit và vận hành

**Phạm vi**

- Delete chỉ cho Draft/Rejected theo policy.
- Archive chỉ cho Admin/Steward phù hợp; snapshot vẫn còn để audit.
- Audit transition, actor, revision và business version.
- Theo dõi 403/409/5xx, publish failure, latency và outbox lag.
- Có runbook rollback bản triển khai, backup/restore và xử lý outbox lỗi.

**Test/DoD**

- Test quyền và confirm modal delete/archive.
- Archived snapshot không là latest nhưng vẫn truy vết theo chính sách.
- Diễn tập rollback bản triển khai và restore; không làm mất snapshot.
- Có UAT sign-off, dashboard, alert và rollback runbook.

## 5. Quy trình cho mỗi chức năng

1. Chốt acceptance criteria và API contract.
2. Viết backend test thất bại.
3. Triển khai backend và authorization.
4. Chạy integration và non-regression tests.
5. Viết frontend API/hook test.
6. Triển khai UI và component tests.
7. Thêm một E2E hành trình chính.
8. Triển khai ở dev/UAT và review bằng chứng rồi mới làm chức năng tiếp theo.

Checklist bắt buộc cho mỗi PR:

- [ ] Chỉ Data Dictionary và CDE được đi qua business workflow.
- [ ] Backend không dựa vào UI để bảo vệ dữ liệu.
- [ ] Có positive và negative authorization tests.
- [ ] Có test 409 nếu là mutation.
- [ ] Có negative test chứng minh Native Glossary không được expose qua UI hoặc business API.
- [ ] Không trộn native version, business version và working revision.
- [ ] UI có loading, empty, error và stale-request handling.
- [ ] Có thể rollback bản triển khai mà không xóa dữ liệu.

## 6. Các mốc phát hành

- **Milestone A — Tra cứu an toàn:** F00–F02.
- **Milestone B — Vòng đời CDE:** F03–F06.
- **Milestone C — Bản phát hành Từ điển dữ liệu dùng chung:** F07–F10.
- **Milestone D — Khai thác dữ liệu:** F11–F15.
- **Milestone E — Production-ready:** F16 và full regression/security/performance suite.

Không cần chờ Milestone D mới pilot Milestone A. Đây là lợi ích chính của triển khai theo từng chức năng.
