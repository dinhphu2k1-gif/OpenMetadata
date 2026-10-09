# Kiến trúc hiện tại hệ thống Agribank Metadata

> Đối chiếu mã nguồn tại commit `d793acfbb63` (2026-10-08). Vận hành index: [van-hanh-search-index.md](../../../docs/van-hanh-search-index.md). Đây là nguồn tham chiếu kiến trúc cho các tài liệu thiết kế phân hệ; nền upstream xem [Kiến trúc tham chiếu OpenMetadata 1.13.3](./openmetadata-1.13.3-upstream-architecture-reference.md), contract API xem [Đặc tả API governed](../api/openmetadata-governed-api-specification.md).

## 1. Triển khai và người dùng

| Thành phần | Người dùng | Ghi chú |
| --- | --- | --- |
| OpenMetadata server + UI | Chỉ `Admin` (và bot) khi bật `OM_ADMIN_ONLY` | Chạy toàn bộ job nền, seed, outbox worker, kết nối Airflow |
| Portal (OM server ở `portal.enabled`, UI build riêng `/portal-assets`) | `DataSteward`, `DataProposer`, `DataConsumer`, `BasicConsumer` | Cùng DB, cùng IDAS/IAM, cùng RBAC; không seed, không job nền, không Airflow |

Chi tiết: [Kiến trúc triển khai tách Portal](./public-admin-split-deployment-architecture.md).

| Vai trò nghiệp vụ | Role OM | Quyền mặc định trên CDE, DQ Rule, Từ điển kỹ thuật |
| --- | --- | --- |
| Người đề xuất | `DataProposer` | `R`, `W`: tạo, sửa, đề xuất xóa, gửi duyệt, rút yêu cầu của mình |
| Người phê duyệt | `DataSteward` | `R`, `A`: phê duyệt, từ chối |
| Người dùng TT QLDL | `DataConsumer` | `R` bản Approved của cả ba phân hệ |
| Người dùng TSC/CN | `BasicConsumer` | `R` bản Approved của CDE và DQ; không xem Từ điển kỹ thuật |
| Quản trị | `Admin` | Quản trị hệ thống; không mặc nhiên có `W`/`A` theo ma trận nghiệp vụ |

UI không suy quyền từ tên role. Backend trả capability (`canEditWorking`, `canSubmit`, `canApprove`, `canCreateVersion`, … cho glossary governed; `canView/canEdit/canApprove/canImport/canExport` cho Từ điển kỹ thuật) và UI chỉ dựa vào đó.

## 2. Ba phân hệ governed

| Phân hệ | Entity nền | Version | Nguồn sự thật | Read model danh sách (xem §5) |
| --- | --- | --- | --- | --- |
| Từ điển dữ liệu dùng chung (DD/CDE) | `Glossary` `Data Dictionary` + `GlossaryTerm` | DD `N`, CDE `N.MINOR` | Bảng `glossary_business_*` | Index `governed_glossary_search_index` (mặc định); dự phòng DB (`CdeFlatListService`, `CdeBusinessVersionSearchService`) |
| Quy tắc chất lượng dữ liệu (DQ) | `Glossary` `Data Quality` + `GlossaryTerm`, profile `DATA_QUALITY` | Catalog `N` theo DD, Rule `N.MINOR` | Bảng `glossary_business_*` | Index `governed_glossary_search_index` (mặc định); dự phòng DB (`GlossaryFlatListService`, `GlossaryBusinessVersionSearchService`) |
| Từ điển kỹ thuật (TD) | Bản ghi `technical_record` gắn Column | Không có business version; bản chụp theo phiên bản DD | `technical_record*` | Index `technical_dictionary_search_index` (luôn đọc index, không fallback) |

`GovernedGlossaryProfileRegistry` xác định profile (`DATA_DICTIONARY`, `DATA_QUALITY`) từ glossary hệ thống; client không gửi profile. Từ điển kỹ thuật không còn là profile glossary.

Bảng tùy biến (migration 1.13.x):

| Nhóm | Bảng |
| --- | --- |
| Version nghiệp vụ glossary | `glossary_business_working`, `glossary_business_snapshot`, `glossary_business_snapshot_history`, `glossary_published_head`, `glossary_snapshot_term`, `glossary_snapshot_outbox` |
| Từ điển kỹ thuật | `technical_record`, `technical_record_change_request`, `technical_record_audit`, `technical_binding_snapshot`, `technical_dictionary_state`, `technical_outbox` |
| Kiểm thử theo DQ Rule | `dq_rule_test_binding`, `dq_rule_exec`, `dq_rule_test_spec_exec`, `dq_test_outbox` |
| Đồng bộ search index glossary | `governed_glossary_search_outbox` (migration `1.13.3`; môi trường đã chạy 1.13.3 phải migrate lại bằng `--force`) |

Classification nghiệp vụ (`DataQualityDimension`, `DataQualityTargetPopulation`, `DataQualityMethod`, `DataQualityFrequency`, `DataSource`, `DataClassification`, `PersonalData`, `DataElementType`, `FieldGenerationType`, `DataCreationMethod`, `DataTimeliness`, …) được seed cố định từ `openmetadata-service/src/main/resources/json/data/tags/*.json` với `provider: system`, như cơ chế seed tag upstream.

