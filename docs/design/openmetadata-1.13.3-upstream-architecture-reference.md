# Kiến trúc tham chiếu OpenMetadata 1.13.3

## 1. Mục đích và baseline

Tài liệu này là baseline để thiết kế, review và xử lý lỗi cho bản tùy biến Agribank. Phạm vi đối chiếu là mã nguồn upstream:

- Repository: `open-metadata/OpenMetadata`.
- Tag: `1.13.3-release`.
- Commit đã đối chiếu: `255f6694913b84797064a42859cda3f2a3425dc6`.
- Trọng tâm: nguồn dữ liệu của các API/UI, ranh giới giữa relational database và Elasticsearch/OpenSearch, luồng ghi/index và nguyên tắc mở rộng.

Đây là tài liệu kiến trúc logic toàn hệ thống, không thay thế tài liệu sizing, HA, backup hoặc deployment riêng của từng môi trường.

## 2. Quyết định kiến trúc cốt lõi

### 2.1. Database là nguồn sự thật nghiệp vụ

PostgreSQL hoặc MySQL lưu entity JSON, quan hệ, version, extension, policy, workflow/configuration và các bản ghi vận hành mà repository/DAO quản lý. Các thao tác sau phải resolve từ database authoritative:

- Create, update, patch, delete và restore entity.
- Get by ID/name/FQN, list theo scope, version history và relationship traversal.
- Kiểm tra revision/version, state transition, uniqueness và transaction invariant.
- Authorization cần trạng thái chính xác tại thời điểm thao tác.
- Màn hình quản trị/nghiệp vụ cần strong read-after-commit.

### 2.2. Search engine là projection dẫn xuất

Elasticsearch hoặc OpenSearch chứa search documents được xây từ entity đã commit. Projection này tối ưu cho:

- Global search và discovery đa loại entity.
- Full-text relevance, autocomplete/suggest, aggregation và facet.
- Tìm hoặc đếm asset theo tag, GlossaryTerm, domain, owner và các thuộc tính đã index.
- Search API cần truy vấn ngang nhiều entity với ranking.

Search document không phải bản ghi nghiệp vụ thứ hai để cập nhật độc lập. Nó có thể trễ, thiếu hoặc stale khi indexing lỗi; hệ thống phải có khả năng rebuild từ database. Không dùng search engine để quyết định một workflow mutation đã commit hay chưa.

### 2.3. Một entity có thể xuất hiện ở cả hai nơi

Việc `Glossary`, `GlossaryTerm`, `Table`, `Dashboard` hoặc entity khác được index không có nghĩa mọi màn hình của entity đó đọc OpenSearch. Cần phân biệt:

| Nhu cầu | Nguồn mặc định |
| --- | --- |
| CRUD, detail, list theo container/scope, version, relationship | Database qua repository/DAO |
| Global discovery, full-text relevance, facet/aggregation | Search engine |
| Workflow/state chính xác vừa commit | Database |
| Tìm asset liên quan theo field/tag đã index | Search engine, sau đó hydrate nếu contract cần |
| Reindex/recovery | Database → search engine |

## 3. Các khối hệ thống

| Khối | Trách nhiệm | Persistence/Dependency chính |
| --- | --- | --- |
| Web UI | Route, form, table, entity detail, global search | Gọi REST API; không truy cập DB/search trực tiếp |
| REST resources | HTTP contract, validation, pagination, authorization entry point | Resource classes JAX-RS |
| Entity repositories | Invariant, lifecycle, relationship, field hydration, versioning | Relational database và DAO |
| DAO/JDBI | SQL, transaction, entity JSON, relationship, extension, time-series | PostgreSQL/MySQL |
| Search subsystem | Index document, query, suggest, aggregation, reindex | Elasticsearch/OpenSearch |
| Authorization | Policy evaluation theo principal/resource/operation | Entity/policy/team/role từ database; search query vẫn phải enforce quyền phù hợp |
| Ingestion framework | Connector source/sink, metadata/test/profiler/lineage ingestion | Python client gọi REST; scheduler/orchestrator chạy pipeline |
| Pipeline/application runtime | Lưu cấu hình và trạng thái job, trigger/run workflow | Database cộng runtime/orchestrator được cấu hình |
| Events/notifications | Entity change event, webhook/notification/event subscription | Sinh từ lifecycle đã commit; delivery là side effect |
| Cache | Tối ưu dữ liệu đọc nhiều nếu được bật | Không thay thế nguồn sự thật |

## 4. Luồng ghi chuẩn

```text
UI / API client
      │
      ▼
REST Resource ── validate request + authorize
      │
      ▼
Entity Repository ── invariant + relationship + version logic
      │
      ▼
Database transaction ── entity / relation / extension / version commit
      │
      ├──► lifecycle/change event
      ├──► search index update
      └──► notification/webhook/other integration
```

Giá trị nghiệp vụ chỉ thành công sau database transaction. Search indexing và integration là projection/side effect; lỗi của chúng phải quan sát, retry hoặc reindex được, không được tạo một nguồn sự thật cạnh tranh với database.

