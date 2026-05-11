/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: USER JOURNEY / TRANSACTION TEST                     ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Simulate a COMPLETE BUSINESS WORKFLOW from start to finish.    ║
 * ║  Measures total transaction time, not just individual endpoints. ║
 * ║                                                                  ║
 * ║  THIS FILE: E-Commerce Demo Flow                                 ║
 * ║  The /demo/* endpoints simulate a real e-commerce session:       ║
 * ║    Step 1: Initialize context (get session IDs)                  ║
 * ║    Step 2: Load dashboard                                        ║
 * ║    Step 3: Search for products                                   ║
 * ║    Step 4: View product details                                  ║
 * ║    Step 5: Add item to cart                                      ║
 * ║    Step 6: Checkout                                              ║
 * ║    Step 7: Check order status                                    ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Testing your most critical business path end-to-end          ║
 * ║  • Finding which step in a flow is the bottleneck               ║
 * ║  • Measuring total transaction time (checkout takes how long?)  ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/08-demo-flow.js                                ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/08-demo-flow.js      ║
 * ║                                                                  ║
 * ║  HOW TO READ RESULTS                                             ║
 * ║  Look at the `group_duration` metric in Grafana (or in the CLI  ║
 * ║  summary). Each group name corresponds to a step. The slowest   ║
 * ║  group is your bottleneck.                                       ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import {
  BASE_URL,
  jsonHeaders,
  parseBody,
  thinkTime,
  measure,
  randomItem,
} from '../utils/helpers.js';
import { load, thresholds, SIZE_LABEL } from '../config/sizes.js';

// ─── Custom transaction metrics ───────────────────────────────────────────────
// These track each step's duration independently so you can see in Grafana
// exactly which step is slow.
const stepDuration = {
  context:   new Trend('tx_step_context_ms', true),
  dashboard: new Trend('tx_step_dashboard_ms', true),
  search:    new Trend('tx_step_search_ms', true),
  product:   new Trend('tx_step_product_ms', true),
  cart:      new Trend('tx_step_cart_ms', true),
  checkout:  new Trend('tx_step_checkout_ms', true),
  order:     new Trend('tx_step_order_ms', true),
};

// Track how many full transactions complete successfully
const txSuccessRate = new Rate('demo_tx_success_rate');

// Search queries to rotate through (simulates different users searching)
const searchTerms = ['laptop', 'phone', 'headphones', 'tablet', 'keyboard', 'monitor'];

// ─── Test options ─────────────────────────────────────────────────────────────
const demoThresholds = Object.assign({}, thresholds, {
  demo_tx_success_rate:    ['rate>0.95'],
  tx_step_context_ms:      ['p(95)<500'],
  tx_step_dashboard_ms:    ['p(95)<500'],
  tx_step_search_ms:       ['p(95)<800'],
  tx_step_product_ms:      ['p(95)<500'],
  tx_step_cart_ms:         ['p(95)<500'],
  tx_step_checkout_ms:     ['p(95)<1000'],
  tx_step_order_ms:        ['p(95)<500'],
});

export const options = {
  stages: load.stages,
  thresholds: demoThresholds,
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`\n🛒 Demo Flow Test (User Journey) — project size: ${SIZE_LABEL}`);
  console.log(`   target: ${BASE_URL}`);
  console.log('   Simulating: context → dashboard → search → product → cart → checkout → order\n');
}

// ─── Main test function ───────────────────────────────────────────────────────
// One iteration = one complete user shopping session.
export default function () {
  let contextId, productId, cartId, orderId;
  let allStepsPassed = true;

  // ══════════════════════════════════════════════════════════════════════
  // STEP 1: Initialize context
  // The /demo/context endpoint creates a session with contextId, productId,
  // userId that we carry through the rest of the flow.
  // ══════════════════════════════════════════════════════════════════════
  group('step 1 - initialize context', () => {
    const ms = measure(() => {
      const res = http.get(`${BASE_URL}/demo/context`, {
        tags: { name: 'demo_context' },
      });

      const ok = check(res, {
        'context: 200':          (r) => r.status === 200,
        'context: has contextId': (r) => (parseBody(r) || {}).contextId !== undefined,
      });

      if (!ok) { allStepsPassed = false; return; }

      const body = parseBody(res);
      contextId = body.contextId;
      productId = body.productId;
    });

    stepDuration.context.add(ms);
  });

  if (!contextId) {
    txSuccessRate.add(false);
    return;
  }

  thinkTime(0.5, 1.0); // user is "loading the page"

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Load dashboard
  // ══════════════════════════════════════════════════════════════════════
  group('step 2 - load dashboard', () => {
    const ms = measure(() => {
      const res = http.get(`${BASE_URL}/demo/dashboard`, {
        tags: { name: 'demo_dashboard' },
      });

      const ok = check(res, {
        'dashboard: 200': (r) => r.status === 200,
      });
      if (!ok) allStepsPassed = false;
    });

    stepDuration.dashboard.add(ms);
  });

  thinkTime(1, 2); // user is "reading the dashboard"

  // ══════════════════════════════════════════════════════════════════════
  // STEP 3: Search for a product
  // ══════════════════════════════════════════════════════════════════════
  const query = randomItem(searchTerms);

  group('step 3 - search products', () => {
    const ms = measure(() => {
      const res = http.get(`${BASE_URL}/demo/search?q=${query}`, {
        tags: { name: 'demo_search' },
      });

      const ok = check(res, {
        'search: 200':          (r) => r.status === 200,
        'search: has results':  (r) => {
          const body = parseBody(r);
          return body !== null && (body.results !== undefined || body.products !== undefined);
        },
      });
      if (!ok) allStepsPassed = false;
    });

    stepDuration.search.add(ms);
  });

  thinkTime(1, 3); // user is "browsing search results"

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: View product details
  // ══════════════════════════════════════════════════════════════════════
  group('step 4 - view product details', () => {
    const ms = measure(() => {
      const res = http.get(`${BASE_URL}/demo/product/details?productId=${productId}`, {
        tags: { name: 'demo_product' },
      });

      const ok = check(res, {
        'product: 200':           (r) => r.status === 200,
        'product: has productId': (r) => (parseBody(r) || {}).productId !== undefined,
      });
      if (!ok) allStepsPassed = false;
    });

    stepDuration.product.add(ms);
  });

  thinkTime(2, 5); // user is "deciding whether to buy"

  // ══════════════════════════════════════════════════════════════════════
  // STEP 5: Add to cart
  // ══════════════════════════════════════════════════════════════════════
  group('step 5 - add to cart', () => {
    const ms = measure(() => {
      const res = http.post(
        `${BASE_URL}/demo/cart/add`,
        JSON.stringify({
          productId: productId,
          quantity:  1,
          contextId: contextId,
        }),
        { headers: jsonHeaders, tags: { name: 'demo_cart_add' } }
      );

      const ok = check(res, {
        'cart add: 200':         (r) => r.status === 200,
        'cart add: has cartId':  (r) => {
          const body = parseBody(r);
          return body !== null && body.cartId !== undefined;
        },
      });

      if (!ok) { allStepsPassed = false; return; }
      cartId = parseBody(res).cartId;
    });

    stepDuration.cart.add(ms);
  });

  if (!cartId) {
    txSuccessRate.add(false);
    return;
  }

  thinkTime(0.5, 1.5); // user is "reviewing cart"

  // ══════════════════════════════════════════════════════════════════════
  // STEP 6: Checkout
  // This is the most business-critical step — measure it carefully.
  // ══════════════════════════════════════════════════════════════════════
  group('step 6 - checkout', () => {
    const ms = measure(() => {
      const res = http.post(
        `${BASE_URL}/demo/checkout`,
        JSON.stringify({
          cartId:    cartId,
          contextId: contextId,
        }),
        { headers: jsonHeaders, tags: { name: 'demo_checkout' } }
      );

      const ok = check(res, {
        'checkout: 200':          (r) => r.status === 200,
        'checkout: has orderId':  (r) => {
          const body = parseBody(r);
          return body !== null && body.orderId !== undefined;
        },
      });

      if (!ok) { allStepsPassed = false; return; }
      orderId = parseBody(res).orderId;
    });

    stepDuration.checkout.add(ms);
  });

  if (!orderId) {
    txSuccessRate.add(false);
    return;
  }

  thinkTime(0.5, 1.0); // brief pause after checkout

  // ══════════════════════════════════════════════════════════════════════
  // STEP 7: Check order status
  // ══════════════════════════════════════════════════════════════════════
  group('step 7 - check order status', () => {
    const ms = measure(() => {
      const res = http.get(`${BASE_URL}/demo/order/status?orderId=${orderId}`, {
        tags: { name: 'demo_order_status' },
      });

      const ok = check(res, {
        'order status: 200':          (r) => r.status === 200,
        'order status: has status':   (r) => (parseBody(r) || {}).status !== undefined,
      });
      if (!ok) allStepsPassed = false;
    });

    stepDuration.order.add(ms);
  });

  // Record whether this entire transaction succeeded
  txSuccessRate.add(allStepsPassed);

  thinkTime(1, 3); // user has finished their session
}

export function teardown() {
  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });
  console.log('\n✅ Demo flow test complete.');
  console.log('   Check tx_step_* metrics to find the slowest step.\n');
}