## 3. Vòng đời yêu cầu thống nhất

Mọi thay đổi trên ba phân hệ là một **yêu cầu** maker-checker; bản Approved đang hiệu lực không bị ảnh hưởng cho tới khi yêu cầu được duyệt.

| Loại yêu cầu | CDE / DQ Rule | Từ điển kỹ thuật |
| --- | --- | --- |
| Tạo mới | Working `Draft` → `In Review` → `Approved`/`Rejected` | Record `Draft` → `In Review` → `Approved`/`Rejected` |
| Sửa | Version minor mới hoặc **Sửa phiên bản** (bản nháp cùng `businessVersion`) | Change request `UPDATE` |
| Xóa | `POST .../working/deletion`: working `pendingDeletion`, vào `In Review` ngay | `POST .../records/{id}/deletion-request`: change request `DELETE`, vào `In Review` ngay |
| Rút yêu cầu (chỉ người gửi, khi `In Review`) | `POST .../working/withdraw`: yêu cầu xóa bị hủy, loại khác về `Draft` | `.../withdraw` (record mới về `Draft`), `.../change-request/withdraw` (hủy proposal) |
| Hủy bản nháp | `DELETE .../working` (`Draft`/`Rejected`) | `DELETE .../change-request` hoặc xóa record chưa Approved |
| Duyệt hàng loạt | `POST /glossaryTerms/bulk/{submit|approve|reject|withdraw}` | `POST /technical/records/bulk/{submit|approve|reject}` |

Người gửi không được tự duyệt. Duyệt yêu cầu xóa CDE kiểm tra `CdeDeletionGuard`: CDE không được còn record TD, DQ Rule, CDE khác tham chiếu hoặc asset gắn tag. Duyệt xóa archive mọi snapshot Approved của term trong scope, bỏ published head, giữ lịch sử. Xóa DQ Rule đưa reconcile vào `dq_test_outbox` trong cùng transaction để gỡ TestCase/pipeline managed.

Không còn route archive trực tiếp (`.../published/latest/archive`) và không có hủy duyệt.

UI dùng một component chung `PendingRequestsTab` (tab **Yêu cầu**) cho cả ba phân hệ, mỗi phân hệ có adapter riêng: `useGlossaryPendingRequestsAdapter` (đọc working records `Draft`/`In Review` từ DB), `useDataQualityPendingRequestsAdapter`, `useTechnicalPendingRequestsAdapter` (đọc `GET /glossaryTerms/technical/requests`). Thanh chọn hàng loạt dùng `BulkSelectionBar`, xác nhận dùng `ReviewActionConfirmModal`.

## 4. Cutover phiên bản Từ điển dữ liệu

Approve DD `N+1` trong một transaction:

1. Archive DD `N` và CDE Approved `N.x`; xóa CDE non-Approved `N.x`.
2. Archive DQ Rule Approved của scope `N`; nếu catalog DQ đang ở `N` và không có working, archive catalog `N` và mở catalog DQ `N+1` dạng Draft rỗng (`advanceDataQualityCatalog`). Rule phải được tạo lại theo scope DD mới.
3. Chụp các record TD đã gắn CDE vào `technical_binding_snapshot`, xóa **toàn bộ** record TD (kèm change request đang chờ) và gắn TD sang phiên bản DD mới (`TechnicalCutover`); lỗi ở bước này rollback cả lần duyệt. `publish-preview` trả số lượng ảnh hưởng để UI cảnh báo.
4. Ghi outbox để reindex và reconcile kiểm thử DQ sau commit.

## 5. Projection, search index và side effect

**Nguyên tắc:** database là nguồn dữ liệu gốc; Elasticsearch chỉ phục vụ màn hình **danh sách, tìm kiếm, lọc, thống kê**. Chi tiết, danh sách chờ duyệt (tab **Yêu cầu**), lịch sử, phiên bản và mọi thao tác ghi đọc/ghi DB.

| Index (alias) | Phân hệ | Đọc | Khi index lỗi |
| --- | --- | --- | --- |
| `governed_glossary_search_index` | DD/CDE, DQ | Mặc định bật; tắt bằng `GOVERNED_GLOSSARY_SEARCH_READ_FROM_INDEX=false` (hoặc property `governedGlossarySearch.readFromIndex`) | Tự chuyển sang đọc DB |
| `technical_dictionary_search_index` | TD | Luôn đọc index | `503 TD_INDEX_UNAVAILABLE`, không quét DB |

