# Huong Dan Chay Moi Truong Dev

## 1. Chay toan bo bang Docker
Dung khi can kiem thu he thong bang Docker:

```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/deploy/dev
./run.sh
```
- Chon `1`: Build Frontend va khoi dong
- Chon `2`: Build Backend va khoi dong
- Chon `3`: Build ca hai va khoi dong
- Chon `4`: Chi restart Docker (khong build lai)

Dia chi truy cap:
- Frontend UI (Nginx): http://localhost:3000 (admin / admin)
- Backend API (Java): http://localhost:8585

---

## 2. Phat trien Frontend (Hot-Reload)
Dung khi code giao dien React (sua code cap nhat ngay trong 0.1s):

### Buoc 1: Chi bat Backend (khong bat container UI de tranh trung cong 3000)
```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/deploy/dev
docker compose -f docker-compose.dev.yml up -d openmetadata-server openmetadata_postgresql openmetadata_opensearch
```

### Buoc 2: Chay Vite Dev Server tren may host
```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/openmetadata-ui/src/main/resources/ui
NODE_OPTIONS="--max-old-space-size=2048" NODE_ENV=production yarn start
```
Truy cap: http://localhost:3000

---

## 3. Tat he thong
```bash
cd /home/dinhphu/Documents/Agribank-Metadata/OpenMetadata/deploy/dev
docker compose -f docker-compose.dev.yml down
```
