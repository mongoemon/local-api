import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp } from "../helpers/testApp.js";

const app = createTestApp();

describe("POST /submit-one", () => {
  it("returns 400 when name is missing", async () => {
    const res = await supertest(app).post("/submit-one").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_required_parameter");
    expect(res.body.required).toContain("name");
  });

  it("returns 200 and echoes name when provided", async () => {
    const res = await supertest(app).post("/submit-one").send({ name: "Alice" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Alice");
    expect(res.body.message).toBe("received one required parameter");
  });

  it("ignores extra fields", async () => {
    const res = await supertest(app).post("/submit-one")
      .send({ name: "Alice", extra: "ignored" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Alice" });
  });
});

describe("POST /submit-two", () => {
  it("returns 400 when both fields are missing", async () => {
    const res = await supertest(app).post("/submit-two").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_required_parameters");
    expect(res.body.required).toContain("name");
    expect(res.body.required).toContain("type");
  });

  it("returns 400 when only name is provided", async () => {
    const res = await supertest(app).post("/submit-two").send({ name: "Alice" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when only type is provided", async () => {
    const res = await supertest(app).post("/submit-two").send({ type: "admin" });
    expect(res.status).toBe(400);
  });

  it("returns 200 and echoes both fields when provided", async () => {
    const res = await supertest(app).post("/submit-two")
      .send({ name: "Alice", type: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Alice", type: "admin" });
    expect(res.body.message).toBe("received two required parameters");
  });
});
