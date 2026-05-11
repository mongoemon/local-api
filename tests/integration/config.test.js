import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../../app.js";

// Fresh config per test — prevents state leakage between describe blocks
// that mutate config via PATCH.
function makeConfig() {
  return {
    server: { port: 0 },
    auth: { bearerToken: "test-token", jwtSecret: "test-secret" },
    rateLimit: { enabled: false, windowMs: 60000, max: 10000, message: "Too many requests" },
    concurrency: { maxConcurrent: 50, busyMessage: "Server too busy" },
    workloads: {
      slowDelayMs: 1,
      busyDelayMs: 1,
      cpuIterations: 100,
      memoryArraySize: 100,
      memoryFillValue: "x",
      ioFileSizeKb: 1,
      ioChunkValue: "x"
    }
  };
}

// ─── GET /api/config ─────────────────────────────────────────────────────────

describe("GET /api/config", () => {
  const app = createApp(makeConfig());

  it("returns 200 with the three main config sections", async () => {
    const res = await supertest(app).get("/api/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("rateLimit");
    expect(res.body).toHaveProperty("concurrency");
    expect(res.body).toHaveProperty("workloads");
  });

  it("includes a defaults object", async () => {
    const res = await supertest(app).get("/api/config");
    expect(res.body).toHaveProperty("defaults");
    expect(res.body.defaults).toHaveProperty("rateLimit");
    expect(res.body.defaults).toHaveProperty("concurrency");
    expect(res.body.defaults).toHaveProperty("workloads");
  });

  it("reflects the values the app was started with", async () => {
    const res = await supertest(app).get("/api/config");
    const { rateLimit, concurrency, workloads } = res.body;

    expect(rateLimit.enabled).toBe(false);
    expect(rateLimit.windowMs).toBe(60000);
    expect(rateLimit.max).toBe(10000);
    expect(concurrency.maxConcurrent).toBe(50);
    expect(workloads.slowDelayMs).toBe(1);
    expect(workloads.busyDelayMs).toBe(1);
    expect(workloads.cpuIterations).toBe(100);
    expect(workloads.memoryArraySize).toBe(100);
    expect(workloads.ioFileSizeKb).toBe(1);
  });

  it("defaults object contains the canonical default values", async () => {
    const res = await supertest(app).get("/api/config");
    const { defaults } = res.body;

    expect(defaults.rateLimit.enabled).toBe(false);
    expect(defaults.rateLimit.windowMs).toBe(60000);
    expect(defaults.rateLimit.max).toBe(10000);
    expect(defaults.concurrency.maxConcurrent).toBe(50);
    expect(defaults.workloads.slowDelayMs).toBe(200);
    expect(defaults.workloads.busyDelayMs).toBe(3000);
    expect(defaults.workloads.cpuIterations).toBe(1e7);
    expect(defaults.workloads.memoryArraySize).toBe(1e6);
    expect(defaults.workloads.ioFileSizeKb).toBe(1024);
  });
});

// ─── PATCH /api/config — rateLimit ───────────────────────────────────────────

describe("PATCH /api/config — rateLimit", () => {
  let app;
  beforeEach(() => { app = createApp(makeConfig()); });

  it("returns 200 with ok: true and updated config", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: true } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty("config");
  });

  it("updates rateLimit.enabled to true", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: true } });
    expect(res.body.config.rateLimit.enabled).toBe(true);
  });

  it("updates rateLimit.windowMs", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { windowMs: 30000 } });
    expect(res.body.config.rateLimit.windowMs).toBe(30000);
  });

  it("updates rateLimit.max", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { max: 50 } });
    expect(res.body.config.rateLimit.max).toBe(50);
  });

  it("subsequent GET /api/config reflects the updated rateLimit values", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: true, max: 25 } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.rateLimit.enabled).toBe(true);
    expect(res.body.rateLimit.max).toBe(25);
  });

  it("ignores rateLimit.enabled when it is not a boolean", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: "yes" } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.rateLimit.enabled).toBe(false); // unchanged
  });

  it("ignores rateLimit.windowMs when it is zero or negative", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { windowMs: 0 } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.rateLimit.windowMs).toBe(60000); // unchanged
  });

  it("ignores rateLimit.max when it is zero or negative", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { max: -1 } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.rateLimit.max).toBe(10000); // unchanged
  });
});

