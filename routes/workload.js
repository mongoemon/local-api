import express from "express";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";

const tempDir = path.join(process.cwd(), "tmp");
const ioFilePath = path.join(tempDir, "io-test.dat");

export function createWorkloadRouter(config) {
  const router = express.Router();

  router.get("/fast", (req, res) => {
    res.json({ message: "fast response" });
  });

  router.get("/slow", async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, config.workloads.slowDelayMs));
    res.json({ message: `slow response (${config.workloads.slowDelayMs}ms)` });
  });

  router.get("/busy", async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, config.workloads.busyDelayMs));
    res.json({ message: `busy response (${config.workloads.busyDelayMs}ms)` });
  });

  router.get("/cpu", (req, res) => {
    let sum = 0;
    for (let i = 0; i < config.workloads.cpuIterations; i++) {
      sum += i;
    }
    res.json({ result: sum, iterations: config.workloads.cpuIterations });
  });

  router.get("/memory", (req, res) => {
    const arr = new Array(config.workloads.memoryArraySize).fill(config.workloads.memoryFillValue);
    res.json({ size: arr.length });
  });

  router.get("/io", async (req, res) => {
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

  router.post("/cleanup", async (req, res) => {
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

  return router;
}
