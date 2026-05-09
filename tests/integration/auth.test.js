import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp, testConfig } from "../helpers/testApp.js";

const app = createTestApp();

describe("GET /prep", () => {
  it("returns token and a requestId prefixed with 'prep'", async () => {
    const res = await supertest(app).get("/prep");
    expect(res.status).toBe(200);
    expect(res.body.token).toBe(testConfig.auth.bearerToken);
    expect(res.body.requestId).toMatch(/^prep-/);
    expect(res.body.authorizationHeader).toBe(`Bearer ${testConfig.auth.bearerToken}`);
    expect(res.body.nextEndpoint).toBe("/protected");
  });

  it("uses a custom prefix when provided", async () => {
    const res = await supertest(app).get("/prep?prefix=mytest");
    expect(res.body.requestId).toMatch(/^mytest-/);
  });

  it("ignores blank prefix and falls back to 'prep'", async () => {
    const res = await supertest(app).get("/prep?prefix=");
    expect(res.body.requestId).toMatch(/^prep-/);
  });
});

describe("GET /protected", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await supertest(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_token");
  });

  it("returns 403 for an incorrect bearer token", async () => {
    const res = await supertest(app).get("/protected")
      .set("Authorization", "Bearer wrong-token");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("invalid_token");
  });

  it("returns 200 with a valid Authorization header", async () => {
    const res = await supertest(app).get("/protected")
      .set("Authorization", `Bearer ${testConfig.auth.bearerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.tokenSource).toBe("authorization");
  });

  it("returns 200 with a valid x-access-token header", async () => {
    const res = await supertest(app).get("/protected")
      .set("x-access-token", testConfig.auth.bearerToken);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.tokenSource).toBe("x-access-token");
  });
});

describe("POST /auth/login", () => {
  it("returns 400 when credentials are missing", async () => {
    const res = await supertest(app).post("/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_credentials");
  });

  it("returns 401 for invalid credentials", async () => {
    const res = await supertest(app).post("/auth/login")
      .send({ username: "hacker", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("returns a JWT token for valid demo credentials", async () => {
    const res = await supertest(app).post("/auth/login")
      .send({ username: "demo", password: "password" });
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(3); // JWT has 3 parts
    expect(res.body.tokenType).toBe("Bearer");
    expect(res.body.user.username).toBe("demo");
  });
});

describe("POST /auth/verify", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await supertest(app).post("/auth/verify");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("missing_token");
  });

  it("returns 403 for a malformed token", async () => {
    const res = await supertest(app).post("/auth/verify")
      .set("Authorization", "Bearer not.a.jwt");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("invalid_token");
  });

  it("verifies a freshly issued JWT and returns decoded claims", async () => {
    const loginRes = await supertest(app).post("/auth/login")
      .send({ username: "demo", password: "password" });
    const { token } = loginRes.body;

    const verifyRes = await supertest(app).post("/auth/verify")
      .set("Authorization", `Bearer ${token}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.decoded.username).toBe("demo");
    expect(verifyRes.body.decoded.userId).toBe("user-123");
    expect(typeof verifyRes.body.decoded.iat).toBe("string");
    expect(typeof verifyRes.body.decoded.exp).toBe("string");
  });
});
