"use client";

import { useCallback, useState } from "react";
import type { BaziChartResult, ZiweiChartResult } from "../lib/chart-engines";
import { BirthFields, type ResolvedBirth } from "./birth-fields";
import { SiteFooter, SiteHeader } from "./site-chrome";

export type MeasurementKind = "bazi" | "ziwei" | "match" | "chat";

const configs = {
  bazi: {
    title: "八字测算",
    eyebrow: "四柱结构 · 五行能量 · 大运流年",
    intro: "填写准确的出生资料，先建立经过真太阳时校正的命盘，再选择这次最想理解的人生课题。",
    cost: 5,
    topics: ["综合看看", "事业方向", "财富节奏", "感情关系", "天赋优势", "家庭课题", "学业成长", "身心平衡", "人际互动", "阶段运势", "正缘关系", "子女课题"],
  },
  ziwei: {
    title: "紫微斗数测算",
    eyebrow: "命宫身宫 · 十二宫位 · 主星四化",
    intro: "用出生时间建立十二宫命盘，从事业、关系、财富等具体人生领域理解当下课题。",
    cost: 5,
    topics: ["命盘总览", "事业迁移", "财富田宅", "关系情感", "自我成长", "流年趋势", "合作社交", "决策参考"],
  },
  match: {
    title: "合盘测算",
    eyebrow: "双人结构 · 互动模式 · 共同成长",
    intro: "分别填写双方出生资料，理解两个人如何互相触发、支持与磨合，不用单一分数裁决关系。",
    cost: 10,
    topics: ["关系总览", "沟通模式", "情感表达", "长期发展", "压力应对", "家庭协作", "共同成长", "现实建议"],
  },
  chat: {
    title: "命盘问答",
    eyebrow: "固定命盘 · 连续追问 · 现实选择",
    intro: "建立固定命盘后，围绕工作、感情、关系与时间节点继续提问，让每一轮讨论都回到现实行动。",
    cost: 2,
    topics: ["近期选择", "事业追问", "感情追问", "关系决策", "时间节点", "行动复盘"],
  },
} as const;

