# Configuration Reference

## Supported Environment Variables

| Env | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | server port |
| `AUTH_BEARER_TOKEN` | `lab-token` | token used with `/protected` |
| `JWT_SECRET` | `local-api-jwt-secret` | secret key for signing/verifying JWT in `/auth/login` and `/auth/verify` |
| `RATE_LIMIT_ENABLED` | `false` | enable/disable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `60000` | rate limit time window |
| `RATE_LIMIT_MAX` | `10000` | maximum number of requests per window |
| `RATE_LIMIT_MESSAGE` | `Too many requests, please try again later` | 429 response message |
| `MAX_CONCURRENT` | `50` | maximum number of concurrent requests |
| `SERVER_BUSY_MESSAGE` | `Server too busy` | 503 response message |
| `SLOW_DELAY_MS` | `200` | delay for `/slow` |
| `BUSY_DELAY_MS` | `3000` | delay for `/busy` |
| `CPU_ITERATIONS` | `1e7` | workload for `/cpu` |
| `MEMORY_ARRAY_SIZE` | `1e6` | workload for `/memory` |
| `MEMORY_FILL_VALUE` | `test` | value used to fill the `/memory` array |
| `IO_FILE_SIZE_KB` | `1024` | file size for `/io` |
| `IO_CHUNK_VALUE` | `x` | character used to generate the `/io` file |

## Example

```powershell
$env:PORT=4000
$env:AUTH_BEARER_TOKEN="demo-secret"
$env:JWT_SECRET="my-secure-jwt-secret"
$env:MAX_CONCURRENT=20
$env:BUSY_DELAY_MS=3000
$env:CPU_ITERATIONS=50000000
$env:MEMORY_ARRAY_SIZE=2000000
$env:IO_FILE_SIZE_KB=4096
npm start
```
