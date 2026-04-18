# Local Performance Testing API

API ตัวอย่างสำหรับใช้ทดสอบ performance บนเครื่อง local ด้วย Express มี endpoint สำหรับจำลอง latency, concurrency pressure, CPU, memory, I/O, validation error, auth flow, health check และ metrics

## Quick Start

สิ่งที่ต้องมี:

- Node.js 18 ขึ้นไป
- npm
- Docker ถ้าจะรันผ่าน container

ติดตั้งและรัน:

```bash
npm install
npm start
```

ค่า default:

- URL: `http://localhost:3001`
- หน้าเว็บหลัก: `http://localhost:3001/`
- เช็กว่ายังรันอยู่: `http://localhost:3001/status`

## Start / Status / Stop

รัน:

```bash
npm start
```

เช็กสถานะ:

- เปิด `http://localhost:3001/status`
- หรือเปิดหน้า `/` แล้วดู `Runtime Status`

ปิด:

- ใน terminal เดิมกด `Ctrl + C`

## Documentation

สำหรับผู้เริ่มต้น:

- [Documentation Index](d:/local-api/docs/index.md)
- [Getting Started](d:/local-api/docs/getting-started.md)
- [Endpoints And Responses](d:/local-api/docs/endpoints.md)
- [JMeter Guide](d:/local-api/docs/jmeter.md)
- [Test Matrix And Thread Groups](d:/local-api/docs/test-matrix.md)

สำหรับ feature-specific:

- [JWT Authentication](d:/local-api/docs/authentication.md)
- [Demo E-Commerce Endpoints](d:/local-api/docs/demo-endpoints.md)

สำหรับ reference:

- [Configuration Reference](d:/local-api/docs/configuration.md)
- [Docker Guide](d:/local-api/docs/docker.md)

## Recommended Reading Order

1. [Getting Started](d:/local-api/docs/getting-started.md)
2. [Endpoints And Responses](d:/local-api/docs/endpoints.md)
3. [JWT Authentication](d:/local-api/docs/authentication.md) - New! Token-based auth
4. [Demo E-Commerce Endpoints](d:/local-api/docs/demo-endpoints.md) - New! Transaction flow endpoints
5. [JMeter Guide](d:/local-api/docs/jmeter.md)
6. [Test Matrix And Thread Groups](d:/local-api/docs/test-matrix.md)
7. [Configuration Reference](d:/local-api/docs/configuration.md) or [Docker Guide](d:/local-api/docs/docker.md)

## Beginner Learning Path In Browser

- `/demo.html` เป็นหน้าเริ่มต้น
- `/demo-endpoints.html` เริ่มจาก endpoint
- `/demo-jmeter.html` ค่อยสร้าง JMeter structure
- `/demo-test-types.html` ค่อยเลือก thread group และ test type
- `/assignment.html` สำหรับโจทย์และเฉลยทีละขั้นสำหรับผู้เริ่มต้น

## Main Endpoints

### Authentication & Security
- `POST /auth/login` - JWT token generation
- `POST /auth/verify` - Verify JWT token validity
- `GET /prep` - Generate Bearer token
- `GET /protected` - Protected resource (Bearer token validation)

### Performance & Workload Testing
- `GET /fast` - Fast response (baseline)
- `GET /slow` - Delayed response
- `GET /busy` - High concurrency pressure
- `GET /cpu` - CPU-intensive operation
- `GET /memory` - Memory allocation test
- `GET /io?mode=read|write` - I/O operations

### Validation & Error Handling
- `POST /submit-one` - Single required parameter
- `POST /submit-two` - Two required parameters
- `GET /error` - Intentional HTTP 500

### Health & Monitoring
- `GET /status` - Runtime status with metrics (pid, uptime, activeRequests)
- `GET /metrics` - Prometheus metrics

### Demo E-Commerce
- `GET /demo/context` - Context initialization
- `GET /demo/dashboard` - Fetch dashboard
- `GET /demo/search` - Product search
- `GET /demo/product/details` - Product details
- `POST /demo/cart/add` - Add to cart
- `POST /demo/checkout` - Checkout process
- `GET /demo/order/status` - Order status

### Maintenance
- `POST /cleanup` - Clean temporary files

## Project Structure

- [index.js](d:/local-api/index.js) start server
- [app.js](d:/local-api/app.js) main app และ workload endpoints
- [demo-routes.js](d:/local-api/demo-routes.js) demo commerce routes
- [config.js](d:/local-api/config.js) env-based config
- [public/index.html](d:/local-api/public/index.html) main page

## Notes

- โปรเจกต์นี้เหมาะกับ local lab / sandbox testing
- ยังไม่มี database endpoint จริง ถ้าจะวัด database metrics ต้องเพิ่ม endpoint ฝั่ง DB ก่อน
