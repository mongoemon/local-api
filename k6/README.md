# k6 Performance Testing Guide

> Complete beginner-to-advanced guide for performance testing **local-api** with k6.

---

## Table of Contents

1. [What is k6?](#1-what-is-k6)
2. [Installation](#2-installation)
3. [Quick Start (30 seconds)](#3-quick-start)
4. [Core Concepts](#4-core-concepts)
5. [Test Types — When to Use Each](#5-test-types)
6. [Project Size Configuration](#6-project-size-configuration)
7. [Running Tests](#7-running-tests)
8. [Understanding CLI Output](#8-understanding-cli-output)
9. [Visualizing Results](#9-visualizing-results)
10. [Writing Your Own Tests](#10-writing-your-own-tests)
11. [Best Practices](#11-best-practices)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference Cheat Sheet](#13-quick-reference)

---

## 1. What is k6?

k6 is an open-source performance testing tool. You write a script that describes what one user does (make requests, check responses), and k6 runs that script with hundreds of simulated users at the same time.

**Why use it instead of just running `curl`?**

| Manual testing | k6 |
|---|---|
| 1 user at a time | 1–10,000 users simultaneously |
| No timing data | Detailed percentile latency stats |
| No pass/fail criteria | Configurable thresholds |
| Manual effort | Automated, repeatable |

**Think of it as:** 100 robots simultaneously clicking your app while you watch the response times on a dashboard.

---

## 2. Installation

### Windows
```powershell
# Option A — Chocolatey
choco install k6

# Option B — Winget
winget install k6 --source winget

# Option C — Download installer
# https://dl.k6.io/msi/k6-latest-amd64.msi
```

### macOS
```bash
brew install k6
```

### Linux (Debian/Ubuntu)
```bash
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69

echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
  https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list

sudo apt-get update && sudo apt-get install k6
```

### Docker (no install needed)
```bash
docker run --rm -i --network host grafana/k6 run - < k6/tests/01-baseline.js
```

### Verify
```bash
k6 version
# k6 v0.52.0 (...)
```

---

## 3. Quick Start

```bash
# 1. Start the API
npm start
# → listening on http://localhost:3001

# 2. Run the smoke test (verify everything works)
k6 run k6/tests/01-baseline.js

# 3. Run a load test
k6 run k6/tests/02-load.js

# 4. Run with Grafana dashboard (real-time visualization)
docker compose -f k6/monitoring/docker-compose.yml up -d
k6 run --out influxdb=http://localhost:8086/k6 k6/tests/02-load.js
# → open http://localhost:3000 in your browser
```

---

## 4. Core Concepts

### Virtual User (VU)
A VU is one simulated user. Each VU runs your test script independently and in parallel with other VUs.

```
10 VUs = 10 robot users all hitting the API at the same time

  VU 1 → GET /fast → wait → GET /fast → wait → ...
  VU 2 → GET /fast → wait → GET /fast → wait → ...
  ...
  VU10 → GET /fast → wait → GET /fast → wait → ...
          ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓
          API Server  ← can it handle all 10 at once?
```

### Iteration
One complete run-through of your `default function` by one VU. With 10 VUs, each running for 60 seconds, you might get 600 iterations total (10 × 60 iterations of 1-second requests).

### Stages (Ramp-up / Ramp-down)
Instead of hitting the server with 100 users immediately, stages let you gradually increase (and decrease) load. This is more realistic and shows exactly when performance starts to degrade.

```
VUs
100 │                   ████████████████
 75 │               ████                ████
 50 │           ████                        ████
 25 │       ████                                ████
  0 │───────                                        ────▶ time
         ramp-up           steady state         ramp-down
          (30s)              (2 min)              (30s)
```

### Thresholds
Pass/fail criteria for the test. If any threshold is violated, k6 exits with a non-zero status code (CI/CD pipeline fails).

```javascript
thresholds: {
  http_req_duration: ['p(95)<500'],  // 95% of requests must finish in < 500ms
  http_req_failed:   ['rate<0.01'],  // fewer than 1% of requests can fail
}
```

### Checks
Assertions inside the script. They don't fail the test — they just track pass/fail rates in the report.

```javascript
check(res, {
  'status is 200':    (r) => r.status === 200,
  'body has user id': (r) => JSON.parse(r.body).id !== undefined,
});
```

### Think Time
Real users pause between clicks. Use `sleep()` to simulate this. Without it, k6 sends requests as fast as the network allows, which is unrealistic and overly aggressive.

```javascript
sleep(1);                           // always wait 1 second
sleep(Math.random() * 1.5 + 0.5);  // wait 0.5–2.0 seconds (more realistic)
```

### Transaction / Group
A named block of related requests. Useful for measuring end-to-end timings for business flows like "checkout" or "login + load dashboard".

```javascript
group('checkout flow', () => {
  http.post('/cart/add', ...);
  http.post('/checkout', ...);
  http.get('/order/status', ...);
});
```

---

## 5. Test Types

> **Usage frequency key**
>
> | Symbol | Meaning |
> |--------|---------|
> | ★★★★★ | Run constantly — every deployment or every week |
> | ★★★★☆ | Run regularly — per release or on a fixed schedule |
> | ★★★☆☆ | Run situationally — before launches or after major changes |
> | ★★☆☆☆ | Run rarely — once per quarter or for a specific concern |
> | ★☆☆☆☆ | Run once — infrastructure planning, then almost never again |

---

### Baseline / Smoke Test → `01-baseline.js`
**Usage: ★★★★★ Most frequently run**

**Purpose:** Sanity check with minimal load. Verifies every critical endpoint is alive and responds correctly.

**Why it's run so often:**
It takes only 30 seconds and costs nothing. The rule is simple: if the smoke test fails, stop — there is no point running a 10-minute load test against a broken API. Most teams add this to their CI/CD pipeline so it runs automatically after every deploy. It is the first test you run and the last line of defence before heavier tests.

**When to run:**
- After every deployment, automatically in CI/CD
- Before running any other test in this list
- Any time you want a quick "is it alive?" check

**Load profile:**
```
VUs: 1─2    Duration: 30s    Expect: 0 errors
```

**What it catches:** Broken routes, misconfigured auth tokens, missing environment variables, obvious regressions.

---

### Load Test → `02-load.js`
**Usage: ★★★★☆ Frequently run**

**Purpose:** Verify the API handles **normal expected traffic** at acceptable response times.

**Why it's run often:**
This is the bread-and-butter test. Every team that cares about performance runs this. It answers the most important everyday question: "Does our API still perform well under the traffic we actually expect?" It is fast enough to run per release (5–10 minutes) and gives you a clear pass/fail answer via thresholds.

**When to run:**
- Before every major release
- After infrastructure changes (new server, DB upgrade, config change)
- Weekly as a regression check

**Load profile:**
```
VUs:  0──────5──────────────────────5──────0
      ramp-up    steady (normal load)    ramp-down
```

**What it catches:** Performance regressions, insufficient server capacity, slow endpoints that only appear under concurrent load.

---

### User Journey Test → `08-demo-flow.js`
**Usage: ★★★★☆ Frequently run (for product teams)**

**Purpose:** Simulate a **complete business workflow** end-to-end as a single transaction.

**Why it's run often:**
Individual endpoint latency does not tell the full story. A checkout flow might call 5 endpoints — each one at 200ms — but the total transaction takes over a second. This test measures what users actually experience. For any app with a critical business path (checkout, signup, search → buy), this test gets run alongside the load test.

**When to run:**
- Before any release that touches the critical user flow
- When measuring the total time for a business transaction
- When you need to find which specific step in a flow is the bottleneck

**Load profile:**
```
Same stages as the load test — but one iteration = one full user session
```

**What it catches:** Bottlenecks within multi-step flows, slow steps that only appear in sequence, transaction failure rates.

---

### Stress Test → `03-stress.js`
**Usage: ★★★☆☆ Situationally run**

**Purpose:** Push **beyond normal load** to find exactly where performance degrades.

**Why it's not run as often:**
The load test tells you whether today's traffic is fine. The stress test tells you where the ceiling is. Most teams run this before a major launch or after a significant optimization — not on every release. Running it too often also risks exhausting your team: a stress test that fails is not a bug to fix every sprint, it is capacity information to act on periodically.

**When to run:**
- Before a product launch (know your ceiling before users do)
- After performance optimizations (verify the improvement)
- Quarterly capacity review

**Load profile:**
```
VUs:  0──5──10──20──40──40──40──0
        gradually increasing    (recovery)
```

**What it catches:** The exact VU count where response times spike or error rates climb, which resource runs out first (CPU, memory, connections).

---

### Scenario Test → `07-scenarios.js`
**Usage: ★★★☆☆ Situationally run**

**Purpose:** Run **multiple user types simultaneously**, each with different request patterns.

**Why it's not run as often:**
It is more realistic than a single-pattern load test, but also harder to maintain. You need to keep 3–4 scenario functions up to date as your API changes. Most teams start with the load test and graduate to scenario tests once they have stable, well-understood traffic patterns to model. The added complexity pays off only when you genuinely have distinct user types whose interaction matters.

**When to run:**
- When you have confirmed distinct user types in production traffic
- When you want to verify that heavy users do not degrade light users
- For mature systems where realistic traffic modelling is worth the effort

---

### Spike Test → `04-spike.js`
**Usage: ★★☆☆☆ Rarely run**

**Purpose:** Test how the system handles a **sudden massive traffic burst**, then check if it recovers.

**Why it's rarely run:**
Most APIs do not face true spikes. A spike test is only worth running if your business model actually includes sudden traffic events — flash sales, press coverage, viral posts, or marketing emails sent to large lists. For a typical internal tool or B2B API, spikes are not a realistic threat and this test is skipped entirely. Teams at consumer companies (e-commerce, media, gaming) run it regularly; most others never do.

**When to run:**
- Before a planned high-traffic event (product launch, Black Friday, campaign)
- When testing auto-scaling policies
- If a previous incident was caused by a traffic spike

**Load profile:**
```
VUs:  2──────────── SPIKE ──────── recovery ───2
           2     →    50+      →       2
```

**What it catches:** Cascading failures, connection queue overflow, slow auto-scaling recovery.

---

### Soak / Endurance Test → `05-soak.js`
**Usage: ★★☆☆☆ Rarely run**

**Purpose:** Run at normal load for a **long time** (30 minutes to 8 hours) to detect slow-building problems.

**Why it's rarely run:**
It takes too long for regular use. A 2-hour soak test cannot fit into a CI pipeline, and most teams only remember to run it when something goes wrong in production (server slowing down overnight, memory climbing, logs filling up disk). The right cadence is quarterly, or specifically when you suspect a leak — not per release. When you do run it, use Grafana so you can watch the latency trend line over time.

**When to run:**
- Before going to production for the first time
- After fixing a suspected memory leak
- Quarterly stability audit
- After adding a long-running background job or caching layer

**Load profile:**
```
VUs:  5─────────────────────────────────────────5
           Normal load, for 30 minutes to 8 hours
```

**What it catches:** Memory leaks (rising latency over time), DB connection pool exhaustion, file descriptor leaks, disk filling with logs.

---

### Breakpoint Test → `06-breakpoint.js`
**Usage: ★☆☆☆☆ Almost never run**

**Purpose:** Ramp load **continuously until the system completely fails**, with no ceiling.

**Why it's almost never run:**
This test intentionally destroys your server. You run it once when planning infrastructure — "what is our absolute maximum before we need to scale?" — and then almost never again. It cannot be run in a shared or production environment. Most teams run it once on a clean staging environment, record the number, and use it to set their auto-scaling rules. After that it collects dust unless there is a major architecture change.

**When to run:**
- Initial infrastructure capacity planning (usually done once)
- After a major architecture change (new database, different server tier)
- To set auto-scaling trigger thresholds

**Load profile:**
```
VUs:  0─────────────────────────────────── [CRASH]
         continuously ramping, no ceiling
```

**What it catches:** The hard maximum capacity of the system, which resource fails first, whether failure is graceful (503) or catastrophic (crash/hang).

---

### Summary table

| Test | File | Frequency | Typical cadence | Duration |
|------|------|-----------|-----------------|----------|
| Baseline | `01-baseline.js` | ★★★★★ | Every deploy | ~30s |
| Load | `02-load.js` | ★★★★☆ | Every release | 5–10 min |
| User Journey | `08-demo-flow.js` | ★★★★☆ | Every release | 5–10 min |
| Stress | `03-stress.js` | ★★★☆☆ | Before launch / quarterly | 10–20 min |
| Scenario | `07-scenarios.js` | ★★★☆☆ | Before launch / quarterly | 10–20 min |
| Spike | `04-spike.js` | ★★☆☆☆ | Before planned traffic events | 5–15 min |
| Soak | `05-soak.js` | ★★☆☆☆ | Quarterly / when leaks suspected | 30 min–8 h |
| Breakpoint | `06-breakpoint.js` | ★☆☆☆☆ | Once, during capacity planning | 10–30 min |

**Practical starting point for a new project:**
1. Add `01-baseline.js` to CI/CD → runs on every deploy
2. Run `02-load.js` manually before each release
3. Run `03-stress.js` once before your first production launch
4. Add `08-demo-flow.js` if you have a critical multi-step user flow
5. Revisit the others when a specific need arises

---

## 6. Project Size Configuration

Project size adjusts VU counts, durations, and thresholds to match your expected traffic level.

### How to declare project size

```bash
# Inline (recommended for one-off runs)
k6 run --env PROJECT_SIZE=medium k6/tests/02-load.js

# Windows PowerShell — set for the session
$env:PROJECT_SIZE = "medium"
k6 run k6/tests/02-load.js

# Linux/macOS — set for the session
export PROJECT_SIZE=medium
k6 run k6/tests/02-load.js
```

### Size reference table

| Size | When to use | Load VUs | Stress peak | p95 target | Error tolerance |
|------|-------------|----------|-------------|------------|-----------------|
| `small` | Hobby project, < 100 concurrent users | 5 | 40 | < 1,000ms | < 5% |
| `medium` | Startup / team product, 100–1,000 users | 25 | 150 | < 500ms | < 2% |
| `large` | Enterprise / public service, 1,000+ users | 100 | 600 | < 200ms | < 1% |

### How to choose

Ask yourself: **"How many users do I expect to use this at the same time during a normal day?"**

- **1–50 simultaneous users** → `small`
- **50–500 simultaneous users** → `medium`
- **500+ simultaneous users** → `large`

If unsure, start with `small`. You can always increase after seeing initial results.

---

## 7. Running Tests

### Run a single test
```bash
k6 run k6/tests/01-baseline.js
```

### Run with project size
```bash
k6 run --env PROJECT_SIZE=medium k6/tests/02-load.js
```

### Override VUs/duration from CLI (ignores script options)
```bash
k6 run --vus 10 --duration 30s k6/tests/01-baseline.js
```

### Save results to JSON for later analysis
```bash
# Windows PowerShell
k6 run --out "json=results/run-$(Get-Date -Format 'yyyyMMdd-HHmmss').json" k6/tests/02-load.js

# Linux/macOS
k6 run --out "json=results/run-$(date +%Y%m%d-%H%M%S).json" k6/tests/02-load.js
```

### Run with real-time web dashboard (k6 v0.49+)
```bash
k6 run --web-dashboard k6/tests/02-load.js
# Open http://localhost:5665 while the test is running
```

### Send results to Grafana (InfluxDB)
```bash
k6 run --out influxdb=http://localhost:8086/k6 k6/tests/02-load.js
```

### Run all tests in sequence
```bash
# Windows PowerShell
foreach ($test in (Get-ChildItem k6/tests/*.js | Sort-Object Name)) {
  Write-Host "Running $($test.Name)"
  k6 run $test.FullName
}
```

---

## 8. Understanding CLI Output

After a test, k6 prints a summary like this:

```
     ✓ status is 200
     ✓ body has data

     checks.........................: 100.00% ✓ 1248 ✗ 0
     data_received..................: 2.1 MB  35 kB/s
     data_sent......................: 132 kB  2.2 kB/s
     http_req_blocked...............: avg=1.2ms   min=0s      med=1µs    max=25ms   p(90)=2µs   p(95)=4µs
     http_req_connecting............: avg=0.7ms   min=0s      med=0s     max=22ms   p(90)=0s    p(95)=0s
   ✓ http_req_duration..............: avg=43ms    min=10ms    med=38ms   max=412ms  p(90)=75ms  p(95)=88ms
       { expected_response:true }...: avg=43ms    min=10ms    med=38ms   max=412ms  p(90)=75ms  p(95)=88ms
   ✓ http_req_failed................: 0.00%   ✓ 0    ✗ 1248
     http_req_receiving.............: avg=0.4ms   ...
     http_req_sending...............: avg=0.1ms   ...
     http_req_waiting...............: avg=42ms    ...
     http_reqs......................: 1248    20.8/s
     iteration_duration.............: avg=1.05s   ...
     iterations.....................: 1248    20.8/s
     vus............................: 5       min=1   max=5
     vus_max........................: 5       min=5   max=5
```

### Reading the key lines

| Line | What it means | Good/Bad |
|------|---------------|----------|
| `http_req_duration p(95)` | 95% of requests finished in this time. The most important metric. | Lower = better |
| `http_req_duration p(99)` | 99% finished in this time. Indicates worst-case experience. | Lower = better |
| `http_req_duration avg` | Average response time. Less useful than p(95) — outliers skew it. | Informational |
| `http_req_failed rate` | % of requests that got an error (4xx/5xx or network error). | Should be near 0% |
| `http_reqs rate` | Requests per second (throughput). | Higher = better |
| `checks` | % of your `check()` assertions that passed. | Should be 100% |
| `vus` | Virtual users active at test end. | As configured |

### Status indicators

- `✓` (green) — threshold passed
- `✗` (red) — threshold failed → test exits non-zero (CI fails)

### Percentile explained

`p(95) = 200ms` means: if you took all the response times and sorted them, 95% are at or below 200ms. The slowest 5% were above 200ms.

```
Sorted response times: 10 20 30 40 50 60 70 80 90 [200] ← p(90) here
                                                         [350] ← p(95) here
                                                              [900] ← p(99) here
```

Use p(95) or p(99) for thresholds, not avg — a slow 1% of users still matters.

---

## 9. Visualizing Results

### Option A: Built-in Web Dashboard (simplest, no setup)

```bash
k6 run --web-dashboard k6/tests/02-load.js
```

Open `http://localhost:5665` in your browser while the test runs. Shows real-time charts for response time, VUs, and throughput.

> Requires k6 v0.49.0 or later.

---

### Option B: Grafana + InfluxDB (recommended for teams)

This gives you beautiful persistent dashboards you can compare across test runs.

**Step 1 — Start the monitoring stack:**
```bash
docker compose -f k6/monitoring/docker-compose.yml up -d
```

This starts:
- **InfluxDB** on port 8086 — stores k6 metrics
- **Prometheus** on port 9090 — scrapes the API's `/metrics` endpoint
- **Grafana** on port 3000 — visualizes both

**Step 2 — Run k6 with InfluxDB output:**
```bash
k6 run --out influxdb=http://localhost:8086/k6 k6/tests/02-load.js
```

**Step 3 — Open Grafana:**
- Go to `http://localhost:3000`
- Login: `admin` / `admin`
- Go to **Dashboards → k6 Load Testing Results**
- Watch your test in real-time

**Step 4 — Import the official k6 dashboard (first time only):**
1. In Grafana, click `+` → Import
2. Enter dashboard ID: **2587**
3. Select the **InfluxDB** datasource
4. Click Import

**Step 5 — Stop when done:**
```bash
docker compose -f k6/monitoring/docker-compose.yml down
```

---

### Option C: Prometheus only (for app metrics, no InfluxDB needed)

The API exposes Prometheus metrics at `/metrics`. View them directly:

```bash
# Start just Prometheus + Grafana
docker compose -f k6/monitoring/docker-compose.yml up prometheus grafana -d

# Open Grafana at http://localhost:3000
# Go to Explore → select Prometheus datasource → query metrics like:
#   http_requests_total
#   process_heap_bytes
```

---

### Option D: JSON output + manual analysis

```bash
k6 run --out json=results.json k6/tests/02-load.js

# The JSON file contains one line per data point — parse with jq, Excel, Python, etc.
```

---

### What to look at in Grafana

| Panel | What to watch for |
|-------|-------------------|
| **Response time (p95)** | Does it stay flat? Or does it creep up? |
| **Error rate** | Any spikes above 0%? |
| **Requests/second** | Does throughput stay consistent? |
| **Active VUs** | Confirms your ramp-up/down worked as expected |
| **Iteration duration** | Total time per script run, including think time |

---

## 10. Writing Your Own Tests

### Minimal template
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:3001/fast');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### Template with JWT authentication
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

// setup() runs ONCE before the test; its return value is passed to all VUs
export function setup() {
  const res = http.post(
    'http://localhost:3001/auth/login',
    JSON.stringify({ username: 'demo', password: 'password' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  return { token: JSON.parse(res.body).token };
}

export default function (data) {
  // data.token available to every VU
  const res = http.get('http://localhost:3001/protected', {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  check(res, { 'protected route 200': (r) => r.status === 200 });
  sleep(1);
}
```

### Template with stages
```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up
    { duration: '1m',  target: 10 },  // hold
    { duration: '30s', target: 0  },  // ramp down
  ],
};
```

### Template with grouped transactions
```javascript
import { group } from 'k6';

export default function () {
  group('search flow', () => {
    http.get('http://localhost:3001/demo/search?q=laptop');
    sleep(0.5);
    http.get('http://localhost:3001/demo/product/details?productId=1');
  });
  sleep(1);
}
```

### Template with custom metrics
```javascript
import { Trend } from 'k6/metrics';

const checkoutDuration = new Trend('checkout_duration', true);

export default function () {
  const start = Date.now();
  http.post('/checkout', ...);
  checkoutDuration.add(Date.now() - start);
}
```

---

## 11. Best Practices

**Always run baseline first.** If smoke test fails, stop and fix it before running heavier tests.

**Add think time.** Use `sleep()` between requests. Without it you're testing network saturation, not realistic usage.

**Don't test against production.** Use a dedicated staging environment or your local server.

**Warm up the server.** The ramp-up stage gives the server time to fill caches, compile JIT code, and open connection pools before measurements matter.

**Watch the server, not just k6.** k6 measures response time as seen by the client. Also watch `/status` and `/metrics` on the API during tests.

**Set realistic thresholds.** If an endpoint genuinely does 300ms of database work, a p(95)<100ms threshold will always fail.

**Use groups for transactions.** Wrap related requests in `group()` to track transaction performance separately from individual endpoint latency.

**Run soak tests when stability matters.** A passing load test doesn't guarantee stability over 8 hours.

**Check your results directory.** Create a `k6/results/` folder and save JSON output for historical comparisons.

---

## 12. Troubleshooting

### "ERRO[0000] GoError: too many open files"
```bash
# Linux/macOS — raise file descriptor limit
ulimit -n 65536
```

### Connection refused
```bash
# Make sure the API is running
npm start

# Check the base URL
k6 run --env BASE_URL=http://localhost:3001 k6/tests/01-baseline.js
```

### Thresholds fail immediately with p(95) > threshold
Your API is responding slowly. Run the baseline first to see actual p(95) values, then set thresholds accordingly.

### High error rate during stress test
This is *expected* in stress tests — you are intentionally pushing the system past its limits. What matters is:
1. Does it recover after load drops?
2. At what VU count did errors start?

### Tests run slowly on Windows
Use Docker for better network performance:
```bash
docker run --rm -i --network host grafana/k6 run - < k6/tests/02-load.js
```

### "Cannot find module '../config/sizes.js'"
Run k6 from the repo root, not the `k6/` subdirectory:
```bash
# From d:\work\local-api
k6 run k6/tests/02-load.js    # correct
```

### Grafana shows no data
Make sure you passed `--out influxdb=http://localhost:8086/k6` to k6 and the monitoring stack is running.

---

## 13. Quick Reference

```bash
# ── RUNNING TESTS ──────────────────────────────────────────────────
k6 run k6/tests/01-baseline.js              # smoke test
k6 run k6/tests/02-load.js                  # normal load
k6 run k6/tests/03-stress.js                # stress (find limits)
k6 run k6/tests/04-spike.js                 # spike (sudden burst)
k6 run k6/tests/05-soak.js                  # soak (long-running)
k6 run k6/tests/06-breakpoint.js            # ramp to failure
k6 run k6/tests/07-scenarios.js             # mixed user types
k6 run k6/tests/08-demo-flow.js             # full user journey

# ── PROJECT SIZE ────────────────────────────────────────────────────
k6 run --env PROJECT_SIZE=small   k6/tests/02-load.js
k6 run --env PROJECT_SIZE=medium  k6/tests/02-load.js
k6 run --env PROJECT_SIZE=large   k6/tests/02-load.js

# ── OUTPUT OPTIONS ──────────────────────────────────────────────────
k6 run --web-dashboard              k6/tests/02-load.js  # browser dashboard
k6 run --out json=results.json      k6/tests/02-load.js  # JSON file
k6 run --out csv=results.csv        k6/tests/02-load.js  # CSV file
k6 run --out influxdb=http://localhost:8086/k6 k6/tests/02-load.js  # Grafana

# ── OVERRIDES ───────────────────────────────────────────────────────
k6 run --vus 5 --duration 30s       k6/tests/01-baseline.js
k6 run --env BASE_URL=http://localhost:3001 k6/tests/02-load.js

# ── MONITORING ──────────────────────────────────────────────────────
docker compose -f k6/monitoring/docker-compose.yml up -d    # start stack
docker compose -f k6/monitoring/docker-compose.yml down     # stop stack
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
# InfluxDB: http://localhost:8086

# ── IMPORTANT ENDPOINTS ─────────────────────────────────────────────
# POST /auth/login          → { username: "demo", password: "password" }
# GET  /prep                → returns Bearer token for protected routes
# GET  /protected           → requires Authorization: Bearer lab-token
# GET  /fast                → instant response
# GET  /slow                → 200ms delay (configurable)
# GET  /busy                → 3000ms, simulates heavy load
# GET  /cpu                 → CPU-intensive (10M iterations)
# GET  /memory              → allocates 1MB array
# GET  /io?mode=read        → file I/O test
# GET  /status              → server health info
# GET  /metrics             → Prometheus metrics
# GET  /demo/context        → start e-commerce flow
```
