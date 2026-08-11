import { getStore, type AppStore, type OrderRow, type StoreUser } from "./store";

export type PaymentResult = {
  order: OrderRow;
  payment: { mode: "sandbox" | "wechat" | "alipay"; payUrl: string };
};

export function getPaymentProvider() {
  return (process.env.PAYMENT_PROVIDER || "sandbox") as "sandbox" | "wechat" | "alipay";
}

export async function createPaymentOrder(user: StoreUser, packageId: string, idempotencyKey: string, store?: AppStore): Promise<PaymentResult> {
  const activeStore = store ?? (await getStore());
  const packages = await activeStore.getCreditPackages();
  const pack = packages.find((item) => item.id === packageId);
  if (!pack) throw new PaymentError("PACKAGE_NOT_FOUND", "积分套餐不存在", 404);

  const provider = getPaymentProvider();
  if (provider !== "sandbox" && !process.env[`${provider.toUpperCase()}_PAYMENT_SECRET`]) {
    throw new PaymentError("PAYMENT_NOT_CONFIGURED", `${provider === "wechat" ? "微信" : "支付宝"}支付尚未完成商户配置，当前请使用沙箱支付`, 501);
  }

  const order = await activeStore.createOrder({
    id: crypto.randomUUID(),
    userId: user.id,
    packageId: pack.id,
    provider,
    amountFen: pack.priceFen,
    credits: pack.credits,
    idempotencyKey,
  });

  const payUrl = provider === "sandbox"
    ? `/api/payments/sandbox/confirm?orderId=${order.id}`
    : `/pay/${provider}?orderId=${order.id}`;
  return { order, payment: { mode: provider, payUrl } };
}

export async function applyPaidOrder(user: StoreUser, order: OrderRow, store: AppStore) {
  if (order.userId !== user.id) {
    throw new PaymentError("ORDER_FORBIDDEN", "无权操作该订单", 403);
  }
  if (order.status === "paid") {
    return { balanceAfter: await store.getBalance(user.id), creditsAdded: 0, alreadyPaid: true, order };
  }

  const providerTradeNo = `sandbox-${order.id}`;
  await store.recordPaymentEvent({
    id: crypto.randomUUID(),
    provider: order.provider,
    eventId: `pay-${order.id}`,
    orderId: order.id,
    payloadHash: await simpleHash(`${order.id}:${order.amountFen}:${order.credits}`),
  });
  const credited = await store.credit(user.id, order.credits, {
    kind: "recharge",
    referenceType: "order",
    referenceId: order.id,
    idempotencyKey: `order:${order.id}`,
  });
  const paidOrder = await store.markOrderPaid(order.id, providerTradeNo, new Date().toISOString());
  return { balanceAfter: credited.balanceAfter, creditsAdded: order.credits, alreadyPaid: false, order: paidOrder };
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