// ─── PATCH /api/config — concurrency ─────────────────────────────────────────

describe("PATCH /api/config — concurrency", () => {
  let app;
  beforeEach(() => { app = createApp(makeConfig()); });

  it("updates maxConcurrent", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ concurrency: { maxConcurrent: 5 } });
    expect(res.status).toBe(200);
    expect(res.body.config.concurrency.maxConcurrent).toBe(5);
  });

  it("subsequent GET reflects updated maxConcurrent", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ concurrency: { maxConcurrent: 7 } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.concurrency.maxConcurrent).toBe(7);
  });

  it("ignores maxConcurrent when it is not a number", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ concurrency: { maxConcurrent: "ten" } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.concurrency.maxConcurrent).toBe(50); // unchanged
  });

  it("ignores maxConcurrent when it is zero or negative", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ concurrency: { maxConcurrent: 0 } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.concurrency.maxConcurrent).toBe(50); // unchanged
  });
});

// ─── PATCH /api/config — workloads ───────────────────────────────────────────

describe("PATCH /api/config — workloads", () => {
  let app;
  beforeEach(() => { app = createApp(makeConfig()); });

  it("updates slowDelayMs", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ workloads: { slowDelayMs: 500 } });
    expect(res.body.config.workloads.slowDelayMs).toBe(500);
  });

  it("updates busyDelayMs", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ workloads: { busyDelayMs: 2000 } });
    expect(res.body.config.workloads.busyDelayMs).toBe(2000);
  });

  it("updates cpuIterations", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ workloads: { cpuIterations: 500 } });
    expect(res.body.config.workloads.cpuIterations).toBe(500);
  });

  it("updates memoryArraySize", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ workloads: { memoryArraySize: 200 } });
    expect(res.body.config.workloads.memoryArraySize).toBe(200);
  });

  it("updates ioFileSizeKb", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ workloads: { ioFileSizeKb: 2 } });
    expect(res.body.config.workloads.ioFileSizeKb).toBe(2);
  });

  it("allows slowDelayMs to be set to zero", async () => {
    const res = await supertest(app)
      .patch("/api/config")
      .send({ workloads: { slowDelayMs: 0 } });
    expect(res.body.config.workloads.slowDelayMs).toBe(0);
  });

  it("ignores workload fields that are not numbers", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ workloads: { cpuIterations: "many" } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.workloads.cpuIterations).toBe(100); // unchanged
  });

  it("a partial update leaves unrelated sections unchanged", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ concurrency: { maxConcurrent: 10 } });
    const res = await supertest(app).get("/api/config");
    expect(res.body.rateLimit.max).toBe(10000);       // unchanged
    expect(res.body.workloads.slowDelayMs).toBe(1);   // unchanged
  });
});

// ─── PATCH side-effects on workload endpoints ─────────────────────────────────

describe("PATCH side-effects — workload endpoint behavior", () => {
  let app;
  beforeEach(() => { app = createApp(makeConfig()); });

  it("changed slowDelayMs is reflected in the /slow response message", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ workloads: { slowDelayMs: 10 } });
    const res = await supertest(app).get("/slow");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("10ms");
  });

  it("changed cpuIterations is reflected in the /cpu response", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ workloads: { cpuIterations: 10 } });
    const res = await supertest(app).get("/cpu");
    expect(res.status).toBe(200);
    expect(res.body.iterations).toBe(10);
    expect(res.body.result).toBe(45); // sum of 0..9
  });

  it("changed memoryArraySize is reflected in the /memory response", async () => {
    await supertest(app)
      .patch("/api/config")
      .send({ workloads: { memoryArraySize: 50 } });
    const res = await supertest(app).get("/memory");
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(50);
  });
});

// ─── POST /api/config/reset ───────────────────────────────────────────────────

