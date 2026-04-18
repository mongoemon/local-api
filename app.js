import express from "express";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import client from "prom-client";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { createDemoRouter } from "./demo-routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "tmp");
const ioFilePath = path.join(tempDir, "io-test.dat");

function createLimiter(config) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: config.rateLimit.message
  });
}

function getBearerToken(req) {
  const authorization = req.get("authorization");

  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  const headerToken = req.get("x-access-token");
  return typeof headerToken === "string" ? headerToken.trim() : "";
}

export function createApp(config) {
  const app = express();
  let activeRequests = 0;
  const register = new client.Registry();
  const startedAt = new Date();
  const staticOptions = {
    etag: false,
    lastModified: false,
    index: false,
    maxAge: 0,
    setHeaders(res) {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");
    }
  };

  app.disable("etag");
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  client.collectDefaultMetrics({ register });

  const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"],
    registers: [register]
  });

  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000;

      httpRequestDuration
        .labels(req.method, req.path, res.statusCode)
        .observe(duration);

      console.log(
        `${req.method} ${req.path} ${res.statusCode} - ${duration}s | active: ${activeRequests}`
      );
    });

    next();
  });

  if (config.rateLimit.enabled) {
    app.use(createLimiter(config));
  }

  app.use((req, res, next) => {
    if (activeRequests >= config.concurrency.maxConcurrent) {
      return res.status(503).send(config.concurrency.busyMessage);
    }

    activeRequests++;
    res.on("finish", () => activeRequests--);
    next();
  });

  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
  });

  app.use(express.static(path.join(__dirname, "public"), staticOptions));
  app.use("/demo", createDemoRouter());

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    });
  });

  app.get("/fast", (req, res) => {
    res.json({ message: "fast response" });
  });

  app.get("/slow", async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, config.workloads.slowDelayMs));
    res.json({ message: `slow response (${config.workloads.slowDelayMs}ms)` });
  });

  app.get("/busy", async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, config.workloads.busyDelayMs));
    res.json({ message: `busy response (${config.workloads.busyDelayMs}ms)` });
  });

  app.get("/cpu", (req, res) => {
    let sum = 0;

    for (let i = 0; i < config.workloads.cpuIterations; i++) {
      sum += i;
    }

    res.json({ result: sum, iterations: config.workloads.cpuIterations });
  });

  app.get("/memory", (req, res) => {
    const arr = new Array(config.workloads.memoryArraySize).fill(config.workloads.memoryFillValue);
    res.json({ size: arr.length });
  });

  app.get("/prep", (req, res) => {
    const prefix = typeof req.query.prefix === "string" && req.query.prefix.trim()
      ? req.query.prefix.trim()
      : "prep";
    const timestamp = Date.now();
    const token = config.auth.bearerToken;

    res.json({
      message: "preprocessor seed generated",
      requestId: `${prefix}-${randomUUID()}`,
      token,
      authorizationHeader: `Bearer ${token}`,
      timestamp,
      isoTime: new Date(timestamp).toISOString(),
      nextEndpoint: "/protected"
    });
  });

  app.get("/protected", (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "missing_token",
        message: "Send Authorization: Bearer <token> or x-access-token header"
      });
    }

    if (token !== config.auth.bearerToken) {
      return res.status(403).json({
        error: "invalid_token",
        message: "Token is not valid for this environment"
      });
    }

    res.json({
      message: "protected resource access granted",
      authenticated: true,
      tokenSource: req.get("authorization") ? "authorization" : "x-access-token"
    });
  });

  app.get("/io", async (req, res) => {
    const mode = req.query.mode === "write" ? "write" : "read";
    const fileSizeBytes = config.workloads.ioFileSizeKb * 1024;

    await mkdir(tempDir, { recursive: true });

    const content = config.workloads.ioChunkValue.repeat(fileSizeBytes);
    const start = Date.now();

    if (mode === "write") {
      await writeFile(ioFilePath, content, "utf8");
    } else {
      try {
        await stat(ioFilePath);
      } catch {
        await writeFile(ioFilePath, content, "utf8");
      }

      await readFile(ioFilePath, "utf8");
    }

    const durationMs = Date.now() - start;

    res.json({
      message: `io ${mode} completed`,
      mode,
      fileSizeKb: config.workloads.ioFileSizeKb,
      durationMs
    });
  });

  app.post("/cleanup", async (req, res) => {
    const targets = [];

    try {
      await stat(ioFilePath);
      await rm(ioFilePath, { force: true });
      targets.push("io-test.dat");
    } catch {
      // Ignore when the file does not exist.
    }

    res.json({
      message: "cleanup completed",
      cleaned: targets,
      cleanedCount: targets.length
    });
  });

  app.post("/submit-one", (req, res) => {
    const { name } = req.body ?? {};

    if (!name) {
      return res.status(400).json({
        error: "missing_required_parameter",
        required: ["name"]
      });
    }

    res.json({
      message: "received one required parameter",
      data: { name }
    });
  });

  app.post("/submit-two", (req, res) => {
    const { name, type } = req.body ?? {};

    if (!name || !type) {
      return res.status(400).json({
        error: "missing_required_parameters",
        required: ["name", "type"]
      });
    }

    res.json({
      message: "received two required parameters",
      data: { name, type }
    });
  });

  app.get("/error", (req, res) => {
    res.status(500).json({
      error: "intentional server error",
      message: "This endpoint is designed to simulate an HTTP 500 response"
    });
  });

  app.get("/status", (req, res) => {
    res.json({
      status: "running",
      running: true,
      pid: process.pid,
      startedAt: startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      activeRequests
    });
  });

  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  // JWT Authentication Endpoints
  const JWT_SECRET = config.auth?.jwtSecret || "your-secret-key-change-in-production";

  app.post("/auth/login", (req, res) => {
    const { username, password } = req.body ?? {};

    // Demo credentials validation (for testing purposes)
    if (!username || !password) {
      return res.status(400).json({
        error: "missing_credentials",
        message: "Send username and password in request body"
      });
    }

    // Simple demo validation (in production, validate against database)
    if (username !== "demo" || password !== "password") {
      return res.status(401).json({
        error: "invalid_credentials",
        message: "Invalid username or password"
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: "user-123",
        username: username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      },
      JWT_SECRET
    );

    res.json({
      message: "login successful",
      authenticated: true,
      token: token,
      tokenType: "Bearer",
      expiresIn: "24 hours",
      user: {
        userId: "user-123",
        username: username
      }
    });
  });

  app.post("/auth/verify", (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "missing_token",
        message: "Send Authorization: Bearer <token> or x-access-token header"
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      res.json({
        message: "token is valid",
        valid: true,
        decoded: {
          userId: decoded.userId,
          username: decoded.username,
          iat: new Date(decoded.iat * 1000).toISOString(),
          exp: new Date(decoded.exp * 1000).toISOString()
        }
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "token_expired",
          message: "Token has expired",
          expiredAt: error.expiredAt
        });
      }

      res.status(403).json({
        error: "invalid_token",
        message: "Token is not valid"
      });
    }
  });

  return app;
}
