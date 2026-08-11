"use client";

import { useEffect, useState } from "react";
import { GuanchenWait } from "../guanchen-wait";

type Mode = "login" | "register";

export function LoginCard() {
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ isNew: boolean; credits: number } | null>(null);
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "login") setMode("login");
    const target = params.get("returnTo") || params.get("return_to");
    if (target && target.startsWith("/") && !target.startsWith("//")) setReturnTo(target);
  }, []);

  async function submit() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await response.json() as { status?: string; message?: string; credits?: number; isNew?: boolean; code?: string };
      if (!response.ok || data.status !== "success") throw new Error(data.message || "操作失败，请稍后重试");
      const credits = Number(data.credits ?? 0);
      window.dispatchEvent(new CustomEvent("guanchen:session", { detail: { authenticated: true, credits } }));
      setSuccess({ isNew: Boolean(data.isNew), credits });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <form className="login-card login-success" onSubmit={(event) => event.preventDefault()}>
        <p>WELCOME</p>
        <h2>{success.isNew ? "注册成功，礼遇已到账" : "欢迎回来"}</h2>
        <div className="gift-banner">
          <b>5 积分</b>
          <span>{success.isNew ? "新用户礼遇已到账，可用于解锁八字或紫微斗数完整报告。" : `当前积分余额 ${success.credits}。`}</span>
        </div>
        <a className="primary-btn" href={returnTo === "/" ? "/bazi" : returnTo}>{returnTo === "/" ? "去排盘" : "继续刚才的操作"} <span>→</span></a>
        <a className="text-reset" href="/">返回首页</a>
      </form>
    );
  }

  return (
    <form className="login-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <p>MEMBER ACCESS</p>
      <h2>{mode === "register" ? "注册观辰" : "登录观辰"}</h2>
      <div className="auth-tabs">
        <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setNotice(""); }}>新用户注册</button>
        <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setNotice(""); }}>已有账号登录</button>
      </div>
      {mode === "register" && (
        <label>昵称（选填）<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="怎么称呼你" autoComplete="nickname" maxLength={40} /></label>
      )}
      <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" autoComplete="email" required /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位字符" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} required /></label>
      {mode === "register" && <p className="gift-hint">注册即赠 <b>5 积分</b>，可解锁八字或紫微斗数完整报告。</p>}
      <button type="submit" disabled={loading}>{loading ? "正在进入…" : mode === "register" ? "注册并领取 5 积分" : "登录"}</button>
      <GuanchenWait active={loading} title="小道士正在核对账号" detail="正在确认账号与积分礼遇。" estimatedSeconds={5} compact />
      {notice && <small aria-live="polite">{notice}</small>}
      <small>账号与积分保存在观辰账户体系中；出生资料仅用于排盘与经授权的报告生成。</small>
    </form>
  );
}
