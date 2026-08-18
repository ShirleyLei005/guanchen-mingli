"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PlaceMatch, SolarTimeResult } from "../lib/solar-time";
import { GuanchenWait } from "./guanchen-wait";
import { PlaceHierarchyPicker } from "./place-hierarchy-picker";
import { GuanchenBrandMark } from "./brand-mark";
import { RechargeModal } from "./recharge-modal";

type Product = "bazi" | "ziwei" | "match" | "chat";
type ChartResult = {
  pillars: string[];
  elements: { name: string; value: number }[];
  summary: string;
};

const products = [
  { id: "bazi", stamp: "命", intent: "想理解天赋、惯性与长期节奏", kicker: "先看人生全局", title: "八字命盘", subtitle: "从时间结构看性格、优势与阶段趋势", cost: 5 },
  { id: "ziwei", stamp: "星", intent: "想看事业、关系等具体人生领域", kicker: "再看具体领域", title: "紫微斗数", subtitle: "从十二宫位理解关系、事业与当下课题", cost: 5 },
  { id: "match", stamp: "合", intent: "想理解一段重要关系的互动模式", kicker: "理解重要关系", title: "双人合盘", subtitle: "看见两个人的互补、压力与共同成长", cost: 10 },
  { id: "chat", stamp: "问", intent: "已有命盘，想结合现实问题继续讨论", kicker: "带着问题深入", title: "观辰解析", subtitle: "围绕固定命盘，厘清选择而非索取答案", cost: 2 },
] as const;

const topics: Record<Product, string[]> = {
  bazi: ["命盘总览", "事业方向", "财富节奏", "感情关系", "天赋优势", "阶段运势", "家庭课题", "身心平衡"],
  ziwei: ["十二宫总览", "事业迁移", "财帛田宅", "关系情感", "自我成长", "流年趋势", "合作社交", "决策参考"],
  match: ["关系结构", "沟通模式", "长期发展", "家庭协作", "压力应对", "共同成长"],
  chat: ["近期选择", "事业追问", "感情追问", "时间节点", "关系决策", "行动复盘"],
};

const steps = ["选择工具", "出生资料", "本次课题", "基础命盘"];
const productPaths: Record<Product, string> = {
  bazi: "/bazi",
  ziwei: "/ziwei",
  match: "/match",
  chat: "/chat",
};

