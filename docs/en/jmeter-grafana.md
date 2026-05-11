# JMeter → InfluxDB → Grafana: Connection Guide

This guide wires JMeter's real-time metrics into Grafana so you can watch throughput, latency, and error rate on a live dashboard while the test runs.

## Architecture

```
┌─────────────┐   Backend Listener   ┌───────────┐   data source   ┌─────────┐
│   JMeter    │ ──────────────────► │  InfluxDB  │ ──────────────► │ Grafana │
└─────────────┘   (every 5 s)       └───────────┘                  └─────────┘

┌─────────────┐   GET /metrics       ┌────────────┐  data source   ┌─────────┐
│  local-api  │ ◄─────────────────  │ Prometheus  │ ─────────────► │ Grafana │
└─────────────┘   (scrape interval)  └────────────┘                 └─────────┘
```

- **JMeter stream** — the Backend Listener already configured in `jmeter/local-api-test-plan.jmx` pushes sampler results to InfluxDB every 5 seconds. Grafana reads those and renders the JMeter dashboard.
- **App stream** — the server exposes `GET /metrics` in Prometheus format. Prometheus scrapes it and Grafana shows server-side counters (active requests, request duration histograms) alongside the JMeter data.

---

## Part 1 — InfluxDB

### Option A — InfluxDB v1 (simpler)

**Install**

```bash
# macOS
brew install influxdb@1

# Ubuntu / Debian
wget -q https://dl.influxdata.com/influxdb/releases/influxdb_1.11.8_amd64.deb
sudo dpkg -i influxdb_1.11.8_amd64.deb

# Docker
docker run -d --name influxdb -p 8086:8086 influxdb:1.8
```

**Create the database**

```bash
influx -execute "CREATE DATABASE jmeter"
# verify
influx -execute "SHOW DATABASES"
```

**Leave INFLUX_URL at its default** in the JMX:

```
http://localhost:8086/write?db=jmeter
```

### Option B — InfluxDB v2

**Install**

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

**Get an API token**

```bash
# open the UI at http://localhost:8086
# Go to Data → API Tokens → Generate All Access Token
# Copy the token
```

**Update INFLUX_URL in the JMX** (User Defined Variables panel):

```
http://localhost:8086/api/v2/write?org=myorg&bucket=jmeter&token=<YOUR_TOKEN>
```

---

## Part 2 — Grafana

### Install

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

Open **http://localhost:3000** — default login is `admin` / `admin`.

### Add InfluxDB as a data source

1. Go to **Connections → Data sources → Add data source**
2. Choose **InfluxDB**
3. Fill in:

| Field | InfluxDB v1 | InfluxDB v2 |
|-------|------------|------------|
| URL | `http://localhost:8086` | `http://localhost:8086` |
| Query language | InfluxQL | Flux |
| Database | `jmeter` | — |
| Organisation | — | `myorg` |
| Token | — | `<YOUR_TOKEN>` |
| Default bucket | — | `jmeter` |

4. Click **Save & test** — should show "datasource is working".

### Import the JMeter dashboard

1. Go to **Dashboards → Import**
2. Enter ID **`5496`** and click **Load**
3. Select your InfluxDB data source
4. Click **Import**

You will see panels for: Throughput (req/s), Active Threads, Response Time (avg/p90/p99), Error Rate, and Virtual Users over time.

---

## Part 3 — Prometheus (app-side metrics)

The server exposes `GET /metrics` at `http://localhost:3001/metrics`. This gives you Node.js process metrics plus per-route `http_request_duration_seconds` histograms.

### Install Prometheus

```bash
# macOS
brew install prometheus

# Docker
docker run -d --name prometheus -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### Create `prometheus.yml`

```yaml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: local-api
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
```

### Start Prometheus

```bash
prometheus --config.file=prometheus.yml
```

Verify at **http://localhost:9090/targets** — `local-api` should show `UP`.

### Add Prometheus as a data source in Grafana

1. **Connections → Data sources → Add data source → Prometheus**
2. URL: `http://localhost:9090`
3. **Save & test**

### Useful PromQL queries for a custom panel

| What to measure | Query |
|----------------|-------|
| Request rate per route | `rate(http_request_duration_seconds_count[1m])` |
| p95 latency per route | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1m]))` |
| Active requests right now | `http_active_requests` |
| Error rate (non-2xx) | `rate(http_request_duration_seconds_count{status=~"4..|5.."}[1m])` |

---

## Part 4 — Run the test

### Start the server

```bash
npm start
# server listens on http://localhost:3001
```

### Option A — GUI mode (watch live while clicking play)

```bash
jmeter -t jmeter/local-api-test-plan.jmx
```

Open the test plan, hit the green **Start** button. Open Grafana dashboard #5496 in your browser — panels update in real time.

### Option B — CLI mode (CI / scripted)

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

| Flag | What it overrides |
|------|------------------|
| `-JTHREADS` | Users per thread group |
| `-JRAMP_UP` | Seconds to reach full thread count |
| `-JDURATION` | How long to sustain load (seconds) |
| `-JINFLUX_URL` | InfluxDB write endpoint |
| `-JTEST_TITLE` | Label shown in Grafana event annotations |

HTML report is generated in `jmeter/results/html-report/index.html`.

---

## Part 5 — What to look for in Grafana

| Panel | Healthy signal | Warning signal |
|-------|---------------|----------------|
| **Active Threads** | Ramps up smoothly | Sudden drop = threads erroring and dying |
| **Throughput (req/s)** | Stable or rising with thread count | Flat while threads rise = server saturated |
| **Response Time avg** | Below 500 ms for /fast | Climbing = CPU or concurrency bottleneck |
| **p95 / p99** | p99 < 3× p50 | Wide spread = outliers (GC pause, disk I/O) |
| **Error %** | 0 % under normal load | 503s = concurrency cap hit; 429s = rate limit hit |
| **Active Requests** (Prometheus) | Tracks thread count | Sustained high = /busy or /slow piling up |

---

## Quick-start with Docker Compose

Save as `docker-compose.monitoring.yml` in the project root and run `docker compose -f docker-compose.monitoring.yml up -d`:

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

> **Note** — update `prometheus.yml` to use `host.docker.internal:3001` as the scrape target when running Prometheus inside Docker on macOS/Windows.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Grafana dashboard shows "No data" | InfluxDB database not created | `influx -execute "CREATE DATABASE jmeter"` |
| Backend Listener errors in JMeter log | Wrong `INFLUX_URL` | Check the URL matches your InfluxDB version and database name |
| Prometheus target shows DOWN | Server not running or wrong port | Confirm `npm start` is running and `/metrics` returns 200 |
| p99 shown as NaN in Prometheus panel | Too few requests for histogram buckets | Increase `THREADS` or `DURATION` |
| 503s from the first request | Concurrency cap too low | Raise `maxConcurrent` on the Config page or via `PATCH /api/config` |
