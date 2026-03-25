/**
 * PrizeDraw Platform — k6 Load Test Suite
 *
 * Scenarios:
 *   1. campaign_browse   — simulates users browsing active kuji + unlimited campaigns
 *   2. kuji_draw_queue   — simulates the full kuji draw flow under queue conditions
 *   3. unlimited_draw    — simulates burst unlimited draw requests (high concurrency)
 *
 * Run a specific scenario:
 *   k6 run --env SCENARIO=campaign_browse infra/k6/load-test.js
 *
 * Run all scenarios:
 *   k6 run infra/k6/load-test.js
 *
 * Required env vars:
 *   BASE_URL          — API base URL (default: http://localhost:8080)
 *   TEST_TOKEN        — Valid player JWT for authenticated requests
 *   TEST_CAMPAIGN_ID  — UUID of an active kuji campaign
 *   TEST_BOX_ID       — UUID of a ticket box within the campaign
 *   TEST_UNLIMITED_ID — UUID of an active unlimited campaign
 */

import http from "k6/http";
import ws from "k6/ws";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const AUTH_TOKEN = __ENV.TEST_TOKEN || "";
const CAMPAIGN_ID = __ENV.TEST_CAMPAIGN_ID || "";
const BOX_ID = __ENV.TEST_BOX_ID || "";
const UNLIMITED_ID = __ENV.TEST_UNLIMITED_ID || "";

const SELECTED_SCENARIO = __ENV.SCENARIO || "all";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const campaignBrowseLatency = new Trend("campaign_browse_latency_ms", true);
const queueJoinLatency = new Trend("queue_join_latency_ms", true);
const drawLatency = new Trend("draw_latency_ms", true);
const unlimitedDrawLatency = new Trend("unlimited_draw_latency_ms", true);
const paymentInitLatency = new Trend("payment_init_latency_ms", true);

const drawSuccessRate = new Rate("draw_success_rate");
const unlimitedDrawSuccessRate = new Rate("unlimited_draw_success_rate");
const queueJoinSuccessRate = new Rate("queue_join_success_rate");

const totalDraws = new Counter("total_draws");
const totalUnlimitedDraws = new Counter("total_unlimited_draws");

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------
const scenarioConfig = {
  campaign_browse: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 50 },
      { duration: "2m", target: 100 },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "30s",
    exec: "campaignBrowseScenario",
    tags: { scenario: "campaign_browse" },
  },

  kuji_draw_queue: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "30s", target: 20 },
      { duration: "3m", target: 50 },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "60s",
    exec: "kujiDrawScenario",
    tags: { scenario: "kuji_draw_queue" },
  },

  unlimited_draw: {
    executor: "constant-arrival-rate",
    rate: 500,
    timeUnit: "1s",
    duration: "2m",
    preAllocatedVUs: 200,
    maxVUs: 1000,
    gracefulStop: "30s",
    exec: "unlimitedDrawScenario",
    tags: { scenario: "unlimited_draw" },
  },
};

