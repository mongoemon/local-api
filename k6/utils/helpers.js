/**
 * Shared helpers used by all test scripts.
 *
 * WHAT'S IN HERE
 * ──────────────
 * - BASE_URL            Base URL, configurable via --env BASE_URL=...
 * - login()             POST /auth/login → returns JWT token string
 * - getBearerToken()    GET /prep → returns static Bearer token
 * - bearerHeaders()     Build headers with Authorization: Bearer <token>
 * - checkResponse()     Convenience wrapper around check()
 * - thinkTime()         Random sleep to simulate real user behavior
 * - parseBody()         Safe JSON.parse that returns null on failure
 * - Custom metrics      Shared Trend/Rate/Counter metrics
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ─── Base URL ────────────────────────────────────────────────────────────────
// Override with: k6 run --env BASE_URL=http://staging.example.com ...
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// ─── Custom metrics ──────────────────────────────────────────────────────────
// These appear in the k6 summary and Grafana alongside built-in metrics.

// Transaction-level duration (true = report in milliseconds)
export const txDuration = new Trend('transaction_duration_ms', true);

// Rate of auth failures across all VUs
export const authFailures = new Rate('auth_failure_rate');

// Total requests made by all VUs (redundant with http_reqs but useful for
// segmenting — e.g., count only /demo/* requests)
export const requestCount = new Counter('custom_requests_total');

// ─── Default headers ─────────────────────────────────────────────────────────
export const jsonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Log in and return a JWT token string.
 *
 * Designed for use in setup() so each test run authenticates once:
 *
 *   export function setup() {
 *     return { token: login() };
 *   }
 *   export default function(data) {
 *     // use data.token
 *   }
 *
 * @param {string} username
 * @param {string} password
 * @returns {string|null} JWT token, or null on failure
 */
export function login(username = 'demo', password = 'password') {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username, password }),
    { headers: jsonHeaders, tags: { name: 'auth_login' } }
  );

  const ok = check(res, {
    'login: status 200':     (r) => r.status === 200,
    'login: token returned': (r) => {
      const body = parseBody(r);
      return body !== null && typeof body.token === 'string';
    },
  });

  authFailures.add(!ok);

  if (!ok) {
    console.warn(`login() failed — status: ${res.status}, body: ${res.body}`);
    return null;
  }

  return parseBody(res).token;
}

/**
 * Fetch the static Bearer token from GET /prep.
 * The server's AUTH_BEARER_TOKEN env var controls this value (default: "lab-token").
 *
 * @returns {string|null}
 */
export function getBearerToken() {
  const res = http.get(
    `${BASE_URL}/prep`,
    { tags: { name: 'prep_token' } }
  );

  check(res, { 'prep: status 200': (r) => r.status === 200 });

  const body = parseBody(res);
  return (body && body.token) ? body.token : null;
}

/**
 * Build an Authorization header with a Bearer token.
 *
 * @param {string} token
 * @returns {Object} headers object ready to pass to http.get/post/etc.
 */
export function bearerHeaders(token) {
  return Object.assign({}, jsonHeaders, { Authorization: 'Bearer ' + token });
}

// ─── Check helpers ────────────────────────────────────────────────────────────

/**
 * Run a named check against a response and count the request.
 *
 * @param {Object}   res            k6 Response object
 * @param {string}   name           Human-readable label for this request
 * @param {number}   expectedStatus HTTP status code to expect (default 200)
 * @param {Function} [bodyFn]       Optional extra check on the response body
 * @returns {boolean} true if all checks passed
 */
export function checkResponse(res, name, expectedStatus = 200, bodyFn = null) {
  requestCount.add(1);

  const checks = {
    [`${name}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
  };

  if (bodyFn) {
    checks[`${name}: body`] = bodyFn;
  }

  return check(res, checks);
}

// ─── Timing helpers ───────────────────────────────────────────────────────────

/**
 * Sleep for a random duration between minSec and maxSec.
 * Simulates realistic user think time — real users don't click instantly.
 *
 * Typical values:
 *   thinkTime(0.5, 1.5)  — fast browser interaction
 *   thinkTime(1, 3)      — normal reading/thinking
 *   thinkTime(3, 8)      — slow/deliberate user
 *
 * @param {number} minSec
 * @param {number} maxSec
 */
export function thinkTime(minSec = 0.5, maxSec = 1.5) {
  sleep(Math.random() * (maxSec - minSec) + minSec);
}

/**
 * Measure the wall-clock duration of a callback in milliseconds.
 * Useful for recording custom transaction durations.
 *
 *   const ms = measure(() => {
 *     http.get(...);
 *     http.post(...);
 *   });
 *   txDuration.add(ms);
 *
 * @param {Function} fn
 * @returns {number} elapsed milliseconds
 */
export function measure(fn) {
  const start = Date.now();
  fn();
  return Date.now() - start;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Safely parse a JSON response body.
 * Returns null instead of throwing on malformed JSON.
 *
 * @param {Object} res k6 Response
 * @returns {any|null}
 */
export function parseBody(res) {
  try {
    return JSON.parse(res.body);
  } catch (e) {
    return null;
  }
}

/**
 * Pick a random element from an array.
 * Useful for rotating test data (search terms, product IDs, etc.).
 *
 *   const q = randomItem(['laptop', 'phone', 'tablet']);
 *
 * @param {Array} arr
 * @returns {any}
 */
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
