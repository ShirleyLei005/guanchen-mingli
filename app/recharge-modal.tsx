"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKAGES } from "../lib/domain";

type PaymentInfo = {
  mode: "sandbox" | "wechat" | "alipay" | "manual";
  payUrl?: string;
  qrCodeDataUrl?: string;
};

type OrderState = {
  orderId: string;
  provider: string;
  amountFen: number;
  credits: number;
  payment: PaymentInfo;
};

const PROVIDER_LABELS: Record<string, string> = {
  sandbox: "沙箱模拟",
  wechat: "微信支付",
  alipay: "支付宝",
  manual: "微信人工充值",
};

export function RechargeModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"choose" | "paying" | "submitted" | "done">("choose");
  const [order, setOrder] = useState<OrderState | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [tradeNo, setTradeNo] = useState("");
  const [serverProvider, setServerProvider] = useState<"sandbox" | "wechat" | "alipay" | "manual">("sandbox");
  const [idempotencyKey] = useState(() => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

  useEffect(() => {
    function openModal() {
      setOpen(true);
      setPhase("choose");
      setOrder(null);
      setNotice("");
      setTradeNo("");
    }
    window.addEventListener("guanchen:open-recharge", openModal);
    fetch("/api/health")
      .then((response) => response.json())
      .then((data) => {
        if (["wechat", "alipay", "manual"].includes(data?.payments)) setServerProvider(data.payments);
      })
      .catch(() => {
        // 健康检查失败不影响充值入口
      });
    return () => window.removeEventListener("guanchen:open-recharge", openModal);
  }, []);

  // 真实/人工支付渠道：下单后轮询订单状态，到账后自动完成。
  useEffect(() => {
    if (!open || !["paying", "submitted"].includes(phase) || !order || order.provider === "sandbox") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/payments/orders/${order.orderId}`);
          const data = await response.json() as { order?: { status?: string; balance?: number } };
          if (data?.order?.status === "paid") {
            window.dispatchEvent(new CustomEvent("guanchen:credits", { detail: Number(data.order.balance ?? 0) }));
            setPhase("done");
            setNotice("");
          }
        } catch {
          // 单次轮询失败忽略，下一次继续
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open, phase, order]);

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
      const data = await response.json() as { status?: string; orderId?: string; provider?: string; amountFen?: number; credits?: number; payment?: PaymentInfo; code?: string; message?: string };
      if (response.status === 401) {
        window.location.href = "/login?returnTo=/";
        return;
      }
      if (!response.ok || !data.orderId) throw new Error(data.message || "创建订单失败，请稍后重试");
      const payment: PaymentInfo = data.payment ?? { mode: (data.provider as PaymentInfo["mode"]) || "sandbox" };
      setOrder({
        orderId: data.orderId,
        provider: data.provider || "sandbox",
        amountFen: data.amountFen || 0,
        credits: data.credits || 0,
        payment,
      });
      setPhase("paying");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "创建订单失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSandboxPayment() {
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

  function openAlipayCashier() {
    if (!order?.payment.payUrl) return;
    window.open(order.payment.payUrl, "_blank", "noopener");
  }

  async function markManualPaid() {
    if (!order) return;
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/payments/manual/notify-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.orderId, tradeNo: tradeNo.trim() }),
      });
      const data = await response.json() as { status?: string; orderStatus?: string; balanceAfter?: number; message?: string };
      if (!response.ok || data.status !== "success") throw new Error(data.message || "提交失败，请稍后重试");
      if (data.orderStatus === "paid") {
        window.dispatchEvent(new CustomEvent("guanchen:credits", { detail: Number(data.balanceAfter ?? 0) }));
        setPhase("done");
      } else {
        setPhase("submitted");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "提交失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function backToChoose() {
    setPhase("choose");
    setOrder(null);
    setNotice("");
  }

  const paymentMode = order?.payment.mode || serverProvider;
  const providerLabel = PROVIDER_LABELS[paymentMode] || "在线支付";
  const manualQrImage = order?.payment.qrCodeDataUrl || order?.payment.payUrl;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="积分充值">
      <div className="modal payment-modal">
        <button className="modal-close" onClick={() => setOpen(false)} aria-label="关闭">×</button>
        {phase === "choose" && (
          <>
            <p className="eyebrow">积分充值</p>
            <h2>选择积分包</h2>
            {serverProvider === "sandbox" && <p>当前为测试期沙箱支付，不会产生真实付款。正式支付将在商户资质开通后启用。</p>}
            {serverProvider === "manual" && <p>当前为人工充值模式：请使用微信扫描收款码付款，付款后点击“我已支付”，系统确认后积分自动到账。</p>}
            {(serverProvider === "wechat" || serverProvider === "alipay") && <p>支付成功后积分将自动到账，可直接用于解锁完整报告。</p>}
            {CREDIT_PACKAGES.map((pack) => (
              <button className="modal-package" key={pack.id} disabled={loading} onClick={() => void createOrder(pack.id)}>
                <span><b>{pack.credits} 积分</b><small>约 {pack.name}</small></span>
                <strong>¥{(pack.priceFen / 100).toFixed(1)} →</strong>
              </button>
            ))}
            {notice && <p className="form-notice">{notice}</p>}
          </>
        )}
        {phase === "paying" && order && (
          <>
            <p className="eyebrow">{providerLabel}收银台</p>
            <h2>确认支付</h2>
            <div className="payment-order">
              <span><small>积分包</small><b>{order.credits} 积分</b></span>
              <span><small>应付金额</small><b>¥{(order.amountFen / 100).toFixed(2)}</b></span>
              <span><small>订单号</small><b>{order.orderId}</b></span>
              <span><small>支付方式</small><b>{providerLabel}</b></span>
            </div>
            {order.payment.mode === "sandbox" && (
              <button className="primary-btn payment-confirm" disabled={loading} onClick={() => void confirmSandboxPayment()}>
                {loading ? "正在确认…" : "确认支付（沙箱模拟）"}
              </button>
            )}
            {order.payment.mode === "wechat" && (
              <div className="payment-qr">
                {order.payment.qrCodeDataUrl
                  ? <img src={order.payment.qrCodeDataUrl} alt="微信支付收款码" width={320} height={320} />
                  : <p className="form-notice">收款码生成中，请稍候…</p>}
                <p>请使用微信扫一扫完成支付，到账后本窗口会自动更新。</p>
              </div>
            )}
            {order.payment.mode === "alipay" && (
              <div className="payment-qr">
                <button className="primary-btn payment-confirm" disabled={loading} onClick={openAlipayCashier}>
                  前往支付宝收银台
                </button>
                <p>点击后将在新窗口打开支付宝完成支付，到账后本窗口会自动更新。</p>
              </div>
            )}
            {order.payment.mode === "manual" && (
              <div className="payment-qr">
                {manualQrImage
                  ? <img src={manualQrImage} alt="微信收款码" width={320} height={320} />
                  : <p className="form-notice">收款码暂未配置，请联系管理员。</p>}
                <p>
                  请使用微信扫描收款码，付款金额 <b>¥{(order.amountFen / 100).toFixed(2)}</b>；
                  付款时可在备注填写订单号后 6 位 <b>{order.orderId.slice(-6).toUpperCase()}</b>，方便核对。
                </p>
                <button className="primary-btn payment-confirm" disabled={loading} onClick={() => void markManualPaid()}>
                  {loading ? "正在确认…" : "我已支付，确认到账"}
                </button>
                <input
                  className="payment-trade-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="微信支付交易单号（选填，填了更安全）"
                  value={tradeNo}
                  onChange={(event) => setTradeNo(event.target.value)}
                  maxLength={40}
                />
                <p className="form-notice">提交后系统自动确认到账；每日自动确认额度有限，超出后转人工确认。</p>
              </div>
            )}
            {phase === "paying" && (order.payment.mode === "wechat" || order.payment.mode === "alipay") && (
              <button className="text-btn payment-cancel" onClick={backToChoose}>稍后支付，返回重选</button>
            )}
            {notice && <p className="form-notice">{notice}</p>}
          </>
        )}
        {phase === "submitted" && order && (
          <>
            <p className="eyebrow">已提交确认</p>
            <h2>等待管理员确认到账</h2>
            <p>订单号：{order.orderId}。管理员核对微信到账后，{order.credits} 积分会自动写入账户，本页面会自动刷新。</p>
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
      </div>
    </div>
  );
}
