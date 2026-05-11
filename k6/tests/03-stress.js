/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: STRESS TEST                                         ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Gradually increase load BEYOND normal capacity to find where   ║
 * ║  the system starts to struggle. You want to know the exact VU   ║
 * ║  count where response times spike or errors appear.             ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Before a product launch (know your ceiling before users do)  ║
 * ║  • After performance optimizations (verify they actually helped) ║
 * ║  • Capacity planning: "can we handle 2x traffic next quarter?"  ║
 * ║                                                                  ║
 * ║  WHAT IT CATCHES                                                 ║
 * ║  • The VU count where p(95) latency starts to climb             ║
 * ║  • When the error rate first exceeds 0%                         ║
 * ║  • Whether the server recovers after load is removed            ║
 * ║  • Bottlenecks: CPU, memory, database connections, file handles  ║
 * ║                                                                  ║
 * ║  HOW TO INTERPRET RESULTS                                        ║
 * ║  The stress test is EXPECTED to eventually cause degradation.   ║
 * ║  A failing threshold doesn't mean your API is broken — it means ║
 * ║  you found the limit. Look at WHEN (at what VU count) things    ║
 * ║  started failing.                                                ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/03-stress.js                                   ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/03-stress.js         ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

import {
  BASE_URL,
  jsonHeaders,
  getBearerToken,
  parseBody,
  randomItem,
} from '../utils/helpers.js';
import { stress, thresholds, SIZE_LABEL } from '../config/sizes.js';

// Track when degradation occurs — watch this metric climb as VUs increase
const degradationTracker = new Trend('stress_response_ms', true);

// ─── Test options ─────────────────────────────────────────────────────────────
export const options = {
  stages: stress.stages,

  // Stress test thresholds are intentionally relaxed (or not set) for
  // the outer boundary — we EXPECT things to degrade. Thresholds here
  // act as a record of what we've seen, not hard pass/fail gates.
  thresholds: {
    // We still track these, but we note that they may fail during the peak
    http_req_duration: thresholds.http_req_duration,
    http_req_failed: thresholds.http_req_failed,
    // Custom: track stress response times
    stress_response_ms: ['p(95)<5000'], // very lenient — capturing data
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`\n🔥 Stress Test — project size: ${SIZE_LABEL} — target: ${BASE_URL}`);
  console.log('   Goal: Find the VU count where performance degrades.');
  console.log(`   Stages: ${JSON.stringify(stress.stages)}`);
  console.log('   ⚠️  Threshold failures are expected at peak load.\n');

  const bearerToken = getBearerToken();
  return { bearerToken };
}

// ─── Main test function ───────────────────────────────────────────────────────
// During a stress test we deliberately minimize think time so the load
// builds up as fast as the VU ramp-up intends.
export default function (data) {

  // Mix of endpoint types to stress different server resources
  const scenario = randomItem(['fast', 'slow', 'auth', 'cpu_light', 'submit']);

  switch (scenario) {
    case 'fast':
      stressFast();
      break;
    case 'slow':
      stressSlow();
      break;
    case 'auth':
      stressAuth(data.bearerToken);
      break;
    case 'cpu_light':
      stressCpu();
      break;
    case 'submit':
      stressSubmit();
      break;
  }

  // Very short think time: in stress tests we want to push hard.
  // Think time of 0.1–0.5s still simulates minimal user delays while
  // allowing the VU ramp-up to actually drive up concurrent load.
  sleep(Math.random() * 0.4 + 0.1);
}

function stressFast() {
  group('stress: fast endpoint', () => {
    const start = Date.now();

    const res = http.get(`${BASE_URL}/fast`, { tags: { name: 'stress_fast' } });
    degradationTracker.add(Date.now() - start);

    check(res, { 'fast: 200': (r) => r.status === 200 });
  });
}

function stressSlow() {
  group('stress: slow endpoint', () => {
    const start = Date.now();

    // /slow has a built-in delay (default 200ms).
    // Under high concurrency the server has to handle many slow requests at once.
    const res = http.get(`${BASE_URL}/slow`, { tags: { name: 'stress_slow' } });
    degradationTracker.add(Date.now() - start);

    check(res, {
      'slow: 200 or 503': (r) => r.status === 200 || r.status === 503,
    });
  });
}

function stressAuth(bearerToken) {
  group('stress: auth endpoints', () => {
    // Login endpoint is expensive if it does bcrypt/JWT signing
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'demo', password: 'password' }),
      { headers: jsonHeaders, tags: { name: 'stress_login' } }
    );
    check(res, {
      'login: 200 or 429': (r) => r.status === 200 || r.status === 429,
    });

    if (bearerToken && res.status === 200) {
      const protRes = http.get(`${BASE_URL}/protected`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        tags: { name: 'stress_protected' },
      });
      check(protRes, { 'protected: 200': (r) => r.status === 200 });
    }
  });
}

function stressCpu() {
  group('stress: cpu endpoint', () => {
    // /cpu does many CPU iterations — stresses the server's compute resources
    // Note: under high concurrency this can cause the server to queue requests
    const res = http.get(`${BASE_URL}/cpu`, {
      tags: { name: 'stress_cpu' },
      timeout: '30s',  // allow longer timeout since this is compute-heavy
    });
    check(res, {
      'cpu: responded': (r) => r.status === 200 || r.status === 503,
    });
  });
}

function stressSubmit() {
  group('stress: data submission', () => {
    const names = ['stress-user-a', 'stress-user-b', 'stress-user-c'];

    const res = http.post(
      `${BASE_URL}/submit-two`,
      JSON.stringify({ name: randomItem(names), type: 'stress-test' }),
      { headers: jsonHeaders, tags: { name: 'stress_submit' } }
    );
    check(res, {
      'submit: 200 or 429': (r) => r.status === 200 || r.status === 429,
    });
  });
}

export function teardown() {
  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });
}
