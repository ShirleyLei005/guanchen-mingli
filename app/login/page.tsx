import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const metadata: Metadata = {
  title: "登录 · 观辰",
  description: "登录观辰，保存出生档案、命盘、专题报告与连续问答记录。",
};

export default function LoginPage() {
  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="login-shell">
        <div className="login-value">
          <p>YOUR CHART, CONTINUED</p>
          <h1>保存一张命盘，<br />持续理解同一个人生。</h1>
          <ul><li>保存出生档案与真太阳时校正结果</li><li>登录赠送 5 体验积分</li><li>查看历史报告并基于固定命盘追问</li></ul>
        </div>
        <form className="login-card">
          <p>MEMBER ACCESS</p><h2>登录观辰</h2>
          <label>邮箱<input type="email" name="email" placeholder="your@email.com" autoComplete="email" /></label>
          <label>密码<input type="password" name="password" placeholder="至少 6 位字符" autoComplete="current-password" /></label>
          <label className="login-check"><input type="checkbox" name="remember" /> 记住我</label>
          <button type="button">登录并继续</button>
          <div><Link href="/">注册新账号</Link><Link href="/">忘记密码？</Link></div>
          <small>当前为前端体验页，正式身份系统将在生产上线前接入。</small>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}
