# Configuration Reference

## Supported Environment Variables

| Env | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | port ของ server |
| `AUTH_BEARER_TOKEN` | `lab-token` | token ที่ใช้กับ `/protected` |
| `RATE_LIMIT_ENABLED` | `false` | เปิด/ปิด rate limit |
| `RATE_LIMIT_WINDOW_MS` | `60000` | ช่วงเวลา rate limit |
| `RATE_LIMIT_MAX` | `10000` | จำนวน request สูงสุดต่อ window |
| `RATE_LIMIT_MESSAGE` | `Too many requests, please try again later` | ข้อความ 429 |
| `MAX_CONCURRENT` | `50` | จำนวน request พร้อมกันสูงสุด |
| `SERVER_BUSY_MESSAGE` | `Server too busy` | ข้อความ 503 |
| `SLOW_DELAY_MS` | `200` | delay ของ `/slow` |
| `BUSY_DELAY_MS` | `3000` | delay ของ `/busy` |
| `CPU_ITERATIONS` | `1e7` | workload ของ `/cpu` |
| `MEMORY_ARRAY_SIZE` | `1e6` | workload ของ `/memory` |
| `MEMORY_FILL_VALUE` | `test` | ค่าใน array ของ `/memory` |
| `IO_FILE_SIZE_KB` | `1024` | ขนาดไฟล์ของ `/io` |
| `IO_CHUNK_VALUE` | `x` | ตัวอักษรที่ใช้สร้างไฟล์ของ `/io` |

## Example

```powershell
$env:PORT=4000
$env:AUTH_BEARER_TOKEN="demo-secret"
$env:MAX_CONCURRENT=20
$env:BUSY_DELAY_MS=3000
$env:CPU_ITERATIONS=50000000
$env:MEMORY_ARRAY_SIZE=2000000
$env:IO_FILE_SIZE_KB=4096
npm start
```
