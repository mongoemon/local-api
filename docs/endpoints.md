# Endpoints And Responses

หน้านี้เรียงจากสิ่งที่ผู้เริ่มต้นควรรู้ก่อน:

1. demo transaction flow
2. helpers สำหรับ JMeter
3. performance workload endpoints
4. runtime and monitoring endpoints

## Demo Transaction Flow

ลำดับที่แนะนำ:

1. `GET /demo/context?search=mouse`
2. `GET /demo/dashboard`
3. `GET /demo/search?q=${demoSearchTerm}`
4. `GET /demo/product/details?productId=${demoProductId}`
5. `POST /demo/cart/add`
6. `POST /demo/checkout`
7. `GET /demo/order/status?orderId=${demoOrderId}`

### `GET /demo/context`

ใช้เตรียมค่าเริ่มต้นให้ flow เช่น `cartId`, `shopperId`, `searchTerm`, `recommendedProductId`
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

```json
{
  "message": "demo context prepared",
  "shopperId": "shopper-550e8400-e29b-41d4-a716-446655440000",
  "cartId": "cart-550e8400-e29b-41d4-a716-446655440000",
  "searchTerm": "mouse",
  "recommendedProductId": "sku-101",
  "couponCode": "WELCOME10"
}
```

### `GET /demo/dashboard`

ใช้เป็นหน้า landing ของ flow
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

```json
{
  "message": "demo dashboard loaded"
}
```

### `GET /demo/search`

ต้องส่ง query `q`
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

```json
{
  "message": "demo search completed",
  "query": "mouse",
  "count": 1
}
```

### `GET /demo/product/details`

ต้องส่ง query `productId`
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

success:

```json
{
  "message": "product details loaded",
  "product": {
    "id": "sku-101",
    "name": "Wireless Mouse",
    "price": 24.5
  }
}
```

error:

```json
{ "error": "missing_required_parameter", "required": ["productId"] }
```

```json
{ "error": "product_not_found", "productId": "sku-999" }
```

### `POST /demo/cart/add`

ต้องส่ง JSON body และ header `Content-Type: application/json`
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

body ที่แนะนำ:

```json
{
  "cartId": "${demoCartId}",
  "productId": "${demoProductId}",
  "quantity": 1
}
```

success:

```json
{
  "message": "item added to cart"
}
```

error:

```json
{ "error": "missing_required_parameter", "required": ["productId"] }
```

```json
{ "error": "invalid_quantity", "message": "quantity must be a positive integer" }
```

### `POST /demo/checkout`

ต้องส่ง JSON body และ header `Content-Type: application/json`
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

body ที่แนะนำ:

```json
{
  "cartId": "${demoCartId}",
  "customerId": "${demoShopperId}"
}
```

success:

```json
{
  "message": "checkout completed",
  "orderId": "ord-550e8400-e29b-41d4-a716-446655440000"
}
```

error:

```json
{ "error": "empty_cart", "message": "Add at least one item before checkout" }
```

### `GET /demo/order/status`

ใช้หลัง checkout โดยส่ง query `orderId`
รองรับ header `Accept-Language: en` หรือ `Accept-Language: th`

success:

```json
{
  "message": "order status loaded",
  "status": "confirmed"
}
```

error:

```json
{ "error": "missing_required_parameter", "required": ["orderId"] }
```

```json
{ "error": "order_not_found", "orderId": "ord-unknown" }
```

## JWT Authentication

### `POST /auth/login`

ใช้รับ JWT token ด้วย demo credentials

```json
{ "username": "demo", "password": "password" }
```

success:

```json
{
  "message": "login successful",
  "authenticated": true,
  "token": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": "24 hours",
  "user": { "userId": "user-123", "username": "demo" }
}
```

error:

```json
{ "error": "missing_credentials" }
```

```json
{ "error": "invalid_credentials" }
```

### `POST /auth/verify`

ส่ง header `Authorization: Bearer <token>` หรือ `x-access-token: <token>`

success:

```json
{
  "message": "token is valid",
  "valid": true,
  "decoded": { "userId": "user-123", "username": "demo", "iat": "...", "exp": "..." }
}
```

error:

```json
{ "error": "missing_token" }
```

```json
{ "error": "token_expired", "expiredAt": "..." }
```

```json
{ "error": "invalid_token" }
```

ดูรายละเอียดเพิ่มเติม: [Authentication Guide](./authentication.md)

## Helpers For JMeter

### `GET /prep`

ใช้สอน `PreProcessor` และ `JSON Extractor`

```json
{
  "message": "preprocessor seed generated",
  "requestId": "prep-550e8400-e29b-41d4-a716-446655440000",
  "token": "lab-token",
  "authorizationHeader": "Bearer lab-token",
  "nextEndpoint": "/protected"
}
```

### `GET /protected`

ใช้สอน token flow

success:

```json
{
  "message": "protected resource access granted",
  "authenticated": true
}
```

error:

```json
{ "error": "missing_token" }
```

```json
{ "error": "invalid_token" }
```

### `POST /submit-one`

success:

```json
{ "message": "received one required parameter", "data": { "name": "demo" } }
```

error:

```json
{ "error": "missing_required_parameter", "required": ["name"] }
```

### `POST /submit-two`

success:

```json
{ "message": "received two required parameters", "data": { "name": "demo", "type": "load-test" } }
```

error:

```json
{ "error": "missing_required_parameters", "required": ["name", "type"] }
```

### `POST /cleanup`

ใช้กับ `tearDown Thread Group`

```json
{
  "message": "cleanup completed",
  "cleanedCount": 1
}
```

## Performance Workload Endpoints

### `GET /fast`

```json
{ "message": "fast response" }
```

### `GET /slow`

```json
{ "message": "slow response (200ms)" }
```

delay มาจาก `SLOW_DELAY_MS`

### `GET /busy`

success:

```json
{ "message": "busy response (3000ms)" }
```

overload (503 — plain text, not JSON):

```
Server too busy
```

### `GET /cpu`

```json
{ "result": 49999995000000, "iterations": 10000000 }
```

### `GET /memory`

```json
{ "size": 1000000 }
```

### `GET /io?mode=read|write`

```json
{
  "message": "io write completed",
  "mode": "write",
  "fileSizeKb": 1024,
  "durationMs": 42
}
```

### `GET /error`

```json
{
  "error": "intentional server error",
  "message": "This endpoint is designed to simulate an HTTP 500 response"
}
```

## Runtime And Monitoring Endpoints

### `GET /status`

```json
{
  "status": "running",
  "running": true,
  "activeRequests": 0
}
```

### `GET /metrics`

ตอบกลับเป็น Prometheus text format

## Where To Go Next

- ถ้าจะต่อเป็น JMeter flow: [JMeter Guide](./jmeter.md)
- ถ้าจะเลือก thread group และ test type: [Test Matrix And Thread Groups](./test-matrix.md)
