# Getting Started

หน้านี้ตั้งใจให้เป็นจุดเริ่มต้นสำหรับผู้เริ่มต้นใช้งานใหม่

## 1. Run The App

ต้องมี:

- Node.js 18 ขึ้นไป
- npm

คำสั่งเริ่มต้น:

```bash
npm install
npm start
```

รัน automated tests:

```bash
npm test              # รัน test ทั้งหมดครั้งเดียว
npm run test:watch    # watch mode สำหรับ development
npm run test:coverage # พร้อม coverage report
```

ค่า default:

- App URL: `http://localhost:3001`
- Main page: `http://localhost:3001/`
- Runtime status: `http://localhost:3001/status`
- Demo learning path: `http://localhost:3001/demo.html`

## 2. Learn In This Order

1. อ่าน [Endpoints And Responses](./endpoints.md)
2. เปิด [JMeter Guide](./jmeter.md)
3. ค่อยไป [Test Matrix And Thread Groups](./test-matrix.md)

## 3. If You Prefer The Browser Pages

- `GET /` เป็นหน้า overview หลัก
- `/demo.html` เป็นหน้าเริ่มต้นสำหรับ demo flow
- `/demo-endpoints.html` เริ่มจาก endpoint
- `/demo-jmeter.html` เรียนโครงสร้าง JMeter
- `/demo-test-types.html` เลือก thread group และ test type

## 4. What To Learn First

เริ่มจาก demo flow นี้ก่อน:

1. `GET /demo/context?search=mouse`
2. `GET /demo/dashboard`
3. `GET /demo/search?q=${demoSearchTerm}`
4. `GET /demo/product/details?productId=${demoProductId}`
5. `POST /demo/cart/add`
6. `POST /demo/checkout`
7. `GET /demo/order/status?orderId=${demoOrderId}`

เหตุผล:

- มีทั้ง `GET` และ `POST`
- มีทั้ง query, body, extractor, variable chaining
- ใช้สอน `Transaction Controller`, `Throughput Controller`, `If Controller` ได้

## 5. When To Read The Other Docs

- จะตั้ง env vars: [Configuration Reference](./configuration.md)
- จะรันผ่าน container: [Docker Guide](./docker.md)
- จะหา test profile หรือ thread group: [Test Matrix And Thread Groups](./test-matrix.md)
