import { PaymentError } from "../payments";
import QRCode from "qrcode";
import {
  aesGcmDecrypt,
  importPrivateKey,
  importPublicKey,
  signRsaSha256,
  verifyRsaSha256,
} from "./crypto";
import type { OrderRow } from "../store";

const WECHAT_PAY_PUBLIC_KEY_MODE = true; // 使用微信支付公钥模式，避免平台证书轮换

function wechatApiBase() {
  return process.env.WECHAT_API_BASE?.trim() || "https://api.mch.weixin.qq.com";
}

export type WechatConfig = {
  mchid: string;
  appid: string;
  serialNo: string;
  apiV3Key: string;
  notifyBaseUrl: string;
};

export function getWechatConfig(): WechatConfig {
  const mchid = process.env.WECHAT_PAY_MCHID?.trim();
  const appid = process.env.WECHAT_PAY_APPID?.trim();
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO?.trim();
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY?.trim();
  const notifyBaseUrl = process.env.PAYMENT_NOTIFY_BASE_URL?.trim();
  if (!mchid || !appid || !serialNo || !apiV3Key || !notifyBaseUrl) {
    throw new PaymentError("PAYMENT_NOT_CONFIGURED", "微信支付尚未完成商户配置，当前请使用沙箱支付", 501);
  }
  return { mchid, appid, serialNo, apiV3Key, notifyBaseUrl };
}

function privateKeyPem() {
  return process.env.WECHAT_PAY_PRIVATE_KEY?.trim() ?? "";
}

function publicKeyPem() {
  return process.env.WECHAT_PAY_PUBLIC_KEY?.trim() ?? "";
}

function publicKeyId() {
  return process.env.WECHAT_PAY_PUBLIC_KEY_ID?.trim() ?? "";
}

// 订单号直接使用订单 UUID 去掉连字符（32 位），满足微信 out_trade_no 最大 32 字符限制。
export function orderIdToOutTradeNo(orderId: string): string {
  const outTradeNo = orderId.replace(/-/g, "");
  if (!/^[0-9a-zA-Z_-]{6,32}$/.test(outTradeNo)) {
    throw new PaymentError("INVALID_ORDER_ID", "订单号格式不符合支付平台要求", 500);
  }
  return outTradeNo;
}

export function orderIdFromOutTradeNo(outTradeNo: string): string {
  if (!/^[0-9a-f]{32}$/i.test(outTradeNo)) {
    throw new PaymentError("INVALID_OUT_TRADE_NO", "支付回调订单号格式无效", 400);
  }
  return outTradeNo.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

async function wechatRequest(method: "POST" | "GET", path: string, body?: unknown) {
  const config = getWechatConfig();
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyText}\n`;
  const keyPem = privateKeyPem();
  if (!keyPem) throw new PaymentError("PAYMENT_NOT_CONFIGURED", "微信支付商户私钥未配置", 501);
  const signature = await signRsaSha256(await importPrivateKey(keyPem), message);
  const authorization = [
    "WECHATPAY2-SHA256-RSA2048",
    `mchid="${config.mchid}"`,
    `nonce_str="${nonce}"`,
    `signature="${signature}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${config.serialNo}"`,
  ].join(",");
  const response = await fetch(`${wechatApiBase()}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
      "User-Agent": "guanchen-payment/1.0",
    },
    body: body === undefined ? undefined : bodyText,
  });
  const text = await response.text();
  if (!response.ok) {
    let detail = "";
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      detail = parsed.message ? `：${parsed.message}` : "";
    } catch {
      // 忽略非 JSON 错误体
    }
    throw new PaymentError("WECHAT_API_FAILED", `微信支付接口调用失败（${response.status}）${detail}`, 502);
  }
  return (text ? JSON.parse(text) : {}) as Record<string, unknown>;
}

