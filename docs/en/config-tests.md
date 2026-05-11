# Config API — Test Coverage Explained

`tests/integration/config.test.js` covers the three runtime-config endpoints:
`GET /api/config`, `PATCH /api/config`, and `POST /api/config/reset`.

## How the test file is structured

Each describe block creates a **fresh app instance** via `makeConfig()` + `createApp()` so mutations in one block cannot affect another:

```js
function makeConfig() {
  return {
    rateLimit:   { enabled: false, windowMs: 60000, max: 10000, ... },
    concurrency: { maxConcurrent: 50, ... },
    workloads:   { slowDelayMs: 1, cpuIterations: 100, memoryArraySize: 100, ... }
  };
}

// Blocks that mutate config use beforeEach so each test starts clean
beforeEach(() => { app = createApp(makeConfig()); });
```

Workload values are set to tiny numbers (delays = 1 ms, arrays = 100 items) so tests run fast without triggering real CPU or I/O cost.

---

## Describe blocks and what each test verifies

### `GET /api/config` (4 tests)

These tests use a single shared app (no mutations) and focus on the shape and values of the read endpoint.

| Test | What it verifies |
|------|-----------------|
| **returns 200 with the three main config sections** | The response has HTTP 200 and contains `rateLimit`, `concurrency`, and `workloads` keys — the three categories the API exposes. |
| **includes a defaults object** | The response has a `defaults` key that itself contains all three categories. This object lets the UI show the canonical default next to the live value. |
| **reflects the values the app was started with** | The live values match exactly what was passed to `createApp()` — confirms the GET endpoint reads from the live config object, not a hardcoded copy. |
| **defaults object contains the canonical default values** | `defaults.workloads.slowDelayMs` is 200 (not 1 from `makeConfig()`), `cpuIterations` is 1e7, etc. — confirms DEFAULTS in `config-api.js` are the production values, independent of what the app was started with. |

---

### `PATCH /api/config — rateLimit` (8 tests)

Each test gets a fresh app via `beforeEach`. Tests cover both the happy path and validation rejection.

| Test | What it verifies |
|------|-----------------|
| **returns 200 with ok: true and updated config** | A valid PATCH returns 200, `ok: true`, and a `config` key containing the updated state. |
| **updates rateLimit.enabled to true** | Sending `{ rateLimit: { enabled: true } }` flips the boolean and the response reflects it. |
| **updates rateLimit.windowMs** | Sending `{ rateLimit: { windowMs: 30000 } }` updates the sliding window, confirmed in the PATCH response body. |
| **updates rateLimit.max** | Sending `{ rateLimit: { max: 50 } }` updates the request cap. |
| **subsequent GET /api/config reflects the updated rateLimit values** | After a PATCH, a separate GET returns the changed values — confirms the mutation is durable within the app's lifetime, not just echoed in the PATCH response. |
| **ignores rateLimit.enabled when it is not a boolean** | Sending `"yes"` (a string) leaves `enabled` unchanged at `false`. The API only accepts strict `typeof === "boolean"`. |
| **ignores rateLimit.windowMs when it is zero or negative** | Sending `0` leaves `windowMs` at 60000. Zero or negative window would break the limiter. |
| **ignores rateLimit.max when it is zero or negative** | Sending `-1` leaves `max` at 10000. A zero or negative cap would block all requests. |

---

### `PATCH /api/config — concurrency` (4 tests)

| Test | What it verifies |
|------|-----------------|
| **updates maxConcurrent** | Sending `{ concurrency: { maxConcurrent: 5 } }` returns 200 and the new value. |
| **subsequent GET reflects updated maxConcurrent** | A follow-up GET confirms the change persists. |
| **ignores maxConcurrent when it is not a number** | Sending `"ten"` (a string) leaves `maxConcurrent` at 50. |
| **ignores maxConcurrent when it is zero or negative** | Sending `0` leaves `maxConcurrent` at 50. Zero would make every request return 503 immediately. |

---

### `PATCH /api/config — workloads` (8 tests)

