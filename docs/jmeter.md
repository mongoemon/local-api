# JMeter Guide

หน้านี้เรียงตามลำดับการสร้าง test plan สำหรับผู้เริ่มต้น

## Learn In This Order

1. ตั้ง `HTTP Request Defaults`
2. ลอง endpoint เดี่ยวให้ผ่านก่อน
3. สร้าง demo transaction flow
4. เพิ่ม extractor และ variable chaining
5. เพิ่ม controller ตามเป้าหมาย
6. ค่อยขยายไปเป็น load test

## Step 1: Base Test Plan

```text
Test Plan
├─ User Defined Variables
├─ HTTP Request Defaults
├─ Thread Group
│  ├─ HTTP Request
│  └─ View Results Tree
└─ Summary Report
```

ตั้งค่าแนะนำ:

- Protocol: `http`
- Server: `localhost`
- Port: `3001`
- Threads: `1`
- Ramp-Up: `1`
- Loop Count: `1`

ใช้โครงสร้างนี้เพื่อลอง endpoint เดี่ยว เช่น:

- `/demo/dashboard`
- `/fast`
- `/prep`

ค่าที่ควรอยู่ใน `User Defined Variables` ตั้งแต่ต้น:

- `protocol=http`
- `host=localhost`
- `port=3001`
- `acceptHeader=application/json`
- `contentType=application/json`

เหตุผล:

- เปลี่ยน environment ได้จากจุดเดียว
- ใช้ร่วมกับ `HTTP Request Defaults` และ `HTTP Header Manager` ได้ง่าย

## Step 2: Demo Transaction Flow

เมื่อ endpoint เดี่ยวผ่านแล้ว ให้ขยับเป็น flow นี้

```text
Test Plan
├─ HTTP Request Defaults
├─ Thread Group
│  └─ Transaction Controller - Demo Commerce Flow
│     ├─ HTTP Request - demo context
│     │  └─ JSON Extractor
│     ├─ HTTP Request - demo dashboard
│     ├─ HTTP Request - demo search
│     ├─ HTTP Request - product details
│     ├─ HTTP Request - add to cart
│     ├─ HTTP Request - checkout
│     │  └─ JSON Extractor
│     └─ HTTP Request - order status
├─ View Results Tree
└─ Summary Report
```

เปิด `Generate parent sample` ที่ `Transaction Controller`

ลำดับ request:

1. `GET /demo/context?search=mouse`
2. `GET /demo/dashboard`
3. `GET /demo/search?q=${demoSearchTerm}`
4. `GET /demo/product/details?productId=${demoProductId}`
5. `POST /demo/cart/add`
6. `POST /demo/checkout`
7. `GET /demo/order/status?orderId=${demoOrderId}`

## Step 3: Extract Values From JSON

ค่าที่ควร extract จาก `/demo/context`

- `$.cartId -> demoCartId`
- `$.shopperId -> demoShopperId`
- `$.recommendedProductId -> demoProductId`
- `$.searchTerm -> demoSearchTerm`

ค่าที่ควร extract จาก `/demo/checkout`

- `$.orderId -> demoOrderId`

ตัวอย่าง `JSON Extractor`

- Names of created variables: `demoOrderId`
- JSON Path expressions: `$.orderId`
- Match No.: `1`
- Default Values: `NOT_FOUND`

## Step 3.1: Add User Defined Variables First

ถ้าต้องการให้ flow เริ่มได้เร็วและยังเป็นระเบียบ ให้ตั้ง `User Defined Variables` ไว้ก่อน

ค่าที่แนะนำสำหรับระบบนี้:

- `protocol=http`
- `host=localhost`
- `port=3001`
- `acceptHeader=application/json`
- `contentType=application/json`
- `demoSearchTerm=mouse`
- `demoProductId=sku-101`
- `demoCartId=demo-cart`
- `demoShopperId=demo-user-01`
- `demoQuantity=1`
- `demoAuthToken=lab-token`
- `demoLanguage=en`
- `demoOrderId=NOT_SET`

เหตุผล:

- `mouse` ค้นหาแล้วเจอ product demo
- `sku-101` เป็น product demo ที่มีอยู่จริง
- `demo-cart` และ `demo-user-01` ใช้เป็น fallback ก่อนมี extractor
- `lab-token` ตรงกับค่า default ของ `/protected`
- `en` เป็นภาษาเริ่มต้นที่อ่านง่ายที่สุด และเปลี่ยนเป็น `th` ได้จาก `Accept-Language`
- `NOT_SET` ช่วยให้เห็นชัดว่า `demoOrderId` ยังไม่พร้อมใช้งาน

สิ่งที่ควรแยกตามหน้าที่:

- infrastructure defaults: `protocol`, `host`, `port`
- shared headers: `acceptHeader`, `contentType`
- business defaults: `demoSearchTerm`, `demoProductId`, `demoCartId`, `demoShopperId`
- auth defaults: `demoAuthToken`
- locale defaults: `demoLanguage`
- runtime placeholders: `demoOrderId`

