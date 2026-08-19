import { NextRequest } from "next/server";
import { getStore } from "../../../../../lib/store";
import { PaymentError, settlePaidOrder } from "../../../../../lib/payments";
import { verifyAlipayNotify } from "../../../../../lib/payments/alipay";
import { orderIdFromOutTradeNo } from "../../../../../lib/payments/wechat";
import { sha256Hex } from "../../../../../lib/payments/crypto";

export async function POST(request: NextRequest) {
  const store = await getStore();
  try {
    const rawBody = await request.text();
    const payload = await verifyAlipayNotify(new URLSearchParams(rawBody));
    // 只有交易成功才入账；其余状态确认收下即可。
    if (payload.tradeStatus !== "TRADE_SUCCESS" && payload.tradeStatus !== "TRADE_FINISHED") {
      return new Response("success");
    }
    const order = await store.getOrderById(orderIdFromOutTradeNo(payload.outTradeNo));
    if (!order) return new Response("failure");
    if (order.provider !== "alipay") return new Response("failure");
    if (order.amountFen !== payload.amountFen) return new Response("failure");
    const owner = await store.getUserById(order.userId);
    if (!owner) return new Response("failure");
    await settlePaidOrder(owner, order, store, {
      providerTradeNo: payload.tradeNo,
      eventId: payload.tradeNo,
      payloadHash: await sha256Hex(rawBody),
    });
    return new Response("success");
  } catch (error) {
    if (error instanceof PaymentError) return new Response("failure");
    return new Response("failure");
  }
}