export function MeasurementPage({ kind }: { kind: MeasurementKind }) {
  const config = configs[kind];
  const [primaryBirth, setPrimaryBirth] = useState<ResolvedBirth | null>(null);
  const [secondaryBirth, setSecondaryBirth] = useState<ResolvedBirth | null>(null);
  const [selected, setSelected] = useState<string[]>([config.topics[0]]);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(true);
  const [notice, setNotice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chartResult, setChartResult] = useState<BaziChartResult | ZiweiChartResult | null>(null);

  const updatePrimary = useCallback((value: ResolvedBirth | null) => setPrimaryBirth(value), []);
  const updateSecondary = useCallback((value: ResolvedBirth | null) => setSecondaryBirth(value), []);

  function toggleTopic(topic: string) {
    setSelected((current) => {
      if (current.includes(topic)) return current.filter((item) => item !== topic);
      if (current.length >= 3) {
        setNotice("一次最多选择 3 个重点方向，建议先聚焦最关心的课题。");
        return current;
      }
      setNotice("");
      return [...current, topic];
    });
  }

  async function submit() {
    if (!primaryBirth || (kind === "match" && !secondaryBirth)) {
      setNotice("请先从地点候选列表中确认出生地，并等待真太阳时校正完成。");
      return;
    }
    if (!selected.length) {
      setNotice("请至少选择一个分析方向。");
      return;
    }
    if (!consent) {
      setNotice("请先确认隐私说明与资料提交授权。");
      return;
    }
    setNotice("");
    setChartResult(null);
    setLoading(true);
    try {
      if (kind === "bazi" || kind === "ziwei") {
        const response = await fetch(`/api/charts/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trueSolarTime: primaryBirth.solarTime.trueSolarTime,
            gender: primaryBirth.gender,
            topics: selected,
            notes,
          }),
        });
        const data = await response.json() as BaziChartResult | ZiweiChartResult | { error?: string };
        if (!response.ok || "error" in data) throw new Error("排盘服务暂时不可用，请稍后重试。");
        setChartResult(data);
      }
      setSubmitted(true);
      window.setTimeout(() => document.querySelector("#measurement-result")?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "排盘失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="inner-page">
      <SiteHeader active={kind} />
      <section className="measure-hero">
        <p>{config.eyebrow}</p>
        <h1>{config.title}</h1>
        <span>{config.intro}</span>
      </section>

      <section className="measure-shell">
        <div className="measure-form-head">
          <p>START YOUR CHART</p>
          <h2>开始测算</h2>
          <span>先填基本信息，再选择这次最想看的内容。</span>
        </div>

        <BirthFields label={kind === "match" ? "第一方资料" : undefined} onChange={updatePrimary} />
        {kind === "match" && <BirthFields label="第二方资料" defaultPlace="成都" onChange={updateSecondary} />}

        <fieldset className="birth-fieldset topic-fieldset">
          <legend>本次重点方向</legend>
          <p>最多选择 3 项，完整报告会围绕所选课题组织。</p>
          <div className="measure-topics">
            {config.topics.map((topic) => (
              <button type="button" key={topic} className={selected.includes(topic) ? "selected" : ""} onClick={() => toggleTopic(topic)}>{topic}</button>
            ))}
          </div>
          <div className="topic-status"><span>已选 {selected.length}/3</span><button type="button" onClick={() => setSelected([])}>清空</button></div>
        </fieldset>

        <fieldset className="birth-fieldset">
          <legend>{kind === "chat" ? "你的问题" : "补充说明"}</legend>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={kind === "chat" ? "例如：未来半年转换工作方向，应该重点准备什么？" : "可写下这次最关心的问题、现实背景或希望重点理解的部分。"}
          />
          <label className="measure-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            我已阅读隐私说明，并确认有权提交以上出生资料
          </label>
        </fieldset>

        {notice && <p className="measure-notice">{notice}</p>}
        <button className="measure-submit" disabled={loading} onClick={() => void submit()}>
          {loading ? "正在排盘…" : "开始测算"} <span>{kind === "bazi" || kind === "ziwei" ? "生成命盘与基础解读" : `完整专题 ${config.cost} 积分`}</span> →
        </button>
        <p className="measure-submit-help">点击后将使用已校正的真太阳时生成命盘；基础排盘与本页解读不扣积分。</p>
      </section>

      {submitted && primaryBirth && (
        <section className="measure-result" id="measurement-result">
          <div>
            <p>CHART &amp; REPORT</p><h2>{chartResult ? "排盘与解读报告" : "出生坐标与排盘时间已确认"}</h2>
            <span>{chartResult ? "以下盘面由固定版本服务端引擎计算；每项解读都标明盘面依据。" : "已完成输入核对，后续产品将继续绑定同一命盘版本。"}</span>
          </div>
          <div className="verified-grid">
            <article><small>出生地点</small><b>{primaryBirth.place.name}</b><span>{primaryBirth.place.latitude.toFixed(4)}°, {primaryBirth.place.longitude.toFixed(4)}°</span></article>
            <article><small>历史时区</small><b>{primaryBirth.place.timezone}</b><span>UTC {primaryBirth.solarTime.timezoneOffsetMinutes / 60 >= 0 ? "+" : ""}{primaryBirth.solarTime.timezoneOffsetMinutes / 60}</span></article>
            <article><small>真太阳时</small><b>{primaryBirth.solarTime.trueSolarTime.replace("T", " ").slice(0, 16)}</b><span>总修正 {primaryBirth.solarTime.totalCorrectionMinutes} 分钟</span></article>
            <article><small>报告方向</small><b>{selected.join(" · ")}</b><span>本页基础解读免费</span></article>
          </div>
          {chartResult?.kind === "bazi" && <BaziResult result={chartResult} />}
          {chartResult?.kind === "ziwei" && <ZiweiResult result={chartResult} />}
          {chartResult && <ReportResult report={chartResult.report} />}
          {!chartResult && (
            <div className="engine-boundary">
              <b>本入口的排盘服务将在下一阶段接入</b>
              <p>当前已完成出生资料和真太阳时校正；本页不会用随机数据冒充正式命盘。</p>
            </div>
          )}
        </section>
      )}
      <SiteFooter />
    </main>
  );
}

function BaziResult({ result }: { result: BaziChartResult }) {
  return (
    <div className="chart-output">
      <div className="chart-output-head">
        <div><small>BAZI MCP</small><h3>{result.chart.bazi}</h3></div>
        <span>{result.engine.provider} · {result.engine.tool} · v{result.engine.version}</span>
      </div>
      <div className="bazi-pillars">
        {result.chart.pillars.map((pillar) => (
          <article key={pillar.label}>
            <small>{pillar.label}</small>
            <b>{pillar.stem}<em>{pillar.stemElement}</em></b>
            <b>{pillar.branch}<em>{pillar.branchElement}</em></b>
            <span>{pillar.tenGod || "日主"} · {pillar.nayin}</span>
            <i>藏干 {pillar.hiddenStems.join("、") || "—"}</i>
          </article>
        ))}
      </div>
      <div className="chart-facts">
        <span><small>日主</small>{result.chart.dayMaster}</span>
        <span><small>生肖</small>{result.chart.zodiac}</span>
        <span><small>命宫</small>{result.chart.ownSign}</span>
        <span><small>身宫</small>{result.chart.bodySign}</span>
        <span><small>五行表层</small>{Object.entries(result.chart.elements).map(([name, value]) => `${name}${value}`).join(" · ")}</span>
      </div>
      <div className="decade-row">
        {result.chart.decades.slice(0, 6).map((item) => (
          <span key={`${item.ganzhi}-${item.startYear}`}><b>{item.ganzhi}</b><small>{item.startYear}—{item.endYear}<br />{item.startAge}—{item.endAge} 岁</small></span>
        ))}
      </div>
    </div>
  );
}

function ZiweiResult({ result }: { result: ZiweiChartResult }) {
  return (
    <div className="chart-output">
      <div className="chart-output-head">
        <div><small>ZIWEI MCP CONTRACT</small><h3>命宫在{result.chart.soulPalaceBranch} · {result.chart.fiveElementsClass}</h3></div>
        <span>{result.engine.provider} 契约 · {result.engine.adapter} v{result.engine.version}</span>
      </div>
      <div className="ziwei-grid">
        {result.chart.palaces.map((palace) => (
          <article key={`${palace.name}-${palace.earthlyBranch}`} className={palace.earthlyBranch === result.chart.soulPalaceBranch ? "soul-palace" : ""}>
            <header><b>{palace.name}</b><span>{palace.heavenlyStem}{palace.earthlyBranch}{palace.isBodyPalace ? " · 身宫" : ""}</span></header>
            <p>{palace.majorStars.map((star) => `${star.name}${star.brightness ? `〔${star.brightness}〕` : ""}${star.mutagen ? `化${star.mutagen}` : ""}`).join("、") || "无十四主星"}</p>
            <small>{palace.minorStars.slice(0, 5).map((star) => star.name).join(" · ")}</small>
            <i>{palace.decadal.range[0]}—{palace.decadal.range[1]} 岁</i>
          </article>
        ))}
      </div>
      <p className="adapter-note">{result.engine.reason}</p>
    </div>
  );
}

function ReportResult({ report }: { report: BaziChartResult["report"] }) {
  return (
    <div className="report-output">
      <div className="report-summary">
        <small>基础解读</small><h3>{report.summary}</h3>
        <ul>{report.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="report-topics">
        {report.topics.map((topic) => (
          <article key={topic.title}>
            <small>{topic.title}</small>
            <h4>盘面依据</h4><p>{topic.evidence}</p>
            <h4>趋势理解</h4><p>{topic.interpretation}</p>
            <h4>行动建议</h4><p>{topic.action}</p>
          </article>
        ))}
      </div>
      <p className="report-disclaimer">{report.disclaimer}</p>
    </div>
  );
}
