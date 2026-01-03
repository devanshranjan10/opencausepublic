import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:3001";
const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // Ramp up to 10 users
    { duration: "1m", target: 25 },   // Stay at 25 users
    { duration: "30s", target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests must complete below 2s
    http_req_failed: ["rate<0.01"],    // Less than 1% failures
    errors: ["rate<0.01"],
  },
};

export default function () {
  const campaignId = "camp1";
  const payload = JSON.stringify({
    networkId: "ethereum_mainnet",
    assetId: "eth_ethereum_mainnet",
    amountUsd: "10",
  });

  // Create payment intent
  const createRes = http.post(
    `${BASE}/campaigns/${campaignId}/payment-intents`,
    payload,
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "CreatePaymentIntent" },
    }
  );

  const createSuccess = check(createRes, {
    "created intent": (res) => res.status === 201,
    "has intentId": (res) => {
      try {
        const body = JSON.parse(res.body);
        return body.intentId !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!createSuccess);

  let intentId = null;
  if (createRes.status === 201) {
    try {
      const body = JSON.parse(createRes.body);
      intentId = body.intentId;
    } catch (e) {
      errorRate.add(1);
    }
  }

  // Poll payment intent status
  if (intentId) {
    const pollRes = http.get(`${BASE}/crypto/payment-intents/${intentId}`, {
      tags: { name: "GetPaymentIntent" },
    });

    const pollSuccess = check(pollRes, {
      "polled intent": (res) => res.status === 200,
      "has status": (res) => {
        try {
          const body = JSON.parse(res.body);
          return body.status !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!pollSuccess);
  }

  // Test networks endpoint
  const networksRes = http.get(`${BASE}/crypto/networks`, {
    tags: { name: "GetNetworks" },
  });

  check(networksRes, {
    "networks returned": (res) => res.status === 200,
  });

  sleep(1);
}






