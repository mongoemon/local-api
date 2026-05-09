import express from "express";
import { randomUUID } from "crypto";

const demoProducts = [
  { id: "sku-100", name: "Laptop Sleeve", category: "accessories", price: 29.99 },
  { id: "sku-101", name: "Wireless Mouse", category: "electronics", price: 24.5 },
  { id: "sku-102", name: "Mechanical Keyboard", category: "electronics", price: 89.0 },
  { id: "sku-103", name: "Coffee Mug", category: "lifestyle", price: 12.75 },
  { id: "sku-104", name: "Notebook Pack", category: "stationery", price: 14.25 }
];

const demoMessages = {
  en: {
    contextPrepared: "demo context prepared",
    dashboardLoaded: "demo dashboard loaded",
    searchCompleted: "demo search completed",
    productDetailsLoaded: "product details loaded",
    itemAddedToCart: "item added to cart",
    checkoutCompleted: "checkout completed",
    orderStatusLoaded: "order status loaded",
    emptyCart: "Add at least one item before checkout",
    invalidQuantity: "quantity must be a positive integer"
  },
  th: {
    contextPrepared: "เตรียมข้อมูลเริ่มต้นของเดโมแล้ว",
    dashboardLoaded: "โหลดหน้าแดชบอร์ดเดโมแล้ว",
    searchCompleted: "ค้นหาข้อมูลเดโมเรียบร้อยแล้ว",
    productDetailsLoaded: "โหลดรายละเอียดสินค้าแล้ว",
    itemAddedToCart: "เพิ่มสินค้าเข้าตะกร้าแล้ว",
    checkoutCompleted: "ทำรายการสั่งซื้อเรียบร้อยแล้ว",
    orderStatusLoaded: "โหลดสถานะคำสั่งซื้อแล้ว",
    emptyCart: "กรุณาเพิ่มสินค้าอย่างน้อยหนึ่งรายการก่อน checkout",
    invalidQuantity: "quantity ต้องเป็นจำนวนเต็มบวก"
  }
};

function getDemoLanguage(req) {
  const fromQuery = typeof req.query.lang === "string" ? req.query.lang.trim().toLowerCase() : "";
  if (fromQuery === "th" || fromQuery === "en") {
    return fromQuery;
  }

  const header = typeof req.headers["accept-language"] === "string"
    ? req.headers["accept-language"].toLowerCase()
    : "";

  if (header.startsWith("th")) {
    return "th";
  }

  return "en";
}

function withLanguage(req, payload) {
  return {
    language: getDemoLanguage(req),
    ...payload
  };
}

function getDemoText(req) {
  return demoMessages[getDemoLanguage(req)];
}

function buildCartSummary(cart) {
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    cartId: cart.cartId,
    itemCount,
    total: Number(total.toFixed(2)),
    items: cart.items
  };
}

