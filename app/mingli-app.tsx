"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlaceMatch, SolarTimeResult } from "../lib/solar-time";

type Product = "bazi" | "ziwei" | "match" | "chat";
type ChartResult = {
  pillars: string[];
  elements: { name: string; value: number }[];
  summary: string;
};

const products = [
  { id: "bazi", stamp: "命", intent: "想理解天赋、惯性与长期节奏", kicker: "先看人生全局", title: "八字命盘", subtitle: "从时间结构看性格、优势与阶段趋势", cost: 5 },
  { id: "ziwei", stamp: "星", intent: "想看事业、关系等具体人生领域", kicker: "再看具体领域", title: "紫微斗数", subtitle: "从十二宫位理解关系、事业与当下课题", cost: 5 },
  { id: "match", stamp: "合", intent: "想理解一段重要关系的互动模式", kicker: "理解重要关系", title: "合盘分析", subtitle: "看见两个人的互补、压力与共同成长", cost: 10 },
  { id: "chat", stamp: "问", intent: "已有命盘，想结合现实问题继续讨论", kicker: "带着问题深入", title: "命盘问答", subtitle: "围绕固定命盘，厘清选择而非索取答案", cost: 2 },
] as const;

const topics: Record<Product, string[]> = {
  bazi: ["命盘总览", "事业方向", "财富节奏", "感情关系", "天赋优势", "阶段运势", "家庭课题", "身心平衡"],
  ziwei: ["十二宫总览", "事业迁移", "财帛田宅", "关系情感", "自我成长", "流年趋势", "合作社交", "决策参考"],
  match: ["关系结构", "沟通模式", "长期发展", "家庭协作", "压力应对", "共同成长"],
  chat: ["近期选择", "事业追问", "感情追问", "时间节点", "关系决策", "行动复盘"],
};

const steps = ["选择工具", "出生资料", "本次课题", "基础命盘"];

function mockChart(date: string, gender: string): ChartResult {
  const seed = [...date, ...gender].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const pillars = Array.from({ length: 4 }, (_, index) => `${stems[(seed + index * 3) % 10]}${branches[(seed + index * 5) % 12]}`);
  const raw = [18, 23, 20, 17, 22].map((value, index) => value + ((seed + index * 7) % 9) - 4);
  const total = raw.reduce((sum, value) => sum + value, 0);
  const names = ["木", "火", "土", "金", "水"];
  return {
    pillars,
    elements: names.map((name, index) => ({ name, value: Math.round((raw[index] / total) * 100) })),
    summary: "这是一份流程预览盘，用于核对资料与时间修正。正式干支、星曜和宫位必须由服务端固定版本排盘引擎生成。",
  };
}

function displayTime(value: string) {
  return value ? value.replace("T", " ").slice(0, 16) : "—";
}