describe("POST /api/config/reset", () => {
  let app;
  beforeEach(() => { app = createApp(makeConfig()); });

  it("returns 200 with ok: true and a config object", async () => {
    const res = await supertest(app).post("/api/config/reset");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body).toHaveProperty("config");
  });

  it("resets rateLimit to canonical defaults", async () => {
    await supertest(app).patch("/api/config").send({
      rateLimit: { enabled: true, windowMs: 1000, max: 5 }
    });
    const res = await supertest(app).post("/api/config/reset");
    expect(res.body.config.rateLimit.enabled).toBe(false);
    expect(res.body.config.rateLimit.windowMs).toBe(60000);
    expect(res.body.config.rateLimit.max).toBe(10000);
  });

  it("resets concurrency to canonical defaults", async () => {
    await supertest(app).patch("/api/config").send({
      concurrency: { maxConcurrent: 2 }
    });
    const res = await supertest(app).post("/api/config/reset");
    expect(res.body.config.concurrency.maxConcurrent).toBe(50);
  });

  it("resets workload values to canonical defaults", async () => {
    await supertest(app).patch("/api/config").send({
      workloads: { slowDelayMs: 999, busyDelayMs: 9999, cpuIterations: 999, memoryArraySize: 999, ioFileSizeKb: 10 }
    });
    const res = await supertest(app).post("/api/config/reset");
    expect(res.body.config.workloads.slowDelayMs).toBe(200);
    expect(res.body.config.workloads.busyDelayMs).toBe(3000);
    expect(res.body.config.workloads.cpuIterations).toBe(1e7);
    expect(res.body.config.workloads.memoryArraySize).toBe(1e6);
    expect(res.body.config.workloads.ioFileSizeKb).toBe(1024);
  });

  it("GET /api/config reflects defaults after reset", async () => {
    await supertest(app).patch("/api/config").send({
      rateLimit: { enabled: true, max: 5 }
    });
    await supertest(app).post("/api/config/reset");
    const res = await supertest(app).get("/api/config");
    expect(res.body.rateLimit.enabled).toBe(false);
    expect(res.body.rateLimit.max).toBe(10000);
  });

  it("workload endpoint uses reset value after reset", async () => {
    await supertest(app).patch("/api/config").send({
      workloads: { memoryArraySize: 10 }
    });
    await supertest(app).post("/api/config/reset");
    const res = await supertest(app).get("/memory");
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(1e6);
  });

  it("consecutive resets are idempotent", async () => {
    await supertest(app).post("/api/config/reset");
    const res = await supertest(app).post("/api/config/reset");
    expect(res.body.ok).toBe(true);
    expect(res.body.config.rateLimit.enabled).toBe(false);
    expect(res.body.config.concurrency.maxConcurrent).toBe(50);
  });
});

// ─── Rate limiting enforcement ────────────────────────────────────────────────

describe("rate limiting enforcement after PATCH", () => {
  it("returns 429 once the request count exceeds max within the window", async () => {
    const app = createApp(makeConfig());
    // Enable rate limiting with a cap of 2 requests per window.
    // The config API is mounted before the rate limiter so this PATCH does not consume quota.
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: true, windowMs: 60000, max: 2 } });

    await supertest(app).get("/fast"); // request 1 — passes
    await supertest(app).get("/fast"); // request 2 — passes
    const res = await supertest(app).get("/fast"); // request 3 — exceeds cap
    expect(res.status).toBe(429);
  });

  it("GET /api/config is never rate-limited even when the limit is tight", async () => {
    const app = createApp(makeConfig());
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: true, windowMs: 60000, max: 1 } });

    // Burn the quota
    await supertest(app).get("/fast");

    // Config API should still respond with 200
    const res = await supertest(app).get("/api/config");
    expect(res.status).toBe(200);
  });

  it("disabling rate limit after enabling stops returning 429", async () => {
    const app = createApp(makeConfig());
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: true, windowMs: 60000, max: 1 } });

    await supertest(app).get("/fast"); // burns the 1 allowed request

    // Disable the rate limiter — the window reset happens via limiter recreation
    await supertest(app)
      .patch("/api/config")
      .send({ rateLimit: { enabled: false } });

    const res = await supertest(app).get("/fast");
    expect(res.status).toBe(200);
  });
});
