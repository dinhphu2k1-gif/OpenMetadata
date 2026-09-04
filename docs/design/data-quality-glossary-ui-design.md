# Thiết kế giao diện Glossary Chất lượng dữ liệu (Data Quality Glossary)

> **Trạng thái:** Bản thiết kế chi tiết để review & phê duyệt triển khai  
> **Phạm vi:** Desktop UI (Màn danh sách & Màn chi tiết Glossary Term), Phân quyền & Quản trị  
> **Nguồn dữ liệu tham chiếu:** `openmetadata-python-client/cde/QuyTacKiemTraChatDuLieu.xlsx`  
> **Mô hình tham chiếu:** Giao diện & Kiến trúc của **Từ điển dữ liệu dùng chung (Data Dictionary / CDE Glossary)** và **Từ điển kỹ thuật (Technical Dictionary)**

---

## 1. Tổng quan & Mục tiêu

Nhằm hoàn thiện hệ thống quản trị dữ liệu tập trung theo tiêu chuẩn Agribank, bên cạnh **Từ điển dữ liệu dùng chung (CDE Glossary)** và **Từ điển kỹ thuật (Technical Dictionary)**, module **Glossary Chất lượng dữ liệu (Data Quality Rules Glossary)** được thiết kế để quản lý, tra cứu và liên kết toàn bộ các quy tắc kiểm tra chất lượng dữ liệu nghiệp vụ và kỹ thuật.

### 1.1. Mục tiêu giao diện
1. **Tra cứu & Khai thác trực quan:** Giúp cán bộ nghiệp vụ (Data Steward, Data Proposer) và kỹ thuật dễ dàng tra cứu, lọc và theo dõi toàn bộ các quy tắc kiểm tra chất lượng dữ liệu (DQ Rules) theo từng CDE, theo tiêu chí chất lượng (Đầy đủ, Chính xác, Nhất quán, Tuân thủ, Kịp thời), theo hệ thống nguồn và bảng/cột kỹ thuật.
2. **Liên kết chặt chẽ với CDE & Metadata:** Thể hiện rõ ràng mối liên kết giữa Quy tắc chất lượng dữ liệu với Thành tố dữ liệu dùng chung (CDE) tương ứng.
3. **Đồng nhất trải nghiệm người dùng (UX/UI):** Kế thừa 100% phong cách thiết kế, nhịp khoảng cách, bảng màu thương hiệu Agribank (`#AE1C3F`), cấu trúc thẻ tóm tắt (Summary Grid Cards), bộ chọn tùy chỉnh cột (Column Customization), và cơ chế phân quyền phê duyệt theo workflow của OpenMetadata.

### 1.2. Ngoài phạm vi bản thiết kế này
- Giao diện mobile/tablet (tập trung tối ưu cho Desktop viewport ≥ 1280px).
- Giao diện thiết lập tự động hóa chạy Profiler / Test Suite ngầm định (OpenMetadata Native Test Suite).
- Thay đổi cấu trúc cơ sở dữ liệu core backend của OpenMetadata (sử dụng 100% cơ chế GlossaryTerm + Custom Properties + Tag Classifications sẵn có).

---

## 2. Phân tích Nguồn dữ liệu `QuyTacKiemTraChatDuLieu.xlsx` & Ánh xạ Thành phần OpenMetadata

File Excel nguồn bao gồm sheet `Bussiness data quality rule` với 17 cột thông tin chuẩn và 50 quy tắc mẫu. Theo định hướng tinh gọn và tập trung vào nghiệp vụ quản trị, các cột kỹ thuật hạ tầng (*Bảng dữ liệu, Thuật ngữ kỹ thuật, Kiểu dữ liệu*) sẽ **không biểu diễn trên giao diện Glossary Chất lượng dữ liệu**.

### Quy chuẩn đặt tên Metadata (OpenMetadata Naming Convention):
- **`name`**: Sử dụng **Tiếng Anh** (chuẩn không dấu, camelCase hoặc PascalCase) để định danh an toàn trong hệ thống và API.
- **`displayName`**: Sử dụng **Tiếng Việt** (có dấu đầy đủ, chuẩn thuật ngữ quản trị Agribank) để hiển thị thân thiện trên giao diện người dùng.

Dưới đây là bảng phân định chính xác từng cột trong Excel sẽ sử dụng **thành phần dữ liệu / thuộc tính nào của OpenMetadata** (`name`, `displayName`, `description`, `tags`, `customProperties`, `relatedTerms`, `owners`, `entityStatus`):