export function MingliApp() {
  const [active, setActive] = useState<Product>("bazi");
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("命盘总览");
  const [date, setDate] = useState("1992-08-18T08:30");
  const [gender, setGender] = useState("女");
  const [calendar, setCalendar] = useState("solar");
  const [placeQuery, setPlaceQuery] = useState("昆明");
  const [place, setPlace] = useState<PlaceMatch | null>(null);
  const [placeOptions, setPlaceOptions] = useState<PlaceMatch[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [solarTime, setSolarTime] = useState<SolarTimeResult | null>(null);
  const [solarLoading, setSolarLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [credits, setCredits] = useState(5);
  const [showRecharge, setShowRecharge] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const current = useMemo(() => products.find((item) => item.id === active)!, [active]);
  const effectiveDate = solarTime?.trueSolarTime.slice(0, 16) ?? date;

  useEffect(() => {
    if (place || placeQuery.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(placeQuery.trim())}`, { signal: controller.signal });
        const data = await response.json() as { results?: PlaceMatch[] };
        setPlaceOptions(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPlaceOptions([]);
      } finally {
        setPlaceLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [placeQuery, place]);

  useEffect(() => {
    if (!place || !date) {
      return;
    }
    const controller = new AbortController();
    async function calculateSolarTime() {
      setSolarLoading(true);
      try {
        const response = await fetch("/api/solar-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ localDateTime: date, longitude: place!.longitude, timezone: place!.timezone }),
        });
        if (!response.ok) throw new Error("SOLAR_TIME_FAILED");
        setSolarTime(await response.json() as SolarTimeResult);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSolarTime(null);
      } finally {
        setSolarLoading(false);
      }
    }
    void calculateSolarTime();
    return () => controller.abort();
  }, [date, place]);

  function chooseProduct(id: Product, enterFlow = false) {
    setActive(id);
    setTopic(topics[id][0]);
    setResult(null);
    setNotice("");
    if (enterFlow) {
      setStep(2);
      window.setTimeout(() => document.querySelector("#calculator")?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function selectPlace(option: PlaceMatch) {
    setSolarTime(null);
    setPlace(option);
    setPlaceQuery([option.name, option.admin1, option.country].filter(Boolean).join(" · "));
    setPlaceOptions([]);
  }

  function nextFromBirth() {
    if (!date || !place) {
      setNotice("请先选择出生时间，并从匹配列表中确认出生地。");
      return;
    }
    if (!solarTime) {
      setNotice("正在校正真太阳时，请稍候。");
      return;
    }
    setNotice("");
    setStep(3);
  }

  function calculate() {
    if ((active === "chat" || active === "match") && !question.trim()) {
      setNotice(active === "chat" ? "请写下这次最想追问的问题。" : "请简单说明关系阶段与关注点。");
      return;
    }
    setResult(mockChart(effectiveDate, gender));
    setNotice("基础资料与真太阳时已核对。下方命盘仅为流程演示，不作为正式命理解读。");
    setStep(4);
  }

  function unlock() {
    if (credits < current.cost) {
      setShowRecharge(true);
      return;
    }
    setCredits((value) => value - current.cost);
    setNotice(`已解锁「${topic}」示范报告，扣除 ${current.cost} 积分。正式报告仍需服务端排盘引擎。`);
  }

  function recharge(amount: number) {
    setCredits((value) => value + amount);
    setShowRecharge(false);
    setNotice(`沙箱充值成功，已到账 ${amount} 积分。`);
  }

  return (
    <main>
      <header className="nav-shell">
        <a className="brand" href="#top" aria-label="观辰首页">
          <span className="brand-mark">观</span>
          <span><strong>观辰</strong><small>东方命理研究所</small></span>
        </a>
        <nav className={mobileNav ? "open" : ""} aria-label="主导航">
          <a href="#top" onClick={() => setMobileNav(false)}>首页</a>
          <a href="#calculator" onClick={() => chooseProduct("bazi", true)}>八字命盘</a>
          <a href="#calculator" onClick={() => chooseProduct("ziwei", true)}>紫微斗数</a>
          <a href="#calculator" onClick={() => chooseProduct("match", true)}>合盘分析</a>
          <a className="nav-hot" href="#calculator" onClick={() => chooseProduct("chat", true)}>命盘问答 <i>热门</i></a>
          <a href="#knowledge" onClick={() => setMobileNav(false)}>命理课堂</a>
        </nav>
        <div className="account-actions">
          <a href="#calculator">登录</a>
          <button className="credit-pill" onClick={() => setShowRecharge(true)}><span>余</span>{credits} 体验积分</button>
          <button className="menu-toggle" aria-label="打开菜单" aria-expanded={mobileNav} onClick={() => setMobileNav((value) => !value)}>☰</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="hero-copy">
          <p className="eyebrow">看见趋势 · 理解课题 · 主动选择</p>
          <h1>读懂命盘，<br /><em>不把人生交给命盘。</em></h1>
          <p className="lead">借八字看见时间与天赋，借紫微理解关系与人生领域。命盘呈现的是趋势、惯性和可能遇见的课题，而你如何理解、选择与行动，才真正塑造人生。</p>
          <div className="hero-actions">
            <a className="primary-btn" href="#calculator" onClick={() => setStep(1)}>免费建立我的命盘 <span>→</span></a>
            <a className="text-btn" href="#compare">八字和紫微怎么选？</a>
          </div>
          <div className="trust-row"><span>基础排盘免费</span><span>每项解读有盘面依据</span><span>不作宿命式断言</span></div>
        </div>
        <div className="hero-chart" aria-hidden="true">
          <div className="chart-ring">
            {["命", "兄", "夫", "子", "财", "疾", "迁", "友", "官", "田", "福", "父"].map((text, index) => (
              <span key={text} style={{ "--i": index } as React.CSSProperties}>{text}</span>
            ))}
            <div className="chart-center"><b>观 辰</b><small>人生课题地图</small></div>
          </div>
        </div>
      </section>

      <section className="intent-section" id="compare">
        <div className="section-heading">
          <p className="eyebrow">从真实问题出发</p>
          <h2>此刻，你最想看清什么？</h2>
          <p>不必先学会命理术语。选择最接近你现实处境的问题，我们会推荐更合适的观察工具。</p>
        </div>
        <div className="intent-grid">
          {products.map((item, index) => (
            <button key={item.id} onClick={() => chooseProduct(item.id, true)}>
              <span>0{index + 1}</span><i>{item.stamp}</i>
              <div><small>{item.intent}</small><strong>{item.title}</strong><em>{item.kicker} →</em></div>
            </button>
          ))}
        </div>
      </section>

      <section className="belief-section" id="belief">
        <div className="belief-intro">
          <p className="eyebrow">观辰的方法</p>
          <h2>命盘给出线索，人生仍由你作答。</h2>
          <p>我们不追求一句“准不准”的判决，而是把命盘变成一套可以回到现实、帮助行动的观察方法。</p>
        </div>
        <div className="belief-flow">
          <article><span>01</span><i>见</i><h3>看见倾向</h3><p>辨认天赋、惯性与阶段趋势，知道哪些力量正在影响你。</p></article>
          <article><span>02</span><i>知</i><h3>理解课题</h3><p>理解反复出现的关系模式、内在冲突与此刻需要面对的成长主题。</p></article>
          <article><span>03</span><i>行</i><h3>主动选择</h3><p>把洞察带回现实，用更清醒的行动回应命盘，而不是把决定权交出去。</p></article>
        </div>
      </section>

      <section className="calculator-wrap" id="calculator">
        <div className="calculator-copy">
          <p className="eyebrow">四步建立命盘</p>
          <h2>先把出生坐标算清楚，<br />再谈命盘与人生课题。</h2>
          <p>出生地点不只是一个名称。系统会匹配经纬度与历史时区，并计算经度时差和均时差，得到排盘所需的真太阳时。</p>
          <ol className="flow-progress">
            {steps.map((label, index) => (
              <li key={label} className={step >= index + 1 ? "active" : ""}>
                <button onClick={() => index + 1 < step && setStep(index + 1)}><span>0{index + 1}</span>{label}</button>
              </li>
            ))}
          </ol>
          <div className="accuracy-note">
            <strong>时间精度说明</strong>
            <p>真太阳时采用 IANA 历史时区、出生地经度修正和 NOAA 均时差近似。地点应选择出生医院或出生城市，不建议填写当前居住地。</p>
          </div>
        </div>

        <div className="calculator-card">
          <div className="wizard-head"><span>步骤 {step} / 4</span><b>{steps[step - 1]}</b></div>

          {step === 1 && (
            <div className="wizard-panel">
              <h3>你想用哪一种方式观察？</h3>
              <p>不确定时，建议先从八字看整体结构，再用紫微深入具体领域。</p>
              <div className="tool-picker">
                {products.map((item) => (
                  <button key={item.id} className={active === item.id ? "selected" : ""} onClick={() => chooseProduct(item.id)}>
                    <span className="seal">{item.stamp}</span><b>{item.title}</b><small>{item.subtitle}</small>
                  </button>
                ))}
              </div>
              <button className="submit-btn" onClick={() => setStep(2)}>下一步 · 填写出生资料 <span>→</span></button>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-panel">
              <h3>确认出生时间与地点</h3>
              <p>这些资料决定干支、宫位与星曜落点，请尽量依据出生证明填写。</p>
              <div className="form-row">
                <label>性别
                  <span className="segmented">{["女", "男"].map((value) => <button key={value} className={gender === value ? "selected" : ""} onClick={() => setGender(value)}>{value}</button>)}</span>
                </label>
                <label>历法
                  <span className="segmented">
                    <button className={calendar === "solar" ? "selected" : ""} onClick={() => setCalendar("solar")}>阳历</button>
                    <button className={calendar === "lunar" ? "selected" : ""} onClick={() => setCalendar("lunar")}>农历</button>
                  </span>
                </label>
              </div>
              <label>{calendar === "solar" ? "阳历出生日期与时间" : "农历日期对应的当地钟表时间"}
                  <input type="datetime-local" value={date} onChange={(event) => { setSolarTime(null); setDate(event.target.value); }} />
                {calendar === "lunar" && <small className="field-help">正式排盘会先在服务端校验闰月并换算阳历；当前页面仅演示时间与地点校正链。</small>}
              </label>
              <label className="place-field">出生地点
                <input
                  value={placeQuery}
                  onChange={(event) => { setSolarTime(null); setPlace(null); setPlaceOptions([]); setPlaceQuery(event.target.value); }}
                  placeholder="输入城市或区县，例如：云南昆明"
                  autoComplete="off"
                  aria-autocomplete="list"
                />
                {placeLoading && <span className="input-status">正在匹配地点…</span>}
                {placeOptions.length > 0 && (
                  <div className="place-options" role="listbox">
                    {placeOptions.map((option) => (
                      <button key={option.id} onClick={() => selectPlace(option)} role="option" aria-selected="false">
                        <b>{option.name}</b><span>{[option.admin1, option.country].filter(Boolean).join(" · ")}</span>
                        <em>{option.latitude.toFixed(4)}°, {option.longitude.toFixed(4)}°</em>
                      </button>
                    ))}
                  </div>
                )}
              </label>

              {place && (
                <div className="solar-card" aria-live="polite">
                  <div className="solar-card-head"><span>真太阳时校正</span><b>{solarLoading ? "计算中…" : solarTime ? "已完成" : "等待重算"}</b></div>
                  <div className="coordinate-row">
                    <span><small>纬度</small>{place.latitude.toFixed(4)}°</span>
                    <span><small>经度</small>{place.longitude.toFixed(4)}°</span>
                    <span><small>历史时区</small>{place.timezone}</span>
                  </div>
                  {solarTime && (
                    <>
                      <div className="time-compare">
                        <span><small>当地钟表时间</small><strong>{displayTime(solarTime.civilTime)}</strong></span>
                        <i>＋ {solarTime.totalCorrectionMinutes >= 0 ? "+" : ""}{solarTime.totalCorrectionMinutes} 分钟</i>
                        <span><small>真太阳时</small><strong>{displayTime(solarTime.trueSolarTime)}</strong></span>
                      </div>
                      <details>
                        <summary>查看计算依据</summary>
                        <p>标准经线 {solarTime.standardMeridian}°；经度修正 {solarTime.longitudeCorrectionMinutes} 分钟；均时差 {solarTime.equationOfTimeMinutes} 分钟；UTC {solarTime.utcTime.replace("T", " ").slice(0, 19)}。</p>
                      </details>
                    </>
                  )}
                </div>
              )}
              {notice && <p className="form-notice">{notice}</p>}
              <div className="wizard-actions"><button className="back-btn" onClick={() => setStep(1)}>返回</button><button className="submit-btn" onClick={nextFromBirth}>确认时间，下一步 <span>→</span></button></div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-panel">
              <h3>这次最想理解哪个课题？</h3>
              <p>先聚焦一个方向，报告会更清晰。以后可基于同一张命盘继续探索。</p>
              <div className="topic-grid">
                {topics[active].map((value) => <button key={value} className={topic === value ? "selected" : ""} onClick={() => setTopic(value)}>{value}</button>)}
              </div>
              {(active === "chat" || active === "match") && (
                <label>{active === "chat" ? "你的问题" : "关系背景"}
                  <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={active === "chat" ? "例如：接下来半年转换工作方向，需要重点准备什么？" : "简单描述关系阶段、双方授权与这次最关注的问题"} />
                </label>
              )}
              <label className="consent"><input type="checkbox" defaultChecked /> 我已阅读隐私说明，并确认有权提交以上资料</label>
              {notice && <p className="form-notice">{notice}</p>}
              <div className="wizard-actions"><button className="back-btn" onClick={() => setStep(2)}>返回</button><button className="submit-btn" onClick={calculate}>生成免费基础盘 <span>→</span></button></div>
            </div>
          )}

          {step === 4 && result && (
            <div className="wizard-panel result-panel">
              <div className="result-summary-head"><span className="seal">{current.stamp}</span><div><small>免费基础盘 · 流程预览</small><h3>{current.title}资料核对完成</h3></div></div>
              <div className="input-snapshot">
                <span><small>出生地</small>{place?.name}</span><span><small>钟表时间</small>{displayTime(date)}</span><span><small>排盘时间</small>{displayTime(effectiveDate)}</span>
              </div>
              <div className="mini-pillars">{result.pillars.map((pillar, index) => <span key={`${pillar}-${index}`}><small>{["年柱", "月柱", "日柱", "时柱"][index]}</small><b>{pillar}</b></span>)}</div>
              <p className="preview-warning">{result.summary}</p>
              <div className="report-preview">
                <p className="eyebrow">完整报告结构</p>
                <div><b>01 盘面事实</b><span>每项判断可展开查看干支、宫位或星曜依据</span></div>
                <div><b>02 趋势与课题</b><span>讨论更容易出现的模式，不给出宿命式结论</span></div>
                <div><b>03 现实行动</b><span>把洞察转化为当下可以验证和调整的选择</span></div>
              </div>
              <button className="unlock-btn" onClick={unlock}>解锁「{topic}」完整报告 · {current.cost} 积分</button>
              <button className="text-reset" onClick={() => setStep(2)}>修改出生资料</button>
              {notice && <p className="form-notice">{notice}</p>}
            </div>
          )}
        </div>
      </section>

      <section className="report-demo">
        <div className="section-heading"><p className="eyebrow">报告不是一句吉凶</p><h2>每个结论，都要回到依据与行动。</h2><p>我们把抽象命理拆成四个可以阅读、质疑和带回现实的层次。</p></div>
        <div className="report-columns">
          <article><span>01</span><h3>盘面事实</h3><p>先列出干支、十神、五行、宫位、主星和四化等确定性数据。</p></article>
          <article><span>02</span><h3>可能趋势</h3><p>说明哪些模式更容易被环境和阶段触发，同时标注其他可能。</p></article>
          <article><span>03</span><h3>人生课题</h3><p>把反复出现的冲突、关系和成长主题提炼成可理解的问题。</p></article>
          <article><span>04</span><h3>行动建议</h3><p>不给“必须怎样”的答案，而是提供可以尝试、观察和复盘的路径。</p></article>
        </div>
      </section>

      <section className="method-section">
        <div className="method-quote"><span>“</span><p>星盘指出天气，<br />掌舵的人始终是你。</p></div>
        <div className="method-copy">
          <p className="eyebrow">清醒地理解命盘</p><h2>尊重传统方法，拒绝宿命式答案</h2>
          <p>干支、星曜、宫位与四化由确定性算法计算。解读只负责呈现可能性、惯性与课题，不用恐惧制造依赖，也不替你做人生决定。</p>
          <div className="method-points"><span><b>01</b>盘面事实可追溯</span><span><b>02</b>趋势不等于必然</span><span><b>03</b>每次解读回到行动</span></div>
        </div>
      </section>

      <section className="knowledge" id="knowledge">
        <div className="section-heading"><p className="eyebrow">命理课堂</p><h2>先理解命盘，再决定如何使用它</h2><p>真正有用的命理，不是制造神秘感，而是帮助你形成更诚实的自我观察。</p></div>
        <div className="article-grid">
          <article><span>八字入门 · 6 分钟</span><h3>为什么八字以节气换月，而不是农历初一？</h3><p>从时间坐标理解四柱排盘的第一条基础规则。</p><a href="#calculator">阅读全文 →</a></article>
          <article><span>紫微入门 · 8 分钟</span><h3>命宫、身宫与十二宫，分别在说什么？</h3><p>一张紫微命盘的结构，比星曜吉凶更值得先看。</p><a href="#calculator">阅读全文 →</a></article>
          <article><span>精准排盘 · 7 分钟</span><h3>钟表时间和真太阳时为什么会不同？</h3><p>经度、时区与均时差，如何共同影响最终排盘时间。</p><a href="#calculator">立即校正 →</a></article>
        </div>
      </section>

      <section className="faq">
        <div><p className="eyebrow">常见问题</p><h2>你可能还想知道</h2></div>
        <div className="faq-list">
          <details open><summary>不知道准确出生分钟，可以排盘吗？<span>＋</span></summary><p>可以先建立标记了时间精度的命盘，但紫微对时辰尤其敏感。若时间接近时辰边界，应优先核对出生证明或进行时间校准。</p></details>
          <details><summary>真太阳时是怎样计算的？<span>＋</span></summary><p>先根据出生地坐标确定 IANA 历史时区，再计算出生地相对标准经线的经度时差，并叠加当天均时差。报告会保留全部计算参数。</p></details>
          <details><summary>命盘真的能决定我的人生吗？<span>＋</span></summary><p>不能。命盘呈现的是倾向、惯性与可能遇见的课题。环境、意识、行动和每一次选择，都会影响人生实际走向。</p></details>
          <details><summary>我的出生资料会被公开吗？<span>＋</span></summary><p>不会。出生资料只用于排盘和经授权的报告生成，不进入公开页面，也不用于广告画像。</p></details>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">观</span><span><strong>观辰</strong><small>东方命理研究所</small></span></div>
        <p>传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。</p>
        <div><a href="#top">隐私政策</a><a href="#top">用户协议</a><a href="#knowledge">联系我们</a></div>
        <small>© 2026 观辰 · 看见趋势，理解课题，主动选择</small>
      </footer>

      {showRecharge && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="积分充值">
          <div className="modal">
            <button className="modal-close" onClick={() => setShowRecharge(false)} aria-label="关闭">×</button>
            <p className="eyebrow">支付沙箱</p><h2>选择积分包</h2><p>本地验收模式不会产生真实付款。</p>
            {[["10", "¥9.9"], ["50", "¥39"], ["120", "¥79"]].map(([amount, price]) => (
              <button className="modal-package" key={amount} onClick={() => recharge(Number(amount))}><span><b>{amount} 积分</b><small>即时到账</small></span><strong>{price} →</strong></button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
