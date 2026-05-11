# Config API — อธิบาย Test Coverage

`tests/integration/config.test.js` ครอบคลุม endpoint สำหรับปรับ config ขณะรันทั้ง 3 ตัว:
`GET /api/config`, `PATCH /api/config`, และ `POST /api/config/reset`

## โครงสร้างของ test file

แต่ละ describe block สร้าง **app instance ใหม่** ผ่าน `makeConfig()` + `createApp()` เพื่อป้องกัน state จากบล็อกหนึ่งรั่วไปยังอีกบล็อกหนึ่ง:

```js
function makeConfig() {
  return {
    rateLimit:   { enabled: false, windowMs: 60000, max: 10000, ... },
    concurrency: { maxConcurrent: 50, ... },
    workloads:   { slowDelayMs: 1, cpuIterations: 100, memoryArraySize: 100, ... }
  };
}

// บล็อกที่แก้ config ใช้ beforeEach เพื่อให้แต่ละ test เริ่มต้นใหม่เสมอ
beforeEach(() => { app = createApp(makeConfig()); });
```

ค่า workload ถูกตั้งให้เล็กมาก (delay = 1 ms, array = 100 items) เพื่อให้ test รันเร็วโดยไม่เปลือง CPU หรือ I/O จริง

---

## Describe blocks และสิ่งที่แต่ละ test ตรวจสอบ

### `GET /api/config` (4 tests)

กลุ่มนี้ใช้ app ร่วมกันโดยไม่มีการแก้ไข มุ่งตรวจสอบโครงสร้างและค่าของ endpoint อ่านข้อมูล

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **returns 200 with the three main config sections** | Response มี HTTP 200 และมี key `rateLimit`, `concurrency`, `workloads` ครบ — สามหมวดที่ API เปิดเผย |
| **includes a defaults object** | Response มี key `defaults` ที่ภายในมีทั้งสามหมวด — ให้ UI แสดงค่า default คู่กับค่าปัจจุบันได้ |
| **reflects the values the app was started with** | ค่าปัจจุบันตรงกับที่ส่งให้ `createApp()` ทุกประการ — ยืนยันว่า GET อ่านจาก config object ที่มีชีวิต ไม่ใช่สำเนาที่เขียนตายตัว |
| **defaults object contains the canonical default values** | `defaults.workloads.slowDelayMs` เป็น 200 (ไม่ใช่ 1 จาก `makeConfig()`), `cpuIterations` เป็น 1e7 — ยืนยันว่า DEFAULTS ใน `config-api.js` คือค่า production จริง ไม่ขึ้นกับค่าที่เปิดแอปมา |

---

### `PATCH /api/config — rateLimit` (8 tests)

แต่ละ test ได้ app ใหม่จาก `beforeEach` ครอบคลุมทั้ง happy path และการปฏิเสธค่าที่ไม่ถูกต้อง

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **returns 200 with ok: true and updated config** | PATCH ที่ถูกต้องคืน 200, `ok: true`, และ key `config` ที่มีค่าใหม่ |
| **updates rateLimit.enabled to true** | ส่ง `{ rateLimit: { enabled: true } }` แล้ว boolean เปลี่ยนและ response สะท้อนค่านั้น |
| **updates rateLimit.windowMs** | ส่ง `{ rateLimit: { windowMs: 30000 } }` แล้วช่วงเวลาอัปเดต ยืนยันใน response body ของ PATCH |
| **updates rateLimit.max** | ส่ง `{ rateLimit: { max: 50 } }` แล้วจำนวน request สูงสุดอัปเดต |
| **subsequent GET /api/config reflects the updated rateLimit values** | หลัง PATCH แล้ว GET แยกต่างหากยังคืนค่าใหม่ — ยืนยันว่าการแก้ไขคงอยู่ตลอดชีวิตแอป ไม่ใช่แค่ echo ใน response |
| **ignores rateLimit.enabled when it is not a boolean** | ส่ง `"yes"` (string) แล้ว `enabled` ยังคงเป็น `false` — API รับเฉพาะ `typeof === "boolean"` เท่านั้น |
| **ignores rateLimit.windowMs when it is zero or negative** | ส่ง `0` แล้ว `windowMs` ยังคงเป็น 60000 — window เป็น 0 หรือลบจะทำให้ limiter พัง |
| **ignores rateLimit.max when it is zero or negative** | ส่ง `-1` แล้ว `max` ยังคงเป็น 10000 — cap เป็น 0 หรือลบจะบล็อก request ทุกอัน |

