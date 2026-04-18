# Test Matrix And Thread Groups

หน้านี้เป็น reference หลังจากคุณสร้าง flow ใน JMeter ผ่านแล้ว

## 1. Choose The Right Thread Group

| Thread Group | เหมาะกับ | ใช้เมื่อ | ไม่ใช่ตัวเลือกแรกเมื่อ |
| --- | --- | --- | --- |
| `Normal` | baseline, debug, simple SLA | อยากเริ่มง่ายและดู flow ให้ผ่านก่อน | ต้องคุม concurrency หรือ arrival rate |
| `Concurrency` | stress, saturation, active sessions | อยากคุมจำนวน concurrent users | แค่จะ debug request ธรรมดา |
| `Stepping` | spike, threshold | อยากรู้ว่าระบบเริ่ม fail ที่ step ไหน | อยากคุม rate ต่อวินาที |
| `Arrival` | steady traffic, open workload | อยากคุม workload แบบ requests/sec | อยากคุม active sessions โดยตรง |

## 2. Match Thread Group To Test Type

| Test Type | Recommended Thread Group | Goal |
| --- | --- | --- |
| `Load` | `Normal`, `Concurrency`, `Arrival` | ดูว่าระบบยังผ่าน SLA ภายใต้โหลดปกติหรือไม่ |
| `Stress` | `Concurrency` | หา limit และ saturation point |
| `Spike` | `Stepping`, `Concurrency` | ดูผลเมื่อ traffic พุ่งเร็ว |
| `Endurance` | `Normal`, `Concurrency`, `Arrival` | ดู degradation ระยะยาว |

## 3. Recommended Structures

### Load Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Thread Group or Concurrency Thread Group or Arrival Thread Group
│  ├─ Transaction Controller - Browse Flow
│  ├─ Throughput Controller - Cart Flow
│  └─ If Controller - order status
├─ Summary Report
└─ Aggregate Report
```

ค่าเริ่มต้น:

- `Normal`: `10-30 users`, `20-60 sec ramp-up`, `50-200 loops`
- `Concurrency`: target `20-50`, hold `300 sec`
- `Arrival`: target `10-30/sec`, hold `300 sec`

### Stress Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Concurrency Thread Group
│  ├─ target endpoint or transaction flow
│  ├─ Summary Report
│  └─ Aggregate Report
├─ tearDown Thread Group
│  └─ HTTP Request - cleanup
└─ View Results Tree
```

ค่าเริ่มต้น:

- target concurrency `20`
- ramp-up `60 sec`
- steps `5`
- hold `120 sec`

แล้วค่อยเพิ่ม `20 -> 50 -> 100`

### Spike Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Stepping Thread Group or Concurrency Thread Group
│  ├─ target endpoint or transaction flow
│  ├─ Summary Report
│  └─ Aggregate Report
└─ View Results Tree
```

ค่าเริ่มต้น:

- `Stepping`: `20-50 users per step`, `5 sec step period`, `30-60 sec flight time`
- `Concurrency`: target `50-150`, ramp-up `10-30 sec`

### Endurance / Soak Test

```text
Test Plan
├─ HTTP Request Defaults
├─ Thread Group or Concurrency Thread Group or Arrival Thread Group
│  ├─ target endpoint or demo flow
│  ├─ Summary Report
│  └─ Backend Listener
├─ tearDown Thread Group
│  └─ HTTP Request - cleanup
└─ View Results Tree
```

ค่าเริ่มต้น:

- `Normal`: `20-50 users`, duration `30-120 min`
- `Concurrency`: target `20-40`, hold `30-120 min`
- `Arrival`: target `5-15/sec`, hold `30-120 min`

## 4. Endpoint To Test Type Mapping

| Endpoint / Flow | Best Test Types | What You Usually Watch |
| --- | --- | --- |
| `/fast` | load, endurance, rate limit | p95, throughput, 429 |
| `/slow` | load, endurance | latency drift |
| `/busy` | stress, spike | 503, saturation |
| `/cpu` | stress | CPU-driven latency growth |
| `/memory` | stress, endurance | memory pressure, degradation |
| `/io?mode=write` | stress, endurance | I/O latency |
| `/demo` transaction flow | load, stress, endurance | parent sample latency, checkout ratio |
| `/protected` | functional load, auth validation | 200/401/403 split |

## 5. Quick Decision Guide

| ถ้าโจทย์คือ | ให้เริ่มจาก |
| --- | --- |
| endpoint เดี่ยวต้องผ่าน SLA | `Normal Thread Group` |
| flow ทั้งก้อนต้องวัดเวลารวม | `Transaction Controller` ใต้ `Normal Thread Group` |
| user ทุกคนไม่ checkout เหมือนกัน | เพิ่ม `Throughput Controller` |
| มี request ถัดไปที่ใช้ค่าจาก response ก่อนหน้า | เพิ่ม `If Controller` + `JSON Extractor` |
| อยากคุม concurrent sessions | `Concurrency Thread Group` |
| อยากหา break point แบบเป็นขั้น | `Stepping Thread Group` |
| อยากคุม workload แบบ requests/sec | `Arrival Thread Group` |

## 6. Suggested Reading Order

1. [Getting Started](./getting-started.md)
2. [Endpoints And Responses](./endpoints.md)
3. [JMeter Guide](./jmeter.md)
4. กลับมาที่หน้านี้เมื่อ flow ผ่านแล้ว
