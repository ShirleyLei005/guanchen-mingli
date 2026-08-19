import { NextRequest, NextResponse } from "next/server";
import { getStore } from "../../../../../lib/store";

function adminAuthorized(request: NextRequest) {
  const expected = process.env.ADMIN_RECHARGE_PASSWORD?.trim();
  if (!expected) return false;
  const provided = request.headers.get("x-admin-password");
  return provided === expected;
}

export async function GET(request: NextRequest) {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ status: "error", code: "ADMIN_FORBIDDEN", message: "管理员验证失败" }, { status: 403 });
  }
  const store = await getStore();
  const status = request.nextUrl.searchParams.get("status") || "awaiting_confirmation";
  if (!["pending", "awaiting_confirmation", "paid"].includes(status)) {
    return NextResponse.json({ status: "error", code: "INVALID_STATUS", message: "状态参数无效" }, { status: 400 });
  }
  const orders = await store.listOrdersByStatus(status);
  const rows = await Promise.all(
    orders.map(async (order) => {
      const user = await store.getUserById(order.userId);
      return {
        orderId: order.id,
        email: user?.email ?? "未知用户",
        credits: order.credits,
        amountFen: order.amountFen,
        provider: order.provider,
        status: order.status,
        paidAt: order.paidAt,
      };
    }),
  );
  return NextResponse.json({ status: "success", orders: rows });
}
