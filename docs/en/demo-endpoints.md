# Demo E-Commerce Endpoints

The demo API simulates a complete e-commerce workflow, suitable for testing transaction flows with realistic scenarios.

## Overview

Demo routes support 2 languages: **thai (th)** and **english (en)**

Specify the language via:
- Query param: `?lang=th` or `?lang=en`
- Header: `Accept-Language: th` or `Accept-Language: en`
- Default: Auto-detect or English

## Endpoints

### 1. GET /demo/context - Initialize Demo

Starts the e-commerce workflow journey by requesting the demo context.

**Request:**
```bash
curl "http://localhost:3001/demo/context?search=mouse&lang=th"
```

**Parameters:**
- `search` (optional): Search term - default: "mouse"
- `lang` (optional): Language - "th" or "en"

**Response (200 OK):**
```json
{
  "language": "th",
  "message": "เตรียมข้อมูลเริ่มต้นของเดโมแล้ว",
  "shopperId": "shopper-a1b2c3d4-e5f6-7890-abcd",
  "cartId": "cart-x9y8z7-w6v5-u4t3-s2r1",
  "searchTerm": "mouse",
  "recommendedProductId": "sku-101",
  "couponCode": "WELCOME10",
  "nextEndpoints": {
    "dashboard": "/demo/dashboard",
    "search": "/demo/search",
    "productDetails": "/demo/product/details",
    "addToCart": "/demo/cart/add",
    "checkout": "/demo/checkout",
    "orderStatus": "/demo/order/status"
  }
}
```

---

### 2. GET /demo/dashboard - Fetch Dashboard

Returns dashboard data including featured products, categories, and metrics.

**Request:**
```bash
curl "http://localhost:3001/demo/dashboard?lang=en"
```

**Response (200 OK):**
```json
{
  "language": "en",
  "message": "demo dashboard loaded",
  "featured": [
    {
      "id": "sku-100",
      "name": "Laptop Sleeve",
      "category": "accessories",
      "price": 29.99
    },
    {
      "id": "sku-101",
      "name": "Wireless Mouse",
      "category": "electronics",
      "price": 24.5
    },
    {
      "id": "sku-102",
      "name": "Mechanical Keyboard",
      "category": "electronics",
      "price": 89.0
    }
  ],
  "categories": ["accessories", "electronics", "lifestyle", "stationery"],
  "metrics": {
    "productCount": 5,
    "activeCartCount": 0
  }
}
```

---

### 3. GET /demo/search - Product Search

Search for products by name or category.

**Request:**
```bash
curl "http://localhost:3001/demo/search?q=keyboard&lang=th"
```

**Parameters:**
- `q` (optional): Search query
- `lang` (optional): Language

**Response (200 OK):**
```json
{
  "language": "th",
  "message": "ค้นหาข้อมูลเดโมเรียบร้อยแล้ว",
  "query": "keyboard",
  "count": 1,
  "results": [
    {
      "id": "sku-102",
      "name": "Mechanical Keyboard",
      "category": "electronics",
      "price": 89.0
    }
  ]
}
```

---

### 4. GET /demo/product/details - Product Details

View full product details including stock status and rating.

**Request:**
```bash
curl "http://localhost:3001/demo/product/details?productId=sku-101&lang=th"
```

**Parameters:**
- `productId` (required): Product SKU
- `lang` (optional): Language

**Response (200 OK):**
```json
{
  "language": "th",
  "message": "โหลดรายละเอียดสินค้าแล้ว",
  "product": {
    "id": "sku-101",
    "name": "Wireless Mouse",
    "category": "electronics",
    "price": 24.5,
    "stockStatus": "in_stock",
    "rating": 4.6,
    "description": "Wireless Mouse demo description for transaction flow testing"
  }
}
```

**Error (400 Bad Request) - Missing productId:**
```json
{
  "error": "missing_required_parameter",
  "required": ["productId"]
}
```

**Error (404 Not Found) - Product not found:**
```json
{
  "error": "product_not_found",
  "productId": "sku-unknown"
}
```

---

### 5. POST /demo/cart/add - Add Item to Cart

Add a product to the cart.

**Request:**
```bash
curl -X POST http://localhost:3001/demo/cart/add \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "cart-abc123",
    "productId": "sku-101",
    "quantity": 2
  }'
```

**Request Body:**
- `cartId` (optional): Cart ID - auto-generate if not provided
- `productId` (required): Product SKU
- `quantity` (optional): Quantity - default: 1

**Response (200 OK):**
```json
{
  "language": "en",
  "message": "item added to cart",
  "cart": {
    "cartId": "cart-abc123",
    "itemCount": 2,
    "total": 49.0,
    "items": [
      {
        "productId": "sku-101",
        "name": "Wireless Mouse",
        "quantity": 2,
        "unitPrice": 24.5,
        "lineTotal": 49.0
      }
    ]
  }
}
```

