import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../lib/auth";
import { createPaymentOrder, PaymentError } from "../../../../lib/payments";
import { getStore } from "../../../../lib/store";

export async function POST(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录后再充值" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { packageId?: string; idempotencyKey?: string } | null;
  if (!body?.packageId || !body?.idempotencyKey) {
    return NextResponse.json({ status: "error", code: "INVALID_INPUT", message: "缺少套餐或幂等键" }, { status: 400 });
  }
  try {
    const result = await createPaymentOrder(user, body.packageId, body.idempotencyKey.slice(0, 120), store);
    return NextResponse.json({
      status: "pending",
      orderId: result.order.id,
      provider: result.order.provider,
      amountFen: result.order.amountFen,
      credits: result.order.credits,
      payment: result.payment,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "error", code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", code: "ORDER_CREATE_FAILED", message: "订单创建失败，请稍后重试" }, { status: 500 });
  }
}
