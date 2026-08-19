import { PaymentError } from "../payments";
import { importPrivateKey, importPublicKey, signRsaSha256, verifyRsaSha256 } from "./crypto";
import { orderIdToOutTradeNo } from "./wechat";
import type { OrderRow } from "../store";

const DEFAULT_GATEWAY = "https://openapi.alipay.com/gateway.do";

export type AlipayConfig = {
  appId: string;
  gateway: string;
  notifyBaseUrl: string;
  returnBaseUrl: string;
};

export function getAlipayConfig(): AlipayConfig {
  const appId = process.env.ALIPAY_APP_ID?.trim();
  const notifyBaseUrl = process.env.PAYMENT_NOTIFY_BASE_URL?.trim();
  if (!appId || !notifyBaseUrl) {
    throw new PaymentError("PAYMENT_NOT_CONFIGURED", "支付宝支付尚未完成商户配置，当前请使用沙箱支付", 501);
  }
  return {
    appId,
    gateway: process.env.ALIPAY_GATEWAY?.trim() || DEFAULT_GATEWAY,
    notifyBaseUrl,
    returnBaseUrl: process.env.PAYMENT_RETURN_BASE_URL?.trim() || notifyBaseUrl,
  };
}

function privateKeyPem() {
  return process.env.ALIPAY_PRIVATE_KEY?.trim() ?? "";
}

function publicKeyPem() {
  return process.env.ALIPAY_PUBLIC_KEY?.trim() ?? "";
}

function beijingTimestamp(date = new Date()): string {
  const beijing = new Date(date.getTime() + 8 * 3600 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    beijing.getUTCFullYear(),
    pad(beijing.getUTCMonth() + 1),
    pad(beijing.getUTCDate()),
  ].join("-") + " " + [
    pad(beijing.getUTCHours()),
    pad(beijing.getUTCMinutes()),
    pad(beijing.getUTCSeconds()),
  ].join(":");
}

function commonParams(config: AlipayConfig): Record<string, string> {
  return {
    app_id: config.appId,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: beijingTimestamp(),
    version: "1.0",
  };
}

export async function alipaySignParams(params: Record<string, string>, privateKey: CryptoKey): Promise<string> {
  const content = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "" && params[key] != null)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return signRsaSha256(privateKey, content);
}

export async function createAlipayPagePay(order: OrderRow): Promise<{ mode: "alipay"; payUrl: string }> {
  const config = getAlipayConfig();
  const keyPem = privateKeyPem();
  if (!keyPem) throw new PaymentError("PAYMENT_NOT_CONFIGURED", "支付宝应用私钥未配置", 501);
  const params: Record<string, string> = {
    ...commonParams(config),
    method: "alipay.trade.page.pay",
    notify_url: `${config.notifyBaseUrl.replace(/\/$/, "")}/api/payments/webhook/alipay`,
    return_url: `${config.returnBaseUrl.replace(/\/$/, "")}/account`,
    biz_content: JSON.stringify({
      out_trade_no: orderIdToOutTradeNo(order.id),
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: (order.amountFen / 100).toFixed(2),
      subject: `观辰积分充值（${order.credits}积分）`,
      timeout_express: "30m",
    }),
  };
  const sign = await alipaySignParams(params, await importPrivateKey(keyPem));
  const query = new URLSearchParams({ ...params, sign });
  return { mode: "alipay", payUrl: `${config.gateway}?${query.toString()}` };
}

export async function queryAlipayOrder(orderId: string): Promise<{
  paid: boolean;
  providerTradeNo?: string;
  amountFen?: number;
}> {
  const config = getAlipayConfig();
  const keyPem = privateKeyPem();
  if (!keyPem) throw new PaymentError("PAYMENT_NOT_CONFIGURED", "支付宝应用私钥未配置", 501);
  const params: Record<string, string> = {
    ...commonParams(config),
    method: "alipay.trade.query",
    biz_content: JSON.stringify({ out_trade_no: orderIdToOutTradeNo(orderId) }),
  };
  const sign = await alipaySignParams(params, await importPrivateKey(keyPem));
  const url = `${config.gateway}?${new URLSearchParams({ ...params, sign }).toString()}`;
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new PaymentError("ALIPAY_QUERY_FAILED", `支付宝查询请求失败（${response.status}）`, 502);
  let payload: { alipay_trade_query_response?: { code?: string; msg?: string; trade_status?: string; trade_no?: string; total_amount?: string } };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new PaymentError("ALIPAY_QUERY_FAILED", "支付宝查询返回格式异常", 502);
  }
  const result = payload.alipay_trade_query_response;
  if (!result || result.code !== "10000") {
    throw new PaymentError("ALIPAY_QUERY_FAILED", `支付宝查询失败：${result?.msg ?? "未知错误"}`, 502);
  }
  return {
    paid: result.trade_status === "TRADE_SUCCESS" || result.trade_status === "TRADE_FINISHED",
    providerTradeNo: result.trade_no,
    amountFen: result.total_amount ? Math.round(Number(result.total_amount) * 100) : undefined,
  };
}

export type AlipayNotifyPayload = {
  outTradeNo: string;
  tradeNo: string;
  tradeStatus: string;
  amountFen: number;
};

export async function verifyAlipayNotify(params: URLSearchParams): Promise<AlipayNotifyPayload> {
  const config = getAlipayConfig();
  const record: Record<string, string> = {};
  for (const [key, value] of params.entries()) record[key] = value;
  const sign = record.sign;
  if (!sign) throw new PaymentError("INVALID_SIGNATURE", "支付宝回调缺少签名", 401);
  if (record.app_id !== config.appId) {
    throw new PaymentError("INVALID_SIGNATURE", "支付宝回调 AppID 不匹配", 401);
  }
  const content = Object.keys(record)
    .filter((key) => key !== "sign" && key !== "sign_type" && record[key] !== "")
    .sort()
    .map((key) => `${key}=${record[key]}`)
    .join("&");
  const keyPem = publicKeyPem();
  if (!keyPem) throw new PaymentError("PAYMENT_NOT_CONFIGURED", "支付宝公钥未配置", 501);
  const verified = await verifyRsaSha256(await importPublicKey(keyPem), content, sign);
  if (!verified) throw new PaymentError("INVALID_SIGNATURE", "支付宝回调验签失败", 401);
  const outTradeNo = record.out_trade_no ?? "";
  const tradeNo = record.trade_no ?? "";
  const tradeStatus = record.trade_status ?? "";
  const totalAmount = Number(record.total_amount ?? "0");
  if (!outTradeNo || !tradeNo) throw new PaymentError("INVALID_PAYLOAD", "支付宝回调缺少订单信息", 400);
  return { outTradeNo, tradeNo, tradeStatus, amountFen: Math.round(totalAmount * 100) };
}
