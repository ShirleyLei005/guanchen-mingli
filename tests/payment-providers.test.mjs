import assert from "node:assert/strict";
import test from "node:test";
import {
  createCipheriv,
  createPrivateKey,
  generateKeyPairSync,
  randomBytes,
  sign as nodeSign,
} from "node:crypto";

const ENV = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const CTX = { waitUntil() {}, passThroughOnException() {} };

process.env.ALLOW_DEBUG_VERIFICATION_CODE = "true";
process.env.PAYMENT_NOTIFY_BASE_URL = "https://guanchen.site";
process.env.PAYMENT_RETURN_BASE_URL = "https://guanchen.site";

const { privateKey: privatePkcs8, publicKey: publicSpki } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const privateKeyObject = createPrivateKey(privatePkcs8);

function signMessage(message) {
  return nodeSign("sha256", Buffer.from(message, "utf8"), privateKeyObject).toString("base64");
}

function wechatResource(plaintext) {
  const key = Buffer.from(process.env.WECHAT_PAY_API_V3_KEY, "utf8");
  const nonce = randomBytes(12);
  const associatedData = "transaction";
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(plaintext), "utf8"), cipher.final()]);
  return {
    algorithm: "AEAD_AES_256_GCM",
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
    associated_data: associatedData,
    nonce: nonce.toString("base64"),
    original_type: "transaction",
  };
}

// 拦截 Worker 对微信/支付宝的真实网络调用，改为本地固定响应，避免测试依赖外部网络。
globalThis.fetch = async (input, init) => {
  const url = String(input);
  const method = init?.method || "GET";
  if (url.includes("api.mch.weixin.qq.com")) {
    if (method === "POST" && url.includes("/v3/pay/transactions/native")) {
      return Response.json({ code_url: "weixin://wxpay/bizpayurl?pr=GC-TEST" });
    }
    if (url.includes("/v3/pay/transactions/out-trade-no/")) {
      const outTradeNo = decodeURIComponent(url.split("/v3/pay/transactions/out-trade-no/")[1].split("?")[0]);
      return Response.json({
        trade_state: "SUCCESS",
        transaction_id: `WX-TX-${outTradeNo}`,
        amount: { total: 3900, currency: "CNY" },
      });
    }
  }
  if (url.includes("openapi.alipay.com") && url.includes("alipay.trade.query")) {
    return Response.json({
      alipay_trade_query_response: {
        code: "10000",
        msg: "Success",
        trade_status: "TRADE_SUCCESS",
        trade_no: "ALI-TX-1",
        total_amount: "39.00",
      },
    });
  }
  throw new Error(`Unexpected provider call in test: ${url}`);
};

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("payments", `${process.pid}-${Date.now()}-${Math.random()}`);
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

function setWechatEnv() {
  process.env.PAYMENT_PROVIDER = "wechat";
  process.env.WECHAT_PAY_MCHID = "1900000001";
  process.env.WECHAT_PAY_APPID = "wx1234567890abcdef";
  process.env.WECHAT_PAY_SERIAL_NO = "MCH-SERIAL-1";
  process.env.WECHAT_PAY_API_V3_KEY = "0123456789abcdef0123456789abcdef";
  process.env.WECHAT_PAY_PRIVATE_KEY = privatePkcs8;
  process.env.WECHAT_PAY_PUBLIC_KEY = publicSpki;
  process.env.WECHAT_PAY_PUBLIC_KEY_ID = "PUBKEY-1";
}

function clearProviderEnv() {
  for (const key of [
    "PAYMENT_PROVIDER",
    "WECHAT_PAY_MCHID",
    "WECHAT_PAY_APPID",
    "WECHAT_PAY_SERIAL_NO",
    "WECHAT_PAY_API_V3_KEY",
    "WECHAT_PAY_PRIVATE_KEY",
    "WECHAT_PAY_PUBLIC_KEY",
    "WECHAT_PAY_PUBLIC_KEY_ID",
    "ALIPAY_APP_ID",
    "ALIPAY_PRIVATE_KEY",
    "ALIPAY_PUBLIC_KEY",
  ]) {
    delete process.env[key];
  }
}

