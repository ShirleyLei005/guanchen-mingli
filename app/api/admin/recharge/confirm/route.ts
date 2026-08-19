import { NextRequest, NextResponse } from "next/server";
import { getStore } from "../../../../../lib/store";
import { PaymentError, settlePaidOrder } from "../../../../../lib/payments";
import { sha256Hex } from "../../../../../lib/payments/crypto";

function adminAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_RECHARGE_PASSWORD?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-admin-password");
  return provided === expected;
}

export async function POST(request: NextRequest) {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ status: "error", code: "ADMIN_FORBIDDEN", message: "管理员验证失败" }, { status: 403 });
  }
  const store = await getStore();
  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId) {
    return NextResponse.json({ status: "error", code: "INVALID_INPUT", message: "缺少订单号" }, { status: 400 });
  }
  const order = await store.getOrderById(body.orderId);
  if (!order) {
    return NextResponse.json({ status: "error", code: "ORDER_NOT_FOUND", message: "订单不存在" }, { status: 404 });
  }
  if (order.provider !== "manual") {
    return NextResponse.json({ status: "error", code: "ORDER_PROVIDER_INVALID", message: "该订单不是人工充值订单" }, { status: 400 });
  }
  if (order.status === "paid") {
    return NextResponse.json({
      status: "success",
      creditsAdded: 0,
      balanceAfter: await store.getBalance(order.userId),
      message: "该订单已确认到账",
    });
  }
  if (order.status !== "awaiting_confirmation") {
    return NextResponse.json({ status: "error", code: "ORDER_STATE_INVALID", message: "只有用户已标记支付的订单才能确认到账" }, { status: 400 });
  }
  const owner = await store.getUserById(order.userId);
  if (!owner) {
    return NextResponse.json({ status: "error", code: "USER_NOT_FOUND", message: "订单用户不存在" }, { status: 404 });
  }
  try {
    const providerTradeNo = `manual-${order.id}`;
    const result = await settlePaidOrder(owner, order, store, {
      providerTradeNo,
      eventId: providerTradeNo,
      payloadHash: await sha256Hex(`${order.id}:manual:confirmed`),
    });
    return NextResponse.json({
      status: "success",
      orderId: order.id,
      creditsAdded: result.creditsAdded,
      balanceAfter: result.balanceAfter,
      message: `${result.creditsAdded} 积分已确认到账`,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "error", code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", code: "PAYMENT_APPLY_FAILED", message: "确认到账失败，请稍后重试" }, { status: 500 });
  }
}
