"use client";

import { useState } from "react";

export function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function register() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/credits/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json() as { message?: string; credits?: number; isNew?: boolean };
      if (!response.ok) throw new Error(data.message || "注册失败，请稍后重试");
      const credits = Number(data.credits ?? 5);
      window.dispatchEvent(new CustomEvent("guanchen:credits", { detail: credits }));
      setNotice(data.isNew ? `测试账号已建立，已赠送 ${credits} 积分。` : `欢迎回来，当前余额 ${credits} 积分。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return <form className="login-card" onSubmit={(event) => { event.preventDefault(); void register(); }}>
    <p>MEMBER ACCESS</p><h2>登录 / 注册观辰</h2>
    <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" autoComplete="email" required /></label>
    <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位字符" autoComplete="current-password" minLength={6} required /></label>
    <label className="login-check"><input type="checkbox" name="remember" defaultChecked /> 记住我</label>
    <button type="submit" disabled={loading}>{loading ? "正在进入…" : "登录或注册并继续"}</button>
    {notice && <small aria-live="polite">{notice}</small>}
    <small>测试期账号用于领取和核验积分；正式身份与资料同步将在生产上线前接入。</small>
  </form>;
}
