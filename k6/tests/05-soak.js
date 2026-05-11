/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: SOAK / ENDURANCE TEST                               ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Run at NORMAL LOAD for an EXTENDED TIME (30 minutes to 8 hours) ║
 * ║  to find problems that only appear after prolonged operation.    ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Before going to production for the first time                ║
 * ║  • After fixing a suspected memory leak                          ║
 * ║  • Quarterly stability audits                                    ║
 * ║  • When performance is good short-term but degrades over time    ║
 * ║                                                                  ║
 * ║  WHAT IT CATCHES                                                 ║
 * ║  • Memory leaks: p(95) latency slowly climbs over hours         ║
 * ║  • DB connection pool exhaustion: errors start appearing later  ║
 * ║  • File descriptor leaks: "too many open files" after N hours   ║
 * ║  • Disk filling up: logs or temp files that never get cleaned   ║
 * ║  • Session/cache issues: stale data causes errors over time     ║
 * ║                                                                  ║
 * ║  HOW TO SPOT A MEMORY LEAK in results                           ║
 * ║  Look at the http_req_duration chart in Grafana. A memory leak  ║
 * ║  shows as a slowly rising line. Normal behavior is flat.        ║
 * ║                                                                  ║
 * ║  IMPORTANT: Soak tests run for a long time. Small project size  ║
 * ║  runs 30 minutes; large runs 8 hours. Plan accordingly.         ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/05-soak.js                                     ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/05-soak.js           ║
 * ║                                                                  ║
 * ║  Recommended: run with Grafana so you can watch the trend:      ║
 * ║  k6 run --out influxdb=http://localhost:8086/k6 k6/tests/05-soak.js ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

import {
  BASE_URL,
  jsonHeaders,
  login,
  getBearerToken,
  parseBody,
  thinkTime,
  randomItem,
} from '../utils/helpers.js';
import { soak, thresholds, SIZE_LABEL } from '../config/sizes.js';

// Track latency trend over time — in Grafana, plot this against wall clock
// to see if it slowly climbs (memory leak signature).
const latencyTrend = new Trend('soak_latency_trend_ms', true);

// Track error rate over time — should stay at 0% throughout
const soakErrorRate = new Rate('soak_error_rate');

// ─── Test options ─────────────────────────────────────────────────────────────
const soakThresholds = Object.assign({}, thresholds, {
  soak_latency_trend_ms: ['p(95)<2000'],
  soak_error_rate:       ['rate<0.01'],
  checks:                ['rate>0.98'],
});

export const options = {
  stages: soak.stages,
  thresholds: soakThresholds,
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  // Log the estimated test duration from the soak stages
  const totalSeconds = soak.stages.reduce((sum, s) => {
    const n = parseInt(s.duration);
    const unit = s.duration.replace(/[0-9]/g, '');
    return sum + (unit === 'h' ? n * 3600 : unit === 'm' ? n * 60 : n);
  }, 0);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  console.log(`\n🕰  Soak Test — project size: ${SIZE_LABEL} — target: ${BASE_URL}`);
  console.log(`   Estimated duration: ${hours}h ${minutes}m`);
  console.log('   Goal: Confirm stable latency and zero errors over time.');
  console.log('   Tip: Watch the latency trend chart — a slow climb means a leak.\n');

  const jwtToken    = login();
  const bearerToken = getBearerToken();

  return { jwtToken, bearerToken };
}

// ─── Main test function ───────────────────────────────────────────────────────
// The soak test exercises the full API surface at a sustainable pace.
// Think time is realistic (1–3 seconds) to avoid burning through CPU.
export default function (data) {
  // Rotate through different endpoint types to exercise all code paths
  const scenario = randomItem(['status', 'fast_data', 'auth', 'slow', 'io']);

  switch (scenario) {
    case 'status':
      soakStatus();
      break;
    case 'fast_data':
      soakFastData();
      break;
    case 'auth':
      soakAuth(data.bearerToken);
      break;
    case 'slow':
      soakSlow();
      break;
    case 'io':
      soakIo();
      break;
  }
}

function soakStatus() {
  group('soak: status', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/status`, { tags: { name: 'soak_status' } });
    const ms  = Date.now() - start;

    latencyTrend.add(ms);
    soakErrorRate.add(res.status >= 500);

    check(res, {
      'status: 200':        (r) => r.status === 200,
      'status: has uptime': (r) => (parseBody(r) || {}).uptime !== undefined,
    });
  });

  thinkTime(1, 2);
}

function soakFastData() {
  group('soak: fast + submit', () => {
    // Fast request
    let start = Date.now();
    let res = http.get(`${BASE_URL}/fast`, { tags: { name: 'soak_fast' } });
    latencyTrend.add(Date.now() - start);
    soakErrorRate.add(res.status >= 500);
    check(res, { 'fast: 200': (r) => r.status === 200 });

    thinkTime(0.5, 1.0);

    // Data submission
    start = Date.now();
    res = http.post(
      `${BASE_URL}/submit-one`,
      JSON.stringify({ name: `soak-user-${__VU}` }),
      { headers: jsonHeaders, tags: { name: 'soak_submit' } }
    );
    latencyTrend.add(Date.now() - start);
    soakErrorRate.add(res.status >= 500);
    check(res, { 'submit: 200': (r) => r.status === 200 });
  });

  thinkTime(1, 3);
}

function soakAuth(bearerToken) {
  group('soak: auth flow', () => {
    // Fresh JWT login every iteration — tests token generation over time
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'demo', password: 'password' }),
      { headers: jsonHeaders, tags: { name: 'soak_login' } }
    );
    latencyTrend.add(Date.now() - start);
    soakErrorRate.add(res.status >= 500);
    check(res, { 'login: 200': (r) => r.status === 200 });
  });

  thinkTime(2, 4);
}

function soakSlow() {
  group('soak: slow endpoint', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/slow`, { tags: { name: 'soak_slow' } });
    latencyTrend.add(Date.now() - start);
    soakErrorRate.add(res.status >= 500);
    check(res, { 'slow: 200': (r) => r.status === 200 });
  });

  thinkTime(2, 4);
}

function soakIo() {
  group('soak: I/O read', () => {
    // Exercise file I/O — file handles are a common leak source
    const start = Date.now();
    const res = http.get(`${BASE_URL}/io?mode=read`, {
      tags: { name: 'soak_io_read' },
      timeout: '15s',
    });
    latencyTrend.add(Date.now() - start);
    soakErrorRate.add(res.status >= 500);
    check(res, { 'io read: 200': (r) => r.status === 200 });
  });

  thinkTime(2, 5);
}

export function teardown() {
  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });

  console.log('\n✅ Soak test complete.');
  console.log('   Check the latency trend: was it flat the whole time?');
  console.log('   Check memory via /status: was heap usage stable?\n');
}
