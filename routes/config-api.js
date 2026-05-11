import express from "express";

const DEFAULTS = {
  rateLimit: {
    enabled: false,
    windowMs: 60000,
    max: 10000
  },
  concurrency: {
    maxConcurrent: 50
  },
  workloads: {
    slowDelayMs: 200,
    busyDelayMs: 3000,
    cpuIterations: 1e7,
    memoryArraySize: 1e6,
    ioFileSizeKb: 1024
  }
};

function snapshot(config) {
  return {
    rateLimit: {
      enabled: config.rateLimit.enabled,
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max
    },
    concurrency: {
      maxConcurrent: config.concurrency.maxConcurrent
    },
    workloads: {
      slowDelayMs: config.workloads.slowDelayMs,
      busyDelayMs: config.workloads.busyDelayMs,
      cpuIterations: config.workloads.cpuIterations,
      memoryArraySize: config.workloads.memoryArraySize,
      ioFileSizeKb: config.workloads.ioFileSizeKb
    }
  };
}

export function createConfigRouter(config, onRateLimitChange) {
  const router = express.Router();

  router.get("/api/config", (_req, res) => {
    res.json({ ...snapshot(config), defaults: DEFAULTS });
  });

  router.patch("/api/config", (req, res) => {
    const { rateLimit, concurrency, workloads } = req.body;
    let needsRefresh = false;

    if (rateLimit) {
      if (typeof rateLimit.enabled === "boolean") {
        config.rateLimit.enabled = rateLimit.enabled;
        needsRefresh = true;
      }
      if (typeof rateLimit.windowMs === "number" && rateLimit.windowMs > 0) {
        config.rateLimit.windowMs = rateLimit.windowMs;
        needsRefresh = true;
      }
      if (typeof rateLimit.max === "number" && rateLimit.max > 0) {
        config.rateLimit.max = rateLimit.max;
        needsRefresh = true;
      }
    }

    if (concurrency && typeof concurrency.maxConcurrent === "number" && concurrency.maxConcurrent > 0) {
      config.concurrency.maxConcurrent = concurrency.maxConcurrent;
    }

    if (workloads) {
      if (typeof workloads.slowDelayMs === "number" && workloads.slowDelayMs >= 0) config.workloads.slowDelayMs = workloads.slowDelayMs;
      if (typeof workloads.busyDelayMs === "number" && workloads.busyDelayMs >= 0) config.workloads.busyDelayMs = workloads.busyDelayMs;
      if (typeof workloads.cpuIterations === "number" && workloads.cpuIterations >= 0) config.workloads.cpuIterations = workloads.cpuIterations;
      if (typeof workloads.memoryArraySize === "number" && workloads.memoryArraySize >= 0) config.workloads.memoryArraySize = workloads.memoryArraySize;
      if (typeof workloads.ioFileSizeKb === "number" && workloads.ioFileSizeKb > 0) config.workloads.ioFileSizeKb = workloads.ioFileSizeKb;
    }

    if (needsRefresh) onRateLimitChange();
    res.json({ ok: true, config: snapshot(config) });
  });

  router.post("/api/config/reset", (_req, res) => {
    Object.assign(config.rateLimit, DEFAULTS.rateLimit);
    Object.assign(config.concurrency, DEFAULTS.concurrency);
    Object.assign(config.workloads, DEFAULTS.workloads);
    onRateLimitChange();
    res.json({ ok: true, config: snapshot(config) });
  });

  return router;
}
