import express from "express";

export function createSystemRouter({ startedAt, getActiveRequests, register }) {
  const router = express.Router();

  router.get("/error", (req, res) => {
    res.status(500).json({
      error: "intentional server error",
      message: "This endpoint is designed to simulate an HTTP 500 response"
    });
  });

  router.get("/status", (req, res) => {
    res.json({
      status: "running",
      running: true,
      pid: process.pid,
      startedAt: startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      activeRequests: getActiveRequests()
    });
  });

  router.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  return router;
}
