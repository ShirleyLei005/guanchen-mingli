"use client";

import { useCallback, useState } from "react";
import type { BaziChartResult, CompatibilityMode, CompatibilityResult, ZiweiChartResult } from "../lib/chart-engines";
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
  const [matchMode, setMatchMode] = useState<CompatibilityMode>("bazi");
  const [chartResult, setChartResult] = useState<BaziChartResult | ZiweiChartResult | CompatibilityResult | null>(null);

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
        setChartResult(data as BaziChartResult | ZiweiChartResult);
      } else if (kind === "match" && secondaryBirth) {
        const response = await fetch("/api/charts/compatibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: matchMode,
            first: { trueSolarTime: primaryBirth.solarTime.trueSolarTime, gender: primaryBirth.gender },
            second: { trueSolarTime: secondaryBirth.solarTime.trueSolarTime, gender: secondaryBirth.gender },
            topics: selected,
            notes,
          }),
        });
        const data = await response.json() as CompatibilityResult | { error?: string };
        if (!response.ok || "error" in data) throw new Error("合盘服务暂时不可用，请稍后重试。");
        setChartResult(data as CompatibilityResult);
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

        {kind === "match" && (
          <fieldset className="birth-fieldset match-mode-fieldset">
            <legend>选择合盘体系</legend>
            <p>默认使用八字合盘；也可以切换为紫微斗数双盘分析。</p>
            <div className="match-mode-switch">
              <button type="button" className={matchMode === "bazi" ? "selected" : ""} onClick={() => setMatchMode("bazi")}>
                <b>八字合盘</b><span>默认 · 日主、日支、十神与五行互动</span>
              </button>
              <button type="button" className={matchMode === "ziwei" ? "selected" : ""} onClick={() => setMatchMode("ziwei")}>
                <b>紫微斗数合盘</b><span>命身、夫妻、福德与三方四正</span>
              </button>
            </div>
          </fieldset>
        )}

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
          {chartResult?.kind === "compatibility" && <CompatibilityView result={chartResult} />}
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
  const positions: Record<string, string> = {
    巳: "1 / 1", 午: "1 / 2", 未: "1 / 3", 申: "1 / 4",
    辰: "2 / 1", 酉: "2 / 4", 卯: "3 / 1", 戌: "3 / 4",
    寅: "4 / 1", 丑: "4 / 2", 子: "4 / 3", 亥: "4 / 4",
  };
  return (
    <div className="chart-output">
      <div className="chart-output-head">
        <div><small>ZIWEI MCP CONTRACT</small><h3>命宫在{result.chart.soulPalaceBranch} · {result.chart.fiveElementsClass}</h3></div>
        <span>{result.engine.provider} 契约 · {result.engine.adapter} v{result.engine.version}</span>
      </div>
      <div className="ziwei-board-wrap">
        <div className="ziwei-board">
          {result.chart.palaces.map((palace) => (
            <article
              key={`${palace.name}-${palace.earthlyBranch}`}
              style={{ gridArea: positions[palace.earthlyBranch] }}
              className={`ziwei-palace ${palace.earthlyBranch === result.chart.soulPalaceBranch ? "soul-palace" : ""}`}
            >
              <header><b>{palace.name}</b><span>{palace.heavenlyStem}{palace.earthlyBranch}{palace.isBodyPalace ? " · 身宫" : ""}</span></header>
              <div className="ziwei-stars major">
                {palace.majorStars.length ? palace.majorStars.map((star) => (
                  <span key={star.name} className={star.mutagen ? `mutagen mutagen-${star.mutagen}` : ""}>
                    {star.name}<small>{star.brightness || ""}</small>{star.mutagen && <em>{star.mutagen}</em>}
                  </span>
                )) : <span className="empty-star">无十四主星</span>}
              </div>
              <p className="ziwei-stars minor">{palace.minorStars.map((star) => star.name).join(" ")}</p>
              <p className="ziwei-stars adjective">{palace.adjectiveStars.map((star) => star.name).join(" ")}</p>
              <div className="palace-ages">{palace.ages.slice(0, 6).join("、")}</div>
              <footer>
                <span>{palace.changsheng12} · {palace.boshi12}<br />{palace.jiangqian12} · {palace.suiqian12}</span>
                <b>{palace.decadal.range[0]}—{palace.decadal.range[1]}</b>
              </footer>
            </article>
          ))}
          <section className="ziwei-center">
            <small>本命命盘</small>
            <h4>{result.chart.yinYangGender} · {result.chart.fiveElementsClass}</h4>
            <dl>
              <div><dt>真太阳时</dt><dd>{result.chart.solarDate} {result.chart.time}</dd></div>
              <div><dt>农历日期</dt><dd>{result.chart.lunarDate}</dd></div>
              <div><dt>节气四柱</dt><dd>{result.chart.chineseDate}</dd></div>
              <div><dt>命主 / 身主</dt><dd>{result.chart.soul} / {result.chart.body}</dd></div>
              <div><dt>命宫 / 身宫</dt><dd>{result.chart.soulPalaceBranch} / {result.chart.bodyPalaceBranch}</dd></div>
            </dl>
            <div className="natal-mutagens">
              <span>生年四化</span>
              {result.chart.natalMutagens.map((star) => <b key={`${star.name}-${star.mutagen}`} className={`mutagen-${star.mutagen}`}>{star.name}化{star.mutagen}</b>)}
            </div>
            <div className="fortune-focus">
              <span>{result.chart.currentFortune.targetYear} 流年 · 虚岁 {result.chart.currentFortune.nominalAge}</span>
              <b>{result.chart.currentFortune.yearly.ganzhi} · {result.chart.currentFortune.yearly.palaceName}</b>
              <small>大限 {result.chart.currentFortune.decadal.range.join("—")} 岁 · {result.chart.currentFortune.decadal.palaceName}</small>
            </div>
          </section>
        </div>
      </div>
      <div className="fortune-timeline">
        <header><b>大限</b><span>十年阶段只表示观察窗口，不等于吉凶定论</span></header>
        <div>{[...result.chart.palaces].sort((a, b) => a.decadal.range[0] - b.decadal.range[0]).map((palace) => (
          <span key={`${palace.name}-${palace.decadal.range[0]}`}><b>{palace.decadal.range.join("—")}</b><small>{palace.decadal.heavenlyStem}{palace.decadal.earthlyBranch}<br />{palace.name}</small></span>
        ))}</div>
        <header><b>流年</b><span>当前年份前后十年</span></header>
        <div>{result.chart.yearlyFlow.map((year) => (
          <span key={year.year} className={year.year === result.chart.currentFortune.targetYear ? "current" : ""}><b>{year.year}</b><small>{year.nominalAge} 岁 · {year.ganzhi}<br />{year.palaceName}</small></span>
        ))}</div>
      </div>
      <p className="adapter-note">{result.engine.reason}</p>
    </div>
  );
}

function CompatibilityView({ result }: { result: CompatibilityResult }) {
  return (
    <div className="chart-output compatibility-output">
      <div className="chart-output-head">
        <div><small>{result.mode === "bazi" ? "BAZI SYNASTRY" : "ZIWEI SYNASTRY"}</small><h3>{result.mode === "bazi" ? "八字合盘分析" : "紫微斗数合盘分析"}</h3></div>
        <span>{result.engine}</span>
      </div>
      <div className="compatibility-profiles">
        {result.profiles.map((profile) => (
          <article key={profile.label}><small>{profile.label}</small><h4>{profile.headline}</h4>{profile.facts.map((fact) => <span key={fact}>{fact}</span>)}</article>
        ))}
      </div>
      <p className="no-score-note">本报告不设置绝对匹配分数，所有判断都保留双盘依据与现实验证方式。</p>
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
            {topic.keyPoints?.length ? <ul className="report-key-points">{topic.keyPoints.map((item) => <li key={item}>{item}</li>)}</ul> : null}
          </article>
        ))}
      </div>
      <p className="report-disclaimer">{report.disclaimer}</p>
    </div>
  );
}
