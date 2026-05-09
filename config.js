export function getNumberEnv(name, defaultValue) {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function getBooleanEnv(name, defaultValue) {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const config = {
  server: {
    port: getNumberEnv("PORT", 3001)
  },
  auth: {
    bearerToken: process.env.AUTH_BEARER_TOKEN || "lab-token",
    jwtSecret: process.env.JWT_SECRET || "local-api-jwt-secret"
  },
  rateLimit: {
    enabled: getBooleanEnv("RATE_LIMIT_ENABLED", false),
    windowMs: getNumberEnv("RATE_LIMIT_WINDOW_MS", 60 * 1000),
    max: getNumberEnv("RATE_LIMIT_MAX", 10000),
    message: process.env.RATE_LIMIT_MESSAGE || "Too many requests, please try again later"
  },
  concurrency: {
    maxConcurrent: getNumberEnv("MAX_CONCURRENT", 50),
    busyMessage: process.env.SERVER_BUSY_MESSAGE || "Server too busy"
  },
  workloads: {
    slowDelayMs: getNumberEnv("SLOW_DELAY_MS", 200),
    busyDelayMs: getNumberEnv("BUSY_DELAY_MS", 3000),
    cpuIterations: getNumberEnv("CPU_ITERATIONS", 1e7),
    memoryArraySize: getNumberEnv("MEMORY_ARRAY_SIZE", 1e6),
    memoryFillValue: process.env.MEMORY_FILL_VALUE || "test",
    ioFileSizeKb: getNumberEnv("IO_FILE_SIZE_KB", 1024),
    ioChunkValue: process.env.IO_CHUNK_VALUE || "x"
  }
};
