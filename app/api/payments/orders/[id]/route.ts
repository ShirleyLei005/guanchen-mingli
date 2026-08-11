import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getStore } from "../../../../../lib/store";

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
  return NextResponse.json({ order: { ...order, balance: await store.getBalance(user.id) } });
}