export function createDemoRouter() {
  const router = express.Router();
  const demoCarts = new Map();
  const demoOrders = new Map();

  function getOrCreateCart(cartId) {
    const normalizedCartId = typeof cartId === "string" && cartId.trim() ? cartId.trim() : "demo-cart";
    if (!demoCarts.has(normalizedCartId)) {
      demoCarts.set(normalizedCartId, { cartId: normalizedCartId, items: [] });
    }
    return demoCarts.get(normalizedCartId);
  }

  router.get("/context", (req, res) => {
    const text = getDemoText(req);
    const shopperId = `shopper-${randomUUID()}`;
    const cartId = `cart-${randomUUID()}`;
    const searchTerm = typeof req.query.search === "string" && req.query.search.trim()
      ? req.query.search.trim()
      : "mouse";

    res.json(withLanguage(req, {
      message: text.contextPrepared,
      shopperId,
      cartId,
      searchTerm,
      recommendedProductId: "sku-101",
      couponCode: "WELCOME10",
      nextEndpoints: {
        dashboard: "/demo/dashboard",
        search: "/demo/search",
        productDetails: "/demo/product/details",
        addToCart: "/demo/cart/add",
        checkout: "/demo/checkout",
        orderStatus: "/demo/order/status"
      }
    }));
  });

  router.get("/dashboard", (req, res) => {
    const text = getDemoText(req);

    res.json(withLanguage(req, {
      message: text.dashboardLoaded,
      featured: demoProducts.slice(0, 3),
      categories: [...new Set(demoProducts.map(product => product.category))],
      metrics: {
        productCount: demoProducts.length,
        activeCartCount: demoCarts.size
      }
    }));
  });

  router.get("/search", (req, res) => {
    const text = getDemoText(req);
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const results = query
      ? demoProducts.filter(product =>
        product.name.toLowerCase().includes(query) || product.category.toLowerCase().includes(query)
      )
      : demoProducts;

    res.json(withLanguage(req, {
      message: text.searchCompleted,
      query: req.query.q || "",
      count: results.length,
      results
    }));
  });

  router.get("/product/details", (req, res) => {
    const text = getDemoText(req);
    const productId = typeof req.query.productId === "string" ? req.query.productId.trim() : "";

    if (!productId) {
      return res.status(400).json({
        error: "missing_required_parameter",
        required: ["productId"]
      });
    }

    const product = demoProducts.find(item => item.id === productId);

    if (!product) {
      return res.status(404).json({
        error: "product_not_found",
        productId
      });
    }

    res.json(withLanguage(req, {
      message: text.productDetailsLoaded,
      product: {
        ...product,
        stockStatus: "in_stock",
        rating: 4.6,
        description: `${product.name} demo description for transaction flow testing`
      }
    }));
  });

  router.post("/cart/add", (req, res) => {
    const text = getDemoText(req);
    const body = req.body ?? {};
    const { cartId, productId, quantity } = body;
    const normalizedQuantity = Number(quantity ?? 1);
    const product = demoProducts.find(item => item.id === productId);

    if (!productId) {
      return res.status(400).json({
        error: "missing_required_parameter",
        required: ["productId"]
      });
    }

    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
      return res.status(400).json({
        error: "invalid_quantity",
        message: text.invalidQuantity
      });
    }

    if (!product) {
      return res.status(404).json({
        error: "product_not_found",
        productId
      });
    }

    const cart = getOrCreateCart(cartId);
    const existingItem = cart.items.find(item => item.productId === product.id);

    if (existingItem) {
      existingItem.quantity += normalizedQuantity;
      existingItem.lineTotal = Number((existingItem.quantity * existingItem.unitPrice).toFixed(2));
    } else {
      cart.items.push({
        productId: product.id,
        name: product.name,
        quantity: normalizedQuantity,
        unitPrice: product.price,
        lineTotal: Number((normalizedQuantity * product.price).toFixed(2))
      });
    }

    res.json(withLanguage(req, {
      message: text.itemAddedToCart,
      cart: buildCartSummary(cart)
    }));
  });

  router.post("/checkout", (req, res) => {
    const text = getDemoText(req);
    const body = req.body ?? {};
    const cart = getOrCreateCart(body.cartId);
    const customerId = typeof body.customerId === "string" && body.customerId.trim()
      ? body.customerId.trim()
      : "guest";

    if (cart.items.length === 0) {
      return res.status(400).json({
        error: "empty_cart",
        message: text.emptyCart
      });
    }

    const summary = buildCartSummary(cart);
    const orderId = `ord-${randomUUID()}`;
    const order = {
      orderId,
      customerId,
      status: "confirmed",
      cart: summary
    };

    demoOrders.set(orderId, order);
    demoCarts.delete(cart.cartId);

    res.json(withLanguage(req, {
      message: text.checkoutCompleted,
      orderId,
      customerId,
      cart: summary
    }));
  });

  router.get("/order/status", (req, res) => {
    const text = getDemoText(req);
    const orderId = typeof req.query.orderId === "string" ? req.query.orderId.trim() : "";

    if (!orderId) {
      return res.status(400).json({
        error: "missing_required_parameter",
        required: ["orderId"]
      });
    }

    const order = demoOrders.get(orderId);

    if (!order) {
      return res.status(404).json({
        error: "order_not_found",
        orderId
      });
    }

    res.json(withLanguage(req, {
      message: text.orderStatusLoaded,
      orderId: order.orderId,
      customerId: order.customerId,
      status: order.status,
      itemCount: order.cart.itemCount,
      total: order.cart.total
    }));
  });

  return router;
}