test("wechat native order returns a QR code and verified webhook credits exactly once", async () => {
  setWechatEnv();
  try {
    const { cookie } = await registerUser("wechat@example.com");
    const orderResponse = await request("/api/payments/orders", {
      method: "POST",
      body: JSON.stringify({ packageId: "light", idempotencyKey: "wechat-order-1" }),
    }, cookie);
    assert.equal(orderResponse.status, 200);
    const order = await orderResponse.json();
    assert.equal(order.provider, "wechat");
    assert.equal(order.payment.mode, "wechat");
    assert.match(order.payment.qrCodeDataUrl, /^data:image\/png;base64,/);

    const rawBody = JSON.stringify({
      event_type: "TRANSACTION.SUCCESS",
      resource: wechatResource({
        out_trade_no: order.orderId.replace(/-/g, ""),
        transaction_id: "4200002220240000000000000001",
        trade_state: "SUCCESS",
        amount: { total: 990, currency: "CNY" },
      }),
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = "testnonce1234567890";
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const signature = signMessage(message);
    const webhookHeaders = {
      "wechatpay-timestamp": timestamp,
      "wechatpay-nonce": nonce,
      "wechatpay-signature": signature,
      "wechatpay-serial": "PUBKEY-1",
    };

    const webhook = await request("/api/payments/webhook/wechat", {
      method: "POST",
      headers: webhookHeaders,
      body: rawBody,
    });
    assert.equal(webhook.status, 200);
    assert.equal((await webhook.json()).code, "SUCCESS");

    const balance = await request("/api/credits", {}, cookie).then((response) => response.json());
    assert.equal(balance.credits, 15);

    const duplicate = await request("/api/payments/webhook/wechat", {
      method: "POST",
      headers: webhookHeaders,
      body: rawBody,
    });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).code, "SUCCESS");
    const balanceAfterDuplicate = await request("/api/credits", {}, cookie).then((response) => response.json());
    assert.equal(balanceAfterDuplicate.credits, 15);
  } finally {
    clearProviderEnv();
  }
});

test("wechat webhook rejects forged signatures", async () => {
  setWechatEnv();
  try {
    const { cookie } = await registerUser("forged@example.com");
    const orderResponse = await request("/api/payments/orders", {
      method: "POST",
      body: JSON.stringify({ packageId: "light", idempotencyKey: "wechat-order-forged" }),
    }, cookie);
    const order = await orderResponse.json();
    const rawBody = JSON.stringify({
      event_type: "TRANSACTION.SUCCESS",
      resource: wechatResource({
        out_trade_no: order.orderId.replace(/-/g, ""),
        transaction_id: "4200002220240000000000000999",
        trade_state: "SUCCESS",
        amount: { total: 990, currency: "CNY" },
      }),
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const forged = await request("/api/payments/webhook/wechat", {
      method: "POST",
      headers: {
        "wechatpay-timestamp": timestamp,
        "wechatpay-nonce": "forgednonce12345",
        "wechatpay-signature": "forged-signature",
        "wechatpay-serial": "PUBKEY-1",
      },
      body: rawBody,
    });
    assert.equal(forged.status, 401);
  } finally {
    clearProviderEnv();
  }
});

test("alipay page pay redirects and verified notify credits exactly once", async () => {
  process.env.PAYMENT_PROVIDER = "alipay";
  process.env.ALIPAY_APP_ID = "2021000000000000";
  process.env.ALIPAY_PRIVATE_KEY = privatePkcs8;
  process.env.ALIPAY_PUBLIC_KEY = publicSpki;
  try {
    const { cookie } = await registerUser("alipay@example.com");
    const orderResponse = await request("/api/payments/orders", {
      method: "POST",
      body: JSON.stringify({ packageId: "light", idempotencyKey: "alipay-order-1" }),
    }, cookie);
    assert.equal(orderResponse.status, 200);
    const order = await orderResponse.json();
    assert.equal(order.provider, "alipay");
    assert.equal(order.payment.mode, "alipay");
    assert.match(order.payment.payUrl, /gateway\.do/);

    const params = new URLSearchParams();
    params.set("app_id", process.env.ALIPAY_APP_ID);
    params.set("charset", "utf-8");
    params.set("sign_type", "RSA2");
    params.set("timestamp", "2026-08-19 10:00:00");
    params.set("notify_type", "trade_status_sync");
    params.set("trade_status", "TRADE_SUCCESS");
    params.set("out_trade_no", order.orderId.replace(/-/g, ""));
    params.set("trade_no", "2026081922000000000001");
    params.set("total_amount", (order.amountFen / 100).toFixed(2));
    const content = [...params.keys()]
      .filter((key) => key !== "sign" && key !== "sign_type")
      .sort()
      .map((key) => `${key}=${params.get(key)}`)
      .join("&");
    params.set("sign", signMessage(content));

    const notify = await request("/api/payments/webhook/alipay", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    assert.equal(await notify.text(), "success");

    const balance = await request("/api/credits", {}, cookie).then((response) => response.json());
    assert.equal(balance.credits, 15);

    const duplicate = await request("/api/payments/webhook/alipay", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    assert.equal(await duplicate.text(), "success");
    const balanceAfterDuplicate = await request("/api/credits", {}, cookie).then((response) => response.json());
    assert.equal(balanceAfterDuplicate.credits, 15);
  } finally {
    clearProviderEnv();
  }
});

test("pending real-provider order is settled when polled through the order endpoint", async () => {
  setWechatEnv();
  try {
    const { cookie } = await registerUser("poll@example.com");
    const orderResponse = await request("/api/payments/orders", {
      method: "POST",
      body: JSON.stringify({ packageId: "light", idempotencyKey: "wechat-order-poll" }),
    }, cookie);
    const order = await orderResponse.json();
    const poll = await request(`/api/payments/orders/${order.orderId}`, {}, cookie);
    assert.equal(poll.status, 200);
    const data = await poll.json();
    assert.equal(data.order.status, "paid");
    assert.equal(data.order.balance, 15);
  } finally {
    clearProviderEnv();
  }
});