แนวทางใช้งาน:

- เริ่มจากค่าพวกนี้ก่อนเพื่อ proof of concept
- เมื่อใช้ `JSON Extractor` แล้ว ให้ค่าจาก response มา override ตัวแปรเดิม
- `demoOrderId` ไม่ควรถูก hardcode ใช้จริง ควรให้ `/demo/checkout` สร้างให้

## Step 4: Send JSON Body Correctly

สำหรับ `POST /demo/cart/add`

- Header: `Content-Type: application/json`
- Body:

```json
{
  "cartId": "${demoCartId}",
  "productId": "${demoProductId}",
  "quantity": 1
}
```

สำหรับ `POST /demo/checkout`

- Header: `Content-Type: application/json`
- Body:

```json
{
  "cartId": "${demoCartId}",
  "customerId": "${demoShopperId}"
}
```

## Step 4.1: Recommended HTTP Header Structure

ค่า header ที่ควรใช้เป็นโครงสร้างพื้นฐาน:

- `Accept=${acceptHeader}`
- `Accept-Language=${demoLanguage}`
- `Content-Type=${contentType}` สำหรับ JSON POST
- `x-access-token=${demoAuthToken}` หรือ `Authorization=Bearer ${demoAuthToken}` สำหรับ `/protected`

แนวทางวาง header:

- วาง `Accept` ไว้ระดับ Test Plan หรือ Thread Group ถ้า request ส่วนใหญ่เป็น JSON
- วาง `Accept-Language` ไว้ระดับ Test Plan หรือ Thread Group ถ้าทั้ง flow ใช้ภาษาเดียวกัน
- วาง `Content-Type` ไว้เฉพาะ sampler ที่ส่ง JSON body
- วาง auth header ไว้เฉพาะ sampler ที่ต้องใช้ token

เหตุผล:

- ลดการ hardcode
- ลดความเสี่ยงที่ GET จะได้ header ที่ไม่จำเป็น
- ทำให้แก้ token หรือ content type จากจุดเดียวได้

## Step 5: Add Useful Controllers

### Transaction Controller

ใช้เมื่อ:

- อยากวัดเวลารวมของ flow
- อยากอ่านผลเป็น business transaction

### Throughput Controller

ใช้เมื่อ:

- อยากให้บาง flow เกิดแค่บางส่วนของ traffic
- เช่น user ทุกคน browse แต่มีแค่บางส่วนที่ checkout

ตัวอย่าง:

```text
Thread Group
├─ Transaction Controller - Browse Flow
├─ Throughput Controller - Cart Flow (40%)
│  └─ Transaction Controller - Add And Checkout
└─ If Controller - if demoOrderId exists
   └─ HTTP Request - order status
```

ข้อสำคัญ:

- ถ้าใช้แบบ `Percent Executions`
- `40` คือ `40%`
- `100` คือ `100%`
- `1.0` ไม่ใช่ `100%`

### If Controller

ใช้เมื่อ:

- request ถัดไปต้องอาศัยค่าจาก response ก่อนหน้า
- เช่น `order status` ต้องมี `orderId`

เงื่อนไขตัวอย่าง:

```text
${__groovy(vars.get("demoOrderId") != null && vars.get("demoOrderId") != "NOT_FOUND" && !vars.get("demoOrderId").isEmpty())}
```

### JSR223 PreProcessor

ใช้เมื่อ:

- อยากสร้าง variable ก่อนยิง request
- อยากเปลี่ยน query หรือ body แบบ dynamic

ตัวอย่าง:

```groovy
vars.put("prepPrefix", "test-" + System.currentTimeMillis())
```

### tearDown Thread Group

ใช้เมื่อ:

- ต้องล้างข้อมูลหลังจบ test

```text
tearDown Thread Group
└─ HTTP Request - POST /cleanup
```

## Step 6: Move From Functional To Load Test

ใช้ลำดับนี้:

1. `1 user`, `1 loop`
2. `5 users`, `5 loops`
3. `10-20 users` เพื่อเก็บ baseline
4. ค่อยเพิ่มไป load, stress, spike, endurance

ตัวอย่าง baseline สำหรับ demo flow:

- Threads: `5`
- Ramp-Up: `5 sec`
- Loop Count: `10`

## What To Measure

- parent sample ของ `Transaction Controller`
- response time ของแต่ละ step
- error rate
- sample count ของ flow ที่อยู่ใต้ `Throughput Controller`

## SLA By Test Type

SLA ไม่ควรถูกดูแบบเหมารวมทุก test type

| Test Type | Should You Use It For SLA? | What It Usually Proves |
| --- | --- | --- |
| `Load Test` | ใช่ เป็นตัวหลัก | ระบบยังผ่าน SLA ภายใต้ expected traffic จริงหรือไม่ |
| `Stress Test` | ใช้ได้ แต่เป็น threshold SLA | ระบบเริ่ม degrade หรือ fail ที่โหลดระดับไหน |
| `Spike Test` | ใช้ได้ ถ้า SLA พูดถึง peak หรือ recovery | ระบบรับโหลดพุ่งเร็วได้ไหม และ recover กลับมาในกี่วินาที |
| `Endurance Test` | ใช้ได้ ถ้า SLA พูดถึง stability | SLA ยังนิ่งหรือ drift เมื่อรันนาน ๆ |