export const options = {
  scenarios:
    SELECTED_SCENARIO === "all"
      ? scenarioConfig
      : { [SELECTED_SCENARIO]: scenarioConfig[SELECTED_SCENARIO] },

  thresholds: {
    // Campaign browse: p95 < 200ms
    "http_req_duration{scenario:campaign_browse}": ["p(95)<200"],
    campaign_browse_latency_ms: ["p(95)<200", "p(99)<500"],

    // Kuji draw: p95 < 500ms (includes queue, WebSocket, draw RPC)
    "http_req_duration{scenario:kuji_draw_queue}": ["p(95)<500"],
    draw_latency_ms: ["p(95)<500", "p(99)<1000"],

    // Unlimited draw burst: p95 < 200ms
    "http_req_duration{scenario:unlimited_draw}": ["p(95)<200"],
    unlimited_draw_latency_ms: ["p(95)<200", "p(99)<500"],

    // Success rates
    draw_success_rate: ["rate>0.95"],
    unlimited_draw_success_rate: ["rate>0.95"],
    queue_join_success_rate: ["rate>0.90"],

    // Overall HTTP error rate < 1%
    http_req_failed: ["rate<0.01"],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

const authHeaders = {
  ...jsonHeaders,
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

function checkResponse(res, tag) {
  const ok = check(res, {
    [`${tag}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${tag}: response time < 1s`]: (r) => r.timings.duration < 1000,
  });
  return ok;
}

// ---------------------------------------------------------------------------
// Scenario 1: Campaign Browse
// ---------------------------------------------------------------------------
export function campaignBrowseScenario() {
  group("Campaign Browse", function () {
    // List active kuji campaigns
    const kujiList = http.get(`${BASE_URL}/api/v1/campaigns/kuji`, {
      headers: jsonHeaders,
      tags: { name: "list_kuji_campaigns" },
    });
    campaignBrowseLatency.add(kujiList.timings.duration);
    checkResponse(kujiList, "GET /campaigns/kuji");

    sleep(0.5);

    // List active unlimited campaigns
    const unlimitedList = http.get(`${BASE_URL}/api/v1/campaigns/unlimited`, {
      headers: jsonHeaders,
      tags: { name: "list_unlimited_campaigns" },
    });
    campaignBrowseLatency.add(unlimitedList.timings.duration);
    checkResponse(unlimitedList, "GET /campaigns/unlimited");

    sleep(0.5);

    // Fetch campaign detail
    if (CAMPAIGN_ID) {
      const detail = http.get(
        `${BASE_URL}/api/v1/campaigns/kuji/${CAMPAIGN_ID}`,
        {
          headers: jsonHeaders,
          tags: { name: "get_campaign_detail" },
        }
      );
      campaignBrowseLatency.add(detail.timings.duration);
      checkResponse(detail, "GET /campaigns/kuji/:id");
    }

    sleep(1);

    // Browse leaderboard
    const leaderboard = http.get(
      `${BASE_URL}/api/v1/leaderboard?type=DRAW_COUNT&period=TODAY`,
      {
        headers: jsonHeaders,
        tags: { name: "get_leaderboard" },
      }
    );
    campaignBrowseLatency.add(leaderboard.timings.duration);
    checkResponse(leaderboard, "GET /leaderboard");

    sleep(Math.random() * 2 + 1);
  });
}

// ---------------------------------------------------------------------------
// Scenario 2: Kuji Draw under Queue
// ---------------------------------------------------------------------------
export function kujiDrawScenario() {
  group("Kuji Draw with Queue", function () {
    if (!BOX_ID || !AUTH_TOKEN) {
      return;
    }

    // Step 1: Join the queue via WebSocket
    let queuePosition = -1;
    let sessionToken = null;

    const wsUrl = `${BASE_URL.replace("http", "ws")}/ws/queue/${BOX_ID}`;

    const wsRes = ws.connect(
      wsUrl,
      { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } },
      function (socket) {
        socket.on("open", function () {
          socket.send(JSON.stringify({ type: "JOIN_QUEUE" }));
        });

        socket.on("message", function (data) {
          const msg = JSON.parse(data);
          if (msg.type === "QUEUE_JOINED") {
            queuePosition = msg.position;
            queueJoinSuccessRate.add(true);
          } else if (msg.type === "SESSION_STARTED") {
            sessionToken = msg.sessionToken;
            // Signal that we can proceed with the draw
            socket.close();
          } else if (msg.type === "QUEUE_UPDATE") {
            queuePosition = msg.position;
          }
        });

        socket.on("error", function () {
          queueJoinSuccessRate.add(false);
          socket.close();
        });

        // Wait up to 30s for a session to be granted
        socket.setTimeout(function () {
          socket.close();
        }, 30000);
      }
    );

    queueJoinLatency.add(wsRes.timings.duration);

    if (!sessionToken) {
      // Queue was too long or session not granted — acceptable in load test
      sleep(1);
      return;
    }

    sleep(0.5);

    // Step 2: Perform the draw (single ticket)
    const drawStart = new Date().getTime();
    const drawRes = http.post(
      `${BASE_URL}/api/v1/draw/kuji`,
      JSON.stringify({
        ticketBoxId: BOX_ID,
        quantity: 1,
      }),
      {
        headers: authHeaders,
        tags: { name: "kuji_draw" },
      }
    );
    const drawDuration = new Date().getTime() - drawStart;

    drawLatency.add(drawDuration);
    totalDraws.add(1);

    const drawOk = checkResponse(drawRes, "POST /draw/kuji");
    drawSuccessRate.add(drawOk);

    sleep(Math.random() * 2 + 0.5);
  });
}

// ---------------------------------------------------------------------------
// Scenario 3: Unlimited Draw Burst
// ---------------------------------------------------------------------------
export function unlimitedDrawScenario() {
  if (!UNLIMITED_ID || !AUTH_TOKEN) {
    return;
  }

  group("Unlimited Draw Burst", function () {
    const drawStart = new Date().getTime();
    const drawRes = http.post(
      `${BASE_URL}/api/v1/draw/unlimited`,
      JSON.stringify({
        campaignId: UNLIMITED_ID,
        quantity: 1,
      }),
      {
        headers: authHeaders,
        tags: { name: "unlimited_draw" },
      }
    );
    const drawDuration = new Date().getTime() - drawStart;

    unlimitedDrawLatency.add(drawDuration);
    totalUnlimitedDraws.add(1);

    // Accept both success (200) and rate limit (429) as expected outcomes
    const ok = check(drawRes, {
      "unlimited draw: 200 or 429": (r) =>
        r.status === 200 || r.status === 429,
      "unlimited draw: response time < 500ms": (r) =>
        r.timings.duration < 500,
    });

    unlimitedDrawSuccessRate.add(drawRes.status === 200);

    // No sleep — constant-arrival-rate executor controls pacing
  });
}

// ---------------------------------------------------------------------------
// Default export (runs all scenarios via options.scenarios)
// ---------------------------------------------------------------------------
export default function () {
  // This function is unused when scenarios are configured in options.
  // The executor calls the named export functions directly.
}

/**
 * Lifecycle hook: called once before the test begins.
 * Use to seed test data or obtain tokens if needed.
 */
export function setup() {
  // Verify the server is reachable before starting load
  const healthRes = http.get(`${BASE_URL}/health`, {
    headers: jsonHeaders,
    timeout: "10s",
  });

  if (healthRes.status !== 200) {
    throw new Error(
      `Server health check failed with status ${healthRes.status}. ` +
        `Is the server running at ${BASE_URL}?`
    );
  }

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

/**
 * Lifecycle hook: called once after all scenarios complete.
 */
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
  console.log(`Target: ${data.baseUrl}`);
}
