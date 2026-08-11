"use client";

import Link from "next/link";
import { GuanchenBrandMark } from "./brand-mark";
import { useEffect, useState } from "react";

export function SiteHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(5);
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
      .then((data: { credits?: number }) => Number.isFinite(data.credits) && setCredits(Number(data.credits)))
      .catch(() => undefined);
    refresh();
    const update = (event: Event) => setCredits(Number((event as CustomEvent<number>).detail));
    window.addEventListener("guanchen:credits", update);
    return () => window.removeEventListener("guanchen:credits", update);
  }, []);

  return (
    <header className="sub-nav">
      <Link className="brand" href="/" aria-label="观辰首页">
        <GuanchenBrandMark />
        <span><strong>观辰</strong><small>命盘与人生决策</small></span>
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
        <Link className="sub-credit" href="/login">{credits} 积分</Link>
        <button aria-label="打开菜单" aria-expanded={open} onClick={() => setOpen((value) => !value)}>☰</button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="brand footer-brand"><GuanchenBrandMark /><span><strong>观辰</strong><small>命盘与人生决策</small></span></div>
      <p>传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。</p>
      <div><Link href="/knowledge">隐私说明</Link><Link href="/knowledge">用户协议</Link><Link href="/knowledge">联系我们</Link></div>
      <small>© 2026 观辰 · 看见趋势，理解课题，主动选择</small>
    </footer>
  );
}
