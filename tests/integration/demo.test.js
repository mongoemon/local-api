import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createTestApp } from "../helpers/testApp.js";

// Each test file gets its own app instance with fresh in-memory state.
const app = createTestApp();

describe("GET /demo/context", () => {
  it("returns shopper context with unique IDs and endpoint map", async () => {
    const res = await supertest(app).get("/demo/context");
    expect(res.status).toBe(200);
    expect(res.body.shopperId).toMatch(/^shopper-/);
    expect(res.body.cartId).toMatch(/^cart-/);
    expect(res.body).toHaveProperty("recommendedProductId");
    expect(res.body.nextEndpoints).toHaveProperty("checkout");
  });

  it("generates unique IDs on each call", async () => {
    const [a, b] = await Promise.all([
      supertest(app).get("/demo/context"),
      supertest(app).get("/demo/context")
    ]);
    expect(a.body.cartId).not.toBe(b.body.cartId);
  });
});

describe("GET /demo/dashboard", () => {
  it("returns featured products, categories, and metrics", async () => {
    const res = await supertest(app).get("/demo/dashboard");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.featured)).toBe(true);
    expect(res.body.featured.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.metrics.productCount).toBeGreaterThan(0);
  });
});

describe("GET /demo/search", () => {
  it("returns all products when no query is given", async () => {
    const res = await supertest(app).get("/demo/search");
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.count).toBe(res.body.results.length);
  });

  it("filters products by partial name match", async () => {
    const res = await supertest(app).get("/demo/search?q=mouse");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.results[0].name).toMatch(/mouse/i);
  });

  it("filters products by category", async () => {
    const res = await supertest(app).get("/demo/search?q=electronics");
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it("returns zero results for an unmatched query", async () => {
    const res = await supertest(app).get("/demo/search?q=zzznomatch");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });
});

describe("GET /demo/product/details", () => {
  it("returns 400 when productId is missing", async () => {
    const res = await supertest(app).get("/demo/product/details");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_required_parameter");
  });

  it("returns 404 for an unknown productId", async () => {
    const res = await supertest(app).get("/demo/product/details?productId=sku-999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("product_not_found");
  });

  it("returns product details with stockStatus and rating", async () => {
    const res = await supertest(app).get("/demo/product/details?productId=sku-101");
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe("sku-101");
    expect(res.body.product).toHaveProperty("stockStatus", "in_stock");
    expect(res.body.product).toHaveProperty("rating");
  });
});

describe("POST /demo/cart/add", () => {
  it("returns 400 when productId is missing", async () => {
    const res = await supertest(app).post("/demo/cart/add").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_required_parameter");
  });

  it("returns 404 for an unknown productId", async () => {
    const res = await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-999" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("product_not_found");
  });

  it("returns 400 for a non-positive quantity", async () => {
    const res = await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-101", quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_quantity");
  });

  it("adds a product to the cart", async () => {
    const res = await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-101", cartId: "cart-add-basic", quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body.cart.itemCount).toBe(2);
    expect(res.body.cart.total).toBeGreaterThan(0);
  });

  it("increments quantity when the same product is added twice", async () => {
    const cartId = "cart-increment-test";
    await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-102", cartId, quantity: 1 });
    const res = await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-102", cartId, quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.cart.itemCount).toBe(4);
  });
});

describe("POST /demo/checkout", () => {
  it("returns 400 when the cart is empty", async () => {
    const res = await supertest(app).post("/demo/checkout")
      .send({ cartId: "cart-empty-xyz" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("empty_cart");
  });

  it("creates an order and clears the cart", async () => {
    const cartId = "cart-checkout-test";
    await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-103", cartId, quantity: 1 });

    const res = await supertest(app).post("/demo/checkout")
      .send({ cartId, customerId: "shopper-abc" });
    expect(res.status).toBe(200);
    expect(res.body.orderId).toMatch(/^ord-/);
    expect(res.body.customerId).toBe("shopper-abc");
  });
});

describe("GET /demo/order/status", () => {
  it("returns 400 when orderId is missing", async () => {
    const res = await supertest(app).get("/demo/order/status");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_required_parameter");
  });

  it("returns 404 for an unknown orderId", async () => {
    const res = await supertest(app).get("/demo/order/status?orderId=bad-order");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("order_not_found");
  });

  it("returns order status for a placed order", async () => {
    const cartId = "cart-status-test";
    await supertest(app).post("/demo/cart/add")
      .send({ productId: "sku-104", cartId, quantity: 1 });
    const checkoutRes = await supertest(app).post("/demo/checkout")
      .send({ cartId });
    const { orderId } = checkoutRes.body;

    const res = await supertest(app).get(`/demo/order/status?orderId=${orderId}`);
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe(orderId);
    expect(res.body.status).toBe("confirmed");
    expect(res.body.itemCount).toBe(1);
  });
});

describe("Full shopping flow", () => {
  it("context → search → add to cart → checkout → order status", async () => {
    const ctxRes = await supertest(app).get("/demo/context");
    expect(ctxRes.status).toBe(200);
    const { cartId, shopperId } = ctxRes.body;

    const searchRes = await supertest(app).get("/demo/search?q=keyboard");
    expect(searchRes.status).toBe(200);
    const productId = searchRes.body.results[0].id;

    const addRes = await supertest(app).post("/demo/cart/add")
      .send({ cartId, productId, quantity: 1 });
    expect(addRes.status).toBe(200);

    const checkoutRes = await supertest(app).post("/demo/checkout")
      .send({ cartId, customerId: shopperId });
    expect(checkoutRes.status).toBe(200);
    const { orderId } = checkoutRes.body;

    const orderRes = await supertest(app).get(`/demo/order/status?orderId=${orderId}`);
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.orderId).toBe(orderId);
    expect(orderRes.body.status).toBe("confirmed");
  });
});
