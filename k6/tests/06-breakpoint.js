/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: BREAKPOINT TEST                                     ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Ramp VUs up CONTINUOUSLY until the system completely fails.    ║
 * ║  Unlike stress tests (which have a fixed peak), breakpoint tests ║
 * ║  just keep going until something gives.                          ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Infrastructure capacity planning ("how many users max?")     ║
 * ║  • Setting auto-scaling thresholds and rules                     ║
 * ║  • After hardware upgrades (verify the new ceiling)             ║
 * ║  • One-time deep investigation, not regular testing              ║
 * ║                                                                  ║
 * ║  WHAT IT CATCHES                                                 ║
 * ║  • Absolute maximum throughput before failure                    ║
 * ║  • Whether the failure is graceful (503) or catastrophic (crash) ║
 * ║  • Resource that fails first (CPU, memory, connections, disk)   ║
 * ║                                                                  ║
 * ║  ⚠️  IMPORTANT                                                   ║
 * ║  This test WILL crash your server if you let it run long enough. ║
 * ║  Run it against a dedicated test environment, never production.  ║
 * ║  Stop manually (Ctrl+C) once you observe complete failure.       ║
 * ║                                                                  ║
 * ║  HOW TO INTERPRET RESULTS                                        ║
 * ║  Note the VU count when:                                         ║
 * ║    1. Latency first starts climbing (soft limit)                 ║
 * ║    2. Error rate first exceeds 5% (performance limit)            ║
 * ║    3. Error rate exceeds 50% (hard capacity limit)               ║
 * ║    4. Server stops responding at all (absolute maximum)          ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/06-breakpoint.js                               ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/06-breakpoint.js     ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

import { BASE_URL, jsonHeaders, randomItem } from '../utils/helpers.js';
import { breakpoint, SIZE_LABEL } from '../config/sizes.js';

// Metrics to track degradation progression
const errorRate          = new Rate('breakpoint_error_rate');
const latencyAtBreak     = new Trend('breakpoint_latency_ms', true);
const totalRequestsSent  = new Counter('breakpoint_requests_total');

// ─── Test options ─────────────────────────────────────────────────────────────
export const options = {
  stages: breakpoint.stages,

  // Breakpoint tests have very loose thresholds — we expect total failure.
  // The goal is measurement, not pass/fail.
  thresholds: {
    // Track the data — don't fail the test report
    breakpoint_error_rate:  ['rate<0.99'],  // only fail if 100% error (server dead)
    breakpoint_latency_ms:  ['p(95)<30000'], // only fail if > 30 second response
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`\n💥 Breakpoint Test — project size: ${SIZE_LABEL} — target: ${BASE_URL}`);
  console.log('   WARNING: This test will intentionally crash your server.');
  console.log('   Run only against a test environment, NOT production.');
  console.log(`   Stages: ${JSON.stringify(breakpoint.stages)}`);
  console.log('\n   Watch for these milestones:');
  console.log('     • Latency starts climbing         → soft capacity limit');
  console.log('     • Error rate > 5%                → performance limit');
  console.log('     • Error rate > 50%               → hard capacity limit');
  console.log('     • Server stops responding         → absolute maximum\n');
}

// ─── Main test function ───────────────────────────────────────────────────────
// Keep requests simple and fast so the VU count (not request complexity)
// is the primary variable. We want to measure concurrency limits.
export default function () {
  const endpoint = randomItem([
    `${BASE_URL}/fast`,
    `${BASE_URL}/status`,
    `${BASE_URL}/fast`,  // fast endpoint appears twice = 66% of requests
  ]);

  const start = Date.now();
  const res   = http.get(endpoint, {
    tags:    { name: 'breakpoint' },
    timeout: '30s',
  });
  const ms = Date.now() - start;

  totalRequestsSent.add(1);
  latencyAtBreak.add(ms);
  errorRate.add(res.status >= 500 || res.status === 0);

  check(res, {
    'responding (not server crash)': (r) => r.status !== 0,
    '2xx or 429 or 503':             (r) => [200, 201, 429, 503].includes(r.status),
  });

  // Minimal think time — we want maximum request pressure
  sleep(0.05);
}

export function teardown() {
  // Server may be unresponsive, but try to clean up
  try {
    http.post(`${BASE_URL}/cleanup`, null, {
      tags:    { name: 'cleanup' },
      timeout: '5s',
    });
  } catch (e) {
    console.warn('cleanup request failed — server may be down');
  }

  console.log('\n💥 Breakpoint test complete.');
  console.log('   Check the VU count at the moment errors spiked.');
  console.log('   That VU count is your system\'s hard capacity limit.\n');
}