| STT | Tên cột trong Excel | Giải thích nội dung | Thành phần OpenMetadata sử dụng | Kiểu dữ liệu trong OpenMetadata | Chi tiết trường / Phân loại cụ thể (`name` & `displayName`) |
|:---:|---|---|---|---|---|
| 1 | **STT** | Số thứ tự dòng trong biểu mẫu | *UI Computed Field* | Số nguyên (`number`) | Tự động tính toán trên giao diện: `(page - 1) * pageSize + index + 1` |
| 2 | **Mã CDE** | Mã thành tố CDE liên kết (ví dụ: `CDE1`, `CDE3`, `CDE476`...) | **`customProperties`** + **`relatedTerms`** | `string` + `EntityReference` | 1. Custom Property `name: "cdeCode"`, `displayName: "Mã CDE"`<br>2. `relatedTerms` liên kết tới Term CDE trong `Từ điển dữ liệu dùng chung` |
| 3 | **Tên thành tố** | Tên thuật ngữ nghiệp vụ CDE (ví dụ: `Mã số khách hàng`, `Tên khách hàng`...) | **`customProperties`** / **`displayName`** | `string` | Custom Property `name: "cdeName"`, `displayName: "Tên thành tố CDE"` (đồng thời ghép vào `displayName` của quy tắc) |
| 4 | **Mã quy tắc nghiệp vụ** | Mã định danh quy tắc (ví dụ: `DQ1.1`, `DQ3.1`, `DQ476.1`...) | **`name`** | `string` | Thuộc tính **`name`** cốt lõi của `GlossaryTerm` (khóa định danh duy nhất của thuật ngữ) |
| 5 | **Tiêu chí đánh giá CLDL** | 5 tiêu chí: *Tính đầy đủ, Tính chính xác, Tính nhất quán, Tính tuân thủ, Tính kịp thời* | **`tags`** *(Classification)* | `TagLabel` | Tag thuộc Classification `DataQualityDimension` (`Completeness`, `Accuracy`, `Consistency`, `Compliance`, `Timeliness`) |
| 6 | **Quy tắc nghiệp vụ về CLDL** | Nội dung phát biểu quy tắc nghiệp vụ đánh giá chất lượng | **`description`** | `markdown` | Thuộc tính **`description`** cốt lõi của `GlossaryTerm` (mô tả nội dung chính của quy tắc) |
| 7 | **Diễn giải Quy tắc nghiệp vụ** | Giải thích chi tiết nghiệp vụ, ngữ cảnh áp dụng | **`customProperties`** | `markdown` | Custom Property `name: "ruleExplanation"`, `displayName: "Diễn giải quy tắc nghiệp vụ"` |
| 8 | **Ràng buộc/yêu cầu khác** | Ràng buộc kỹ thuật, kiểm tra Not Null, định dạng Date... | **`customProperties`** | `markdown` | Custom Property `name: "otherConstraints"`, `displayName: "Ràng buộc / Yêu cầu khác"` |
| 9 | **Dấu hiệu ngoại lệ** | Dấu hiệu nhận biết các trường hợp ngoại lệ không vi phạm | **`customProperties`** | `markdown` | Custom Property `name: "exceptions"`, `displayName: "Dấu hiệu ngoại lệ"` |
| 10 | **Các tiêu chí cơ sở (Tập dữ liệu)** | Phạm vi áp dụng (ví dụ: *Toàn nền khách hàng, Khách hàng cá nhân...*) | **`tags`** *(Classification)* | `TagLabel` | Tag thuộc Classification `DataQualityTargetPopulation` (`EntireCustomerBase`, `IndividualCustomers`, `CustomersWithInfo`, `CreditRiskData`) |
| 11 | **Hình thức kiểm tra CLDL** | Phương pháp kiểm tra (ví dụ: *Kiểm tra bằng SQL*...) | **`tags`** *(Classification)* | `TagLabel` | Tag thuộc Classification `DataQualityMethod` (`TechnicalSqlRule`, `DataProfiling`) |
| 12 | **Tần suất** | Chu kỳ thực hiện (ví dụ: *Hàng Quý, Tháng/Quý, Hàng Ngày*) | **`tags`** *(Classification)* | `TagLabel` | Tag thuộc Classification `DataQualityFrequency` (`Quarterly`, `MonthlyOrQuarterly`, `Monthly`, `Daily`) |
| 13 | **Ngưỡng Chất lượng Dữ liệu** | Mức độ chấp nhận chất lượng (ví dụ: `0.99` (99%), `0.95` (95%), `1` (100%)) | **`customProperties`** | `string` | Custom Property `name: "qualityThreshold"`, `displayName: "Ngưỡng chất lượng dữ liệu"` |
| 14 | **Nguồn dữ liệu** | Hệ thống nguồn (ví dụ: `IPCAS`, `Kho RRTD`) | **`tags`** *(Classification)* | `TagLabel` | Tag thuộc Classification `DataSource` (`IPCAS`, `CreditRiskDataWarehouse`) |
| 15 | **Bảng dữ liệu** | Tên bảng dữ liệu kỹ thuật | *Không biểu diễn* | - | Bỏ qua, không hiển thị trên giao diện Glossary |
| 16 | **Thuật ngữ kỹ thuật** | Tên trường / cột dữ liệu kỹ thuật | *Không biểu diễn* | - | Bỏ qua, không hiển thị trên giao diện Glossary |
| 17 | **Kiểu dữ liệu** | Kiểu dữ liệu kỹ thuật (CHAR, VARCHAR...) | *Không biểu diễn* | - | Bỏ qua, không hiển thị trên giao diện Glossary |
| - | **Chủ sở hữu dữ liệu** | User hoặc Team phụ trách quy tắc | **`owners`** | `EntityReference[]` | Thuộc tính **`owners`** cốt lõi của `GlossaryTerm` (gán User/Team) |
| - | **Người kiểm duyệt** | Cán bộ có quyền phê duyệt quy tắc | **`reviewers`** | `EntityReference[]` | Thuộc tính **`reviewers`** cốt lõi của `GlossaryTerm` |
| - | **Trạng thái kiểm soát** | Trạng thái phê duyệt workflow | **`entityStatus`** | `enum` | Thuộc tính **`entityStatus`** cốt lõi (`Approved`, `Draft`, `InReview`) |

### 2.1. Phân nhóm các Thành phần OpenMetadata sử dụng

1. **Nhóm Thuộc tính Cốt lõi (Core Entity Attributes):**
   - **`name`**: Lưu **Mã quy tắc nghiệp vụ** (ví dụ: `DQ1.1`, `DQ3.1`).
   - **`displayName`**: Tên hiển thị thân thiện tiếng Việt (ví dụ: `DQ1.1 - Tính chính xác (Tên khách hàng)`).
   - **`description`**: Lưu **Nội dung phát biểu Quy tắc nghiệp vụ về CLDL**.
   - **`owners`**: Quản lý **Chủ sở hữu (Data Owners)** theo User/Team.
   - **`reviewers`**: Quản lý **Người phê duyệt (Reviewers)**.
   - **`entityStatus`**: Quản lý **Trạng thái phê duyệt (Approval Workflow Status)**.
   - **`relatedTerms`**: Lưu liên kết đối ứng với **Glossary Term CDE** trong Glossary `Từ điển dữ liệu dùng chung`.

