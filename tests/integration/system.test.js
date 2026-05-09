import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp } from "../helpers/testApp.js";

const app = createTestApp();

describe("GET /error", () => {
  it("returns 500 with intentional error message", async () => {
    const res = await supertest(app).get("/error");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("intentional server error");
    expect(typeof res.body.message).toBe("string");
  });
});

describe("GET /status", () => {
  it("returns running status with required fields", async () => {
    const res = await supertest(app).get("/status");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("running");
    expect(res.body.running).toBe(true);
    expect(typeof res.body.pid).toBe("number");
    expect(typeof res.body.startedAt).toBe("string");
    expect(typeof res.body.uptimeSec).toBe("number");
    expect(typeof res.body.activeRequests).toBe("number");
  });

  it("startedAt is a valid ISO 8601 date string", async () => {
    const res = await supertest(app).get("/status");
    expect(() => new Date(res.body.startedAt)).not.toThrow();
    expect(new Date(res.body.startedAt).toISOString()).toBe(res.body.startedAt);
  });
});

describe("GET /metrics", () => {
  it("returns Prometheus metrics in text/plain format", async () => {
    const res = await supertest(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
  });

  it("includes the custom http_request_duration_seconds metric", async () => {
    await supertest(app).get("/fast"); // generate at least one observation
    const res = await supertest(app).get("/metrics");
    expect(res.text).toContain("http_request_duration_seconds");
  });
});
