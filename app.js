import express from "express";
import rateLimit from "express-rate-limit";
import client from "prom-client";
import path from "path";
import { fileURLToPath } from "url";
import { createDemoRouter } from "./demo-routes.js";
import { createWorkloadRouter } from "./routes/workload.js";
import { createAuthRouter } from "./routes/auth.js";
import { createDataRouter } from "./routes/data.js";
import { createSystemRouter } from "./routes/system.js";
import { createConfigRouter } from "./routes/config-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createLimiter(config) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: config.rateLimit.message,
    validate: { creationStack: false }
  });
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

  const activeRequestsGauge = new client.Gauge({
    name: "http_active_requests",
    help: "Number of HTTP requests currently being processed",
    registers: [register]
  });

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000;
      httpRequestDuration.labels(req.method, req.path, res.statusCode).observe(duration);
      console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}s | active: ${activeRequests}`);
    });
    next();
  });

  // Config API — mounted before rate limiter and concurrency so it is always reachable
  let activeLimiter = createLimiter(config);
  app.use(createConfigRouter(config, () => { activeLimiter = createLimiter(config); }));

  // Rate limiter — re-checks config.rateLimit.enabled on every request so toggle takes effect immediately
  app.use((req, res, next) => {
    if (!config.rateLimit.enabled) return next();
    return activeLimiter(req, res, next);
  });

  app.use((_req, res, next) => {
    if (activeRequests >= config.concurrency.maxConcurrent) {
      return res.status(503).send(config.concurrency.busyMessage);
    }
    activeRequests++;
    activeRequestsGauge.set(activeRequests);
    res.on("finish", () => {
      activeRequests--;
      activeRequestsGauge.set(activeRequests);
    });
    next();
  });

  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
  });

  app.use(express.static(path.join(__dirname, "public"), staticOptions));
  app.use("/demo", createDemoRouter());

  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    });
  });

  app.use(createWorkloadRouter(config));
  app.use(createAuthRouter(config));
  app.use(createDataRouter());
  app.use(createSystemRouter({ startedAt, getActiveRequests: () => activeRequests, register }));

  return app;
}
