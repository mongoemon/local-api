# JMeter → InfluxDB → Grafana: คู่มือการเชื่อมต่อ

คู่มือนี้อธิบายวิธีส่ง metrics ของ JMeter แบบ real-time เข้า Grafana เพื่อดู throughput, latency, และ error rate บน dashboard ขณะที่ test กำลังรันอยู่

## สถาปัตยกรรมการทำงาน

```
┌─────────────┐   Backend Listener   ┌───────────┐   data source   ┌─────────┐
│   JMeter    │ ──────────────────► │  InfluxDB  │ ──────────────► │ Grafana │
└─────────────┘   (ทุก 5 วินาที)    └───────────┘                  └─────────┘

┌─────────────┐   GET /metrics       ┌────────────┐  data source   ┌─────────┐
│  local-api  │ ◄─────────────────  │ Prometheus  │ ─────────────► │ Grafana │
└─────────────┘   (scrape interval)  └────────────┘                 └─────────┘
```

- **JMeter stream** — Backend Listener ที่ตั้งค่าไว้แล้วใน `jmeter/local-api-test-plan.jmx` จะส่งผลลัพธ์ของ sampler ไปยัง InfluxDB ทุก 5 วินาที Grafana อ่านข้อมูลนั้นและแสดง JMeter dashboard
- **App stream** — เซิร์ฟเวอร์เปิดเผย `GET /metrics` ในรูปแบบ Prometheus Prometheus scrape ข้อมูลนั้นแล้ว Grafana แสดง counter ฝั่งเซิร์ฟเวอร์ (active requests, request duration histograms) ควบคู่กับข้อมูลของ JMeter

---

## ส่วนที่ 1 — InfluxDB

### ตัวเลือก A — InfluxDB v1 (ง่ายกว่า)

**ติดตั้ง**

```bash
# macOS
brew install influxdb@1

# Ubuntu / Debian
wget -q https://dl.influxdata.com/influxdb/releases/influxdb_1.11.8_amd64.deb
sudo dpkg -i influxdb_1.11.8_amd64.deb

# Docker
docker run -d --name influxdb -p 8086:8086 influxdb:1.8
```

**สร้าง database**

```bash
influx -execute "CREATE DATABASE jmeter"
# ตรวจสอบ
influx -execute "SHOW DATABASES"
```

**ใช้ค่าเริ่มต้นของ INFLUX_URL** ใน JMX ได้เลย:

```
http://localhost:8086/write?db=jmeter
```

### ตัวเลือก B — InfluxDB v2

**ติดตั้ง**

```bash
# macOS
brew install influxdb

# Docker
docker run -d --name influxdb2 -p 8086:8086 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=adminpass \
  -e DOCKER_INFLUXDB_INIT_ORG=myorg \
  -e DOCKER_INFLUXDB_INIT_BUCKET=jmeter \
  influxdb:2
```

**รับ API token**

```bash
# เปิด UI ที่ http://localhost:8086
# ไปที่ Data → API Tokens → Generate All Access Token
# คัดลอก token
```

**อัปเดต INFLUX_URL ใน JMX** (ในส่วน User Defined Variables):

```
http://localhost:8086/api/v2/write?org=myorg&bucket=jmeter&token=<YOUR_TOKEN>
```

---

## ส่วนที่ 2 — Grafana

### ติดตั้ง

```bash
# macOS
brew install grafana
brew services start grafana

# Ubuntu / Debian
sudo apt-get install -y grafana
sudo systemctl start grafana-server

# Docker
docker run -d --name grafana -p 3000:3000 grafana/grafana
```

เปิด **http://localhost:3000** — username/password เริ่มต้นคือ `admin` / `admin`

### เพิ่ม InfluxDB เป็น data source

1. ไปที่ **Connections → Data sources → Add data source**
2. เลือก **InfluxDB**
3. กรอกข้อมูล:

| Field | InfluxDB v1 | InfluxDB v2 |
|-------|------------|------------|
| URL | `http://localhost:8086` | `http://localhost:8086` |
| Query language | InfluxQL | Flux |
| Database | `jmeter` | — |
| Organisation | — | `myorg` |
| Token | — | `<YOUR_TOKEN>` |
| Default bucket | — | `jmeter` |

4. คลิก **Save & test** — ควรแสดง "datasource is working"

### Import JMeter dashboard

1. ไปที่ **Dashboards → Import**
2. กรอก ID **`5496`** แล้วคลิก **Load**
3. เลือก InfluxDB data source ที่สร้างไว้
4. คลิก **Import**

จะเห็น panel สำหรับ: Throughput (req/s), Active Threads, Response Time (avg/p90/p99), Error Rate, และ Virtual Users ตามเวลา

---

## ส่วนที่ 3 — Prometheus (metrics ฝั่ง app)

เซิร์ฟเวอร์เปิดเผย `GET /metrics` ที่ `http://localhost:3001/metrics` ให้ข้อมูล Node.js process metrics และ histogram `http_request_duration_seconds` แยกตาม route

### ติดตั้ง Prometheus

```bash
# macOS
brew install prometheus

# Docker
docker run -d --name prometheus -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### สร้างไฟล์ `prometheus.yml`

```yaml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: local-api
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
```

### เริ่ม Prometheus

```bash
prometheus --config.file=prometheus.yml
```

ตรวจสอบที่ **http://localhost:9090/targets** — `local-api` ควรแสดงสถานะ `UP`

### เพิ่ม Prometheus เป็น data source ใน Grafana

1. **Connections → Data sources → Add data source → Prometheus**
2. URL: `http://localhost:9090`
3. **Save & test**

