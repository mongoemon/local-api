# Testing Guide

Local API มี automated test suite ที่ครอบคลุมทุก endpoint พร้อมใช้งานทันที

## Test Stack

| Tool | บทบาท |
| --- | --- |
| [Vitest](https://vitest.dev) | test runner — รองรับ ESM โดยตรง |
| [Supertest](https://github.com/ladjs/supertest) | ยิง HTTP request ต่อ Express app โดยไม่ต้องเปิด server |

## Run Tests

```bash
npm test                # รันทุก test ครั้งเดียว (CI-friendly)
npm run test:watch      # watch mode — re-run อัตโนมัติเมื่อแก้ไขไฟล์
npm run test:coverage   # รันพร้อม coverage report
```

## Directory Structure

```
tests/
├── helpers/
│   └── testApp.js          # createTestApp() และ testConfig (delays=1ms, arrays=100)
├── unit/
│   └── config.test.js      # unit test สำหรับ getNumberEnv / getBooleanEnv
└── integration/
    ├── workload.test.js    # /fast /slow /busy /cpu /memory /io /cleanup
    ├── auth.test.js        # /prep /protected /auth/login /auth/verify
    ├── data.test.js        # /submit-one /submit-two
    ├── system.test.js      # /status /error /metrics
    └── demo.test.js        # /demo/* รวมถึง full shopping flow
```

## Test Types Covered

### Unit Tests (`tests/unit/`)

ทดสอบ pure functions แบบแยกส่วน ไม่ต้องใช้ HTTP:

- `getNumberEnv` — parse numeric env var, fallback, non-numeric string
- `getBooleanEnv` — parse boolean env var, case-insensitive, truthy values

### Integration Tests (`tests/integration/`)

ทดสอบ HTTP endpoints ผ่าน Supertest แต่ละ test file สร้าง app instance แยก ทำให้ in-memory state (cart, orders) isolated ระหว่าง test file

**workload.test.js** — 11 tests
- `/fast` ตอบ 200 พร้อม message
- `/slow` และ `/busy` ตอบ 200 (testConfig ตั้ง delay=1ms)
- `/cpu` คำนวณ sum ถูกต้อง
- `/memory` ตอบ size ถูกต้อง
- `/io` ทดสอบทั้ง write และ read mode
- `/cleanup` ล้างไฟล์หลัง write

**auth.test.js** — 13 tests
- `/prep` — prefix ปกติและ custom, fallback prefix
- `/protected` — 401 missing, 403 invalid, 200 Authorization header, 200 x-access-token
- `/auth/login` — 400 missing, 401 invalid credentials, 200 + JWT token
- `/auth/verify` — 401 missing, 403 malformed, 200 + decoded claims

**data.test.js** — 7 tests
- `/submit-one` — 400 missing name, 200 echo, extra fields ignored
- `/submit-two` — 400 scenarios, 200 echo

**system.test.js** — 5 tests
- `/error` — ตอบ 500 intentional
- `/status` — fields ครบ, startedAt เป็น ISO 8601
- `/metrics` — Prometheus text format, รวม custom metric

**demo.test.js** — 21 tests
- `/demo/context` — unique IDs ทุก call
- `/demo/dashboard` — featured products, categories
- `/demo/search` — no query returns all, filter by name, filter by category, no match
- `/demo/product/details` — 400 missing, 404 unknown, 200 + stockStatus/rating
- `/demo/cart/add` — 400 missing productId, 404 unknown product, 400 invalid quantity, 200 add, quantity increment
- `/demo/checkout` — 400 empty cart, 200 create order
- `/demo/order/status` — 400 missing orderId, 404 unknown, 200 confirmed
- **Full shopping flow** — context → search → add → checkout → order status

## testConfig

`tests/helpers/testApp.js` export `testConfig` ที่ปรับค่าให้ test เร็ว:

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

หลังจากการ restructure routes ถูกแยกเป็น module ย่อย:

```
routes/
├── workload.js   # createWorkloadRouter(config)
├── auth.js       # createAuthRouter(config)
├── data.js       # createDataRouter()
└── system.js     # createSystemRouter({ startedAt, getActiveRequests, register })
```

แต่ละ router เป็น pure factory function — ทำให้ import และ test แยกส่วนได้โดยไม่ต้องสร้าง app เต็ม

## State Isolation

`demo-routes.js` เก็บ `demoCarts` และ `demoOrders` ไว้ภายใน `createDemoRouter()` (ไม่ใช่ module scope) ทำให้:

- แต่ละ `createTestApp()` ได้ state ใหม่เสมอ
- test file ต่าง ๆ ที่รันพร้อมกันไม่ขัดกัน
- ไม่มี state หลุดจาก test หนึ่งไปอีก test หนึ่ง

## Writing New Tests

สร้าง test file ใหม่ใน `tests/integration/` หรือ `tests/unit/`:

```js
import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp } from "../helpers/testApp.js";

const app = createTestApp(); // สร้างครั้งเดียวต่อ file

describe("GET /my-endpoint", () => {
  it("returns 200", async () => {
    const res = await supertest(app).get("/my-endpoint");
    expect(res.status).toBe(200);
  });
});
```
