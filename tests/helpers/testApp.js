import { createApp } from "../../app.js";

export const testConfig = {
  server: { port: 0 },
  auth: {
    bearerToken: "test-token",
    jwtSecret: "test-secret"
  },
  rateLimit: {
    enabled: false,
    windowMs: 60000,
    max: 10000,
    message: "Too many requests"
  },
  concurrency: {
    maxConcurrent: 50,
    busyMessage: "Server too busy"
  },
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

export function createTestApp() {
  return createApp(testConfig);
}
