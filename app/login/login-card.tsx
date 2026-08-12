"use client";

import { useEffect, useState } from "react";
import { GuanchenWait } from "../guanchen-wait";

type Mode = "login" | "register";
type Phase = "form" | "verify";

export function LoginCard() {
  const [mode, setMode] = useState<Mode>("register");
  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState("");
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

  function showSuccess(data: { isNew?: boolean; credits?: number; displayName?: string; email?: string }) {
    const credits = Number(data.credits ?? 0);
    window.dispatchEvent(new CustomEvent("guanchen:session", {
      detail: { authenticated: true, credits, displayName: data.displayName || "", email: data.email || "" },
    }));
    setSuccess({ isNew: Boolean(data.isNew), credits });
  }

  async function submit() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, website: "" }),
      });
      const data = await response.json() as {
        status?: string;
        message?: string;
        credits?: number;
        isNew?: boolean;
        verificationRequired?: boolean;
        debugCode?: string;
        email?: string;
        displayName?: string;
      };
      if (!response.ok || data.status !== "success") throw new Error(data.message || "操作失败，请稍后重试");
      if (data.verificationRequired) {
        setPendingEmail(data.email || email);
        setDebugCode(data.debugCode || "");
        setCode("");
        setPhase("verify");
        setNotice(data.message || "验证码已发送，请查收后继续。");
        return;
      }
      showSuccess(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json() as { status?: string; message?: string; credits?: number; isNew?: boolean; displayName?: string; email?: string };
      if (!response.ok || data.status !== "success") throw new Error(data.message || "验证失败，请稍后重试");
      showSuccess({ isNew: true, credits: data.credits });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "验证失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await response.json() as { status?: string; message?: string; debugCode?: string };
      if (!response.ok || data.status !== "success") throw new Error(data.message || "验证码发送失败，请稍后重试");
      setDebugCode(data.debugCode || "");
      setCode("");
      setNotice(data.message || "验证码已重新发送。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "验证码发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <form className="login-card login-success" onSubmit={(event) => event.preventDefault()}>
        <p>观辰 · 礼遇已至</p>
        <h2>{success.isNew ? "验证功成，礼遇已到账" : "故人重逢，命盘依旧"}</h2>
        <div className="gift-banner">
          <b>{success.isNew ? "5 积分" : `${success.credits} 积分`}</b>
          <span>{success.isNew ? "新用户礼遇已到账，可用于解锁八字或紫微斗数完整报告。" : `当前积分余额 ${success.credits}。`}</span>
        </div>
        <a className="primary-btn" href={returnTo === "/" ? "/bazi" : returnTo}>{returnTo === "/" ? "去排盘" : "继续刚才的操作"} <span>→</span></a>
        <a className="text-reset" href="/">返回首页</a>
      </form>
    );
  }

  if (phase === "verify") {
    return (
      <form className="login-card" onSubmit={(event) => { event.preventDefault(); void verifyCode(); }}>
        <p>观辰 · 礼遇之门</p>
        <h2>验证邮箱</h2>
        <p className="verify-lead">验证码已发送至 <b>{pendingEmail}</b>，验证通过后 5 积分自动到账。</p>
        {debugCode && <div className="debug-code-box"><span>本地预览：未发送真实邮件，验证码如下</span><b>{debugCode}</b><button type="button" onClick={() => setCode(debugCode)}>一键填入</button></div>}
        <label>6 位验证码<input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" required /></label>
        <button type="submit" disabled={loading || code.length !== 6}>{loading ? "正在验证…" : "验证并领取 5 积分"}</button>
        <button type="button" className="text-reset" disabled={loading} onClick={() => void resendCode()}>重新发送验证码</button>
        <GuanchenWait active={loading} title="小道士正在核对验证码" detail="正在确认邮箱归属并发放积分礼遇。" estimatedSeconds={5} compact />
        {notice && <small aria-live="polite">{notice}</small>}
        <small>验证码 30 分钟内有效，连续输错 5 次需重新发送。</small>
        <button type="button" className="text-reset" onClick={() => setPhase("form")}>返回修改资料</button>
      </form>
    );
  }

  return (
    <form className="login-card" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <p>观辰 · 会员之门</p>
      <h2>{mode === "register" ? "注册观辰" : "登录观辰"}</h2>
      <div className="auth-tabs">
        <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setNotice(""); }}>新用户注册</button>
        <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setNotice(""); }}>已有账号登录</button>
      </div>
      {mode === "register" && (
        <label>昵称（选填）<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="怎么称呼你" autoComplete="nickname" maxLength={40} /></label>
      )}
      {mode === "register" && <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="auth-honeypot" />}
      <label>邮箱<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" autoComplete="email" required /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 6 位字符" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} required /></label>
      {mode === "register" && <p className="gift-hint">注册并验证邮箱，即赠 <b>5 积分</b>，可解锁八字或紫微斗数完整报告。</p>}
      <button type="submit" disabled={loading}>{loading ? "正在进入…" : mode === "register" ? "注册并发送验证码" : "登录"}</button>
      <GuanchenWait active={loading} title="小道士正在核对账号" detail="正在确认账号与邮箱归属。" estimatedSeconds={5} compact />
      {notice && <small aria-live="polite">{notice}</small>}
      <small>账号与积分保存在观辰账户体系中；出生资料仅用于排盘与经授权的报告生成。</small>
    </form>
  );
}
