import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { applyPaidOrder, PaymentError } from "../../../../../lib/payments";
import { getStore } from "../../../../../lib/store";

export async function POST(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录后再完成支付" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId) {
    return NextResponse.json({ status: "error", code: "INVALID_INPUT", message: "缺少订单号" }, { status: 400 });
  }
  const order = await store.getOrderById(body.orderId);
  if (!order) {
    return NextResponse.json({ status: "error", code: "ORDER_NOT_FOUND", message: "订单不存在" }, { status: 404 });
  }
  try {
    const result = await applyPaidOrder(user, order, store);
    return NextResponse.json({
      status: "paid",
      orderId: order.id,
      creditsAdded: result.creditsAdded,
      balanceAfter: result.balanceAfter,
      message: `沙箱支付成功，${result.creditsAdded} 积分已到账。`,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "error", code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", code: "PAYMENT_APPLY_FAILED", message: "支付确认失败，请稍后重试" }, { status: 500 });
  }
}