- **Hạ tầng dùng chung** (`governance/search`): `GovernanceSearchIndex` (tạo index, rebuild bằng physical index mới rồi đổi alias), `GovernanceOutboxRunner` (worker 60 giây), `GovernanceSearchCircuit` (lỗi kết nối/5xx thì ngừng gọi ES 15 giây), `GovernanceSearchScanner` (đối soát), `GovernanceSearchMetrics` (`om_governance_search_*`). Giả định production chạy **1 instance**.
- **Glossary** (`glossary/search`): `GovernedGlossaryOutbox` ghi `governed_glossary_search_outbox` cùng transaction với thay đổi working/snapshot, flush tối đa 5 giây ngay sau commit; `GovernedGlossaryDocumentBuilder`, `GovernedGlossarySearchQueryBuilder`, `GovernedGlossarySearchService`, `GovernedGlossaryReconciler` (so số dòng và tổng revision theo từng phiên bản đang dùng, bỏ phiên bản archived), `GovernedGlossaryIndexRebuilder` (`POST /glossaryTerms/index/rebuild`, Admin). `GovernedGlossarySearchBootstrap` tự tạo/rebuild khi mapping đổi.
- **Quyền xem** không phụ thuộc từng term: kiểm tra một lần mỗi request, sau đó lọc theo trạng thái trong truy vấn (Consumer chỉ thấy bản Approved); không lưu thông tin phân quyền trong index.
- **Tìm kiếm** không phân biệt dấu và hoa thường (gồm `đ`→`d`). DD/CDE và DQ tìm chuỗi con trong **mã, tên và mô tả** (`nameSearch`, `displayNameSearch`, `descriptionSearch`, cùng ngữ nghĩa với đường dự phòng DB). TD dùng ngram 3–10 ký tự.
- **UI** dùng bộ thành phần chung `common/GovernanceList` (`GovernanceListSearchInput`, `GovernanceListFilterDropdown`, `GovernanceListTable`, `GovernanceListToolbar`) cho cả ba danh sách; `ApprovedRecordHistoryModal` thay modal lịch sử sửa riêng của CDE.

| Kênh outbox | Nguồn | Consumer | Worker |
| --- | --- | --- | --- |
| `governed_glossary_search_outbox` | Tạo/sửa/trình/duyệt/từ chối/xóa working hoặc snapshot DD/CDE/DQ | Index glossary | OM server, 60 giây; mục lỗi chỉ worker retry, không chặn mục khác |
| `glossary_snapshot_outbox` | Publish/sửa/xóa snapshot | Đồng bộ TD | OM server |
| `technical_outbox` | Ghi `technical_record`, reset khi cutover | `INDEX` (`technical_dictionary_search_index`), `PROJECTION` (tag trên Column), `RESET` | Xử lý ngay sau commit; lỗi được worker và lần đọc kế tiếp retry |
| `dq_test_outbox` | Approve/xóa/cutover DQ Rule, thay đổi TD | `DqTestReconciler` sinh/gỡ TestCase, suite, pipeline; `SYNC_INGESTION_PIPELINE`, `TRIGGER_INGESTION_PIPELINE` | OM server, 60 giây; Portal không drain |

Trước mỗi lần đọc danh sách server đồng bộ thêm các mục outbox đang chờ nếu không có luồng nào khác đang chạy. Metric cảnh báo và quy trình rebuild: [van-hanh-search-index.md](../../../docs/van-hanh-search-index.md).

Sửa phiên bản (`GlossaryVersionCorrection`) ghi lịch sử thay đổi theo từng trường (`GlossaryCorrectionChanges`); tạo DQ Rule trả `409` chỉ khi vi phạm khóa duy nhất thật sự (`isDuplicateKeyViolation`), các lỗi SQL khác được ném lại.

## 5.1. Tab theo phân hệ

Term DQ ẩn tab **Tài sản** (cùng nhóm tab bị hạn chế của CDE): DQ Rule không gắn trực tiếp vào asset, quan hệ với dữ liệu thực đi qua kiểm thử (tab Kiểm thử).

## 6. Tài liệu phân hệ

| Phân hệ | Thiết kế | Kế hoạch |
| --- | --- | --- |
| DD/CDE | [cde-glossary-ui-design.md](./cde-glossary-ui-design.md) | [cde-glossary-feature-implementation-plan.md](./cde-glossary-feature-implementation-plan.md) |
| DQ | [dq-glossary-ui-design.md](./dq-glossary-ui-design.md) | [dq-glossary-feature-implementation-plan.md](./dq-glossary-feature-implementation-plan.md) |
| Kiểm thử theo DQ Rule | [dq-rule-test-execution-design.md](./dq-rule-test-execution-design.md) | [dq-rule-test-execution-implementation-plan.md](./dq-rule-test-execution-implementation-plan.md) |
| Từ điển kỹ thuật | [technical-dictionary-design.md](./technical-dictionary-design.md) | [technical-dictionary-search-index-implementation-plan.md](./technical-dictionary-search-index-implementation-plan.md) |
| Search index (vận hành) | [van-hanh-search-index.md](../../../docs/van-hanh-search-index.md) | [ke-hoach-dong-nhat-doc-du-lieu.md](../../../docs/ke-hoach-dong-nhat-doc-du-lieu.md) |
| Triển khai Portal/OM | [public-admin-split-deployment-architecture.md](./public-admin-split-deployment-architecture.md) | — |
