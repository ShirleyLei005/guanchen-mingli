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
      <section className="knowledge-index">
        <article><span>01 · 八字基础</span><h2>为什么四柱以节气换月？</h2><p>农历月份与命理月柱不是同一个概念。八字以节气建立太阳黄经上的时间坐标，因此必须特别处理立春和节气交界。</p><a href="/bazi">进入八字测算 →</a></article>
        <article><span>02 · 精准排盘</span><h2>钟表时间为什么不等于真太阳时？</h2><p>同一时区覆盖很宽的经度范围。出生地相对标准经线的差异，加上每天变化的均时差，会共同改变当地太阳时间。</p><a href="/bazi">校正出生时间 →</a></article>
        <article><span>03 · 紫微结构</span><h2>命宫、身宫与十二宫在说什么？</h2><p>紫微斗数以宫位结构观察不同人生领域。先看命身主轴和宫位关系，再谈单颗星曜的表现。</p><a href="/ziwei">进入紫微测算 →</a></article>
        <article><span>04 · 关系分析</span><h2>合盘不是给关系打一个分数</h2><p>真正有用的合盘应呈现双方如何互相支持、触发和消耗，以及关系在现实压力下如何协作。</p><a href="/match">进入合盘测算 →</a></article>
      </section>
      <SiteFooter />
    </main>
  );
}
