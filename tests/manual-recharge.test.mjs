import assert from "node:assert/strict";
import test from "node:test";

const ENV = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const CTX = { waitUntil() {}, passThroughOnException() {} };

process.env.ALLOW_DEBUG_VERIFICATION_CODE = "true";
process.env.PAYMENT_PROVIDER = "manual";
process.env.ADMIN_RECHARGE_PASSWORD = "test-admin-secret";
process.env.MANUAL_PAY_QR_IMAGE = "/manual-pay-qr.png";
process.env.MANUAL_AUTO_CONFIRM = "false";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("manual-recharge", `${process.pid}-${Date.now()}-${Math.random()}`);
const worker = (await import(workerUrl.href)).default;

async function request(path, options = {}, cookie) {
  const headers = { "content-type": "application/json", ...(options.headers || {}), ...(cookie ? { cookie } : {}) };
  return worker.fetch(new Request(`http://localhost${path}`, { ...options, headers }), ENV, CTX);
}

async function registerUser(email) {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "123456" }),
  });
  const setCookie = response.headers.get("set-cookie") || "";
  const session = (setCookie.match(/guanchen_session=([^;]+)/) || [])[1];
  const cookie = `guanchen_session=${session}`;
  const registration = await response.json();
  if (!registration.debugCode) throw new Error("Expected debug verification code in registration response");
  const verifyResponse = await request("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code: registration.debugCode }),
  }, cookie);
  if (!verifyResponse.ok) throw new Error("Verification failed in test setup");
  return { cookie, json: await verifyResponse.json() };
}

test("manual recharge creates a pending order and admin confirmation credits exactly once", async () => {
  const { cookie } = await registerUser("manual@example.com");
  const orderResponse = await request("/api/payments/orders", {
    method: "POST",
    body: JSON.stringify({ packageId: "light", idempotencyKey: "manual-order-1" }),
  }, cookie);
  assert.equal(orderResponse.status, 200);
  const order = await orderResponse.json();
  assert.equal(order.provider, "manual");
  assert.equal(order.payment.mode, "manual");
  assert.equal(order.payment.payUrl, "/manual-pay-qr.png");

  const markPaid = await request("/api/payments/manual/notify-paid", {
    method: "POST",
    body: JSON.stringify({ orderId: order.orderId }),
  }, cookie);
  assert.equal(markPaid.status, 200);
  assert.equal((await markPaid.json()).orderStatus, "awaiting_confirmation");

  const forbiddenList = await request("/api/admin/recharge/orders", {
    headers: { "x-admin-password": "wrong" },
  });
  assert.equal(forbiddenList.status, 403);

  const list = await request("/api/admin/recharge/orders", {
    headers: { "x-admin-password": "test-admin-secret" },
  });
  assert.equal(list.status, 200);
  const listed = await list.json();
  const row = listed.orders.find((item) => item.orderId === order.orderId);
  assert.ok(row);
  assert.equal(row.email, "manual@example.com");
  assert.equal(row.credits, 10);

  const confirm = await request("/api/admin/recharge/confirm", {
    method: "POST",
    headers: { "x-admin-password": "test-admin-secret" },
    body: JSON.stringify({ orderId: order.orderId }),
  });
  assert.equal(confirm.status, 200);
  const confirmed = await confirm.json();
  assert.equal(confirmed.creditsAdded, 10);

  const balance = await request("/api/credits", {}, cookie).then((response) => response.json());
  assert.equal(balance.credits, 15);

  const duplicate = await request("/api/admin/recharge/confirm", {
    method: "POST",
    headers: { "x-admin-password": "test-admin-secret" },
    body: JSON.stringify({ orderId: order.orderId }),
  });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).creditsAdded, 0);
  const balanceAfterDuplicate = await request("/api/credits", {}, cookie).then((response) => response.json());
  assert.equal(balanceAfterDuplicate.credits, 15);
});

test("manual recharge rejects marking another user's order as paid", async () => {
  const owner = await registerUser("manual-owner@example.com");
  const orderResponse = await request("/api/payments/orders", {
    method: "POST",
    body: JSON.stringify({ packageId: "deep", idempotencyKey: "manual-order-owner" }),
  }, owner.cookie);
  const order = await orderResponse.json();

  const intruder = await registerUser("manual-intruder@example.com");
  const forged = await request("/api/payments/manual/notify-paid", {
    method: "POST",
    body: JSON.stringify({ orderId: order.orderId }),
  }, intruder.cookie);
  assert.equal(forged.status, 403);
});

test("manual auto-confirm credits immediately, rejects reused trade numbers, and respects the daily limit", async () => {
  process.env.MANUAL_AUTO_CONFIRM = "true";
  process.env.MANUAL_AUTO_CONFIRM_DAILY_LIMIT_FEN = "1000";
  try {
    const { cookie } = await registerUser("auto@example.com");
    const orderResponse = await request("/api/payments/orders", {
      method: "POST",
      body: JSON.stringify({ packageId: "light", idempotencyKey: "auto-order-1" }),
    }, cookie);
    const order = await orderResponse.json();

    const markPaid = await request("/api/payments/manual/notify-paid", {
      method: "POST",
      body: JSON.stringify({ orderId: order.orderId, tradeNo: "WX2026081900001" }),
    }, cookie);
    assert.equal(markPaid.status, 200);
    const paid = await markPaid.json();
    assert.equal(paid.orderStatus, "paid");
    assert.equal(paid.creditsAdded, 10);
    assert.equal(paid.balanceAfter, 15);

    const duplicate = await request("/api/payments/manual/notify-paid", {
      method: "POST",
      body: JSON.stringify({ orderId: order.orderId, tradeNo: "WX2026081900001" }),
    }, cookie);
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).creditsAdded, 0);

    const secondResponse = await request("/api/payments/orders", {
      method: "POST",
      body: JSON.stringify({ packageId: "light", idempotencyKey: "auto-order-2" }),
    }, cookie);
    const second = await secondResponse.json();
    const reused = await request("/api/payments/manual/notify-paid", {
      method: "POST",
      body: JSON.stringify({ orderId: second.orderId, tradeNo: "WX2026081900001" }),
    }, cookie);
    assert.equal(reused.status, 400);
    assert.equal((await reused.json()).code, "TRADE_NO_REUSED");

    const overLimit = await request("/api/payments/manual/notify-paid", {
      method: "POST",
      body: JSON.stringify({ orderId: second.orderId }),
    }, cookie);
    assert.equal(overLimit.status, 200);
    assert.equal((await overLimit.json()).orderStatus, "awaiting_confirmation");

    const balance = await request("/api/credits", {}, cookie).then((response) => response.json());
    assert.equal(balance.credits, 15);

    const confirm = await request("/api/admin/recharge/confirm", {
      method: "POST",
      headers: { "x-admin-password": "test-admin-secret" },
      body: JSON.stringify({ orderId: second.orderId }),
    });
    assert.equal(confirm.status, 200);
    assert.equal((await confirm.json()).creditsAdded, 10);
  } finally {
    process.env.MANUAL_AUTO_CONFIRM = "false";
    delete process.env.MANUAL_AUTO_CONFIRM_DAILY_LIMIT_FEN;
  }
});