2. **Nhóm Nhãn & Phân loại Dữ liệu (Tags & Classification System):**
   - **Classification `DataQualityDimension`** (`displayName: "Tiêu chí chất lượng dữ liệu"`):
     - `name: "Completeness"` | `displayName: "Tính đầy đủ"`
     - `name: "Accuracy"` | `displayName: "Tính chính xác"`
     - `name: "Consistency"` | `displayName: "Tính nhất quán"`
     - `name: "Compliance"` | `displayName: "Tính tuân thủ"`
     - `name: "Timeliness"` | `displayName: "Tính kịp thời"`
   - **Classification `DataQualityTargetPopulation`** (`displayName: "Tiêu chí cơ sở (Tập dữ liệu kiểm tra)"`):
     - `name: "EntireCustomerBase"` | `displayName: "Toàn nền khách hàng"`
     - `name: "IndividualCustomers"` | `displayName: "Khách hàng cá nhân"`
     - `name: "CustomersWithInfo"` | `displayName: "Toàn bộ khách hàng có thông tin"`
     - `name: "CreditRiskData"` | `displayName: "Dữ liệu rủi ro tín dụng"`
   - **Classification `DataQualityMethod`** (`displayName: "Hình thức kiểm tra CLDL"`):
     - `name: "TechnicalSqlRule"` | `displayName: "Kiểm tra bằng Quy tắc kỹ thuật (SQL)"`
     - `name: "DataProfiling"` | `displayName: "Kiểm tra tự động (Data Profiling)"`
   - **Classification `DataQualityFrequency`** (`displayName: "Tần suất kiểm tra CLDL"`):
     - `name: "Quarterly"` | `displayName: "Hàng Quý"`
     - `name: "MonthlyOrQuarterly"` | `displayName: "Tháng/Quý"`
     - `name: "Monthly"` | `displayName: "Hàng Tháng"`
     - `name: "Daily"` | `displayName: "Hàng Ngày"`
   - **Classification `DataSource`** (`displayName: "Nguồn dữ liệu"` - Dùng chung với CDE):
     - `name: "IPCAS"` | `displayName: "IPCAS (Core Banking)"`
     - `name: "CreditRiskDataWarehouse"` | `displayName: "Kho RRTD (Kho Rủi ro Tín dụng)"`

3. **Nhóm Thuộc tính Tùy chỉnh (Custom Properties / `extension`):**
   - Khai báo mở rộng trên Entity Type `glossaryTerm` của OpenMetadata:
     - `name: "cdeCode"` | `displayName: "Mã CDE"` (`string`)
     - `name: "cdeName"` | `displayName: "Tên thành tố CDE"` (`string`)
     - `name: "ruleExplanation"` | `displayName: "Diễn giải quy tắc nghiệp vụ"` (`markdown`)
     - `name: "otherConstraints"` | `displayName: "Ràng buộc / Yêu cầu khác"` (`markdown`)
     - `name: "exceptions"` | `displayName: "Dấu hiệu ngoại lệ"` (`markdown`)
     - `name: "qualityThreshold"` | `displayName: "Ngưỡng chất lượng dữ liệu"` (`string`)

4. **Nhóm Thuộc tính Sinh động Giao diện (UI Dynamic Fields):**
   - **`STT`**: Tính toán theo phân trang `(currentPage - 1) * pageSize + rowIndex + 1`.
   - **`actions`**: Nút thao tác thêm/sửa theo phân quyền `permissions.Create` và `permissions.EditAll`.

---

## 3. Kiến trúc Hệ thống & Mô hình Dữ liệu OpenMetadata

### 3.1. Nhận diện Glossary
- **Tên Glossary hệ thống (`name`):** `Data Quality` (hoặc `DataQualityRules`)
- **Tên hiển thị (`displayName`):** `Chất lượng dữ liệu`
- **Mô tả:** `Từ điển quy tắc kiểm tra chất lượng dữ liệu nghiệp vụ và kỹ thuật Agribank`
- **Hàm nhận diện chuyên biệt:**
  ```typescript
  export const DATA_QUALITY_GLOSSARY_NAME = 'Data Quality';
  export const DATA_QUALITY_GLOSSARY_DISPLAY_NAME = 'Chất lượng dữ liệu';

  export const isDataQualityGlossary = (
    ...identifiers: Array<string | undefined>
  ) =>
    identifiers.some(
      (identifier) =>
        identifier === DATA_QUALITY_GLOSSARY_NAME ||
        identifier === DATA_QUALITY_GLOSSARY_DISPLAY_NAME ||
        identifier === 'DataQuality' ||
        identifier === 'Quy tắc chất lượng dữ liệu' ||
        identifier?.startsWith(`${DATA_QUALITY_GLOSSARY_NAME}.`) ||
        identifier?.startsWith(`${DATA_QUALITY_GLOSSARY_DISPLAY_NAME}.`)
    );
  ```

### 3.2. Bảng mã màu Tiêu chí Đánh giá (Quality Dimension Pill Palette)
Để người dùng nhận biết ngay phân loại quy tắc, mỗi tiêu chí chất lượng dữ liệu được gắn một màu đặc trưng riêng biệt:

| Tiêu chí CLDL | Tag `name` (EN) | Tag `displayName` (VN) | Màu sắc Pill | Mã HEX | Class CSS |
|---|---|---|:---:|:---:|---|
| **Tính đầy đủ** | `Completeness` | `Tính đầy đủ` | Xanh dương | `#1890FF` | `.dq-pill-completeness` |
| **Tính chính xác** | `Accuracy` | `Tính chính xác` | Xanh lá | `#52C41A` | `.dq-pill-accuracy` |
| **Tính nhất quán** | `Consistency` | `Tính nhất quán` | Cam / Amber | `#FA8C16` | `.dq-pill-consistency` |
| **Tính tuân thủ** | `Compliance` | `Tính tuân thủ` | Tím | `#722ED1` | `.dq-pill-compliance` |
| **Tính kịp thời** | `Timeliness` | `Tính kịp thời` | Xanh Cyan | `#13C2C2` | `.dq-pill-timeliness` |

