# Huong Dan Chay Moi Truong Dev

## 1. Local dev (khuyen dung khi sua code)

Chay tat ca bang mot lenh: `./dev.sh up` (xem `README.md` muc 7.1). Cac buoc ben duoi la tung lenh rieng.

PostgreSQL va OpenSearch chay trong Docker. Server OpenMetadata, server Portal va UI chay truc tiep tren
may tu ma nguon, khong build image.

```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/deploy/dev
./local-dev.sh infra        # bat PostgreSQL + OpenSearch, tat server/portal trong Docker
./local-dev.sh migrate      # chay DB migration (lan dau, hoac khi sua SQL migration)
./local-dev.sh reindex      # dung lai index OpenSearch tu PostgreSQL (khi mat du lieu OpenSearch)
```

Moi lenh duoi day chay trong mot terminal rieng:

| Lenh | Dia chi |
| --- | --- |
| `./local-dev.sh server` | API OpenMetadata `:8585`, healthcheck `:8586` |
| `./local-dev.sh portal` | API Portal `:8595`, healthcheck `:8596` |
| `./local-dev.sh ui` | UI OpenMetadata http://localhost:3000 (proxy sang `:8585`) |
| `./local-dev.sh ui-portal` | UI Portal http://localhost:3001 (proxy sang `:8595`) |

Khi sua code:

- **UI**: Vite tu cap nhat, khong can lam gi.
- **Backend** (`openmetadata-service`): `Ctrl+C` server roi chay lai
  `./local-dev.sh server` (hoac `portal`). Script tu compile lai (khoang 1 phut).
- **SQL migration**: `./local-dev.sh migrate`.
- **openmetadata-spec** (JSON schema): `mvn install -pl openmetadata-spec -DskipTests` truoc.

Ghi chu:

- Server doc `deploy/dev/.env` (dang nhap, SSO), roi tro DB sang `localhost:8001` va OpenSearch sang
  `localhost:8086`.
- Server tren may khong phuc vu UI (mo `:8585/` se loi). Dung UI tren `:3000` / `:3001`.
- Ket noi Ingestion tat mac dinh. Can "Kiem thu ket noi", ingest metadata hoac chay pipeline kiem thu thi bat Airflow
  trong Docker roi chay server voi `WITH_INGESTION=true`:

  ```bash
  ./local-dev.sh ingestion                     # Airflow http://localhost:8080 (admin/admin)
  WITH_INGESTION=true ./local-dev.sh server    # server goi Airflow o localhost:8080; Airflow goi lai server qua gateway omd_network
  ```
- Dang nhap basic: `admin@open-metadata.org` / `admin`.
- `./local-dev.sh portal` ket noi PostgreSQL bang user `portal_ro` (chi doc, tao boi `./local-dev.sh infra`). Portal khong tao du lieu
  khoi tao, nen chay `migrate` roi chay `server` it nhat mot lan truoc khi chay `portal`, va nguoi dung phai duoc tao san trong OM.

---

## 2. Chay toan bo bang Docker

Dung khi can kiem thu dung nhu ban trien khai:

```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/deploy/dev
./build-server-image.sh                      # build UI + backend, dong goi thanh image openmetadata/server:custom-1.13.3
SKIP_UI_BUILD=true ./build-server-image.sh   # dung lai ui/dist va ui/dist-portal da build
docker compose -f docker-compose.dev.yml up -d
```

- Image server chua ca backend lan UI (`assets/` va `portal-assets/` nam trong jar), nen khong co image Frontend/Nginx rieng.
- Server OpenMetadata va Portal dung chung mot image. Compose tu giu thu tu `execute-migrate-all`, `openmetadata-server`, `portal`.
- Sua code backend hoac UI thi chay lai `./build-server-image.sh`, roi `docker compose -f docker-compose.dev.yml up -d`.

Dia chi truy cap:
- OpenMetadata: http://localhost (cong `OPENMETADATA_UI_PORT`, mac dinh 80) hoac http://localhost:8585
- Portal: http://localhost:8595 (cong `PORTAL_UI_PORT`)
- Ingestion (Airflow): http://localhost:8080

---

## 3. Tat he thong

```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/deploy/dev
docker compose -f docker-compose.dev.yml down
```