| Test | What it verifies |
|------|-----------------|
| **updates slowDelayMs** | `slowDelayMs: 500` is accepted and returned. |
| **updates busyDelayMs** | `busyDelayMs: 2000` is accepted and returned. |
| **updates cpuIterations** | `cpuIterations: 500` is accepted and returned. |
| **updates memoryArraySize** | `memoryArraySize: 200` is accepted and returned. |
| **updates ioFileSizeKb** | `ioFileSizeKb: 2` is accepted and returned. |
| **allows slowDelayMs to be set to zero** | Sending `0` is accepted — unlike `windowMs`/`max`, a zero delay is valid (no artificial wait). |
| **ignores workload fields that are not numbers** | Sending `"many"` for `cpuIterations` leaves it at 100. All workload fields require `typeof === "number"`. |
| **a partial update leaves unrelated sections unchanged** | Patching only `concurrency` leaves `rateLimit.max` and `workloads.slowDelayMs` untouched — confirms PATCH is a merge, not a replace. |

---

### `PATCH side-effects — workload endpoint behavior` (3 tests)

These tests verify that a PATCH actually changes the behavior of the workload endpoints, not just the stored config value.

| Test | What it verifies |
|------|-----------------|
| **changed slowDelayMs is reflected in the /slow response message** | After `PATCH { workloads: { slowDelayMs: 10 } }`, calling `GET /slow` returns a body whose `message` contains `"10ms"`. Confirms the workload router reads from the live config object on every request. |
| **changed cpuIterations is reflected in the /cpu response** | After `PATCH { workloads: { cpuIterations: 10 } }`, `GET /cpu` returns `iterations: 10` and `result: 45` (sum of 0 through 9). Verifies both the count and the computed value. |
| **changed memoryArraySize is reflected in the /memory response** | After `PATCH { workloads: { memoryArraySize: 50 } }`, `GET /memory` returns `size: 50`. |

---

### `POST /api/config/reset` (7 tests)

| Test | What it verifies |
|------|-----------------|
| **returns 200 with ok: true and a config object** | The reset endpoint has the same response envelope as PATCH. |
| **resets rateLimit to canonical defaults** | After enabling rate limiting and tightening the window, a reset returns `enabled: false`, `windowMs: 60000`, `max: 10000` — the production defaults. |
| **resets concurrency to canonical defaults** | After setting `maxConcurrent: 2`, a reset returns `maxConcurrent: 50`. |
| **resets workload values to canonical defaults** | After changing all five workload fields, a reset returns `slowDelayMs: 200`, `busyDelayMs: 3000`, `cpuIterations: 1e7`, `memoryArraySize: 1e6`, `ioFileSizeKb: 1024`. |
| **GET /api/config reflects defaults after reset** | A follow-up GET after reset shows the canonical values, not the ones set by the preceding PATCH. |
| **workload endpoint uses reset value after reset** | `GET /memory` after reset returns `size: 1e6` — the side-effect test for the reset path, mirroring the PATCH side-effect tests. |
| **consecutive resets are idempotent** | Calling reset twice in a row still returns 200 with the correct defaults. Reset has no "already at defaults" error state. |

---

### `rate limiting enforcement after PATCH` (3 tests)

These tests verify the full end-to-end behavior: PATCH enables the limiter → real requests are counted → 429 is returned → disabling stops it.

| Test | What it verifies |
|------|-----------------|
| **returns 429 once the request count exceeds max within the window** | Enable rate limiting with `max: 2`, then send three `GET /fast` requests. Requests 1 and 2 return 200; request 3 returns 429. Confirms the live limiter is actually enforcing the cap. |
| **GET /api/config is never rate-limited even when the limit is tight** | Enable rate limiting with `max: 1`, burn the one allowed request with `GET /fast`, then confirm `GET /api/config` still returns 200. Verifies the config router is mounted before the rate limiter in the middleware chain. |
| **disabling rate limit after enabling stops returning 429** | Enable with `max: 1`, burn the quota, then PATCH `enabled: false`. A subsequent `GET /fast` returns 200 — the limiter is bypassed immediately, and recreating the limiter instance also resets the request counter window. |

---

## Running the tests

```bash
npm test                                          # all tests
npm test -- tests/integration/config.test.js     # config tests only
```

Total: **37 tests** across 7 describe blocks, completing in under 100 ms.