const lifeQuestions = [
  {
    eyebrow: "问前路",
    title: "守成蓄势，还是另开新局？",
    description: "人生行至岔路，喧声纷至，心意未明。借命盘观天赋所长、时运所向，看清何处宜深耕，何处当转身，令才华与机缘相逢。",
    tags: "天赋所长 · 事业格局 · 进退时机",
    href: "/bazi",
  },
  {
    eyebrow: "问缘分",
    title: "是同心相契，还是课题相逢？",
    description: "缘起有时，聚散有因。以双盘参看彼此的靠近方式、情绪所需与相处节奏，于吸引与摩擦之间，读懂关系真正要教会我们的事。",
    tags: "情感需求 · 沟通模式 · 相处之道",
    href: "/match",
  },
  {
    eyebrow: "问时运",
    title: "何时借势而起，何时藏锋以待？",
    description: "命有其势，时有其序。察大限流年之起伏，辨机缘与暗涌，于顺流处乘风，于未明处守静，让每一次进退都多一分从容。",
    tags: "流年节奏 · 机缘窗口 · 行动准备",
    href: "/ziwei",
  },
] as const;

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
  const [place, setPlace] = useState<PlaceMatch | null>(null);
  const [solarTime, setSolarTime] = useState<SolarTimeResult | null>(null);
  const [solarLoading, setSolarLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ChartResult | null>(null);
  const [session, setSession] = useState<{ authenticated: boolean; credits: number; displayName: string; email: string }>({
    authenticated: false,
    credits: 0,
    displayName: "",
    email: "",
  });
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const current = useMemo(() => products.find((item) => item.id === active)!, [active]);
  const effectiveDate = solarTime?.trueSolarTime.slice(0, 16) ?? date;

  useEffect(() => {
    const refresh = () => void fetch("/api/credits")
      .then((response) => response.json())
      .then((data: { authenticated?: boolean; credits?: number; displayName?: string | null; email?: string | null }) => setSession({
        authenticated: Boolean(data.authenticated),
        credits: Number(data.credits) || 0,
        displayName: data.displayName || "",
        email: data.email || "",
      }))
      .catch(() => undefined);
    refresh();
    const updateBalance = (event: Event) => setSession((current) => ({ ...current, credits: Number((event as CustomEvent<number>).detail) }));
    const updateSession = (event: Event) => {
      const detail = (event as CustomEvent<{ authenticated?: boolean; credits?: number; displayName?: string; email?: string }>).detail;
      setSession({
        authenticated: Boolean(detail?.authenticated),
        credits: Number(detail?.credits) || 0,
        displayName: detail?.displayName || "",
        email: detail?.email || "",
      });
    };
    window.addEventListener("guanchen:credits", updateBalance);
    window.addEventListener("guanchen:session", updateSession);
    return () => {
      window.removeEventListener("guanchen:credits", updateBalance);
      window.removeEventListener("guanchen:session", updateSession);
    };
  }, []);

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
    if (!session.authenticated) {
      setNotice("请先登录。注册并验证邮箱后，新用户可免费获得 5 积分，用于解锁八字或紫微斗数完整报告。");
      window.location.href = "/login?returnTo=/";
      return;
    }
    if (session.credits < current.cost) {
      window.dispatchEvent(new CustomEvent("guanchen:open-recharge"));
      return;
    }
    setNotice(`已解锁「${topic}」示范报告，扣除 ${current.cost} 积分。正式报告仍需服务端排盘引擎。`);
  }

  function openRecharge() {
    window.dispatchEvent(new CustomEvent("guanchen:open-recharge"));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main>
      <header className="nav-shell">
        <a className="brand" href="#top" aria-label="观辰首页">
          <GuanchenBrandMark />
          <span><strong>观辰</strong><small>东方命理 · 观势知行</small></span>
        </a>
        <nav className={mobileNav ? "open" : ""} aria-label="主导航">
          <Link href="/" onClick={() => setMobileNav(false)}>首页</Link>
          <a href="/bazi">八字测算</a>
          <a href="/ziwei">紫微斗数</a>
          <a href="/match">双人合盘</a>
          <a href="/knowledge">命理课堂</a>
        </nav>
        <div className="account-actions">
          {session.authenticated ? (
            <>
              <details className="account-menu home-account-menu">
                <summary className="account-name" title={session.displayName || session.email}>{session.displayName || session.email}<i>⌄</i></summary>
                <div><a href="/account">账号设置</a><a href="/history">测算历史</a><button onClick={() => void logout()}>退出登录</button></div>
              </details>
              <button className="credit-pill" onClick={openRecharge}><span>余</span>{session.credits} 积分</button>
            </>
          ) : (
            <>
              <a href="/login">登录</a>
              <a className="credit-pill" href="/login"><span>礼</span>注册领 5 积分</a>
            </>
          )}
          <button className="menu-toggle" aria-label="打开菜单" aria-expanded={mobileNav} onClick={() => setMobileNav((value) => !value)}>☰</button>
        </div>
        <RechargeModal />
      </header>

      <section className="hero" id="top">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="hero-copy">
          <p className="eyebrow">观天时 · 察人事 · 知进退</p>
          <h1>解码东方智慧，<br /><em>洞见人生起伏。</em></h1>
          <p className="lead">以八字观人生格局，以紫微察十二宫垣。循古法排盘，取今意解读，于星辰流转与五行生克之间，看见天赋、惯性与时运，也照见每一次选择所能抵达的远方。</p>
          <div className="hero-actions hero-product-actions" aria-label="选择测算类型">
            <a className="hero-product-btn primary" href="/bazi">
              <small>理解天赋与长期结构</small><strong>八字测算</strong><span>→</span>
            </a>
            <a className="hero-product-btn" href="/ziwei">
              <small>看清十二宫人生课题</small><strong>紫微斗数测算</strong><span>→</span>
            </a>
            <a className="hero-product-btn" href="/match">
              <small>理解靠近与磨合方式</small><strong>双人合盘</strong><span>→</span>
            </a>
          </div>
          <div className="trust-row"><span>新用户验证赠 5 积分</span><span>推演有据，脉络可寻</span><span>知命而行，不囿于命</span></div>
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
          <p className="eyebrow">心有所问 · 盘有所应</p>
          <h2>人生万象，皆可从此刻的一问开始。</h2>
          <p>不必先通术数，也无需拘泥吉凶。只需带着眼下最真实的困惑，观辰将循盘中线索，为你辨来路、察当下、望前程。</p>
        </div>
        <div className="question-grid">
          {lifeQuestions.map((item) => (
            <a key={item.eyebrow} href={item.href}>
              <small>{item.eyebrow}</small>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span>{item.tags}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="belief-section" id="belief">
        <div className="belief-intro">
          <p className="eyebrow">观辰的方法</p>
          <h2>循古法以立盘，取今意以解人。</h2>
          <p>命理之学，贵在有源、有据、有验。观辰先校出生时空，再依盘面陈其理、辨其势，最终落于今日可行之选择。</p>
        </div>
        <div className="belief-flow">
          <article><span>01</span><i>校</i><h3>校准时空</h3><p>匹配出生地坐标、历史时区与真太阳时，先把命盘的时间基础算清楚。</p></article>
          <article><span>02</span><i>证</i><h3>追溯依据</h3><p>每项判断回到干支、十神、宫位、星曜和四化，不让结论凭空出现。</p></article>
          <article><span>03</span><i>行</i><h3>回到选择</h3><p>把趋势翻译成现实问题、观察信号与行动建议，最终决定权始终在你手中。</p></article>
        </div>
      </section>

      <section className="calculator-wrap" id="calculator">
        <div className="calculator-copy">
          <p className="eyebrow">四步建立命盘</p>
          <h2>先定生辰坐标，<br />再观命理乾坤。</h2>
          <p>差之毫厘，盘或有别。系统将核对出生地经纬、历史时区、经度时差与均时差，以真太阳时为排盘之基。</p>
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
              <PlaceHierarchyPicker defaultCity="昆明" onChange={(nextPlace) => { setSolarTime(null); setPlace(nextPlace); }} />

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
              <GuanchenWait active={solarLoading} title="小道士正在校正出生时间" detail="正在根据出生地经纬度与历史时区计算真太阳时。" estimatedSeconds={6} compact />
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
        <div className="section-heading"><p className="eyebrow">言必有据 · 推演有章</p><h2>不止告知其然，更为你细说所以然。</h2><p>观辰将玄奥术理铺陈为四重脉络，使每一处判断皆有盘面可循，每一份洞察皆能落于现实。</p></div>
        <div className="report-columns">
          <article><span>01</span><h3>盘面事实</h3><p>先列出干支、十神、五行、宫位、主星和四化等确定性数据。</p></article>
          <article><span>02</span><h3>可能趋势</h3><p>说明哪些模式更容易被环境和阶段触发，同时标注其他可能。</p></article>
          <article><span>03</span><h3>人生课题</h3><p>把反复出现的冲突、关系和成长主题提炼成可理解的问题。</p></article>
          <article><span>04</span><h3>行动建议</h3><p>不给“必须怎样”的答案，而是提供可以尝试、观察和复盘的路径。</p></article>
        </div>
      </section>

      <section className="method-section">
        <div className="method-quote"><span>“</span><p>命示其势，<br />人定其行。</p></div>
        <div className="method-copy">
          <p className="eyebrow">知命不认命 · 观势亦观心</p><h2>命盘可照见来风，却不替你走完长路</h2>
          <p>干支、星曜、宫位与四化皆由固定版本引擎推得。报告所陈，是倾向、惯性与可供参照的时势；真正书写人生的，仍是你的见识、勇气与每一次行动。</p>
          <div className="method-points"><span><b>01</b>盘面事实可追溯</span><span><b>02</b>趋势不等于必然</span><span><b>03</b>每次解读回到行动</span></div>
        </div>
      </section>

      <section className="knowledge" id="knowledge">
        <div className="section-heading"><p className="eyebrow">命理课堂</p><h2>读古法之源流，明命盘之所以然</h2><p>术数不应止于神秘。知其法度，明其边界，方能以清醒之心观命，以自在之身行路。</p></div>
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
        <div className="brand footer-brand"><GuanchenBrandMark /><span><strong>观辰</strong><small>东方命理 · 观势知行</small></span></div>
        <p>传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。</p>
        <div><Link href="/privacy">隐私政策</Link><Link href="/terms">用户协议</Link></div>
        <small>© 2026 观辰 · 观天时，察人事，知进退</small>
      </footer>

    </main>
  );
}
