/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: SPIKE TEST                                          ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Test how the system handles a SUDDEN dramatic traffic increase  ║
 * ║  — then checks if it recovers back to normal performance.        ║
 * ║                                                                  ║
 * ║  Real-world triggers for spikes:                                 ║
 * ║    • Flash sale / limited offer going live                       ║
 * ║    • Product launch / press coverage                             ║
 * ║    • Social media post going viral                               ║
 * ║    • Marketing email batch sent to 100K subscribers              ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Before a marketing campaign or product launch                 ║
 * ║  • Testing auto-scaling policies (does it scale fast enough?)    ║
 * ║  • Whenever sudden traffic bursts are a business risk            ║
 * ║                                                                  ║
 * ║  WHAT IT CATCHES                                                 ║
 * ║  • Connection queue overflow (error 503)                         ║
 * ║  • Cascading failures (one slow service blocks others)           ║
 * ║  • Slow recovery (server takes minutes to return to normal)      ║
 * ║  • Auto-scaling lag (new instances spin up too slowly)           ║
 * ║                                                                  ║
 * ║  LOAD PROFILE                                                    ║
 * ║  VUs:  2 ──────── ▲ SPIKE ▲ ──────── 2 ──── (recovery) ─── 0  ║
 * ║            2     →   50→100   →     2                           ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/04-spike.js                                    ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/04-spike.js          ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

import {
  BASE_URL,
  jsonHeaders,
  getBearerToken,
  parseBody,
  randomItem,
} from '../utils/helpers.js';
import { spike, thresholds, SIZE_LABEL } from '../config/sizes.js';

// Track behavior during the spike phase specifically
const spikeErrorRate  = new Rate('spike_error_rate');
const recoveryLatency = new Trend('post_spike_latency_ms', true);

// Phase tracking — k6 doesn't expose the current stage, but we can track
// elapsed time since setup to approximate where in the spike we are.
let testStartTime;

// ─── Test options ─────────────────────────────────────────────────────────────
export const options = {
  stages: spike.stages,

  thresholds: {
    // During a spike test, some errors are expected at peak.
    // What matters is RECOVERY — errors should go back down after the spike.
    // The overall rate across the whole test may be worse than load test limits.
    http_req_failed:   ['rate<0.15'],          // allow up to 15% errors overall
    spike_error_rate:  ['rate<0.20'],          // up to 20% spike-phase errors
    post_spike_latency_ms: ['p(95)<2000'],     // recovery: must return under 2s

    // Still track latency but allow degradation during the spike
    http_req_duration: ['p(95)<5000'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  testStartTime = Date.now();

  console.log(`\n⚡ Spike Test — project size: ${SIZE_LABEL} — target: ${BASE_URL}`);
  console.log('   Goal: Simulate sudden traffic burst and measure recovery.');
  console.log(`   Stages: ${JSON.stringify(spike.stages)}`);
  console.log('   ⚠️  Errors during the spike phase are expected.\n');
  console.log('   Watch for: Does the server RECOVER after the spike?\n');

  const bearerToken = getBearerToken();
  return { bearerToken, startTime: Date.now() };
}

// ─── Main test function ───────────────────────────────────────────────────────
export default function (data) {
  // Spike tests use a simple, uniform request pattern so the spike is "pure"
  // — we're measuring server capacity, not request variety.
  const res = http.get(`${BASE_URL}/fast`, { tags: { name: 'spike_request' } });

  const success = check(res, {
    'spike request: 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  // Track errors separately so we can threshold-check spike phase vs. recovery
  spikeErrorRate.add(res.status >= 500);

  // Very minimal think time — spikes are about volume, not realism
  sleep(0.1);
}

// ─── Spike with full auth flow ────────────────────────────────────────────────
// Uncomment the function below and swap it into the default function
// if you want to spike test the auth pathway specifically.
// This is harder on the server because each request does JWT work.
//
// export default function (data) {
//   spikeAuthFlow(data.bearerToken);
//   sleep(0.1);
// }
//
// function spikeAuthFlow(bearerToken) {
//   group('spike auth', () => {
//     const res = http.post(
//       `${BASE_URL}/auth/login`,
//       JSON.stringify({ username: 'demo', password: 'password' }),
//       { headers: jsonHeaders }
//     );
//     check(res, { 'login: not 500': (r) => r.status !== 500 });
//   });
// }

// ─── Recovery verification ────────────────────────────────────────────────────
// After the spike drops back to normal load, these requests measure
// whether the server has actually recovered. We compare latency to
// the post_spike_latency_ms threshold.
//
// This is handled automatically: after the spike stage, the VU count
// drops back to baseline. The requests made by those remaining VUs
// represent "post-spike" traffic. The `post_spike_latency_ms` custom
// metric would need per-stage tracking to be exact — for now,
// watch the http_req_duration chart in Grafana — it should return to
// normal after the VU spike drops.

export function teardown() {
  // Verify recovery: send a few requests at the end and check their latency
  console.log('\n🔍 Checking server recovery after spike...\n');

  for (let i = 0; i < 5; i++) {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/fast`, { tags: { name: 'recovery_check' } });
    const ms   = Date.now() - start;

    recoveryLatency.add(ms);

    check(res, { 'recovery: server responding': (r) => r.status === 200 });
    console.log(`  Recovery request ${i + 1}: ${ms}ms — status ${res.status}`);
    sleep(1);
  }

  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });
  console.log('\n✅ Spike test complete. Check the chart for recovery shape.\n');
}