### 3.3. Hiển thị Ngưỡng chất lượng (Threshold Badge)
- **Tỷ lệ phần trăm (≥ 99%):** Badge xanh lá viền đậm (ví dụ: `99%`, `100%`)
- **Tỷ lệ phần trăm (< 99% và ≥ 90%):** Badge cam (ví dụ: `95%`)
- **Ghi chú đặc thù / Không kiểm soát:** Badge xám kèm tooltip giải thích chi tiết khi hover.

---

## 4. Thiết kế Màn danh sách (List Screen - Data Quality Rules Table)

```
+--------------------------------------------------------------------------------------------------------------------------------------+
| [Logo Agribank]  Tìm kiếm dữ liệu, thuật ngữ...                        [Miền: Tất cả v]  [Tiếng Việt v]   [Chuông]  [Avatar User]   |
+--------------------------------------------------------------------------------------------------------------------------------------+
| [Icon] | Glossaries >                                                                                                                |
|        | #️⃣ CHẤT LƯỢNG DỮ LIỆU                                                           [+ Thêm quy tắc]  [...]                     |
| [Icon] | Từ điển quy tắc kiểm tra chất lượng dữ liệu nghiệp vụ và kỹ thuật Agribank                                                  |
|        +-----------------------------------------------------------------------------------------------------------------------------+
| [Icon] | [Thuật ngữ (50)]    [Đồ thị quan hệ]    [Luồng hoạt động & Nhiệm vụ]                                                         |
|        +-----------------------------------------------------------------------------------------------------------------------------+
|        | [🔍 Tìm mã DQ, CDE, tên quy tắc...  ]  [Tiêu chí CLDL: Tất cả v]  [Hệ thống: Tất cả v]  [Tần suất: Tất cả v] [Tùy chỉnh cột v] |
|        +-----------------------------------------------------------------------------------------------------------------------------+
|        | Mã quy tắc | Mã CDE | Tên thành tố        | Tiêu chí CLDL   | Quy tắc nghiệp vụ CLDL         | Ngưỡng | Nguồn | Tần suất  | Trạng thái | Thao tác |
|        |------------|--------|---------------------|-----------------|--------------------------------|--------|-------|-----------|------------|----------|
|        | DQ1.1      | CDE1   | Tên khách hàng      | [Tính chính xác]| Tên KH phải chính xác khớp...  | [100%] | IPCAS | Hàng Quý  | [Approved] | [✏️] [➕] |
|        | DQ1.2      | CDE1   | Tên khách hàng      | [Tính đầy đủ]   | Tên KH không được rỗng/null... | [ 95%] | IPCAS | Hàng Quý  | [Approved] | [✏️] [➕] |
|        | DQ3.1      | CDE3   | Thông tin ID KH     | [Tính chính xác]| Số CMND/CCCD/MST hợp lệ...     | [100%] | IPCAS | Tháng/Quý | [Approved] | [✏️] [➕] |
|        | DQ10.1     | CDE10  | Số điện thoại DĐ    | [Tính tuân thủ] | Số ĐT phải đúng 10 chữ số...   | [100%] | IPCAS | Tháng/Quý | [Approved] | [✏️] [➕] |
+--------+-----------------------------------------------------------------------------------------------------------------------------+
|                                  Hiển thị 1-15 trong tổng số 50 quy tắc | [< Trang 1 >] | 15 hàng/trang v                             |
+--------------------------------------------------------------------------------------------------------------------------------------+
```

### 4.1. Cấu trúc Cột trên Bảng dữ liệu & Thành phần OpenMetadata sử dụng