---

### `PATCH /api/config — concurrency` (4 tests)

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **updates maxConcurrent** | ส่ง `{ concurrency: { maxConcurrent: 5 } }` คืน 200 พร้อมค่าใหม่ |
| **subsequent GET reflects updated maxConcurrent** | GET ถัดไปยืนยันว่าการเปลี่ยนแปลงคงอยู่ |
| **ignores maxConcurrent when it is not a number** | ส่ง `"ten"` (string) แล้ว `maxConcurrent` ยังคงเป็น 50 |
| **ignores maxConcurrent when it is zero or negative** | ส่ง `0` แล้ว `maxConcurrent` ยังคงเป็น 50 — ค่า 0 จะทำให้ทุก request ตอบ 503 ทันที |

---

### `PATCH /api/config — workloads` (8 tests)

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **updates slowDelayMs** | `slowDelayMs: 500` ถูกรับและส่งคืน |
| **updates busyDelayMs** | `busyDelayMs: 2000` ถูกรับและส่งคืน |
| **updates cpuIterations** | `cpuIterations: 500` ถูกรับและส่งคืน |
| **updates memoryArraySize** | `memoryArraySize: 200` ถูกรับและส่งคืน |
| **updates ioFileSizeKb** | `ioFileSizeKb: 2` ถูกรับและส่งคืน |
| **allows slowDelayMs to be set to zero** | ส่ง `0` ถูกรับ — ต่างจาก `windowMs`/`max` ตรงที่ delay เป็น 0 ถือว่าสมเหตุสมผล (ไม่หน่วงเทียม) |
| **ignores workload fields that are not numbers** | ส่ง `"many"` สำหรับ `cpuIterations` แล้วค่ายังคงเป็น 100 — ทุก field ใน workloads ต้องการ `typeof === "number"` |
| **a partial update leaves unrelated sections unchanged** | PATCH เฉพาะ `concurrency` แล้ว `rateLimit.max` และ `workloads.slowDelayMs` ไม่เปลี่ยน — ยืนยันว่า PATCH คือการ merge ไม่ใช่การแทนที่ทั้งหมด |

---

### `PATCH side-effects — workload endpoint behavior` (3 tests)

กลุ่มนี้ยืนยันว่า PATCH เปลี่ยนพฤติกรรมจริงของ workload endpoint ไม่ใช่แค่เก็บค่าไว้

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **changed slowDelayMs is reflected in the /slow response message** | หลัง `PATCH { workloads: { slowDelayMs: 10 } }` แล้ว `GET /slow` คืน body ที่มี `message` บรรจุ `"10ms"` — ยืนยันว่า workload router อ่านจาก config object ที่มีชีวิตทุก request |
| **changed cpuIterations is reflected in the /cpu response** | หลัง `PATCH { workloads: { cpuIterations: 10 } }` แล้ว `GET /cpu` คืน `iterations: 10` และ `result: 45` (ผลรวม 0 ถึง 9) — ตรวจทั้งจำนวนและค่าที่คำนวณได้ |
| **changed memoryArraySize is reflected in the /memory response** | หลัง `PATCH { workloads: { memoryArraySize: 50 } }` แล้ว `GET /memory` คืน `size: 50` |

---

### `POST /api/config/reset` (7 tests)

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **returns 200 with ok: true and a config object** | endpoint reset มี response envelope เดียวกับ PATCH |
| **resets rateLimit to canonical defaults** | หลังเปิด rate limiting และรัดช่วงเวลา reset คืน `enabled: false`, `windowMs: 60000`, `max: 10000` — ค่า default production |
| **resets concurrency to canonical defaults** | หลังตั้ง `maxConcurrent: 2` แล้ว reset คืน `maxConcurrent: 50` |
| **resets workload values to canonical defaults** | หลังเปลี่ยน field workload ทั้งห้า reset คืน `slowDelayMs: 200`, `busyDelayMs: 3000`, `cpuIterations: 1e7`, `memoryArraySize: 1e6`, `ioFileSizeKb: 1024` |
| **GET /api/config reflects defaults after reset** | GET ถัดไปหลัง reset แสดงค่า canonical ไม่ใช่ค่าที่ PATCH ก่อนหน้าตั้งไว้ |
| **workload endpoint uses reset value after reset** | `GET /memory` หลัง reset คืน `size: 1e6` — ทดสอบ side-effect ของ reset path เช่นเดียวกับที่ทำกับ PATCH |
| **consecutive resets are idempotent** | เรียก reset สองครั้งติดกันยังคืน 200 พร้อมค่า default ถูกต้อง — reset ไม่มี error state "อยู่ที่ default อยู่แล้ว" |