Trong upstream, `SearchIndexHandler` tham gia entity lifecycle để cập nhật search index. Đây là cơ chế đồng bộ projection, không thay đổi quyền sở hữu dữ liệu của repository/DAO.

## 5. Luồng đọc và cách chọn nguồn

### 5.1. Entity REST

Các endpoint entity tiêu chuẩn `list`, `getById`, `getByName`, `versions`, `create`, `patch`, `delete` đi qua resource → repository → DAO/database. Field quan hệ có thể được repository hydrate theo `fields` hoặc DAO quan hệ.

### 5.2. Search REST

Các endpoint `/search/query`, suggest, aggregate/facet và các helper dựa trên `EntitySearch` đi vào search engine. Kết quả phù hợp cho discovery, nhưng caller phải chấp nhận projection consistency và contract authorization của search layer.

### 5.3. Quy tắc quyết định

Trước khi thêm một query, trả lời theo thứ tự:

1. Kết quả có quyết định state, workflow, revision, permission hoặc vừa ghi xong hay không? Nếu có, dùng database.
2. Query có phải list theo một parent/scope xác định và database có khóa/index phù hợp hay không? Nếu có, ưu tiên database.
3. Query có cần relevance, full-text đa entity, facet lớn hoặc discovery ngang toàn catalog hay không? Nếu có, dùng search engine.
4. Nếu search result dẫn tới mutation, backend phải tải lại entity authoritative và kiểm tra quyền/invariant từ database trước khi ghi.

## 6. Bản đồ theo phân hệ

| Phân hệ/chức năng | Database authoritative | Search engine |
| --- | --- | --- |
| Data assets: Table, Topic, Dashboard, Pipeline, ML Model, API, Container... | CRUD, detail, version, owner/domain/tag/relationship và service/container hierarchy | Global search, relevance, facet, suggest và discovery asset |
| Services và connections | Service entity/configuration, ownership, relationship, pipeline configuration | Discovery service/entity nếu được index |
| Glossary và GlossaryTerm | CRUD, list, detail, hierarchy, status filter, version, relationship và DB-backed term search endpoint | Global discovery của Glossary/Term; tìm/đếm asset được gắn term |
| Classification và Tag | CRUD, hierarchy, assignment relationship | Discovery và tìm asset theo tag |
| Domain và Data Product | CRUD, hierarchy/membership authoritative | Discovery và aggregation asset/membership đã index khi endpoint dùng search |
| Lineage | Edge/relationship authoritative và API lineage | Search chỉ hỗ trợ tìm entity đầu mút; không là nguồn sự thật của graph lineage |
| Data Quality | Test definition/suite/case, cấu hình và quan hệ; kết quả/time-series theo DAO tương ứng | Discovery các entity DQ; không thay thế kho kết quả authoritative |
| Profiler và time series | Sample/profile/query/system metrics theo extension/time-series store được repository quản lý | Có thể index summary phục vụ discovery; không là kho metric gốc |
| Users, Teams, Roles, Policies, Bots | Identity, membership, policy và permission inputs | Discovery khi entity được index; authorization cuối cùng không dựa vào document stale |
| Feeds, tasks, conversations | Thread/task state, assignee, transition và relationship | Search nếu có chỉ phục vụ tìm kiếm, không điều khiển task state |
| Ingestion Pipelines | Pipeline entity, cấu hình, status/run metadata | Discovery pipeline; execution do ingestion runtime/orchestrator |
| Applications/Jobs | App config, run record/status theo repository và scheduler | Discovery nếu được index |
| Events, subscriptions, webhooks | Subscription/configuration và change/event state | Không dùng làm nguồn event authoritative; search update là một consumer/side effect |
| Usage, analytics và reports | Raw/aggregated records theo DAO hoặc pipeline tương ứng | Có thể đọc aggregation từ search khi feature được thiết kế dựa trên indexed assets |

Ma trận trên mô tả ranh giới mặc định. Khi đánh giá một endpoint cụ thể, source code của resource/service/repository tại đúng tag vẫn là bằng chứng cuối cùng.

## 7. Baseline chi tiết cho Glossary

### 7.1. Các thao tác đọc database

Trong upstream 1.13.3, các luồng sau thuộc database/repository path:

- `GET /v1/glossaries`, get by ID/name, version list/version detail.
- CRUD/PATCH/delete/restore Glossary.
- `GET /v1/glossaryTerms` theo glossary/parent/status và cursor pagination.
- Get GlossaryTerm by ID/FQN, children, version history và CRUD/workflow fields.
- `GET /v1/glossaryTerms/search` dùng DAO SQL để tìm term theo query/glossary/parent; tên endpoint không đồng nghĩa với OpenSearch.
- UI table/tree Glossary gọi các endpoint trên để lấy Glossary/GlossaryTerm.

### 7.2. Các thao tác dùng search engine

Trong phạm vi màn hình Glossary, search engine được dùng khi câu hỏi thực chất là về catalog asset:

- Tab Assets của một GlossaryTerm tìm các asset có tag/GlossaryTerm tương ứng.
- Đếm asset liên quan tới Glossary/GlossaryTerm.
- Global search/discovery có thể trả về Glossary hoặc GlossaryTerm vì chúng được index.

