"use client";

import { useEffect, useState } from "react";

type RechargeOrder = {
  orderId: string;
  email: string;
  credits: number;
  amountFen: number;
  provider: string;
  status: string;
  paidAt: string | null;
};

export default function AdminRechargePage() {
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [status, setStatus] = useState("awaiting_confirmation");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadOrders() {
    if (!password) {
      setNotice("请先输入管理员密码");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/recharge/orders?status=${encodeURIComponent(status)}`, {
        headers: { "x-admin-password": password },
      });
      const data = await response.json() as { status?: string; orders?: RechargeOrder[]; message?: string };
      if (!response.ok) throw new Error(data.message || "加载失败");
      setOrders(data.orders ?? []);
      if (!data.orders?.length) setNotice("暂无该状态的订单");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "加载失败，请检查密码");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmOrder(orderId: string) {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/recharge/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json() as { status?: string; message?: string };
      if (!response.ok) throw new Error(data.message || "确认失败");
      setNotice(data.message || "确认成功");
      await loadOrders();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "确认失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (password) void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, sans-serif", color: "#17251f" }}>
      <h1 style={{ fontSize: 28 }}>人工充值管理</h1>
      <p style={{ color: "#5f6b65" }}>核对微信到账后，在订单上点击“确认到账”，积分会自动写入对应用户账户。</p>
      <div style={{ display: "flex", gap: 10, margin: "18px 0", flexWrap: "wrap" }}>
        <input
          type="password"
          placeholder="管理员密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{ padding: "10px 12px", border: "1px solid #ccd5d0", borderRadius: 8 }}
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ padding: "10px 12px", border: "1px solid #ccd5d0", borderRadius: 8 }}>
          <option value="awaiting_confirmation">待确认到账</option>
          <option value="pending">待支付</option>
          <option value="paid">已到账</option>
        </select>
        <button onClick={() => void loadOrders()} disabled={loading} style={{ padding: "10px 18px", borderRadius: 8, border: 0, background: "#214c3d", color: "#fff", cursor: "pointer" }}>
          {loading ? "处理中…" : "刷新"}
        </button>
      </div>
      {notice && <p style={{ color: "#9b6f2e" }}>{notice}</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {orders.map((order) => (
          <div key={order.orderId} style={{ border: "1px solid #e3e8e5", borderRadius: 12, padding: "14px 16px", background: "#fffdf7" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div><b>{order.email}</b>　{order.credits} 积分　¥{(order.amountFen / 100).toFixed(2)}</div>
                <div style={{ color: "#7a837e", fontSize: 12, marginTop: 4 }}>订单号：{order.orderId}</div>
              </div>
              {order.status === "awaiting_confirmation" && (
                <button onClick={() => void confirmOrder(order.orderId)} disabled={loading} style={{ padding: "8px 14px", borderRadius: 8, border: 0, background: "#9b6f2e", color: "#fff", cursor: "pointer" }}>
                  确认到账
                </button>
              )}
              {order.status === "paid" && <span style={{ color: "#2f6b4f", fontWeight: 600 }}>已到账</span>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
