import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getStore } from "../../../../../lib/store";
import { queryAndSettlePendingOrder } from "../../../../../lib/payments";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录" }, { status: 401 });
  }
  const order = await store.getOrderById(id);
  if (!order) {
    return NextResponse.json({ status: "error", code: "ORDER_NOT_FOUND", message: "订单不存在" }, { status: 404 });
  }
  if (order.userId !== user.id) {
    return NextResponse.json({ status: "error", code: "ORDER_FORBIDDEN", message: "无权查看该订单" }, { status: 403 });
  }
  let current = order;
  let balance = await store.getBalance(user.id);
  if (current.status === "pending" && current.provider !== "sandbox") {
    try {
      const settled = await queryAndSettlePendingOrder(store, current);
      if (settled) {
        current = settled.order;
        balance = settled.balanceAfter;
      }
    } catch {
      // 查询失败时保持轮询，由支付回调负责最终入账。
    }
  }
  return NextResponse.json({ order: { ...current, balance } });
}