## SLA Statement To Test Type Mapping

| If The SLA Says | Use This Test Type First | Why |
| --- | --- | --- |
| รองรับผู้ใช้หรือ request ในภาวะปกติ | `Load Test` | เป็นการพิสูจน์ target หลักใน expected traffic |
| ห้ามพังแม้โหลดสูงกว่าปกติ | `Stress Test` | ใช้หา degradation point และ failure threshold |
| ต้องทน traffic peak หรือ flash sale | `Spike Test` | ใช้จำลอง load ที่ขึ้นเร็วผิดปกติ |
| ต้องนิ่งตลอดวันหรือหลายชั่วโมง | `Endurance Test` | ใช้จับ latency drift, leak, และ stability ปลายรอบ |

## Practical SLA Statements

| Example SLA Statement | Recommended Test Type | What To Measure |
| --- | --- | --- |
| Under normal weekday traffic, product search must complete with `p95 < 700 ms` and error rate below `1%`. | `Load Test` | `/demo/search` percentile and error % at expected user/rate level |
| At expected business load, the full checkout journey must complete within `1.5 s` for `95%` of users. | `Load Test` | parent sample ของ `Transaction Controller - Add And Checkout` |
| The service must remain available until at least `80 concurrent users`; after that point graceful degradation is acceptable. | `Stress Test` | จุดที่ error rate เริ่มสูงหรือ latency breach เมื่อเพิ่ม concurrency |
| During campaign launch, traffic may jump to `3x` normal within one minute, and the API must recover within `2 minutes`. | `Spike Test` | latency jump, error burst, และ recovery time หลัง spike |
| The platform must keep `p95 < 900 ms` for browsing traffic throughout an `8-hour` business window. | `Endurance Test` | percentile trend ตลอดช่วงเวลา ไม่ใช่แค่ต้นรอบ |
| No more than `40%` of browse sessions should proceed to cart and checkout in the standard usage model. | `Load Test` with `Throughput Controller` | sample count ของ browse flow เทียบกับ cart flow |

## SLA Statement To Metric To JMeter Component

| SLA Statement Type | Main Metric | Main JMeter Component | Pass/Fail Example |
| --- | --- | --- | --- |
| dashboard/search ต้องเร็ว | `p95`, `error %` | `Aggregate Report` | pass ถ้า `95% < 700 ms` และ error `< 1%` |
| checkout journey ต้องเร็ว | transaction `p95` | `Transaction Controller` parent sample | pass ถ้า flow รวม `< 1.5 s` ที่โหลดที่ระบุ |
| traffic mix ต้องใกล้ usage จริง | flow count ratio | `Throughput Controller` + report sample count | pass ถ้า cart flow ใกล้ `40%` ของ browse flow |
| ต้องไม่พังก่อนถึง concurrency เป้าหมาย | error threshold, latency breach point | `Concurrency Thread Group` + `Aggregate Report` | pass ถ้าก่อน `80 users` ยังไม่ breach target |
| ต้อง recover หลัง peak | recovery time, post-spike error/latency | `Stepping` หรือ `Concurrency` + trend reports | pass ถ้ากลับสู่ target ภายในเวลาที่กำหนด |
| ต้องนิ่งตลอดหลายชั่วโมง | p95 drift, throughput drift, error drift | `Backend Listener`, `Summary Report`, `Aggregate Report` | pass ถ้าปลายรอบยังอยู่ใน target |

## Example Analysis

```text
Statement
"At expected business load, the full checkout journey must complete within 1.5 s for 95% of users."

Analysis
- This is a user journey statement, not a single endpoint statement
- Main metric is transaction p95
- Main test type is Load Test
- Best component is Transaction Controller parent sample
- Pass only if tested at expected load, not at 1 user only
```

```text
Statement
"The service must remain available until at least 80 concurrent users; after that point graceful degradation is acceptable."

Analysis
- This is a capacity threshold statement
- Main test type is Stress Test
- Best thread group is Concurrency Thread Group
- Pass if the system still meets availability/error target below 80 concurrent users
- After 80, slower response or some rejection may be acceptable depending on the statement
```

```text
Statement
"During campaign launch, traffic may jump to 3x normal within one minute, and the API must recover within 2 minutes."

Analysis
- This is not a normal SLA-only statement
- Main test type is Spike Test
- Focus on error burst, percentile jump, and recovery window
- Pass only if the system returns to acceptable latency/error within the stated recovery time
```

## Next Step

- จะเลือก thread group: [Test Matrix And Thread Groups](./test-matrix.md)
- จะดู endpoint และ response ก่อน: [Endpoints And Responses](./endpoints.md)