export async function createWechatNativeOrder(order: OrderRow): Promise<{
  mode: "wechat";
  payUrl: string;
  qrCodeDataUrl: string;
}> {
  const config = getWechatConfig();
  const notifyUrl = `${config.notifyBaseUrl.replace(/\/$/, "")}/api/payments/webhook/wechat`;
  const payload = await wechatRequest("POST", "/v3/pay/transactions/native", {
    appid: config.appid,
    mchid: config.mchid,
    description: `观辰积分充值（${order.credits}积分）`,
    out_trade_no: orderIdToOutTradeNo(order.id),
    notify_url: notifyUrl,
    amount: { total: order.amountFen, currency: "CNY" },
  });
  const codeUrl = typeof payload.code_url === "string" ? payload.code_url : "";
  if (!codeUrl) throw new PaymentError("WECHAT_NO_CODE_URL", "微信支付未返回收款码，请稍后重试", 502);
  const qrCodeDataUrl = await QRCode.toDataURL(codeUrl, { width: 320, margin: 1, errorCorrectionLevel: "M" });
  return { mode: "wechat", payUrl: codeUrl, qrCodeDataUrl };
}

export async function queryWechatOrder(orderId: string): Promise<{
  paid: boolean;
  providerTradeNo?: string;
  amountFen?: number;
}> {
  const config = getWechatConfig();
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderIdToOutTradeNo(orderId))}?mchid=${encodeURIComponent(config.mchid)}`;
  const payload = await wechatRequest("GET", path);
  const amount = payload.amount as { total?: number } | undefined;
  return {
    paid: payload.trade_state === "SUCCESS",
    providerTradeNo: typeof payload.transaction_id === "string" ? payload.transaction_id : undefined,
    amountFen: typeof amount?.total === "number" ? amount.total : undefined,
  };
}

export type WechatWebhookPayload = {
  eventType: string;
  outTradeNo: string;
  transactionId: string;
  amountFen: number;
};

export async function verifyWechatWebhook(headers: Headers, rawBody: string): Promise<WechatWebhookPayload> {
  const timestamp = headers.get("wechatpay-timestamp");
  const nonce = headers.get("wechatpay-nonce");
  const signature = headers.get("wechatpay-signature");
  const serial = headers.get("wechatpay-serial");
  if (!timestamp || !nonce || !signature || !serial) {
    throw new PaymentError("INVALID_SIGNATURE", "微信回调缺少验签信息", 401);
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new PaymentError("INVALID_SIGNATURE", "微信回调时间戳已过期", 401);
  }
  const keyId = publicKeyId();
  if (WECHAT_PAY_PUBLIC_KEY_MODE && keyId && serial !== keyId) {
    throw new PaymentError("INVALID_SIGNATURE", "微信回调公钥 ID 不匹配", 401);
  }
  const keyPem = publicKeyPem();
  if (!keyPem) throw new PaymentError("PAYMENT_NOT_CONFIGURED", "微信支付公钥未配置", 501);
  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  const verified = await verifyRsaSha256(await importPublicKey(keyPem), message, signature);
  if (!verified) throw new PaymentError("INVALID_SIGNATURE", "微信回调验签失败", 401);

  const body = JSON.parse(rawBody) as {
    event_type?: string;
    resource?: {
      algorithm?: string;
      ciphertext?: string;
      associated_data?: string;
      nonce?: string;
      original_type?: string;
    };
  };
  const resource = body.resource;
  if (!resource?.ciphertext || !resource.nonce) {
    throw new PaymentError("INVALID_PAYLOAD", "微信回调缺少加密内容", 400);
  }
  const config = getWechatConfig();
  const plaintext = await aesGcmDecrypt({
    key: config.apiV3Key,
    nonceBase64: resource.nonce,
    ciphertextBase64: resource.ciphertext,
    associatedData: resource.associated_data ?? undefined,
  });
  const data = JSON.parse(plaintext) as {
    out_trade_no?: string;
    transaction_id?: string;
    trade_state?: string;
    amount?: { total?: number };
  };
  if (!data.out_trade_no || !data.transaction_id) {
    throw new PaymentError("INVALID_PAYLOAD", "微信回调缺少订单信息", 400);
  }
  return {
    eventType: body.event_type ?? "",
    outTradeNo: data.out_trade_no,
    transactionId: data.transaction_id,
    amountFen: typeof data.amount?.total === "number" ? data.amount.total : 0,
  };
}
