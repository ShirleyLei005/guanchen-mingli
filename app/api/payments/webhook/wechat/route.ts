import { NextRequest, NextResponse } from "next/server";
import { getStore } from "../../../../../lib/store";
import { PaymentError, settlePaidOrder } from "../../../../../lib/payments";
import { orderIdFromOutTradeNo, verifyWechatWebhook } from "../../../../../lib/payments/wechat";
import { sha256Hex } from "../../../../../lib/payments/crypto";

export async function POST(request: NextRequest) {
  const store = await getStore();
  try {
    const rawBody = await request.text();
    const payload = await verifyWechatWebhook(request.headers, rawBody);
    // 非交易成功事件（如退款、账单）直接确认收下，避免微信反复重试。
    if (payload.eventType !== "TRANSACTION.SUCCESS") {
      return NextResponse.json({ code: "SUCCESS", message: "已忽略" });
    }
    const order = await store.getOrderById(orderIdFromOutTradeNo(payload.outTradeNo));
    if (!order) {
      return NextResponse.json({ code: "FAIL", message: "订单不存在" }, { status: 404 });
    }
    if (order.provider !== "wechat") {
      return NextResponse.json({ code: "FAIL", message: "支付方式不匹配" }, { status: 400 });
    }
    if (order.amountFen !== payload.amountFen) {
      return NextResponse.json({ code: "FAIL", message: "支付金额不匹配" }, { status: 400 });
    }
    const owner = await store.getUserById(order.userId);
    if (!owner) {
      return NextResponse.json({ code: "FAIL", message: "用户不存在" }, { status: 404 });
    }
    await settlePaidOrder(owner, order, store, {
      providerTradeNo: payload.transactionId,
      eventId: payload.transactionId,
      payloadHash: await sha256Hex(rawBody),
    });
    return NextResponse.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ code: "FAIL", message: error.message }, { status: error.status });
    }
    return NextResponse.json({ code: "FAIL", message: "回调处理失败" }, { status: 500 });
  }
}