| Thứ tự | Tên cột trên Giao diện | Khóa cột (Key) | Thành phần OpenMetadata sử dụng (`name`, `tags`, `customProperties`...) | Thuộc tính Entity / Phân loại cụ thể | Thành phần UI OpenMetadata hiển thị | Chiều rộng | Cố định | Mặc định |
|:---:|---|---|---|---|---|:---:|:---:|:---:|
| 1 | **Mã quy tắc** | `dqRuleCode` | **`name`** *(Core Attribute)* | `GlossaryTerm.name` (ví dụ: `DQ1.1`) | `<Link to={getGlossaryPath(fqn)} className="dq-code-link">` | 140px | Fixed Left | ✅ Cố định |
| 2 | **Mã CDE** | `dqCdeCode` | **`customProperties`** + **`relatedTerms`** | `extension.cdeCode` (`name: "cdeCode"`) + `relatedTerms` | `<Tag className="dq-cde-pill">` kèm Link điều hướng sang CDE Term trong `Từ điển dữ liệu dùng chung` | 110px | Fixed Left | ✅ Cố định |
| 3 | **Tên thành tố** | `dqCdeName` | **`customProperties`** / **`displayName`** | `extension.cdeName` (`name: "cdeName"`) hoặc `GlossaryTerm.displayName` | `<Typography.Text ellipsis>` kèm `<Tooltip title={name}>` | 220px | - | ✅ Bật |
| 4 | **Tiêu chí CLDL** | `dqDimension` | **`tags`** *(Classification)* | `tags` thuộc `DataQualityDimension` (`Completeness`, `Accuracy`, `Consistency`, `Compliance`, `Timeliness`) | `<Tag className="dq-pill dq-pill-{dim}">` (Ant Design Tag + class màu phân loại) | 160px | - | ✅ Bật |
| 5 | **Quy tắc nghiệp vụ** | `dqRuleStatement` | **`description`** *(Core Attribute)* | `GlossaryTerm.description` | `<RichTextEditorPreviewerNew enableSeeMoreVariant maxLength={100} />` (Preview markdown rút gọn) | 320px | - | ✅ Bật |
| 6 | **Ngưỡng CLDL** | `dqThreshold` | **`customProperties`** | `extension.qualityThreshold` (`name: "qualityThreshold"`) | `<Tag className="dq-threshold-badge dq-threshold-badge-{level}">` kèm `<Tooltip>` | 120px | - | ✅ Bật |
| 7 | **Hệ thống nguồn** | `dqSource` | **`tags`** *(Classification)* | `tags` thuộc `DataSource` (`IPCAS`, `CreditRiskDataWarehouse`) | `<Tag className="cde-value-pill cde-value-pill-source">` (Tái sử dụng Tag chip nguồn từ CDE) | 130px | - | ✅ Bật |
| 8 | **Tần suất** | `dqFrequency` | **`tags`** *(Classification)* | `tags` thuộc `DataQualityFrequency` (`Quarterly`, `MonthlyOrQuarterly`, `Monthly`, `Daily`) | `<Tag className="dq-pill-frequency">` | 120px | - | ✅ Bật |
| 9 | **Tập dữ liệu kiểm tra** | `dqTargetPopulation`| **`tags`** *(Classification)* | `tags` thuộc `DataQualityTargetPopulation` (`EntireCustomerBase`, `IndividualCustomers`, `CustomersWithInfo`, `CreditRiskData`) | `<Tag className="dq-pill-population">` (Hiển thị nhãn Tiêu chí cơ sở tiếng Việt) | 180px | - | ⚪ Tùy chọn |
| 10 | **Hình thức kiểm tra** | `dqMethod` | **`tags`** *(Classification)* | `tags` thuộc `DataQualityMethod` (`TechnicalSqlRule`, `DataProfiling`) | `<Tag className="dq-pill-method">` | 180px | - | ⚪ Tùy chọn |
| 11 | **Diễn giải quy tắc** | `dqRuleExplanation` | **`customProperties`** | `extension.ruleExplanation` (`name: "ruleExplanation"`) | `<RichTextEditorPreviewerNew enableSeeMoreVariant maxLength={100} />` (Modal xem đầy đủ markdown) | 260px | - | ⚪ Tùy chọn |
| 12 | **Ràng buộc / Ghi chú** | `dqOtherConstraints` | **`customProperties`** | `extension.otherConstraints` (`name: "otherConstraints"`) | `<RichTextEditorPreviewerNew enableSeeMoreVariant maxLength={100} />` (Xem các ràng buộc Not Null, Date format...) | 220px | - | ⚪ Tùy chọn |
| 13 | **Dấu hiệu ngoại lệ** | `dqExceptions` | **`customProperties`** | `extension.exceptions` (`name: "exceptions"`) | `<RichTextEditorPreviewerNew enableSeeMoreVariant maxLength={100} />` (Xem các trường hợp ngoại lệ) | 220px | - | ⚪ Tùy chọn |
| 14 | **Chủ sở hữu** | `dqOwners` | **`owners`** *(Core Attribute)* | `GlossaryTerm.owners` (`EntityReference[]`) | `ownerTableObject` + `<ProfilePicture isTeam name="..." />` (Avatar & Tên User/Team) | 200px | - | ⚪ Tùy chọn |
| 15 | **Trạng thái** | `status` | **`entityStatus`** *(Core Attribute)* | `GlossaryTerm.entityStatus` (`Approved`, `Draft`, `InReview`) | `<Tag className="entity-status-tag">` (Trạng thái kiểm soát chuẩn OpenMetadata) | 130px | - | ✅ Cố định |
| 16 | **Thao tác** | `actions` | *UI RBAC Permission* | `permissions.Create / EditAll` | `<Tooltip><Button type="text" icon={<EditIcon />} /></Tooltip>` + `<PlusOutlinedIcon />` | 100px | Fixed Right | ✅ Cố định |

### 4.2. Chi tiết các Thành phần OpenMetadata (OpenMetadata Components Breakdown)

Bảng danh sách quy tắc chất lượng dữ liệu tái sử dụng toàn bộ hệ sinh thái component và thư viện tiện ích cốt lõi của OpenMetadata:

1. **Khung Bảng Dữ liệu & Quản lý Phân trang (Data Table & Pagination):**
   - **Component:** `Ant Design Table` (`<Table<ModifiedGlossaryTerm> ... />`) tích hợp bên trong `GlossaryTermTab.component.tsx`.
   - **Cơ chế:** Quản lý chiều rộng container tự động (`ResizeObserver`), header cố định khi cuộn (`sticky header`), thanh cuộn ngang khi số cột lớn, phân trang đồng bộ với hook `usePaging`.
   - **CSS Scope:** Bao bọc trong container `.dq-glossary-table-container` và bảng `.dq-glossary-terms-table`.

2. **Quản lý Tùy biến Cột (Column Preferences & Customization):**
   - **Component:** `ManageTableColumns` (Dropdown menu chọn bật/tắt cột).
   - **Storage State:** Lưu cấu hình hiển thị cột của từng người dùng vào `userProfileStore` / `localStorage` với khóa độc lập `dqGlossaryTerm` (`DQ_GLOSSARY_TABLE_PREFERENCE_KEY`).
   - **Cột cố định không thể ẩn:** `Mã quy tắc` (`dqRuleCode`), `Trạng thái` (`status`), `Thao tác` (`actions`).

3. **Hiển thị Nội dung RichText & Markdown Rút gọn:**
   - **Component:** `RichTextEditorPreviewerNew` từ `src/components/common/RichTextEditor/RichTextEditorPreviewNew`.
   - **Đặc tính:** Cắt gọn văn bản ở mức 100 ký tự (`maxLength={100}`), hỗ trợ nút `... Xem thêm` (`enableSeeMoreVariant`) mở modal hoặc xem toàn bộ nội dung mà không phá vỡ chiều cao dòng bảng.

