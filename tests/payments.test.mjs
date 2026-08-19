import assert from "node:assert/strict";
import test from "node:test";

const ENV = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const CTX = { waitUntil() {}, passThroughOnException() {} };

process.env.ALLOW_DEBUG_VERIFICATION_CODE = "true";
process.env.PAYMENT_PROVIDER = "sandbox";

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("payments", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

async function request(worker, path, options = {}, cookie) {
  const headers = { "content-type": "application/json", ...(options.headers || {}), ...(cookie ? { cookie } : {}) };
  return worker.fetch(new Request(`http://localhost${path}`, { ...options, headers }), ENV, CTX);
}

async function registerUser(worker, email = "payer@example.com") {
  const response = await request(worker, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "123456" }),
  });
  const setCookie = response.headers.get("set-cookie") || "";
  const session = (setCookie.match(/guanchen_session=([^;]+)/) || [])[1];
  const cookie = `guanchen_session=${session}`;
  const registration = await response.json();
  const code = registration.debugCode;
  if (!code) throw new Error("Expected debug verification code in registration response");
  const verifyResponse = await request(worker, "/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code }),
  }, cookie);
  if (!verifyResponse.ok) throw new Error("Verification failed in test setup");
  return { cookie, json: await verifyResponse.json() };
}

test("guests have zero credits and must log in before unlocking paid reports", async () => {
  const worker = await getWorker();
  const creditsResponse = await request(worker, "/api/credits");
  assert.equal(creditsResponse.status, 200);
  assert.deepEqual(await creditsResponse.json(), {
    authenticated: false,
    credits: 0,
    displayName: null,
    email: null,
    newUserGift: 5,
    message: "注册并验证邮箱后，新用户可免费获得 5 积分，用于解锁八字或紫微斗数完整报告。",
  });

  const reportResponse = await request(worker, "/api/charts/bazi", {
    method: "POST",
    body: JSON.stringify({ trueSolarTime: "2000-01-01T12:00:00", gender: "male", topics: ["综合看看"], deepReport: true }),
  });
  assert.equal(reportResponse.status, 401);
  assert.equal((await reportResponse.json()).code, "AUTH_REQUIRED");
});

test("sandbox payment creates an order, credits idempotently, and rejects forged callbacks", async () => {
  const worker = await getWorker();
  const { cookie, json: registration } = await registerUser(worker);
  assert.equal(registration.credits, 5);

  const orderResponse = await request(worker, "/api/payments/orders", {
    method: "POST",
    body: JSON.stringify({ packageId: "deep", idempotencyKey: "order-key-1" }),
  }, cookie);
  assert.equal(orderResponse.status, 200);
  const order = await orderResponse.json();
  assert.equal(order.status, "pending");
  assert.equal(order.provider, "sandbox");
  assert.equal(order.credits, 50);
  assert.equal(order.amountFen, 3900);

  const confirmResponse = await request(worker, "/api/payments/sandbox/confirm", {
    method: "POST",
    body: JSON.stringify({ orderId: order.orderId }),
  }, cookie);
  assert.equal(confirmResponse.status, 200);
  const confirmed = await confirmResponse.json();
  assert.equal(confirmed.status, "paid");
  assert.equal(confirmed.creditsAdded, 50);
  assert.equal(confirmed.balanceAfter, 55);

  const duplicateResponse = await request(worker, "/api/payments/sandbox/confirm", {
    method: "POST",
    body: JSON.stringify({ orderId: order.orderId }),
  }, cookie);
  assert.equal(duplicateResponse.status, 200);
  const duplicate = await duplicateResponse.json();
  assert.equal(duplicate.creditsAdded, 0);
  assert.equal(duplicate.balanceAfter, 55);

  const forgedWebhook = await request(worker, "/api/payments/webhook/sandbox", {
    method: "POST",
    body: JSON.stringify({ orderId: order.orderId }),
  });
  assert.equal(forgedWebhook.status, 401);

  const webhook = await request(worker, "/api/payments/webhook/sandbox", {
    method: "POST",
    headers: { "x-sandbox-secret": "guanchen-sandbox-secret" },
    body: JSON.stringify({ orderId: order.orderId }),
  });
  assert.equal(webhook.status, 200);
  assert.equal((await webhook.json()).balanceAfter, 55);
});

test("guests cannot create orders or claim tester credits without a session", async () => {
  const worker = await getWorker();
  const orderResponse = await request(worker, "/api/payments/orders", {
    method: "POST",
    body: JSON.stringify({ packageId: "light", idempotencyKey: "guest-order" }),
  });
  assert.equal(orderResponse.status, 401);

  const testerResponse = await request(worker, "/api/sandbox/tester-credits", {
    method: "POST",
    body: JSON.stringify({ code: "GC100-8A11-K7Q4" }),
  });
  assert.equal(testerResponse.status, 401);
});

test("new accounts hold zero credits until the email is verified and reject honeypot submissions", async () => {
  const worker = await getWorker();
  const response = await request(worker, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "new-user@example.com", password: "123456", website: "spam" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "BOT_DETECTED");

  const registrationResponse = await request(worker, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "pending@example.com", password: "123456" }),
  });
  assert.equal(registrationResponse.status, 200);
  const registration = await registrationResponse.json();
  assert.equal(registration.verificationRequired, true);
  assert.equal(registration.credits, 0);
  assert.match(registration.debugCode, /^\d{6}$/);

  const wrongResponse = await request(worker, "/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code: "000000" }),
  }, `guanchen_session=${(registrationResponse.headers.get("set-cookie") || "").match(/guanchen_session=([^;]+)/)?.[1]}`);
  assert.equal(wrongResponse.status, 400);

  const verifiedResponse = await request(worker, "/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ code: registration.debugCode }),
  }, `guanchen_session=${(registrationResponse.headers.get("set-cookie") || "").match(/guanchen_session=([^;]+)/)?.[1]}`);
  assert.equal(verifiedResponse.status, 200);
  const verified = await verifiedResponse.json();
  assert.equal(verified.verified, true);
  assert.equal(verified.credits, 5);
});

test("orders belong to the paying user and cannot be confirmed by someone else", async () => {
  const worker = await getWorker();
  const owner = await registerUser(worker, "owner@example.com");
  const other = await registerUser(worker, "other@example.com");
  const orderResponse = await request(worker, "/api/payments/orders", {
    method: "POST",
    body: JSON.stringify({ packageId: "light", idempotencyKey: "owner-order" }),
  }, owner.cookie);
  const order = await orderResponse.json();

  const forgedConfirm = await request(worker, "/api/payments/sandbox/confirm", {
    method: "POST",
    body: JSON.stringify({ orderId: order.orderId }),
  }, other.cookie);
  assert.equal(forgedConfirm.status, 403);
});
