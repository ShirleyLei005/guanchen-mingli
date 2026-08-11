import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const metadata: Metadata = {
  title: "命理课堂 · 观辰",
  description: "从节气、真太阳时、四柱、十二宫和合盘结构开始，学习如何清醒地使用命盘。",
};

export default function KnowledgePage() {
  return (
    <main className="inner-page">
      <SiteHeader active="knowledge" />
      <section className="knowledge-hero">
        <p>KNOWLEDGE BEFORE JUDGEMENT</p>
        <h1>先理解命盘，<br />再决定如何使用它。</h1>
        <span>命理知识不是为了增加神秘感，而是帮助你辨认数据、解释与选择之间的边界。</span>
      </section>
      <nav className="knowledge-path" aria-label="命理课堂学习路径">
        <a href="#bazi">八字基础</a><a href="#ziwei">紫微斗数</a><a href="#timing">大运流年</a><a href="#relations">婚姻与六亲</a><a href="#method">清醒使用命盘</a>
      </nav>
      <section className="knowledge-index">
        <article id="bazi"><span>01 · 八字基础</span><h2>为什么四柱以节气换月？</h2><p>农历月份与命理月柱不是同一个概念。八字以节气建立太阳黄经上的时间坐标，因此必须特别处理立春和节气交界。</p><a href="/bazi">进入八字测算 →</a></article>
        <article><span>02 · 精准排盘</span><h2>钟表时间为什么不等于真太阳时？</h2><p>同一时区覆盖很宽的经度范围。出生地相对标准经线的差异，加上每天变化的均时差，会共同改变当地太阳时间。</p><a href="/bazi">校正出生时间 →</a></article>
        <article><span>03 · 子平方法</span><h2>日主旺衰，不是数一数五行</h2><p>判断强弱要同时看月令、通根、透干、制化和全局气势。某个五行数量多，不等于它真的有力，更不能直接等同喜忌。</p><a href="/bazi">查看四柱结构 →</a></article>
        <article><span>04 · 十神语言</span><h2>十神说的是关系，不是性格标签</h2><p>同一个十神会随位置、强弱和组合呈现不同作用。把它放回家庭、工作和资源关系中，才有现实解释力。</p><a href="/bazi">理解自己的关系结构 →</a></article>
        <article><span>05 · 格局与调候</span><h2>格局、扶抑、调候为什么不能混在一起？</h2><p>格局观察结构能否成立，扶抑讨论力量平衡，调候关心寒暖燥湿。三者需要互相校验，不能用一个喜用词概括全部人生。</p><a href="/bazi">生成完整八字报告 →</a></article>
        <article id="timing"><span>06 · 大运流年</span><h2>运势是时间窗口，不是事件预告</h2><p>大运像持续十年的环境背景，流年像当年被放大的议题。原局、阶段和现实选择同时作用，才形成具体经历。</p><a href="/bazi">查看阶段节奏 →</a></article>
        <article id="ziwei"><span>07 · 紫微结构</span><h2>命宫、身宫与十二宫在说什么？</h2><p>紫微斗数以宫位结构观察不同人生领域。先看命身主轴和宫位关系，再谈单颗星曜的表现。</p><a href="/ziwei">进入紫微测算 →</a></article>
        <article><span>08 · 三方四正</span><h2>为什么不能只看一颗主星？</h2><p>一个宫位会受到对宫与三合宫共同影响，四化还会让能量在宫位之间流动。单星吉凶很容易遗漏真正的结构。</p><a href="/ziwei">查看十二宫命盘 →</a></article>
        <article id="relations"><span>09 · 婚姻关系</span><h2>感情分析不等于预测结婚日期</h2><p>更有价值的阅读，是辨认亲密需求、表达习惯、边界和阶段压力，再用现实相处经验验证，而不是承诺某天一定发生什么。</p><a href="/ziwei">理解感情课题 →</a></article>
        <article><span>10 · 六亲主题</span><h2>父母、兄弟与子女宫应该怎样看？</h2><p>六亲相关信息更适合用来理解互动方式、责任分配和个人感受，不应用来替他人下确定结论，也不替代真实沟通。</p><a href="/ziwei">查看家庭主题 →</a></article>
        <article><span>11 · 双人关系</span><h2>合盘不是给关系打一个分数</h2><p>真正有用的合盘应呈现双方如何互相支持、触发和消耗，以及关系在现实压力下如何协作。</p><a href="/match">进入双人合盘 →</a></article>
        <article id="method"><span>12 · 使用边界</span><h2>怎样把“准”变成可验证的观察？</h2><p>先区分盘面事实与解释，再记录现实反馈。命盘若能帮助你看见惯性、调整选择，它才成为工具，而不是新的束缚。</p><a href="/bazi">从一张命盘开始 →</a></article>
      </section>
      <p className="knowledge-source">栏目选题参考 <a href="https://www.kvov.com/" target="_blank" rel="noreferrer">星尘算命公开知识分类</a>，正文由观辰依据证据化、非宿命原则独立编写。</p>
      <SiteFooter />
    </main>
  );
}