4. **Hiển thị Danh tính & Avatar Quản trị (User/Team Avatars):**
   - **Component:** `ProfilePicture` từ `src/components/common/ProfilePicture/ProfilePicture`.
   - **Đặc tính:** Phân biệt Avatar người dùng cá nhân (User) và Đơn vị chủ trì (Team - icon nhóm), tooltip hiển thị tên đầy đủ và chức danh.

5. **Thẻ Nhãn & Phân loại Dữ liệu (Tags & Classification Chips):**
   - **Component:** `Tag` từ Ant Design kết hợp hàm tiện ích `createTagObject`, `getTagLabel` từ `src/utils/TagsUtils`.
   - **Styling:** Kế thừa hệ thống style `.cde-value-pill` và mở rộng các class màu độc lập `.dq-pill-*` cho 5 tiêu chí chất lượng dữ liệu.

6. **Điều hướng & Liên kết Thực thể (Routing & Entity Links):**
   - **Tiện ích:** `getGlossaryPath` từ `src/utils/RouterUtils` để điều hướng trang chi tiết Term.
   - **Liên kết chéo:** `Link` (React Router) dẫn trực tiếp sang CDE Term tương ứng trong Glossary `Từ điển dữ liệu dùng chung`.

7. **Phân quyền & Thao tác (RBAC & Action Buttons):**
   - **Context Hook:** `useGenericContext<GlossaryTerm>()` cung cấp đối tượng `permissions`.
   - **Nút tương tác:** Icon Buttons `EditIconButton`, `EditIcon`, `PlusOutlinedIcon` với màu `DE_ACTIVE_COLOR` (`#AE1C3F` khi hover) và kiểm tra quyền `permissions.Create`, `permissions.EditAll`.

### 4.3. Thanh công cụ & Bộ lọc (Toolbar & Filters)
- **Tìm kiếm đa trường:** Tìm kiếm tức thời (debounce 300ms) theo Mã quy tắc (`DQ1.1`), Mã CDE (`CDE1`), Tên thành tố, Nội dung quy tắc.
- **Bộ lọc Tiêu chí CLDL (Dimension Filter):** Dropdown lọc theo `Tính đầy đủ`, `Tính chính xác`, `Tính nhất quán`, `Tính tuân thủ`, `Tính kịp thời`.
- **Bộ lọc Nguồn dữ liệu (Source Filter):** Dropdown lọc theo `IPCAS`, `Kho RRTD`.
- **Bộ lọc Tần suất (Frequency Filter):** Dropdown lọc theo `Hàng Quý`, `Tháng/Quý`.
- **Tùy chỉnh cột (Column Preferences):** Lưu thiết lập người dùng với key `dqGlossaryTerm` trong `localStorage` / `userProfileStore`.

---

## 5. Thiết kế Màn chi tiết (Detail / Overview Screen - DQ Rule Detail)

```
+--------------------------------------------------------------------------------------------------------------------------------------+
| [Logo Agribank]  Tìm kiếm dữ liệu, thuật ngữ...                        [Miền: Tất cả v]  [Tiếng Việt v]   [Chuông]  [Avatar User]   |
+--------------------------------------------------------------------------------------------------------------------------------------+
| [Icon] | Glossaries > Chất lượng dữ liệu > DQ3.1                                                                                     |
|        | 📋 DQ3.1: Mã số khách hàng (số CIF) không được để trống                     [Approved v]   [Chỉnh sửa]  [...]               |
| [Icon] | Tiêu chí: [Tính đầy đủ] | Ngưỡng: [≥ 99%] | CDE liên kết: [CDE1 - Mã số khách hàng]                                          |
|        +-----------------------------------------------------------------------------------------------------------------------------+
| [Icon] | [Tổng quan]    [Đồ thị quan hệ]    [Luồng hoạt động & Nhiệm vụ]                                                              |
|        +-----------------------------------------------------------------------------------------------------------------------------+
|        | +------------------------------------------------------------+  +---------------------------------------------------------+ |
|        | | 📝 NỘI DUNG QUY TẮC NGHIỆP VỤ (BUSINESS RULE)              |  | 👥 NGƯỜI PHÊ DUYỆT & TRẠNG THÁI                         | |
|        | | Mã quy tắc:       DQ3.1                                    |  | Trạng thái:   [Đã phê duyệt (Approved)]                 | |
|        | | Tiêu chí CLDL:    [Tính đầy đủ]                            |  | Người duyệt:  [Avatar] Lê Văn B (Trưởng ban QTDL)       | |
|        | | Mã CDE liên kết:  [🔗 CDE1 - Mã số khách hàng]            |  | Chủ sở hữu:   [Avatar] Phòng Quản trị Dữ liệu (Team)   | |
|        | | Quy tắc chi tiết: Mã số khách hàng (số CIF) không được để  |  +---------------------------------------------------------+ |
|        | |                   trống, không được NULL trên CoreBank.    |                                                              |
|        | | Diễn giải:        Bắt buộc nhập liệu trên CIF Corebank.    |  +---------------------------------------------------------+ |
|        | | Ràng buộc khác:   Kiểm tra Not Null                        |  | 🎯 ĐIỀU KIỆN & PHẠM VI KIỂM TRA                         | |
|        | | Ngoại lệ:         Không có ngoại lệ áp dụng                |  | Nguồn dữ liệu: [IPCAS]                                  | |
|        | +------------------------------------------------------------+  | Tập kiểm tra:  [Toàn nền khách hàng]                    | |
|        |                                                                 | Hình thức:     [Kiểm tra bằng SQL]                      | |
|        |                                                                 | Tần suất:      [Hàng Quý]                               | |
|        |                                                                 | Ngưỡng chuẩn:  [ 99.0% ]                                | |
|        |                                                                 +---------------------------------------------------------+ |
+--------------------------------------------------------------------------------------------------------------------------------------+
```

### 5.1. Phân bổ Bố cục 3 Khối thông tin & Thành phần OpenMetadata sử dụng

