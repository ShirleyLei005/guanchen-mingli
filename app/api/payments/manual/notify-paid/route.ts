import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getStore } from "../../../../../lib/store";
import { PaymentError } from "../../../../../lib/payments";

export async function POST(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { orderId?: string } | null;
  if (!body?.orderId) {
    return NextResponse.json({ status: "error", code: "INVALID_INPUT", message: "缺少订单号" }, { status: 400 });
  }
  const order = await store.getOrderById(body.orderId);
  if (!order) {
    return NextResponse.json({ status: "error", code: "ORDER_NOT_FOUND", message: "订单不存在" }, { status: 404 });
  }
  if (order.userId !== user.id) {
    return NextResponse.json({ status: "error", code: "ORDER_FORBIDDEN", message: "无权操作该订单" }, { status: 403 });
  }
  if (order.provider !== "manual") {
    return NextResponse.json({ status: "error", code: "ORDER_PROVIDER_INVALID", message: "该订单不是人工充值订单" }, { status: 400 });
  }
  if (order.status === "awaiting_confirmation" || order.status === "paid") {
    return NextResponse.json({ status: "success", orderStatus: order.status, message: "已提交，等待管理员确认到账" });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ status: "error", code: "ORDER_STATE_INVALID", message: "订单当前状态无法提交" }, { status: 400 });
  }
  try {
    const updated = await store.markOrderAwaitingConfirmation(order.id);
    return NextResponse.json({ status: "success", orderStatus: updated.status, message: "已提交，等待管理员确认到账" });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "error", code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", code: "ORDER_UPDATE_FAILED", message: "提交失败，请稍后重试" }, { status: 500 });
  }
}
