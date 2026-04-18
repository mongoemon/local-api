# Docker Guide

## Build

```bash
docker build -t local-api:latest -f dockerfile .
```

## Run

```bash
docker run --rm -p 3001:3001 local-api:latest
```

## Run พร้อม env vars

```bash
docker run --rm -p 3001:3001 -e MAX_CONCURRENT=20 -e BUSY_DELAY_MS=3000 local-api:latest
```

## Rebuild หลังแก้ไฟล์

```bash
docker build -t local-api:latest -f dockerfile .
docker run --rm -p 3001:3001 local-api:latest
```

## เช็กว่า container ยังรันอยู่ไหม

```bash
docker ps
```

```bash
docker ps --filter "name=local-api"
```

```bash
docker inspect -f "{{.State.Status}}" local-api-test
```

## ดู log

```bash
docker run --name local-api-test -p 3001:3001 local-api:latest
```

```bash
docker logs -f local-api-test
```

## ปิดการใช้งาน

- ถ้ารันอยู่ใน terminal เดิม: `Ctrl + C`

```bash
docker stop local-api-test
```

```bash
docker kill local-api-test
```

```bash
docker rm local-api-test
```

## Bottleneck Commands

CPU bottleneck:

```bash
docker run --rm -p 3001:3001 --cpus="0.5" -e CPU_ITERATIONS=50000000 local-api:latest
```

Memory bottleneck:

```bash
docker run --rm -p 3001:3001 --memory="256m" -e MEMORY_ARRAY_SIZE=3000000 local-api:latest
```

Concurrency / backpressure:

```bash
docker run --rm -p 3001:3001 --cpus="0.5" --memory="256m" -e MAX_CONCURRENT=20 -e BUSY_DELAY_MS=3000 local-api:latest
```

I/O bottleneck:

```bash
docker run --rm -p 3001:3001 --memory="256m" -e IO_FILE_SIZE_KB=4096 local-api:latest
```

Rate limit:

```bash
docker run --rm -p 3001:3001 -e RATE_LIMIT_ENABLED=true -e RATE_LIMIT_MAX=100 -e RATE_LIMIT_WINDOW_MS=60000 local-api:latest
```
