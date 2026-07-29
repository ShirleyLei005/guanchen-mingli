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
            calendar: primaryBirth.calendar,
            timezone: primaryBirth.place.timezone || "Asia/Shanghai",
            location: {
              province: primaryBirth.place.admin1 || primaryBirth.place.name || "北京市",
              city: primaryBirth.place.name || "北京市",
              longitude: primaryBirth.place.longitude,
              latitude: primaryBirth.place.latitude,
            },
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
          {chartResult?.kind === "ziwei" && <ZiweiNarrativeReport result={chartResult} />}
          {chartResult && chartResult.kind !== "ziwei" && <ReportResult report={chartResult.report} />}
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
  const analysisTabs = [
    ["命格总览", "命宫", "general"], ["财运", "财帛", "wealth"], ["事业", "官禄", "career"], ["感情", "夫妻", "relationships"],
    ["副业", "财帛", "side_income"], ["婚姻时机", "夫妻", "marriage_timing"],
    ["性格", "福德", "personality"], ["健康", "疾厄", "health"], ["兄弟合伙", "兄弟", "family"], ["子女", "子女", "family"],
    ["迁移外出", "迁移", "career"], ["人际贵人", "仆役", "relationships"], ["田宅", "田宅", "wealth"], ["福德", "福德", "personality"], ["父母长辈", "父母", "family"],
  ] as const;
  const [analysisTab, setAnalysisTab] = useState<(typeof analysisTabs)[number][0]>("命格总览");
  const [analysisMode, setAnalysisMode] = useState<"report" | "chat">("report");
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReply, setChatReply] = useState<{ answer: string; evidence: string[]; tool: string; disclaimer: string } | null>(null);
  const [chatError, setChatError] = useState("");
  const positions: Record<string, string> = {
    巳: "1 / 1", 午: "1 / 2", 未: "1 / 3", 申: "1 / 4",
    辰: "2 / 1", 酉: "2 / 4", 卯: "3 / 1", 戌: "3 / 4",
    寅: "4 / 1", 丑: "4 / 2", 子: "4 / 3", 亥: "4 / 4",
  };
  const activeTab = analysisTabs.find(([label]) => label === analysisTab) ?? analysisTabs[0];
  const selectedPalaceName = activeTab[1];
  const selectedPalace = result.chart.palaces.find((palace) => palace.name.includes(selectedPalaceName)) ?? result.chart.palaces[0];
  const selectedModule = result.interpretation?.find((module) => module.aspect === activeTab[2]);
  const selectedStars = selectedPalace.majorStars.map((star) => star.name).join("、") || "无十四主星";
  const mainStar = selectedPalace.majorStars[0]?.name || selectedPalace.minorStars[0]?.name || "宫位结构";
  const starHeadlines: Record<string, string> = {
    紫微: "统筹全局，建立自己的秩序", 天机: "善于推演，在变化中寻找路径", 太阳: "主动担当，以行动建立影响",
    武曲: "务实推进，重视成果与边界", 天同: "保留柔软，创造稳定感", 廉贞: "辨明欲望，学习进退尺度",
    天府: "藏才纳贤，稳健托底", 太阴: "细腻积累，重视内在安全", 贪狼: "资源广阔，课题在取舍",
    巨门: "以表达辨真伪，也要避免过度质疑", 天相: "平衡规则，在协作中成事", 天梁: "守护原则，把经验变成支持",
    七杀: "果断破局，先建立风险边界", 破军: "重组旧局，在变化中完成更新",
  };
  const scoreFor = (name: string) => {
    const palace = result.chart.palaces.find((item) => item.name.includes(name));
    if (!palace) return 52;
    const mutagens = [...palace.majorStars, ...palace.minorStars].filter((star) => star.mutagen).length;
    return Math.min(88, 48 + palace.majorStars.length * 10 + palace.minorStars.length * 2 + mutagens * 5);
  };
  const rawRadar = [scoreFor("官禄"), scoreFor("财帛"), scoreFor("夫妻"), scoreFor("福德"), scoreFor("疾厄")];
  const radarValues = [Math.round(rawRadar.reduce((sum, value) => sum + value, 0) / rawRadar.length), ...rawRadar];
  const radarPolygon = radarValues.map((value, index) => {
    const angle = (-150 + index * 60) * Math.PI / 180;
    const radius = value * 0.43;
    return `${50 + Math.cos(angle) * radius}% ${50 + Math.sin(angle) * radius}%`;
  }).join(", ");
  const palaceMainStar = (name: string) =>
    result.chart.palaces.find((palace) => palace.name.includes(name))?.majorStars[0]?.name || "宫位";
  async function askChart() {
    if (!result.chartId || !question.trim()) {
      setChatError(result.chartId ? "请先输入你想了解的问题。" : "当前命盘缺少 chartId，请重新生成命盘。");
      return;
    }
    setChatLoading(true);
    setChatError("");
    try {
      const response = await fetch("/api/charts/ziwei/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartId: result.chartId, question: question.trim() }),
      });
      const data = await response.json() as { status: string; answer?: string; evidence?: string[]; tool?: string; disclaimer?: string; message?: string };
      if (!response.ok || data.status !== "success" || !data.answer) throw new Error(data.message || "分析失败");
      setChatReply({ answer: data.answer, evidence: data.evidence ?? [], tool: data.tool ?? "interpret_chart", disclaimer: data.disclaimer ?? "" });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "分析失败，请重新生成命盘后再试。");
    } finally {
      setChatLoading(false);
    }
  }
  return (
    <div className="chart-output">
      <div className="chart-output-head">
        <div><small>ZIWEI MCP CONTRACT</small><h3>命宫在{result.chart.soulPalaceBranch} · {result.chart.fiveElementsClass}</h3></div>
        <span>{result.engine.provider} 契约 · {result.engine.adapter} v{result.engine.version}</span>
      </div>
      <div className="ziwei-workbench">
        <div className="ziwei-board-column">
          <div className="ziwei-direction north"><span>正南方</span><span>南偏西</span></div>
          <div className="ziwei-board-wrap">
            <div className="ziwei-board">
              {result.chart.palaces.map((palace) => (
                <article
                  key={`${palace.name}-${palace.earthlyBranch}`}
                  style={{ gridArea: positions[palace.earthlyBranch] }}
                  className={`ziwei-palace ${palace.earthlyBranch === result.chart.soulPalaceBranch ? "soul-palace" : ""}`}
                >
                  <header><b>{palace.name}</b><span>{palace.decadal.range[0]}—{palace.decadal.range[1]}</span></header>
                  <div className="ziwei-stars ziwei-major-stars">
                    {palace.majorStars.length ? palace.majorStars.map((star) => (
                      <span key={star.name} className={star.mutagen ? `mutagen mutagen-${star.mutagen}` : ""}>
                        {star.name}<small>{star.brightness || ""}</small>{star.mutagen && <em>{star.mutagen}</em>}
                      </span>
                    )) : <span className="empty-star">无十四主星</span>}
                  </div>
                  <p className="ziwei-stars ziwei-minor-stars">{palace.minorStars.map((star) => star.name).join(" ")}</p>
                  <p className="ziwei-stars ziwei-adjective-stars">{palace.adjectiveStars.map((star) => star.name).join(" ")}</p>
                  <footer>
                    <span>{palace.heavenlyStem}{palace.earthlyBranch}</span>
                    <b>{palace.name}{palace.isBodyPalace ? " · 身" : ""}</b>
                  </footer>
                </article>
              ))}
              <section className="ziwei-center">
                <small>GUANCHEN</small>
                <h4>{result.chart.yinYangGender}　{result.chart.fiveElementsClass}</h4>
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
                  <span>当前大限</span>
                  <b>{result.chart.currentFortune.decadal.range.join("—")} 岁 · {result.chart.currentFortune.decadal.palaceName}</b>
                  <small>{result.chart.currentFortune.targetYear} 流年 {result.chart.currentFortune.yearly.ganzhi} · {result.chart.currentFortune.yearly.palaceName}</small>
                </div>
              </section>
            </div>
          </div>
          <div className="ziwei-direction south"><span>东偏北</span><span>正北方</span><span>北偏西</span></div>
        </div>

        <section className="ziwei-analysis">
          <div className="analysis-mode">
            <button className={analysisMode === "report" ? "active" : ""} type="button" onClick={() => setAnalysisMode("report")}>命盘分析</button>
            <button className={analysisMode === "chat" ? "active" : ""} type="button" onClick={() => setAnalysisMode("chat")}>AI 对话</button>
          </div>
          {analysisMode === "report" ? (
            <>
              <div className="analysis-tabs" role="tablist" aria-label="紫微命盘分析领域">
                {analysisTabs.map(([label]) => (
                  <button type="button" role="tab" aria-selected={analysisTab === label} className={analysisTab === label ? "active" : ""} key={label} onClick={() => setAnalysisTab(label)}>{label}</button>
                ))}
              </div>
              <div className="analysis-copy">
                <p>{selectedModule?.title || selectedPalace.name} · {selectedStars}</p>
                <h4>{selectedModule?.headline || starHeadlines[mainStar] || `${mainStar}入宫，从现实选择中理解课题`}</h4>
                <span>{selectedModule?.summary || `${selectedPalace.name}位于${selectedPalace.heavenlyStem}${selectedPalace.earthlyBranch}。这里呈现的是该领域的关注方式与行动惯性，不是不可改变的结果。`}</span>
              </div>
              <div className="radar-stage" aria-label="六维命盘结构图">
                <div className="radar-chart">
                  {[92, 72, 52, 32].map((size) => <i key={size} className="radar-ring" style={{ width: `${size}%`, height: `${size}%` }} />)}
                  <i className="radar-axis axis-a" /><i className="radar-axis axis-b" /><i className="radar-axis axis-c" />
                  <div className="radar-data" style={{ clipPath: `polygon(${radarPolygon})` }} />
                  <span className="radar-label radar-l1"><b>综合</b><small>命身结构</small></span>
                  <span className="radar-label radar-l2"><b>事业</b><small>{palaceMainStar("官禄")}</small></span>
                  <span className="radar-label radar-l3"><b>财运</b><small>{palaceMainStar("财帛")}</small></span>
                  <span className="radar-label radar-l4"><b>感情</b><small>{palaceMainStar("夫妻")}</small></span>
                  <span className="radar-label radar-l5"><b>性格</b><small>{palaceMainStar("福德")}</small></span>
                  <span className="radar-label radar-l6"><b>健康</b><small>{palaceMainStar("疾厄")}</small></span>
                </div>
              </div>
              <p className="radar-note">六维图仅表示盘面星曜与四化信息密度，不代表能力高低或吉凶评分</p>
              <div className="analysis-evidence">
                <article><small>盘面依据</small><b>{selectedModule?.evidence[0] || selectedStars}</b><span>{selectedModule?.evidence.slice(1).join("；") || `${selectedPalace.changsheng12} · ${selectedPalace.boshi12}`}</span></article>
                <article><small>行动与课题</small><b>{selectedModule?.actions[0] || "这个领域正在要求我学习什么？"}</b><span>{selectedModule?.challenges.join("；") || "结合最近三个月的现实事件核对，不用单一星曜替自己下结论。"}</span></article>
              </div>
            </>
          ) : (
            <div className="ziwei-chat-panel">
              <p>BOUND CHART · {result.chartId || "NO CHART ID"}</p>
              <h4>基于这张命盘继续提问</h4>
              <span>系统会按问题自动调用 interpret_chart；涉及今年、明年、流年或大限时，改用 analyze_fortune。</span>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：未来一年事业上最值得准备的课题是什么？" />
              <button type="button" disabled={chatLoading} onClick={() => void askChart()}>{chatLoading ? "正在分析…" : "发送问题"}</button>
              {chatError && <p className="ziwei-chat-error">{chatError}</p>}
              {chatReply && (
                <article className="ziwei-chat-reply">
                  <small>{chatReply.tool}</small>
                  <p>{chatReply.answer}</p>
                  <details><summary>查看盘面依据</summary><ul>{chatReply.evidence.map((item) => <li key={item}>{item}</li>)}</ul></details>
                  <i>{chatReply.disclaimer}</i>
                </article>
              )}
            </div>
          )}
        </section>
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

function ZiweiNarrativeReport({ result }: { result: ZiweiChartResult }) {
  const modules = result.interpretation ?? [];
  const [activeAspect, setActiveAspect] = useState(modules[0]?.aspect ?? "general");
  const active = modules.find((module) => module.aspect === activeAspect) ?? modules[0];
  const general = modules.find((module) => module.aspect === "general") ?? active;

  if (!active || !general) return null;

  return (
    <section className="ziwei-reading">
      <header className="reading-cover">
        <div>
          <small>PERSONAL CHART READING</small>
          <p>紫微斗数个人命盘解析</p>
          <h3>{general.headline}</h3>
          <span>命盘用于发现人生课题，不替你决定人生。以下内容由 interpret_chart 在固定 chartId 上生成，并保留宫位、星曜、四化与运限依据。</span>
        </div>
        <aside>
          <small>本次优先回应</small>
          <b>{result.reportFocus || "命格结构与当下课题"}</b>
          <span>{result.selectedTopics?.join(" · ") || "命盘总览"}</span>
        </aside>
      </header>

      <div className="reading-core">
        <small>核心结论</small>
        <div>
          {general.conclusions.map((item, index) => (
            <p key={item}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></p>
          ))}
          <p><b>03</b><span>当前大限落{result.chart.currentFortune.decadal.palaceName}，未来三年的提示会按真实流年落宫逐年展开，不把趋势写成必然事件。</span></p>
        </div>
      </div>

      <nav className="reading-tabs" aria-label="详细解读章节">
        {modules.map((module) => (
          <button
            type="button"
            key={module.aspect}
            className={module.aspect === active.aspect ? "active" : ""}
            onClick={() => setActiveAspect(module.aspect)}
          >
            {module.title}
          </button>
        ))}
      </nav>

      <article className="reading-chapter">
        <header>
          <small>{active.kicker}</small>
          <h3>{active.title}</h3>
          <h4>{active.headline}</h4>
          <p>{active.lead}</p>
        </header>

        <section className="reading-conclusion">
          <small>先说结论</small>
          {active.conclusions.map((item) => <p key={item}>{item}</p>)}
        </section>

        <section className="reading-analysis">
          <small>命盘结构与判断依据</small>
          {active.analysis.map((section) => (
            <article key={section.heading}>
              <h4>{section.heading}</h4>
              <p>{section.conclusion}</p>
              <div>
                {section.evidence.map((item) => <span key={item}>{item}</span>)}
              </div>
              {section.explanation.map((item) => <p className="reading-explanation" key={item}>{item}</p>)}
            </article>
          ))}
        </section>

        <section className="reading-timing">
          <header><small>未来三年节奏</small><p>逐年依据来自本命盘的流年落宫；它描述阶段课题，不承诺具体事件。</p></header>
          <div>
            {active.timing.map((period) => (
              <article key={period.year}>
                <b>{period.year}</b>
                <small>{period.label}</small>
                <h4>{period.theme}</h4>
                <p><em>可把握</em>{period.opportunity}</p>
                <p><em>需留意</em>{period.caution}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="reading-decisions">
          <section>
            <small>风险提醒</small>
            {active.risks.map((risk) => (
              <article key={risk.title}><b>{risk.title}</b><p>{risk.detail}</p></article>
            ))}
          </section>
          <section>
            <small>当前阶段建议</small>
            {active.actionPlan.map((action) => (
              <article key={action.horizon}><span>{action.horizon}</span><b>{action.title}</b><p>{action.detail}</p></article>
            ))}
          </section>
        </div>

        <footer className="reading-boundary">
          <small>判断边界</small>
          <ul>{active.boundaries.map((item) => <li key={item}>{item}</li>)}</ul>
        </footer>
      </article>
    </section>
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