#### Khối 1: Thông tin Quy tắc Nghiệp vụ (Business Rule Information)
- **Mã quy tắc (`dqRuleCode`):** `<Tag className="dq-rule-code-badge">` - Hiển thị mã định danh nổi bật.
- **Tiêu chí CLDL (`dqDimension`):** `<Tag className="dq-pill dq-pill-{dim}">` - Pill màu chuẩn hóa theo 5 tiêu chí (Đầy đủ, Chính xác, Nhất quán, Tuân thủ, Kịp thời).
- **Mã CDE liên kết (`dqCdeCode` & `dqCdeName`):** `<Link to={getGlossaryPath(cdeFqn)}> <Tag className="dq-cde-pill">` - Điều hướng trực tiếp sang CDE Term trong `Từ điển dữ liệu dùng chung`.
- **Nội dung quy tắc nghiệp vụ:** `<RichTextEditorPreviewerV1 markdown={description} />` - Hiển thị Markdown đầy đủ.
- **Diễn giải quy tắc & Ràng buộc:** Component `DQTextCustomField` kết hợp `<ModalWithMarkdownEditor>` - Hỗ trợ xem mở rộng và chỉnh sửa nội dung rich-text.
- **Dấu hiệu ngoại lệ:** Component `DQTextCustomField` kết hợp `<ModalWithMarkdownEditor>`.

#### Khối 2: Điều kiện & Phạm vi Đánh giá (Assessment Scope & Criteria)
- **Hệ thống nguồn:** `DQTagField` kết hợp `<TagsContainerV2 classificationFilter="DataSource" />` - Tag nguồn dữ liệu gốc (`IPCAS`, `Kho RRTD`...).
- **Tập dữ liệu kiểm tra / Tiêu chí cơ sở (`targetPopulation`):** `DQTagField` kết hợp `<TagsContainerV2 classificationFilter="DataQualityTargetPopulation" />` - Tag chip đối tượng (`Toàn nền khách hàng`, `Khách hàng cá nhân`, `Toàn bộ khách hàng có thông tin`, `Dữ liệu rủi ro tín dụng`).
- **Hình thức kiểm tra (`method`):** `DQTagField` kết hợp `<TagsContainerV2 classificationFilter="DataQualityMethod" />` - Tag chip phương pháp kiểm tra SQL / Data Profiler.
- **Tần suất đánh giá (`frequency`):** `DQTagField` kết hợp `<TagsContainerV2 classificationFilter="DataQualityFrequency" />` - Chu kỳ rà soát (`Hàng Quý`, `Tháng/Quý`, `Hàng Ngày`).
- **Ngưỡng chất lượng dữ liệu (`threshold`):** Component `DQThresholdField` - Badge tỷ lệ phần trăm to rõ ràng, hỗ trợ Popover chỉnh sửa nhanh khi có quyền.

#### Khối 3: Quản trị & Phê duyệt (Governance & Ownership)
- **Chủ sở hữu dữ liệu (Data Owners):** `<UserTeamSelectableList>` kết hợp hàm render `renderCDEOwners` & `<ProfilePicture>` - Quản lý và gán Owner / Team.
- **Người phê duyệt (Reviewers):** Widget chuẩn OpenMetadata `GlossaryTermDetailPageWidgetKeys.REVIEWER` (`getGlossaryTermWidgetFromKey`).
- **Trạng thái phê duyệt:** Badge trạng thái chuẩn OpenMetadata `EntityStatus` (`Approved`, `Draft`, `In Review`) kết hợp Workflow Approval.

---

## 6. Luồng Tương tác & Phân quyền (Interactions & RBAC)

### 6.1. Chỉnh sửa nhanh từng trường (Inline Field Edit)
- Kế thừa component `EditIconButton`, `UserTeamSelectableList`, `DomainSelectableList`, `ModalWithMarkdownEditor` từ CDE Glossary.
- Khi người dùng có quyền `EditAll` hoặc `EditCustomFields`, icon cây bút `✏️` sẽ xuất hiện cạnh nhãn từng trường.
- Click icon mở Modal Markdown hoặc Popover Select để cập nhật trực tiếp mà không cần reload trang.

### 6.2. Phân quyền Người dùng (RBAC Matrix)
- **Data Consumer / Basic Consumer:** Chỉ xem (Read-only), mặc định chỉ lọc thấy các quy tắc ở trạng thái `Approved`.
- **Data Steward / Data Proposer:** Được phép tạo mới quy tắc, đề xuất chỉnh sửa nội dung quy tắc hoặc ngưỡng chất lượng (tạo Task In Review).
- **Data Admin / Organization:** Toàn quyền phê duyệt (Approve/Reject), sửa đổi trực tiếp và phân quyền quy tắc.

---

## 7. Kế hoạch Triển khai Kỹ thuật (Technical Implementation Plan)

### 7.1. Cấu hình Custom Properties & Classifications

#### 1. Tạo Classifications & Tags trên OpenMetadata:
| Classification `name` (EN) | `displayName` (VN) | Tag `name` (EN) | Tag `displayName` (VN) |
|---|---|---|---|
| **`DataQualityDimension`** | `Tiêu chí chất lượng dữ liệu` | `Completeness`<br>`Accuracy`<br>`Consistency`<br>`Compliance`<br>`Timeliness` | `Tính đầy đủ`<br>`Tính chính xác`<br>`Tính nhất quán`<br>`Tính tuân thủ`<br>`Tính kịp thời` |
| **`DataQualityTargetPopulation`** | `Tiêu chí cơ sở (Tập dữ liệu kiểm tra)` | `EntireCustomerBase`<br>`IndividualCustomers`<br>`CustomersWithInfo`<br>`CreditRiskData` | `Toàn nền khách hàng`<br>`Khách hàng cá nhân`<br>`Toàn bộ khách hàng có thông tin`<br>`Dữ liệu rủi ro tín dụng` |
| **`DataQualityMethod`** | `Hình thức kiểm tra CLDL` | `TechnicalSqlRule`<br>`DataProfiling` | `Kiểm tra bằng Quy tắc kỹ thuật (SQL)`<br>`Kiểm tra tự động (Data Profiling)` |
| **`DataQualityFrequency`** | `Tần suất kiểm tra CLDL` | `Quarterly`<br>`MonthlyOrQuarterly`<br>`Monthly`<br>`Daily` | `Hàng Quý`<br>`Tháng/Quý`<br>`Hàng Tháng`<br>`Hàng Ngày` |
| **`DataSource`** | `Nguồn dữ liệu` (Tái sử dụng chung) | `IPCAS`<br>`CreditRiskDataWarehouse` | `IPCAS (Core Banking)`<br>`Kho RRTD (Kho Rủi ro Tín dụng)` |

