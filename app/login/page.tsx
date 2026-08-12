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
          <p>观天时 · 察人事 · 知进退</p>
          <h1>解码东方智慧，<br />洞见人生起伏。</h1>
          <span>以八字观人生格局，以紫微察十二宫垣。注册观辰，保存命盘与报告，让每一份洞察都回到现实选择。</span>
          <ul><li>注册并验证邮箱，免费获赠 5 积分</li><li>查看历史报告并基于固定命盘追问</li></ul>
        </div>
        <LoginCard />
      </section>
      <SiteFooter />
    </main>
  );
}
