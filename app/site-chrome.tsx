"use client";

import Link from "next/link";
import { GuanchenBrandMark } from "./brand-mark";
import { useEffect, useState } from "react";
import { RechargeModal } from "./recharge-modal";

export function SiteHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<{ authenticated: boolean; credits: number }>({ authenticated: false, credits: 0 });
  const items = [
    ["/", "首页", "home"],
    ["/bazi", "八字测算", "bazi"],
    ["/ziwei", "紫微斗数", "ziwei"],
    ["/match", "双人合盘", "match"],
    ["/knowledge", "命理课堂", "knowledge"],
  ];

  useEffect(() => {
    const refresh = () => void fetch("/api/credits")
      .then((response) => response.json())
      .then((data: { authenticated?: boolean; credits?: number }) => {
        setSession({ authenticated: Boolean(data.authenticated), credits: Number(data.credits) || 0 });
      })
      .catch(() => undefined);
    refresh();
    const updateBalance = (event: Event) => setSession((current) => ({ ...current, credits: Number((event as CustomEvent<number>).detail) }));
    const updateSession = (event: Event) => {
      const detail = (event as CustomEvent<{ authenticated?: boolean; credits?: number }>).detail;
      setSession({ authenticated: Boolean(detail?.authenticated), credits: Number(detail?.credits) || 0 });
    };
    window.addEventListener("guanchen:credits", updateBalance);
    window.addEventListener("guanchen:session", updateSession);
    return () => {
      window.removeEventListener("guanchen:credits", updateBalance);
      window.removeEventListener("guanchen:session", updateSession);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.dispatchEvent(new CustomEvent("guanchen:session", { detail: { authenticated: false, credits: 0 } }));
    window.location.href = "/";
  }

  function openRecharge() {
    window.dispatchEvent(new CustomEvent("guanchen:open-recharge"));
  }

  return (
    <header className="sub-nav">
      <Link className="brand" href="/" aria-label="观辰首页">
        <GuanchenBrandMark />
        <span><strong>观辰</strong><small>东方命理 · 观势知行</small></span>
      </Link>
      <nav className={open ? "open" : ""} aria-label="主导航">
        {items.map(([href, label, id]) => (
          <Link key={id} className={active === id ? "active" : ""} href={href} onClick={() => setOpen(false)}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="sub-account">
        <Link href="/login">登录</Link>
        {session.authenticated ? (
          <>
            <button className="sub-credit" onClick={openRecharge}>{session.credits} 积分</button>
            <button className="sub-logout" onClick={() => void logout()}>退出</button>
          </>
        ) : (
          <Link className="sub-credit" href="/login">登录领 5 积分</Link>
        )}
        <button aria-label="打开菜单" aria-expanded={open} onClick={() => setOpen((value) => !value)}>☰</button>
      </div>
      <RechargeModal />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="brand footer-brand"><GuanchenBrandMark /><span><strong>观辰</strong><small>东方命理 · 观势知行</small></span></div>
      <p>传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。</p>
      <div><Link href="/knowledge">隐私说明</Link><Link href="/knowledge">用户协议</Link><Link href="/knowledge">联系我们</Link></div>
      <small>© 2026 观辰 · 观天时，察人事，知进退</small>
    </footer>
  );
}
