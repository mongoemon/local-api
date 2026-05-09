# Documentation Index

เอกสารถูกแยกเป็น 2 กลุ่ม:

- `Learning Path` สำหรับผู้เริ่มต้น
- `Reference` สำหรับเปิดดูเฉพาะเรื่อง

## Learning Path

1. [Getting Started](./getting-started.md)
2. [Endpoints And Responses](./endpoints.md)
3. [JMeter Guide](./jmeter.md)
4. [Test Matrix And Thread Groups](./test-matrix.md)

## Reference

- [Configuration Reference](./configuration.md)
- [Authentication Guide](./authentication.md)
- [Testing Guide](./testing.md)
- [Docker Guide](./docker.md)

## Recommended Order For New Users

1. รันแอปให้ขึ้นก่อน
2. ลองเรียก endpoint ทีละเส้น
3. สร้าง JMeter flow แบบ `1 user`
4. เพิ่ม controller เช่น `Transaction Controller`, `Throughput Controller`, `If Controller`
5. ค่อยเลือก test type เช่น `load`, `stress`, `spike`, `endurance`
