import { NextRequest, NextResponse } from "next/server";
import { applyPaidOrder, PaymentError } from "../../../../../lib/payments";
import { getStore } from "../../../../../lib/store";

const DEFAULT_SANDBOX_SECRET = "guanchen-sandbox-secret";

export async function POST(request: NextRequest) {
  const expected = process.env.SANDBOX_PAYMENT_SECRET || DEFAULT_SANDBOX_SECRET;
  const provided = request.headers.get("x-sandbox-secret");
  if (!provided || provided !== expected) {
    return NextResponse.json({ status: "error", code: "INVALID_SIGNATURE", message: "支付回调验签失败" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId) {
    return NextResponse.json({ status: "error", code: "INVALID_INPUT", message: "缺少订单号" }, { status: 400 });
  }
  const store = await getStore();
  const order = await store.getOrderById(body.orderId);
  if (!order) {
    return NextResponse.json({ status: "error", code: "ORDER_NOT_FOUND", message: "订单不存在" }, { status: 404 });
  }
  // Webhook 由支付服务商调用，不依赖用户会话；这里以订单归属用户完成入账。
  const owner = await store.getUserById(order.userId);
  if (!owner) {
    return NextResponse.json({ status: "error", code: "USER_NOT_FOUND", message: "订单用户不存在" }, { status: 404 });
  }
  try {
    const result = await applyPaidOrder(owner, order, store);
    return NextResponse.json({ status: "success", orderId: order.id, balanceAfter: result.balanceAfter });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "error", code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", code: "PAYMENT_APPLY_FAILED", message: "支付入账失败" }, { status: 500 });
  }
}
