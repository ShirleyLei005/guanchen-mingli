"use client";

import { useEffect, useState } from "react";

export function AccountSettings() {
  const [form, setForm] = useState({ displayName: "", email: "", currentPassword: "", newPassword: "" });
  const [verified, setVerified] = useState(true);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { void fetch("/api/account").then(async (response) => {
    if (response.status === 401) { window.location.href = "/login?returnTo=/account"; return; }
    const data = await response.json(); setForm((current) => ({ ...current, displayName: data.displayName || "", email: data.email || "" })); setVerified(Boolean(data.emailVerified));
  }); }, []);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    setLoading(true); setNotice("");
    try { const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setVerified(Boolean(data.emailVerified)); setNotice(data.message); window.dispatchEvent(new CustomEvent("guanchen:session", { detail: { authenticated: true, displayName: data.displayName, email: data.email } })); setForm((current) => ({ ...current, currentPassword: "", newPassword: "" })); }
    catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); } finally { setLoading(false); }
  }
  async function sendCode() { const response = await fetch("/api/auth/resend-verification", { method: "POST" }); const data = await response.json(); setNotice(data.message || "验证码已发送"); }
  async function verify() { const response = await fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); const data = await response.json(); setNotice(data.message || "验证完成"); if (response.ok) setVerified(true); }
  return <section className="account-panel">
    <header><p>ACCOUNT SETTINGS</p><h1>账号设置</h1><span>管理用于登录和展示的个人资料。</span></header>
    <div className="account-form">
      <label>用户名称<input value={form.displayName} onChange={(event) => set("displayName", event.target.value)} maxLength={30} /></label>
      <label>电子邮箱<input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
      <label>当前密码<small>更改邮箱或密码时需要填写</small><input type="password" value={form.currentPassword} onChange={(event) => set("currentPassword", event.target.value)} autoComplete="current-password" /></label>
      <label>新密码<small>不修改时请留空，至少 8 个字符</small><input type="password" value={form.newPassword} onChange={(event) => set("newPassword", event.target.value)} autoComplete="new-password" /></label>
      <button className="primary-btn" disabled={loading} onClick={() => void save()}>{loading ? "正在保存…" : "保存账号设置"}</button>
      {!verified && <div className="email-verify-box"><b>新邮箱尚未验证</b><button onClick={() => void sendCode()}>发送验证码</button><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="输入 6 位验证码" /><button onClick={() => void verify()}>完成验证</button></div>}
      {notice && <p className="form-notice">{notice}</p>}
    </div>
  </section>;
}