#### 2. Tạo Custom Properties cho Entity `glossaryTerm`:
| `name` (English) | `displayName` (Tiếng Việt) | Kiểu dữ liệu | Mô tả |
|---|---|:---:|---|
| `cdeCode` | `Mã CDE` | `string` | Mã định danh CDE liên kết (ví dụ: `CDE1`, `CDE3`) |
| `cdeName` | `Tên thành tố CDE` | `string` | Tên thành tố dữ liệu dùng chung CDE tương ứng |
| `ruleExplanation` | `Diễn giải quy tắc nghiệp vụ` | `markdown` | Diễn giải chi tiết quy tắc nghiệp vụ và ngữ cảnh áp dụng |
| `otherConstraints` | `Ràng buộc / Yêu cầu khác` | `markdown` | Ràng buộc kỹ thuật, kiểm tra Not Null, định dạng Date... |
| `exceptions` | `Dấu hiệu ngoại lệ` | `markdown` | Dấu hiệu nhận biết các trường hợp ngoại lệ chấp nhận |
| `qualityThreshold` | `Ngưỡng chất lượng dữ liệu` | `string` | Ngưỡng KPI chất lượng (ví dụ: `0.99`, `0.95`, `1` hoặc ghi chú) |


### 7.2. Các File Frontend cần Tạo mới & Chỉnh sửa

```text
openmetadata-ui/src/main/resources/ui/src/
├── constants/
│   └── Glossary.contant.ts                  <-- Thêm constants DQ Glossary, keys, columns, preference key
├── components/Glossary/
│   ├── GlossaryTermTab/
│   │   ├── DQGlossaryTableColumns.tsx        <-- [MỚI] Định nghĩa tập cột nghiệp vụ cho DQ Table
│   │   └── GlossaryTermTab.component.tsx    <-- Bổ sung nhánh render DQGlossaryTableColumns khi isDataQualityGlossary
│   ├── GlossaryTerms/
│   │   ├── DQGlossaryTermOverview.tsx       <-- [MỚI] Khối Overview 2 cột cho DQ Rule Term
│   │   ├── DQGlossaryTermSummary.tsx        <-- [MỚI] 2 nhóm Summary Cards chi tiết (Nghiệp vụ, Đánh giá & Quản trị)
│   │   └── GlossaryTermsV1.component.tsx    <-- Bổ sung nhánh render DQGlossaryTermOverview khi isDataQualityGlossary
│   └── glossaryV1.less                      <-- Bổ sung scoped CSS .dq-glossary-* và .dq-pill-*
└── locale/languages/
    ├── vi-vn.json                           <-- Bổ sung nhãn tiếng Việt (dq.rule-code, dq.dimension...)
    └── en-us.json                           <-- Bổ sung nhãn tiếng Anh
```

### 7.3. Script Nạp dữ liệu Tự động (Python Ingestion)
- Tạo script `openmetadata-python-client/prepare/7_create_dq_glossary.py`:
  1. Tự động kiểm tra và tạo Glossary `Data Quality` (Tên hiển thị: `Chất lượng dữ liệu`).
  2. Đọc file `openmetadata-python-client/cde/QuyTacKiemTraChatDuLieu.xlsx`.
  3. Chuẩn hóa dữ liệu 50 quy tắc, map Tags phân loại và Custom Properties (bỏ qua các cột kỹ thuật).
  4. Tự động tìm kiếm Term FQN tương ứng trong `Data Dictionary` để gắn `relatedTerms`.
  5. Đẩy dữ liệu qua OpenMetadata REST API (`/v1/glossaryTerms`).

---

## 8. Tiêu chuẩn Nghiệm thu (Acceptance Criteria)

1. **Hiển thị Danh sách (List View):**
   - Danh sách quy tắc hiển thị đầy đủ các cột: Mã quy tắc, Mã CDE, Tên thành tố, Tiêu chí CLDL (màu phân loại riêng), Nội dung quy tắc, Ngưỡng CLDL (Badge), Nguồn, Tần suất, Trạng thái, Thao tác.
   - Hoàn toàn không hiển thị các cột kỹ thuật (*Bảng dữ liệu, Thuật ngữ kỹ thuật, Kiểu dữ liệu*).
   - Tìm kiếm và bộ lọc (Tiêu chí CLDL, Nguồn, Tần suất) phản hồi mượt mà, phân trang chính xác.
   - Bộ chọn "Tùy chỉnh cột" hoạt động độc lập và lưu preference riêng biệt với CDE / Glossary thường.
2. **Hiển thị Chi tiết (Detail View):**
   - Màn chi tiết hiển thị gọn gàng, trực quan với 3 khối thông tin: Quy tắc nghiệp vụ, Phạm vi & Đánh giá, Quản trị & Phê duyệt.
   - Có liên kết 2 chiều trực tiếp tới CDE Term trong `Từ điển dữ liệu dùng chung`.
   - Hỗ trợ chỉnh sửa nhanh inline từng trường khi có quyền.
3. **Độ ổn định & Không Regression:**
   - Không làm ảnh hưởng hoặc thay đổi giao diện của `Từ điển dữ liệu dùng chung (Data Dictionary)` và các `Glossary` chuẩn khác.
