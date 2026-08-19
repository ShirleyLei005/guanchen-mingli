import { getStore, type AppStore, type OrderRow, type StoreUser } from "./store";
import { createWechatNativeOrder, queryWechatOrder } from "./payments/wechat";
import { createAlipayPagePay, queryAlipayOrder } from "./payments/alipay";
import { sha256Hex } from "./payments/crypto";

export type PaymentResult = {
  order: OrderRow;
  payment: PaymentSession;
};

export type PaymentSession = {
  mode: "sandbox" | "wechat" | "alipay";
  payUrl?: string;
  qrCodeDataUrl?: string;
};

export function getPaymentProvider() {
  return (process.env.PAYMENT_PROVIDER || "sandbox") as "sandbox" | "wechat" | "alipay";
}

export async function createPaymentOrder(user: StoreUser, packageId: string, idempotencyKey: string, store?: AppStore): Promise<PaymentResult> {
  const activeStore = store ?? (await getStore());
  const packages = await activeStore.getCreditPackages();
  const pack = packages.find((item) => item.id === packageId);
  if (!pack) throw new PaymentError("PACKAGE_NOT_FOUND", "积分套餐不存在", 404);

  const order = await activeStore.createOrder({
    id: crypto.randomUUID(),
    userId: user.id,
    packageId: pack.id,
    provider: getPaymentProvider(),
    amountFen: pack.priceFen,
    credits: pack.credits,
    idempotencyKey,
  });

  const payment = await createProviderSession(order);
  return { order, payment };
}

async function createProviderSession(order: OrderRow): Promise<PaymentSession> {
  if (order.provider === "sandbox") {
    return { mode: "sandbox", payUrl: `/api/payments/sandbox/confirm?orderId=${order.id}` };
  }
  if (order.provider === "wechat") return createWechatNativeOrder(order);
  if (order.provider === "alipay") return createAlipayPagePay(order);
  throw new PaymentError("PAYMENT_PROVIDER_INVALID", "不支持的支付方式", 501);
}

export async function applyPaidOrder(user: StoreUser, order: OrderRow, store: AppStore) {
  return settlePaidOrder(user, order, store, {
    providerTradeNo: `sandbox-${order.id}`,
    eventId: `pay-${order.id}`,
    payloadHash: await simpleHash(`${order.id}:${order.amountFen}:${order.credits}`),
  });
}

export async function settlePaidOrder(
  user: StoreUser,
  order: OrderRow,
  store: AppStore,
  input: { providerTradeNo: string; eventId: string; payloadHash: string },
) {
  if (order.userId !== user.id) {
    throw new PaymentError("ORDER_FORBIDDEN", "无权操作该订单", 403);
  }
  if (order.status === "paid") {
    return { balanceAfter: await store.getBalance(user.id), creditsAdded: 0, alreadyPaid: true, order };
  }

  await store.recordPaymentEvent({
    id: crypto.randomUUID(),
    provider: order.provider,
    eventId: input.eventId,
    orderId: order.id,
    payloadHash: input.payloadHash,
  });
  const credited = await store.credit(user.id, order.credits, {
    kind: "recharge",
    referenceType: "order",
    referenceId: order.id,
    idempotencyKey: `order:${order.id}`,
  });
  const paidOrder = await store.markOrderPaid(order.id, input.providerTradeNo, new Date().toISOString());
  return {
    balanceAfter: credited.balanceAfter,
    creditsAdded: credited.applied ? order.credits : 0,
    alreadyPaid: !credited.applied,
    order: paidOrder,
  };
}

// 前端轮询订单状态时调用：真实渠道订单若已在支付平台成功但回调尚未到达，可在此补记。
export async function queryAndSettlePendingOrder(
  store: AppStore,
  order: OrderRow,
): Promise<{ order: OrderRow; balanceAfter: number } | null> {
  if (order.status === "paid" || order.provider === "sandbox") return null;
  const query = order.provider === "wechat"
    ? await queryWechatOrder(order.id)
    : order.provider === "alipay"
      ? await queryAlipayOrder(order.id)
      : null;
  if (!query?.paid) return null;
  const owner = await store.getUserById(order.userId);
  if (!owner) return null;
  const providerTradeNo = query.providerTradeNo ?? `provider-${order.id}`;
  const result = await settlePaidOrder(owner, order, store, {
    providerTradeNo,
    eventId: providerTradeNo,
    payloadHash: await sha256Hex(`${order.id}:${order.provider}:${providerTradeNo}`),
  });
  return { order: result.order, balanceAfter: result.balanceAfter };
}

export class PaymentError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}

async function simpleHash(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
