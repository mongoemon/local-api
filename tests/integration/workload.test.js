import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp } from "../helpers/testApp.js";

const app = createTestApp();

describe("GET /fast", () => {
  it("returns 200 with fast response message", async () => {
    const res = await supertest(app).get("/fast");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("fast response");
  });
});

describe("GET /slow", () => {
  it("returns 200 with slow response message", async () => {
    const res = await supertest(app).get("/slow");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("slow response");
  });
});

describe("GET /busy", () => {
  it("returns 200 with busy response message", async () => {
    const res = await supertest(app).get("/busy");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("busy response");
  });
});

describe("GET /cpu", () => {
  it("returns a computed result with iteration count", async () => {
    const res = await supertest(app).get("/cpu");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("result");
    expect(res.body.iterations).toBe(100);
  });

  it("result is the sum of 0..N-1", async () => {
    const res = await supertest(app).get("/cpu");
    const expected = (100 * 99) / 2;
    expect(res.body.result).toBe(expected);
  });
});

describe("GET /memory", () => {
  it("returns the allocated array size", async () => {
    const res = await supertest(app).get("/memory");
    expect(res.status).toBe(200);
    expect(res.body.size).toBe(100);
  });
});

describe("GET /io", () => {
  it("performs a write operation", async () => {
    const res = await supertest(app).get("/io?mode=write");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("write");
    expect(typeof res.body.durationMs).toBe("number");
  });

  it("performs a read operation", async () => {
    const res = await supertest(app).get("/io?mode=read");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("read");
  });

  it("defaults to read when mode is not specified", async () => {
    const res = await supertest(app).get("/io");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("read");
  });
});

describe("POST /cleanup", () => {
  it("cleans up the io test file after a write", async () => {
    await supertest(app).get("/io?mode=write");
    const res = await supertest(app).post("/cleanup");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("cleanup completed");
    expect(res.body.cleanedCount).toBe(1);
    expect(res.body.cleaned).toContain("io-test.dat");
  });

  it("reports nothing cleaned when the file does not exist", async () => {
    await supertest(app).post("/cleanup"); // ensure removed
    const res = await supertest(app).post("/cleanup");
    expect(res.status).toBe(200);
    expect(res.body.cleanedCount).toBe(0);
  });
});