---

### `rate limiting enforcement after PATCH` (3 tests)

กลุ่มนี้ตรวจสอบพฤติกรรมแบบ end-to-end: PATCH เปิด limiter → request จริงถูกนับ → คืน 429 → ปิดแล้วหยุด 429

| Test | สิ่งที่ตรวจสอบ |
|------|----------------|
| **returns 429 once the request count exceeds max within the window** | เปิด rate limiting ด้วย `max: 2` แล้วส่ง `GET /fast` สาม request — request ที่ 1 และ 2 คืน 200, request ที่ 3 คืน 429 ยืนยันว่า limiter บังคับใช้จริง |
| **GET /api/config is never rate-limited even when the limit is tight** | เปิด rate limiting ด้วย `max: 1` เผา quota ด้วย `GET /fast` แล้วยืนยันว่า `GET /api/config` ยังคืน 200 — ตรวจสอบว่า config router ถูก mount ก่อน rate limiter ใน middleware chain |
| **disabling rate limit after enabling stops returning 429** | เปิดด้วย `max: 1` เผา quota แล้ว PATCH `enabled: false` — `GET /fast` ถัดไปคืน 200 limiter ถูก bypass ทันที และการสร้าง limiter instance ใหม่ยังรีเซ็ต window นับ request ด้วย |

---

## การรัน test

```bash
npm test                                          # รันทั้งหมด
npm test -- tests/integration/config.test.js     # รันเฉพาะ config tests
npm run test:coverage                             # รันพร้อม coverage report
```

รวม **37 tests** ใน 7 describe blocks เสร็จภายใน 100 ms

---

## CI/CD

workflow ที่ `.github/workflows/ci.yml` รันอัตโนมัติทุกครั้งที่ push และ pull request ไปยัง `main`

### Pipeline ทำอะไรบ้าง

1. **Matrix build** — รัน test suite ทั้งหมดบน Node.js 20, 22, และ 24 พร้อมกัน ตรวจจับ regression ที่เกิดเฉพาะบางเวอร์ชัน
2. **ติดตั้ง dependency** — ใช้ `npm ci` (ไม่ใช่ `npm install`) เพื่อให้ lockfile ถูกเสมอและ build ทำซ้ำได้
3. **รัน test** — `npm test` รันทุกไฟล์ใน `tests/` ผ่าน Vitest
4. **Coverage report** — `npm run test:coverage` รันครั้งเดียวบน Node 22 เท่านั้น ผลออกที่ job log

### สรุป workflow file

```yaml
on:
  push:    { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22, 24]
    steps:
      - checkout
      - setup-node (with npm cache)
      - npm ci
      - npm test
      - npm run test:coverage   # Node 22 เท่านั้น
```

### ความหมายของ failure แต่ละจุด

| จุดที่ fail | สาเหตุที่น่าจะเป็น |
|-------------|-------------------|
| `npm ci` fail | `package-lock.json` ไม่ sync — รัน `npm install` ในเครื่องแล้ว commit lockfile ที่อัปเดต |
| Tests fail เฉพาะบาง Node version | โค้ดใช้ API ที่เปลี่ยนระหว่างเวอร์ชัน เช่น `crypto`, `fs` |
| Tests fail ทุก version | route, middleware, หรือ validation rule ถูกเปลี่ยนโดยไม่อัปเดต test ที่เกี่ยวข้อง |
| Coverage step fail | มี endpoint ใหม่แต่ยังไม่มี test ครอบคลุม — Vitest จะแสดงบรรทัดที่ไม่มี coverage |