Kết luận: index `glossaryTerm` phục vụ discovery và liên kết tới asset; nó không thay thế `GlossaryRepository`, `GlossaryTermRepository` hoặc DAO cho list/detail/status/workflow.

### 7.3. Quyết định cho Data Dictionary/CDE tùy biến

- F11 default list và F12 search/filter phải dùng cùng database-backed flat read model.
- `parentBusinessVersion`, `businessVersion`, working/published snapshot và archive manifest là dữ liệu nghiệp vụ authoritative trong database.
- Filter `Draft`, `In Review`, `Rejected`, `Approved`, domain, owner và classification phải được áp trong database trước `COUNT`, sort và pagination.
- Không tạo custom index chỉ vì UI bật filter. Không route Consumer/Manager sang hai alias có độ trễ khác nhau.
- OpenSearch vẫn được giữ cho global discovery và Assets. Việc đó độc lập với nguồn dữ liệu của bảng CDE.

## 8. Consistency và failure model

| Tình huống | Hành vi đúng |
| --- | --- |
| Database commit thành công, index update chậm/lỗi | Mutation vẫn được xác định theo DB; detail/list nghiệp vụ thấy dữ liệu đã commit; search có thể tạm stale và cần retry/reindex |
| Search trả một hit đã stale | Backend không dùng hit đó để bỏ qua authorization, revision hoặc state check từ DB |
| Reindex | Đọc entity authoritative từ DB và tái tạo document; không merge ngược document vào DB |
| Filter nghiệp vụ vừa ghi | Query DB để có read-after-commit; không chờ refresh interval của search |
| Search engine unavailable | CRUD/detail/list DB-backed vẫn phải có failure boundary độc lập nếu kiến trúc triển khai cho phép |

## 9. Guardrail khi tùy biến

- Không để cùng một bảng chuyển DB ↔ search engine chỉ vì người dùng nhập từ khóa hoặc bật filter.
- Không đặt tên endpoint `/search` rồi mặc định kết luận implementation phải dùng OpenSearch; xác định nguồn từ repository/service/DAO thực tế.
- Authorization phải được áp trước `total` và pagination. Không page trước rồi post-filter.
- Không hydrate từng row bằng N+1 query; xây một query/bounded batch và đo execution plan.
- Các filter nhiều-nhiều dùng khóa UUID/FQN và bảng nối/index phù hợp, không dùng display label làm identity.
- SQL luôn dùng bind parameter; escape ký tự wildcard khi contract coi input là literal.
- Stable sort phải có tie-breaker định danh để pagination không trùng/mất row trên dataset cố định.
- Nếu thực sự cần custom search projection, phải ghi rõ use case discovery, consistency SLA, authorization model, document identity, rebuild source và failure behavior. Projection đó không được trở thành nguồn workflow mặc định.

## 10. Checklist review một thay đổi

1. Endpoint nào gọi từ UI và response contract là gì?
2. Resource gọi repository/DAO hay search service?
3. Nguồn authoritative của từng field nằm ở đâu?
4. Query có áp scope và authorization trước count/page không?
5. Read-after-write requirement là strong hay eventual, và người dùng có được thông báo không?
6. Search engine hỏng hoặc index stale thì nghiệp vụ nào bị ảnh hưởng?
7. Có route nào cùng màn hình nhưng đọc nguồn khác gây total/status mâu thuẫn không?
8. Có test PostgreSQL/MySQL, query plan, N+1, stable pagination và authorization leakage không?
9. Có regression test cho endpoint native không thuộc phần tùy biến không?

## 11. Nguồn upstream đã đối chiếu

- [GlossaryResource — list/detail CRUD qua repository](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-service/src/main/java/org/openmetadata/service/resources/glossary/GlossaryResource.java#L101-L231)
- [GlossaryTermResource — list/status/children](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-service/src/main/java/org/openmetadata/service/resources/glossary/GlossaryTermResource.java#L199-L307)
- [GlossaryTermResource — endpoint `/search` gọi repository](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-service/src/main/java/org/openmetadata/service/resources/glossary/GlossaryTermResource.java#L310-L406)
- [GlossaryTermRepository — DB-backed term search](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/GlossaryTermRepository.java#L2468-L2581)
- [SearchIndexHandler — lifecycle cập nhật search projection](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-service/src/main/java/org/openmetadata/service/events/lifecycle/handlers/SearchIndexHandler.java#L28-L126)
- [GlossaryTermTab UI — gọi DB-backed term search API](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-ui/src/main/resources/ui/src/components/Glossary/GlossaryTermTab/GlossaryTermTab.component.tsx#L275-L323)
- [Glossary Terms UI — tìm/đếm Assets qua search](https://github.com/open-metadata/OpenMetadata/blob/1.13.3-release/openmetadata-ui/src/main/resources/ui/src/components/Glossary/GlossaryTerms/GlossaryTermsV1.component.tsx#L129-L150)

Các link cố định theo tag `1.13.3-release`; khi nâng version, phải tạo delta architecture và kiểm tra lại từng resource/repository thay vì suy diễn rằng ranh giới dữ liệu không đổi.
