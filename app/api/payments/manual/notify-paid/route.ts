import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../../../lib/auth";
import { getStore } from "../../../../../lib/store";
import {
  getManualAutoConfirmDailyLimitFen,
  isManualAutoConfirmEnabled,
  PaymentError,
  settlePaidOrder,
} from "../../../../../lib/payments";
import { sha256Hex } from "../../../../../lib/payments/crypto";

function beijingTodayStartIso() {
  const now = new Date();
  const beijing = new Date(now.getTime() + 8 * 3600 * 1000);
  const start = new Date(Date.UTC(beijing.getUTCFullYear(), beijing.getUTCMonth(), beijing.getUTCDate()) - 8 * 3600 * 1000);
  return start.toISOString();
}

export async function POST(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) {
    return NextResponse.json({ status: "error", code: "AUTH_REQUIRED", message: "请先登录" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { orderId?: string; tradeNo?: string } | null;
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
  if (order.status === "paid") {
    return NextResponse.json({
      status: "success",
      orderStatus: "paid",
      creditsAdded: 0,
      balanceAfter: await store.getBalance(user.id),
      message: "该订单已到账",
    });
  }
  if (order.status === "awaiting_confirmation") {
    return NextResponse.json({ status: "success", orderStatus: "awaiting_confirmation", message: "已提交，等待管理员确认到账" });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ status: "error", code: "ORDER_STATE_INVALID", message: "订单当前状态无法提交" }, { status: 400 });
  }

  const tradeNo = body.tradeNo?.trim() || "";
  if (tradeNo) {
    if (!/^[0-9A-Za-z_-]{8,40}$/.test(tradeNo)) {
      return NextResponse.json({ status: "error", code: "INVALID_TRADE_NO", message: "微信支付交易单号格式无效" }, { status: 400 });
    }
    const existing = await store.findOrderByProviderTradeNo(tradeNo);
    if (existing && existing.id !== order.id) {
      return NextResponse.json({ status: "error", code: "TRADE_NO_REUSED", message: "该交易单号已被使用" }, { status: 400 });
    }
  }

  try {
    if (isManualAutoConfirmEnabled()) {
      const paidToday = await store.sumManualPaidAmountSince(user.id, beijingTodayStartIso());
      const dailyLimit = getManualAutoConfirmDailyLimitFen();
      if (paidToday + order.amountFen > dailyLimit) {
        const updated = await store.markOrderAwaitingConfirmation(order.id);
        return NextResponse.json({
          status: "success",
          orderStatus: updated.status,
          message: "今日自动确认额度已用完，已转人工确认",
        });
      }
      const providerTradeNo = tradeNo || `manual-${order.id}`;
      const result = await settlePaidOrder(user, order, store, {
        providerTradeNo,
        eventId: `manual-${order.id}`,
        payloadHash: await sha256Hex(`${order.id}:manual:${providerTradeNo}`),
      });
      return NextResponse.json({
        status: "success",
        orderStatus: "paid",
        creditsAdded: result.creditsAdded,
        balanceAfter: result.balanceAfter,
        message: "已自动确认到账",
      });
    }
    const updated = await store.markOrderAwaitingConfirmation(order.id);
    return NextResponse.json({ status: "success", orderStatus: updated.status, message: "已提交，等待管理员确认到账" });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ status: "error", code: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ status: "error", code: "ORDER_UPDATE_FAILED", message: "提交失败，请稍后重试" }, { status: 500 });
  }
}