### ตัวอย่าง PromQL query สำหรับสร้าง panel เอง

| ต้องการวัดอะไร | Query |
|----------------|-------|
| Request rate แยก route | `rate(http_request_duration_seconds_count[1m])` |
| p95 latency แยก route | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1m]))` |
| Active requests ขณะนั้น | `http_active_requests` |
| Error rate (non-2xx) | `rate(http_request_duration_seconds_count{status=~"4..\|5.."}[1m])` |

---

## ส่วนที่ 4 — รัน test

### เริ่มเซิร์ฟเวอร์

```bash
npm start
# เซิร์ฟเวอร์รองรับที่ http://localhost:3001
```

### ตัวเลือก A — GUI mode (ดู live ขณะกด play)

```bash
jmeter -t jmeter/local-api-test-plan.jmx
```

เปิด test plan แล้วกดปุ่ม **Start** สีเขียว จากนั้นเปิด Grafana dashboard #5496 — panel จะอัปเดตแบบ real-time

### ตัวเลือก B — CLI mode (CI / script)

```bash
jmeter -n \
  -t jmeter/local-api-test-plan.jmx \
  -l jmeter/results/results.jtl \
  -e -o jmeter/results/html-report \
  -JHOST=localhost \
  -JPORT=3001 \
  -JTHREADS=20 \
  -JRAMP_UP=60 \
  -JDURATION=300 \
  -JBEARER_TOKEN=lab-token \
  -JINFLUX_URL="http://localhost:8086/write?db=jmeter" \
  -JTEST_TITLE="Load Test Run 1"
```

| Flag | ค่าที่ override |
|------|----------------|
| `-JTHREADS` | จำนวน user ต่อ thread group |
| `-JRAMP_UP` | วินาทีที่ใช้เพิ่มจำนวน thread จนเต็ม |
| `-JDURATION` | ระยะเวลา sustain load (วินาที) |
| `-JINFLUX_URL` | InfluxDB write endpoint |
| `-JTEST_TITLE` | label ที่แสดงใน Grafana event annotation |

HTML report สร้างที่ `jmeter/results/html-report/index.html`

---

## ส่วนที่ 5 — สิ่งที่ควรดูใน Grafana

| Panel | สัญญาณปกติ | สัญญาณเตือน |
|-------|-----------|------------|
| **Active Threads** | เพิ่มขึ้นสม่ำเสมอตาม ramp | ร่วงกะทันหัน = thread เกิด error และตาย |
| **Throughput (req/s)** | คงที่หรือเพิ่มขึ้นตามจำนวน thread | แบนราบขณะ thread เพิ่ม = server อิ่มตัว |
| **Response Time avg** | ต่ำกว่า 500 ms สำหรับ /fast | ไต่ขึ้น = CPU หรือ concurrency เป็น bottleneck |
| **p95 / p99** | p99 < 3× p50 | ช่วงกว้าง = outlier (GC pause, disk I/O) |
| **Error %** | 0% ขณะ load ปกติ | 503 = ชน concurrency cap; 429 = rate limit ทำงาน |
| **Active Requests** (Prometheus) | ติดตาม thread count | สูงต่อเนื่อง = /busy หรือ /slow กองสะสม |

---

## เริ่มต้นเร็วด้วย Docker Compose

บันทึกเป็น `docker-compose.monitoring.yml` ที่ root ของ project แล้วรัน `docker compose -f docker-compose.monitoring.yml up -d`:

```yaml
version: "3.8"
services:

  influxdb:
    image: influxdb:1.8
    ports: ["8086:8086"]
    environment:
      INFLUXDB_DB: jmeter

  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    extra_hosts:
      - "host.docker.internal:host-gateway"

  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
    depends_on: [influxdb, prometheus]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
```

> **หมายเหตุ** — เมื่อรัน Prometheus ใน Docker บน macOS/Windows ให้อัปเดต `prometheus.yml` ให้ใช้ `host.docker.internal:3001` เป็น scrape target แทน `localhost:3001`

---

## แก้ปัญหาเบื้องต้น

| อาการ | สาเหตุที่น่าจะเป็น | วิธีแก้ |
|-------|-----------------|--------|
| Grafana dashboard แสดง "No data" | ยังไม่ได้สร้าง InfluxDB database | `influx -execute "CREATE DATABASE jmeter"` |
| Backend Listener มี error ใน JMeter log | `INFLUX_URL` ผิด | ตรวจสอบ URL ให้ตรงกับ InfluxDB version และ database name |
| Prometheus target แสดง DOWN | เซิร์ฟเวอร์ไม่รันหรือ port ผิด | ยืนยันว่า `npm start` รันอยู่และ `/metrics` ตอบ 200 |
| p99 แสดงเป็น NaN ใน Prometheus panel | request น้อยเกินไปสำหรับ histogram bucket | เพิ่ม `THREADS` หรือ `DURATION` |
| 503 ตั้งแต่ request แรก | concurrency cap ต่ำเกินไป | เพิ่ม `maxConcurrent` ที่หน้า Config หรือผ่าน `PATCH /api/config` |
