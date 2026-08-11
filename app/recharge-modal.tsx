"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKAGES } from "../lib/domain";

type OrderState = {
  orderId: string;
  provider: string;
  amountFen: number;
  credits: number;
};

export function RechargeModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"choose" | "paying" | "done">("choose");
  const [order, setOrder] = useState<OrderState | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [idempotencyKey] = useState(() => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

  useEffect(() => {
    function openModal() {
      setOpen(true);
      setPhase("choose");
      setOrder(null);
      setNotice("");
    }
    window.addEventListener("guanchen:open-recharge", openModal);
    return () => window.removeEventListener("guanchen:open-recharge", openModal);
  }, []);

  if (!open) return null;

  async function createOrder(packageId: string) {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, idempotencyKey }),
      });
      const data = await response.json() as { status?: string; orderId?: string; provider?: string; amountFen?: number; credits?: number; code?: string; message?: string };
      if (response.status === 401) {
        window.location.href = "/login?returnTo=/";
        return;
      }
      if (!response.ok || !data.orderId) throw new Error(data.message || "创建订单失败，请稍后重试");
      setOrder({ orderId: data.orderId, provider: data.provider || "sandbox", amountFen: data.amountFen || 0, credits: data.credits || 0 });
      setPhase("paying");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建订单失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function confirmPayment() {
    if (!order) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/payments/sandbox/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId }),
      });
      const data = await response.json() as { status?: string; balanceAfter?: number; creditsAdded?: number; code?: string; message?: string };
      if (!response.ok || data.status !== "paid") throw new Error(data.message || "支付确认失败，请稍后重试");
      window.dispatchEvent(new CustomEvent("guanchen:credits", { detail: Number(data.balanceAfter) }));
      setPhase("done");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "支付确认失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="积分充值">
      <div className="modal payment-modal">
        <button className="modal-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
        {phase === "choose" && (
          <>
            <p className="eyebrow">积分充值</p>
            <h2>选择积分包</h2>
            <p>当前为测试期沙箱支付，不会产生真实付款。正式支付将在商户资质开通后启用。</p>
            {CREDIT_PACKAGES.map((pack) => (
              <button className="modal-package" key={pack.id} disabled={loading} onClick={() => void createOrder(pack.id)}>
                <span><b>{pack.credits} 积分</b><small>约 {pack.name}</small></span>
                <strong>¥{(pack.priceFen / 100).toFixed(1)} →</strong>
              </button>
            ))}
          </>
        )}
        {phase === "paying" && order && (
          <>
            <p className="eyebrow">沙箱收银台</p>
            <h2>确认支付</h2>
            <div className="payment-order">
              <span><small>积分包</small><b>{order.credits} 积分</b></span>
              <span><small>应付金额</small><b>¥{(order.amountFen / 100).toFixed(2)}</b></span>
              <span><small>支付方式</small><b>沙箱模拟（不扣真实款项）</b></span>
            </div>
            <button className="primary-btn payment-confirm" disabled={loading} onClick={() => void confirmPayment()}>
              {loading ? "正在确认…" : "确认支付（沙箱模拟）"}
            </button>
            {notice && <p className="form-notice">{notice}</p>}
          </>
        )}
        {phase === "done" && order && (
          <>
            <p className="eyebrow">支付成功</p>
            <h2>{order.credits} 积分已到账</h2>
            <p>积分已写入账户，可直接用于解锁八字、紫微斗数或双人合盘报告。</p>
            <button className="primary-btn payment-confirm" onClick={() => setOpen(false)}>继续测算</button>
          </>
        )}
        {notice && phase === "choose" && <p className="form-notice">{notice}</p>}
      </div>
    </div>
  );
}
