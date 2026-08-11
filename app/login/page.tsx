import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { LoginCard } from "./login-card";

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
          <ul><li>保存出生档案与真太阳时校正结果</li><li>新用户注册免费获赠 5 积分</li><li>查看历史报告并基于固定命盘追问</li></ul>
        </div>
        <LoginCard />
      </section>
      <SiteFooter />
    </main>
  );
}
