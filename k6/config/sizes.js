/**
 * PROJECT SIZE CONFIGURATION
 * ==========================
 *
 * Declares the expected scale of your project. This single setting adjusts:
 *   - Number of virtual users (VUs) used in each test type
 *   - Test durations
 *   - Performance thresholds (what counts as "passing")
 *
 * HOW TO CHOOSE YOUR SIZE
 * -----------------------
 * Ask: "How many people use my app at the exact same second during a busy day?"
 *
 *   SMALL  → < 100 simultaneous users
 *            Examples: side project, internal dashboard, dev/staging environment
 *
 *   MEDIUM → 100–1,000 simultaneous users
 *            Examples: startup SaaS, small e-commerce, team tool
 *
 *   LARGE  → 1,000+ simultaneous users
 *            Examples: public API, media platform, enterprise service
 *
 * HOW TO SET IT
 * -------------
 *   k6 run --env PROJECT_SIZE=medium k6/tests/02-load.js
 *
 *   # Or set for the whole session:
 *   $env:PROJECT_SIZE = "medium"   # PowerShell
 *   export PROJECT_SIZE=medium      # bash/zsh
 *
 * Default: small (safe starting point)
 */

const PROJECT_SIZE = __ENV.PROJECT_SIZE || 'small';

const sizes = {
  // ═══════════════════════════════════════════════════════════════
  // SMALL — hobby projects, internal tools, low-traffic services
  // ═══════════════════════════════════════════════════════════════
  small: {
    label: 'Small Project (<100 concurrent users)',

    // Smoke/baseline: just check things work
    baseline: {
      vus: 1,
      duration: '30s',
    },

    // Load: normal daily traffic
    load: {
      stages: [
        { duration: '30s', target: 5 },  // ramp up to 5 users in 30s
        { duration: '1m',  target: 5 },  // hold at 5 users for 1 minute
        { duration: '20s', target: 0 },  // ramp down
      ],
    },

    // Stress: push 8x normal load to find the limit
    stress: {
      stages: [
        { duration: '30s', target: 5  }, // normal
        { duration: '30s', target: 10 }, // 2x
        { duration: '30s', target: 20 }, // 4x
        { duration: '30s', target: 40 }, // 8x normal load
        { duration: '1m',  target: 40 }, // sustain peak
        { duration: '30s', target: 0  }, // recover
      ],
    },

    // Spike: sudden burst (25x normal), then recovery
    spike: {
      stages: [
        { duration: '20s', target: 2  }, // baseline: 2 users
        { duration: '5s',  target: 50 }, // spike! 0→50 in 5 seconds
        { duration: '1m',  target: 50 }, // hold the spike
        { duration: '5s',  target: 2  }, // drop back to normal
        { duration: '1m',  target: 2  }, // recovery period
        { duration: '10s', target: 0  },
      ],
    },

    // Soak: normal load for 30 minutes (check for leaks)
    soak: {
      stages: [
        { duration: '2m',  target: 5 }, // ramp up
        { duration: '30m', target: 5 }, // sustain
        { duration: '2m',  target: 0 }, // ramp down
      ],
    },

    // Breakpoint: ramp until crash (no ceiling)
    breakpoint: {
      stages: [
        { duration: '5m', target: 100 }, // ramp to 100 over 5 minutes
      ],
    },

    // Thresholds: what "passing" looks like for a small project
    thresholds: {
      http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% under 1s
      http_req_failed:   ['rate<0.05'],                 // < 5% errors
      http_reqs:         ['rate>1'],                    // at least 1 req/s
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // MEDIUM — startup/team products, moderate public traffic
  // ═══════════════════════════════════════════════════════════════
  medium: {
    label: 'Medium Project (100–1,000 concurrent users)',

    baseline: {
      vus: 2,
      duration: '1m',
    },

    load: {
      stages: [
        { duration: '1m',  target: 25 }, // ramp up to 25 users
        { duration: '3m',  target: 25 }, // hold
        { duration: '1m',  target: 0  }, // ramp down
      ],
    },

    stress: {
      stages: [
        { duration: '1m', target: 25  }, // normal
        { duration: '1m', target: 50  }, // 2x
        { duration: '1m', target: 100 }, // 4x
        { duration: '1m', target: 150 }, // 6x normal
        { duration: '2m', target: 150 }, // sustain peak
        { duration: '1m', target: 0   }, // recover
      ],
    },

    spike: {
      stages: [
        { duration: '1m',  target: 10  }, // baseline
        { duration: '10s', target: 200 }, // spike!
        { duration: '2m',  target: 200 }, // hold spike
        { duration: '10s', target: 10  }, // drop
        { duration: '2m',  target: 10  }, // recovery
        { duration: '30s', target: 0   },
      ],
    },

    soak: {
      stages: [
        { duration: '5m', target: 25 }, // ramp up
        { duration: '2h', target: 25 }, // 2-hour soak
        { duration: '5m', target: 0  }, // ramp down
      ],
    },

    breakpoint: {
      stages: [
        { duration: '10m', target: 500 }, // ramp to 500 over 10 minutes
      ],
    },

    thresholds: {
      http_req_duration: ['p(95)<500', 'p(99)<1000'],
      http_req_failed:   ['rate<0.02'],
      http_reqs:         ['rate>5'],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // LARGE — enterprise, high-traffic, business-critical services
  // ═══════════════════════════════════════════════════════════════
  large: {
    label: 'Large Project (1,000+ concurrent users)',

    baseline: {
      vus: 5,
      duration: '2m',
    },

    load: {
      stages: [
        { duration: '2m', target: 100 }, // ramp to 100 users
        { duration: '5m', target: 100 }, // hold
        { duration: '2m', target: 0   }, // ramp down
      ],
    },

    stress: {
      stages: [
        { duration: '2m', target: 100 }, // normal
        { duration: '2m', target: 200 }, // 2x
        { duration: '2m', target: 400 }, // 4x
        { duration: '2m', target: 600 }, // 6x normal
        { duration: '3m', target: 600 }, // sustain peak
        { duration: '2m', target: 0   }, // recover
      ],
    },

    spike: {
      stages: [
        { duration: '2m',  target: 50   }, // baseline
        { duration: '30s', target: 1000 }, // spike!
        { duration: '3m',  target: 1000 }, // hold spike
        { duration: '30s', target: 50   }, // drop
        { duration: '3m',  target: 50   }, // recovery
        { duration: '1m',  target: 0    },
      ],
    },

    soak: {
      stages: [
        { duration: '10m', target: 100 }, // ramp up
        { duration: '8h',  target: 100 }, // overnight soak
        { duration: '10m', target: 0   }, // ramp down
      ],
    },

    breakpoint: {
      stages: [
        { duration: '20m', target: 2000 }, // ramp to 2000 over 20 minutes
      ],
    },

    thresholds: {
      http_req_duration: ['p(95)<200', 'p(99)<500'],
      http_req_failed:   ['rate<0.01'],
      http_reqs:         ['rate>50'],
    },
  },
};

if (!sizes[PROJECT_SIZE]) {
  throw new Error(
    `Unknown PROJECT_SIZE: "${PROJECT_SIZE}". ` +
    `Valid values: small, medium, large. ` +
    `Example: k6 run --env PROJECT_SIZE=medium k6/tests/02-load.js`
  );
}

export const config   = sizes[PROJECT_SIZE];
export const SIZE_LABEL = config.label;

// Named exports so test files can destructure only what they need
export const { thresholds, baseline, load, stress, spike, soak, breakpoint } = config;
