# Testing Guide

Local API includes an automated test suite that covers every endpoint and is ready to use out of the box.

## Test Stack

| Tool | Role |
| --- | --- |
| [Vitest](https://vitest.dev) | test runner — supports ESM natively |
| [Supertest](https://github.com/ladjs/supertest) | fires HTTP requests against the Express app without starting a server |

## Run Tests

```bash
npm test                # run all tests once (CI-friendly)
npm run test:watch      # watch mode — re-runs automatically on file changes
npm run test:coverage   # run with coverage report
```

## Directory Structure

```
tests/
├── helpers/
│   └── testApp.js          # createTestApp() and testConfig (delays=1ms, arrays=100)
├── unit/
│   └── config.test.js      # unit tests for getNumberEnv / getBooleanEnv
└── integration/
    ├── workload.test.js    # /fast /slow /busy /cpu /memory /io /cleanup
    ├── auth.test.js        # /prep /protected /auth/login /auth/verify
    ├── data.test.js        # /submit-one /submit-two
    ├── system.test.js      # /status /error /metrics
    └── demo.test.js        # /demo/* including full shopping flow
```

## Test Types Covered

### Unit Tests (`tests/unit/`)

Tests pure functions in isolation without HTTP:

- `getNumberEnv` — parse numeric env var, fallback, non-numeric string
- `getBooleanEnv` — parse boolean env var, case-insensitive, truthy values

### Integration Tests (`tests/integration/`)

Tests HTTP endpoints via Supertest. Each test file creates a separate app instance, keeping in-memory state (cart, orders) isolated between test files.

**workload.test.js** — 11 tests
- `/fast` returns 200 with message
- `/slow` and `/busy` return 200 (testConfig sets delay=1ms)
- `/cpu` computes sum correctly
- `/memory` returns correct size
- `/io` tests both write and read modes
- `/cleanup` removes files after write

**auth.test.js** — 13 tests
- `/prep` — standard prefix, custom prefix, fallback prefix
- `/protected` — 401 missing, 403 invalid, 200 Authorization header, 200 x-access-token
- `/auth/login` — 400 missing, 401 invalid credentials, 200 + JWT token
- `/auth/verify` — 401 missing, 403 malformed, 200 + decoded claims

**data.test.js** — 7 tests
- `/submit-one` — 400 missing name, 200 echo, extra fields ignored
- `/submit-two` — 400 scenarios, 200 echo

**system.test.js** — 5 tests
- `/error` — returns 500 intentional
- `/status` — all fields present, startedAt is ISO 8601
- `/metrics` — Prometheus text format, includes custom metric

**demo.test.js** — 21 tests
- `/demo/context` — unique IDs on every call
- `/demo/dashboard` — featured products, categories
- `/demo/search` — no query returns all, filter by name, filter by category, no match
- `/demo/product/details` — 400 missing, 404 unknown, 200 + stockStatus/rating
- `/demo/cart/add` — 400 missing productId, 404 unknown product, 400 invalid quantity, 200 add, quantity increment
- `/demo/checkout` — 400 empty cart, 200 create order
- `/demo/order/status` — 400 missing orderId, 404 unknown, 200 confirmed
- **Full shopping flow** — context → search → add → checkout → order status

## testConfig

`tests/helpers/testApp.js` exports `testConfig` with values tuned for fast test execution:

| Field | Production Default | testConfig |
| --- | --- | --- |
| `auth.bearerToken` | `lab-token` | `test-token` |
| `auth.jwtSecret` | `local-api-jwt-secret` | `test-secret` |
| `workloads.slowDelayMs` | `200` | `1` |
| `workloads.busyDelayMs` | `3000` | `1` |
| `workloads.cpuIterations` | `1e7` | `100` |
| `workloads.memoryArraySize` | `1e6` | `100` |
| `workloads.ioFileSizeKb` | `1024` | `1` |

## Source Structure (Routes)

After the restructure, routes are split into sub-modules:

```
routes/
├── workload.js   # createWorkloadRouter(config)
├── auth.js       # createAuthRouter(config)
├── data.js       # createDataRouter()
└── system.js     # createSystemRouter({ startedAt, getActiveRequests, register })
```

Each router is a pure factory function — allowing it to be imported and tested in isolation without creating a full app.

## State Isolation

`demo-routes.js` stores `demoCarts` and `demoOrders` inside `createDemoRouter()` (not at module scope), which means:

- Each `createTestApp()` always gets fresh state
- Test files running in parallel do not interfere with each other
- No state leaks from one test to another

## Writing New Tests

Create a new test file in `tests/integration/` or `tests/unit/`:

```js
import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp } from "../helpers/testApp.js";

const app = createTestApp(); // create once per file

describe("GET /my-endpoint", () => {
  it("returns 200", async () => {
    const res = await supertest(app).get("/my-endpoint");
    expect(res.status).toBe(200);
  });
});
```