**Error (400 Bad Request) - Invalid quantity:**
```json
{
  "error": "invalid_quantity",
  "message": "quantity must be a positive integer"
}
```

**Error (404 Not Found) - Product not found:**
```json
{
  "error": "product_not_found",
  "productId": "sku-unknown"
}
```

---

### 6. POST /demo/checkout - Checkout Process

Complete the order from the cart.

**Request:**
```bash
curl -X POST http://localhost:3001/demo/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "cartId": "cart-abc123",
    "customerId": "shopper-xyz"
  }'
```

**Request Body:**
- `cartId` (optional): Cart ID — falls back to `"demo-cart"` if omitted
- `customerId` (optional): Customer identifier — falls back to `"guest"` if omitted

**Response (200 OK):**
```json
{
  "language": "en",
  "message": "checkout completed",
  "orderId": "ord-x1y2z3-a4b5-c6d7-e8f9",
  "customerId": "shopper-xyz",
  "cart": {
    "cartId": "cart-abc123",
    "itemCount": 2,
    "total": 49.0,
    "items": [
      {
        "productId": "sku-101",
        "name": "Wireless Mouse",
        "quantity": 2,
        "unitPrice": 24.5,
        "lineTotal": 49.0
      }
    ]
  }
}
```

**Error (400 Bad Request) - Empty cart:**
```json
{
  "error": "empty_cart",
  "message": "Add at least one item before checkout"
}
```

---

### 7. GET /demo/order/status - Check Order Status

Check the status of a placed order.

**Request:**
```bash
curl "http://localhost:3001/demo/order/status?orderId=order-x1y2z3&lang=th"
```

**Parameters:**
- `orderId` (required): Order ID from checkout response
- `lang` (optional): Language

**Response (200 OK):**
```json
{
  "language": "th",
  "message": "โหลดสถานะคำสั่งซื้อแล้ว",
  "orderId": "ord-x1y2z3-a4b5-c6d7-e8f9",
  "customerId": "shopper-xyz",
  "status": "confirmed",
  "itemCount": 2,
  "total": 49.0
}
```

**Error (404 Not Found) - Order not found:**
```json
{
  "error": "order_not_found",
  "orderId": "order-unknown"
}
```

---

## Demo Products (Inventory)

```json
[
  { "id": "sku-100", "name": "Laptop Sleeve", "category": "accessories", "price": 29.99 },
  { "id": "sku-101", "name": "Wireless Mouse", "category": "electronics", "price": 24.5 },
  { "id": "sku-102", "name": "Mechanical Keyboard", "category": "electronics", "price": 89.0 },
  { "id": "sku-103", "name": "Coffee Mug", "category": "lifestyle", "price": 12.75 },
  { "id": "sku-104", "name": "Notebook Pack", "category": "stationery", "price": 14.25 }
]
```

---

## Complete Workflow Example

```bash
# 1. Initialize
CONTEXT=$(curl -s "http://localhost:3001/demo/context?lang=th")
CART_ID=$(echo $CONTEXT | jq -r '.cartId')

# 2. Search
curl -s "http://localhost:3001/demo/search?q=mouse&lang=th"

# 3. Add to cart
curl -s -X POST http://localhost:3001/demo/cart/add \
  -H "Content-Type: application/json" \
  -d "{\"cartId\":\"$CART_ID\", \"productId\":\"sku-101\", \"quantity\":2}"

# 4. Checkout
CHECKOUT=$(curl -s -X POST http://localhost:3001/demo/checkout \
  -H "Content-Type: application/json" \
  -d "{\"cartId\":\"$CART_ID\",\"customerId\":\"shopper-demo\"}")
ORDER_ID=$(echo $CHECKOUT | jq -r '.orderId')

# 5. Check order status
curl -s "http://localhost:3001/demo/order/status?orderId=$ORDER_ID&lang=th"
```

---

## Language Support

All demo endpoints support Thai (th) and English (en):

| Endpoint | Thai Message | English Message |
|----------|--------------|-----------------|
| /demo/context | เตรียมข้อมูลเริ่มต้นของเดโมแล้ว | demo context prepared |
| /demo/dashboard | โหลดหน้าแดชบอร์ดเดโมแล้ว | demo dashboard loaded |
| /demo/search | ค้นหาข้อมูลเดโมเรียบร้อยแล้ว | demo search completed |
| /demo/product/details | โหลดรายละเอียดสินค้าแล้ว | product details loaded |
| /demo/cart/add | เพิ่มสินค้าเข้าตะกร้าแล้ว | item added to cart |
| /demo/checkout | ทำรายการสั่งซื้อเรียบร้อยแล้ว | checkout completed |
| /demo/order/status | โหลดสถานะคำสั่งซื้อแล้ว | order status loaded |

---

## Notes

- ✓ In-memory cart storage (resets on server restart)
- ✓ No real payment processing
- ✓ No real database
- ✓ Perfect for testing transaction flows locally
- ✓ Suitable for JMeter performance testing scenarios
