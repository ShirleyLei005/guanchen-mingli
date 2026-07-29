import { getBaziDetail } from "bazi-mcp";
import { astro } from "iztro";
import { buildBaziAnalysis, type BaziAnalysis } from "./bazi-interpretation";

export type ChartTopic = {
  title: string;
  evidence: string;
  interpretation: string;
  action: string;
  keyPoints?: string[];
};

export type ChartReport = {
  summary: string;
  evidence: string[];
  topics: ChartTopic[];
  disclaimer: string;
};

export type ZiweiInterpretationModule = {
  aspect: "general" | "personality" | "career" | "wealth" | "side_income" | "relationships" | "marriage_timing" | "health" | "family";
  title: string;
  kicker: string;
  headline: string;
  lead: string;
  summary: string;
  evidence: string[];
  strengths: string[];
  challenges: string[];
  actions: string[];
  conclusions: string[];
  analysis: Array<{
    heading: string;
    conclusion: string;
    evidence: string[];
    explanation: string[];
  }>;
  timing: Array<{
    year: number;
    label: string;
    theme: string;
    opportunity: string;
    caution: string;
  }>;
  risks: Array<{ title: string; detail: string }>;
  actionPlan: Array<{ horizon: string; title: string; detail: string }>;
  boundaries: string[];
};

export type BaziPillar = {
  label: string;
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
  tenGod?: string;
  hiddenStems: string[];
  hiddenTenGods: string[];
  nayin: string;
  stage: string;
  void: string;
};

export type BaziChartResult = {
  kind: "bazi";
  engine: {
    provider: "cantian-ai/bazi-mcp";
    version: "0.1.0";
    tool: "getBaziDetail";
  };
  chart: {
    bazi: string;
    solar: string;
    lunar: string;
    zodiac: string;
    dayMaster: string;
    pillars: BaziPillar[];
    elements: Record<string, number>;
    weightedElements: Record<string, number>;
    fetalOrigin: string;
    ownSign: string;
    bodySign: string;
    fortuneStartDate: string;
    fortuneStartAge: number;
    interactions: string[];
    deities: Array<{ pillar: string; names: string[] }>;
    decades: Array<{
      ganzhi: string;
      startYear: number;
      endYear: number;
      startAge: number;
      endAge: number;
      stemTenGod: string;
      branchTenGods: string[];
    }>;
  };
  report: ChartReport;
  analysis: BaziAnalysis;
};

export type ZiweiStar = {
  name: string;
  brightness?: string;
  mutagen?: string;
};

export type ZiweiChartResult = {
  kind: "ziwei";
  chartId?: string;
  reportFocus?: string;
  selectedTopics?: string[];
  interpretation?: ZiweiInterpretationModule[];
  toolTrace?: Array<{
    tool: "generate_chart" | "interpret_chart";
    status: "success";
    detailLevel?: "detailed" | "comprehensive";
    aspects?: string[];
  }>;
  engine: {
    provider: "SiwuXue/ziwei-mcp";
    contract: "generate_chart + interpret_chart";
    adapter: "iztro";
    version: "2.5.8";
    reason: string;
  };
  chart: {
    solarDate: string;
    lunarDate: string;
    chineseDate: string;
    time: string;
    timeRange: string;
    zodiac: string;
    soulPalaceBranch: string;
    bodyPalaceBranch: string;
    soul: string;
    body: string;
    fiveElementsClass: string;
    yinYangGender: string;
    natalMutagens: ZiweiStar[];
    currentFortune: {
      targetYear: number;
      nominalAge: number;
      decadal: { palaceName: string; range: [number, number]; ganzhi: string; mutagens: string[] };
      yearly: { palaceName: string; ganzhi: string; mutagens: string[] };
    };
    yearlyFlow: Array<{ year: number; nominalAge: number; ganzhi: string; palaceName: string }>;
    palaces: Array<{
      name: string;
      heavenlyStem: string;
      earthlyBranch: string;
      isBodyPalace: boolean;
      isOriginalPalace: boolean;
      majorStars: ZiweiStar[];
      minorStars: ZiweiStar[];
      adjectiveStars: ZiweiStar[];
      changsheng12: string;
      boshi12: string;
      jiangqian12: string;
      suiqian12: string;
      ages: number[];
      decadal: { range: [number, number]; heavenlyStem: string; earthlyBranch: string };
    }>;
  };
  report: ChartReport;
};

export type CompatibilityMode = "bazi" | "ziwei";

export type CompatibilityResult = {
  kind: "compatibility";
  mode: CompatibilityMode;
  engine: string;
  profiles: Array<{ label: string; headline: string; facts: string[] }>;
  report: ChartReport;
};

type EngineInput = {
  trueSolarTime: string;
  gender: "female" | "male";
  topics: string[];
  question?: string;
};

type CompatibilityInput = {
  mode: CompatibilityMode;
  first: EngineInput;
  second: EngineInput;
  topics: string[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  return typeof value === "number" ? value : Number(value) || 0;
}

function hiddenStems(pillar: UnknownRecord) {
  const branch = record(pillar["地支"]);
  const hidden = record(branch["藏干"]);
  return ["主气", "中气", "余气"]
    .map((key) => text(record(hidden[key])["天干"]))
    .filter(Boolean);
}

function normalizePillar(label: string, value: unknown): BaziPillar {
  const pillar = record(value);
  const stem = record(pillar["天干"]);
  const branch = record(pillar["地支"]);
  return {
    label,
    stem: text(stem["天干"]),
    branch: text(branch["地支"]),
    stemElement: text(stem["五行"]),
    branchElement: text(branch["五行"]),
    tenGod: text(stem["十神"]) || undefined,
    hiddenStems: hiddenStems(pillar),
    hiddenTenGods: ["主气", "中气", "余气"].map((key) => text(record(record(branch["藏干"])[key])["十神"])).filter(Boolean),
    nayin: text(pillar["纳音"]),
    stage: text(pillar["星运"]),
    void: text(pillar["空亡"]),
  };
}

function countElements(pillars: BaziPillar[]) {
  const result: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of pillars) {
    if (pillar.stemElement in result) result[pillar.stemElement] += 1;
    if (pillar.branchElement in result) result[pillar.branchElement] += 1;
  }
  return result;
}

const STEM_ELEMENT: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};

function weightedElements(pillars: BaziPillar[]) {
  const result: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const hiddenWeights = [0.6, 0.3, 0.1];
  pillars.forEach((pillar, pillarIndex) => {
    result[pillar.stemElement] += 1;
    pillar.hiddenStems.forEach((stem, index) => {
      const element = STEM_ELEMENT[stem];
      if (element) result[element] += hiddenWeights[index] * (pillarIndex === 1 ? 1.5 : 1);
    });
  });
  const total = Object.values(result).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(result).map(([element, value]) => [element, Math.round(value / total * 100)]));
}

function collectKnowledgePoints(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKnowledgePoints);
  const item = record(value);
  const own = text(item["知识点"]);
  return [...(own ? [own] : []), ...Object.values(item).flatMap(collectKnowledgePoints)];
}

function strongestElement(elements: Record<string, number>) {
  return Object.entries(elements).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "未知";
}

function baziTopic(topic: string, chart: BaziChartResult["chart"]): ChartTopic {
  const dayPillar = chart.pillars[2];
  const decadeText = chart.decades.slice(0, 3).map((item) => `${item.ganzhi}（${item.startYear}—${item.endYear}）`).join("、");
  const strongest = strongestElement(chart.elements);
  const base = {
    title: topic,
    evidence: `日主${chart.dayMaster}，日柱${dayPillar.stem}${dayPillar.branch}；五行表层以${strongest}出现较多。`,
    interpretation: "命盘展示的是先天气质与情境倾向，不等同于固定结论；同一结构会因环境、训练和选择呈现不同结果。",
    action: "把命盘提示与近期真实事件交叉核对，只保留能帮助行动和复盘的部分。",
  };
  if (/事业|学业|天赋/.test(topic)) {
    return {
      ...base,
      evidence: `${base.evidence} 天干十神为${chart.pillars.map((item) => item.tenGod || "日主").join("、")}。`,
      interpretation: "职业与学习判断应同时观察输出、规则、资源与承压方式，适合用现实项目检验优势，而不是仅凭一个十神定职业。",
      action: "选择一个未来 30 天可验证的能力目标，记录投入、反馈与结果，再决定是否加码。",
      keyPoints: ["观察自己更擅长启动、整合还是收尾", "用实际项目反馈修正职业假设", "为高压阶段预留恢复节奏"],
    };
  }
  if (/财富/.test(topic)) {
    return {
      ...base,
      interpretation: "财富主题更适合被理解为资源取得、配置与风险承受方式，不代表确定的收入数字或投资结果。",
      action: "把现金流、安全垫和高风险决策分开管理；重大投资仍应咨询持牌专业人士。",
      keyPoints: ["资源取得方式", "风险边界", "长期积累节奏"],
    };
  }
  if (/感情|关系|正缘|家庭|子女|人际/.test(topic)) {
    return {
      ...base,
      evidence: `关系解读以日支${dayPillar.branch}及四柱互动为依据，本盘日柱为${dayPillar.stem}${dayPillar.branch}。`,
      interpretation: "关系结构揭示的是互动习惯与压力反应，不用来断言某个人是否“注定”适合。",
      action: "优先观察沟通、边界、责任分配和冲突修复四项现实行为。",
      keyPoints: ["表达需求而非猜测", "明确责任边界", "观察冲突后的修复能力"],
    };
  }
  if (/阶段|流年/.test(topic)) {
    return {
      ...base,
      evidence: decadeText ? `当前报告保存的大运序列起始为：${decadeText}。` : base.evidence,
      interpretation: "阶段信息用于安排观察窗口，不把某一年解释为必然发生的吉凶事件。",
      action: "把阶段趋势转换成准备清单、停止条件和复盘日期。",
      keyPoints: ["阶段不是事件预言", "提前准备可逆方案", "按季度复盘现实证据"],
    };
  }
  return base;
}

export async function generateBaziChart(input: EngineInput): Promise<BaziChartResult> {
  const raw = record(await getBaziDetail({
    // bazi-mcp 会把输入统一转换到东八区；传入 +08:00 是为了保留已经校正过的真太阳壁钟时间。
    solarDatetime: `${input.trueSolarTime.slice(0, 19)}+08:00`,
    gender: input.gender === "male" ? 1 : 0,
    eightCharProviderSect: 2,
  }));
  const pillars = [
    normalizePillar("年柱", raw["年柱"]),
    normalizePillar("月柱", raw["月柱"]),
    normalizePillar("日柱", raw["日柱"]),
    normalizePillar("时柱", raw["时柱"]),
  ];
  const fortune = record(raw["大运"]);
  const decades = Array.isArray(fortune["大运"])
    ? fortune["大运"].slice(0, 10).map((item) => {
      const value = record(item);
      return {
        ganzhi: text(value["干支"]),
        startYear: number(value["开始年份"]),
        endYear: number(value["结束"]),
        startAge: number(value["开始年龄"]),
        endAge: number(value["结束年龄"]),
        stemTenGod: text(value["天干十神"]),
        branchTenGods: Array.isArray(value["地支十神"]) ? value["地支十神"].map(text).filter(Boolean) : [],
      };
    })
    : [];
  const chart: BaziChartResult["chart"] = {
    bazi: text(raw["八字"]),
    solar: text(raw["阳历"]),
    lunar: text(raw["农历"]),
    zodiac: text(raw["生肖"]),
    dayMaster: text(raw["日主"]),
    pillars,
    elements: countElements(pillars),
    weightedElements: weightedElements(pillars),
    fetalOrigin: text(raw["胎元"]),
    ownSign: text(raw["命宫"]),
    bodySign: text(raw["身宫"]),
    fortuneStartDate: text(fortune["起运日期"]),
    fortuneStartAge: number(fortune["起运年龄"]),
    interactions: [...new Set(collectKnowledgePoints(raw["刑冲合会"]))],
    deities: Object.entries(record(raw["神煞"])).map(([pillar, names]) => ({
      pillar,
      names: Array.isArray(names) ? names.map(text).filter(Boolean) : [],
    })),
    decades,
  };
  const requested = input.topics.length ? input.topics : ["综合看看"];
  const topics = [...new Set(["命盘结构", "性格与能力", ...requested, "阶段节奏", "现实行动"])];
  return {
    kind: "bazi",
    engine: { provider: "cantian-ai/bazi-mcp", version: "0.1.0", tool: "getBaziDetail" },
    chart,
    analysis: buildBaziAnalysis(chart, input.gender, requested, input.question),
    report: {
      summary: `本盘日主为${chart.dayMaster}，四柱为${chart.bazi}。以下解读只讨论可观察的倾向与人生课题，不作宿命式断言。`,
      evidence: [
        `真太阳时排盘：${input.trueSolarTime.replace("T", " ").slice(0, 16)}`,
        `农历：${chart.lunar}`,
        `生肖：${chart.zodiac}；胎元：${chart.fetalOrigin}`,
      ],
      topics: topics.map((topic) => baziTopic(topic, chart)),
      disclaimer: "传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。",
    },
  };
}

function timeIndex(value: string) {
  const hour = Number(value.slice(11, 13));
  if (hour === 23) return 12;
  if (hour === 0) return 0;
  return Math.floor((hour + 1) / 2);
}

function normalizeStar(value: unknown): ZiweiStar {
  const star = record(value);
  return {
    name: text(star.name),
    brightness: text(star.brightness) || undefined,
    mutagen: text(star.mutagen) || undefined,
  };
}

function findPalace(chart: ZiweiChartResult["chart"], candidates: string[]) {
  return chart.palaces.find((palace) => candidates.some((name) => palace.name.includes(name)));
}

function ziweiTopic(topic: string, chart: ZiweiChartResult["chart"]): ChartTopic {
  const targetNames = /事业|工作/.test(topic)
    ? ["官禄", "迁移"]
    : /财富|田宅/.test(topic)
      ? ["财帛", "田宅"]
      : /关系|情感|合作|社交/.test(topic)
        ? ["夫妻", "仆役", "交友"]
        : ["命宫", "福德"];
  const palace = findPalace(chart, targetNames) ?? chart.palaces.find((item) => item.earthlyBranch === chart.soulPalaceBranch) ?? chart.palaces[0];
  const stars = palace.majorStars.map((star) => `${star.name}${star.mutagen ? `化${star.mutagen}` : ""}`).join("、") || "无十四主星";
  return {
    title: topic,
    evidence: `${palace.name}位于${palace.heavenlyStem}${palace.earthlyBranch}，主星为${stars}；大限区间为 ${palace.decadal.range[0]}—${palace.decadal.range[1]} 岁。`,
    interpretation: "宫位与星曜描述的是该领域常见的关注方式和应对惯性。主星提供主题，辅曜与四化修正表达，三方四正及运限决定何时更值得观察，任何单一星曜都不能独立决定结果。",
    action: "把这一领域拆成一个可观察问题：事实是什么、惯性反应是什么、有哪些现实资源、下一次可以怎样选择。",
    keyPoints: [
      `留意${palace.name}被现实事件触发时的第一反应`,
      palace.majorStars.length ? `记录主星${palace.majorStars.map((star) => star.name).join("、")}的建设性与压力面` : "无主星宫需同时参考对宫与三方",
      `在${chart.currentFortune.targetYear}年按季度复盘，而非等待单一事件验证`,
    ],
  };
}

export function generateZiweiChart(input: EngineInput): ZiweiChartResult {
  const date = input.trueSolarTime.slice(0, 10).replaceAll("-0", "-");
  const astrolabe = astro.bySolar(
    date,
    timeIndex(input.trueSolarTime),
    input.gender === "male" ? "男" : "女",
    true,
    "zh-CN",
  );
  const targetYear = new Date().getFullYear();
  const targetHoroscope = astrolabe.horoscope(`${targetYear}-7-1`);
  const decadalPalace = astrolabe.palaces[targetHoroscope.decadal.index];
  const yearlyPalace = astrolabe.palaces[targetHoroscope.yearly.index];
  const natalStars = astrolabe.palaces.flatMap((palace) => [
    ...palace.majorStars,
    ...palace.minorStars,
    ...palace.adjectiveStars,
  ]).map(normalizeStar).filter((star) => star.mutagen);
  const yearStem = astrolabe.chineseDate.slice(0, 1);
  const yangStems = new Set(["甲", "丙", "戊", "庚", "壬"]);
  const yearlyFlow = Array.from({ length: 10 }, (_, offset) => targetYear - 2 + offset).map((year) => {
    const flow = astrolabe.horoscope(`${year}-7-1`);
    return {
      year,
      nominalAge: flow.age.nominalAge,
      ganzhi: `${flow.yearly.heavenlyStem}${flow.yearly.earthlyBranch}`,
      palaceName: astrolabe.palaces[flow.yearly.index]?.name ?? "",
    };
  });
  const chart: ZiweiChartResult["chart"] = {
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,
    time: astrolabe.time,
    timeRange: astrolabe.timeRange,
    zodiac: astrolabe.zodiac,
    soulPalaceBranch: astrolabe.earthlyBranchOfSoulPalace,
    bodyPalaceBranch: astrolabe.earthlyBranchOfBodyPalace,
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    yinYangGender: `${yangStems.has(yearStem) ? "阳" : "阴"}${input.gender === "male" ? "男" : "女"}`,
    natalMutagens: natalStars,
    currentFortune: {
      targetYear,
      nominalAge: targetHoroscope.age.nominalAge,
      decadal: {
        palaceName: decadalPalace?.name ?? "",
        range: decadalPalace?.decadal.range ?? [0, 0],
        ganzhi: `${targetHoroscope.decadal.heavenlyStem}${targetHoroscope.decadal.earthlyBranch}`,
        mutagens: targetHoroscope.decadal.mutagen,
      },
      yearly: {
        palaceName: yearlyPalace?.name ?? "",
        ganzhi: `${targetHoroscope.yearly.heavenlyStem}${targetHoroscope.yearly.earthlyBranch}`,
        mutagens: targetHoroscope.yearly.mutagen,
      },
    },
    yearlyFlow,
    palaces: astrolabe.palaces.map((palace) => ({
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      isBodyPalace: palace.isBodyPalace,
      isOriginalPalace: palace.isOriginalPalace,
      majorStars: palace.majorStars.map(normalizeStar),
      minorStars: palace.minorStars.map(normalizeStar),
      adjectiveStars: palace.adjectiveStars.map(normalizeStar),
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      jiangqian12: palace.jiangqian12,
      suiqian12: palace.suiqian12,
      ages: palace.ages,
      decadal: {
        range: palace.decadal.range,
        heavenlyStem: palace.decadal.heavenlyStem,
        earthlyBranch: palace.decadal.earthlyBranch,
      },
    })),
  };
  const requested = input.topics.length ? input.topics : ["命盘总览"];
  const topics = [...new Set(["命身结构", "三方四正", ...requested, "大限与流年", "现实行动"])];
  const soulPalace = chart.palaces.find((palace) => palace.earthlyBranch === chart.soulPalaceBranch);
  return {
    kind: "ziwei",
    engine: {
      provider: "SiwuXue/ziwei-mcp",
      contract: "generate_chart + interpret_chart",
      adapter: "iztro",
      version: "2.5.8",
      reason: "原 MCP 仅支持 stdio/SQLite 且核心含简化公式；生产适配器保留工具契约，并以固定版本 iztro 计算。",
    },
    chart,
    report: {
      summary: `命宫在${chart.soulPalaceBranch}，身宫在${chart.bodyPalaceBranch}，五行局为${chart.fiveElementsClass}。命盘用于发现课题，不替你决定人生。`,
      evidence: [
        `真太阳时：${input.trueSolarTime.replace("T", " ").slice(0, 16)}（${chart.timeRange}）`,
        `农历：${chart.lunarDate}；干支：${chart.chineseDate}`,
        `命主：${chart.soul}；身主：${chart.body}`,
        `命宫主星：${soulPalace?.majorStars.map((star) => star.name).join("、") || "无十四主星"}`,
        `生年四化：${chart.natalMutagens.map((star) => `${star.name}化${star.mutagen}`).join("、") || "未见四化标记"}`,
        `${chart.currentFortune.targetYear} 流年：${chart.currentFortune.yearly.ganzhi}，落${chart.currentFortune.yearly.palaceName}`,
      ],
      topics: topics.map((topic) => ziweiTopic(topic, chart)),
      disclaimer: "传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。",
    },
  };
}

function relationshipDisclaimer() {
  return "合盘用于理解互动模式，不提供“注定合适”或“注定分开”的裁决；涉及安全、财务与法律问题时，请以现实证据和专业意见为准。";
}

export async function generateCompatibility(input: CompatibilityInput): Promise<CompatibilityResult> {
  if (input.mode === "bazi") {
    const [first, second] = await Promise.all([
      generateBaziChart(input.first),
      generateBaziChart(input.second),
    ]);
    const firstDay = first.chart.pillars[2];
    const secondDay = second.chart.pillars[2];
    const combined = Object.keys(first.chart.elements).map((element) =>
      `${element}${first.chart.elements[element] + second.chart.elements[element]}`,
    ).join(" · ");
    const requested = input.topics.length ? input.topics : ["关系总览"];
    const topics = [...new Set(["关系底盘", ...requested, "冲突修复", "共同成长"])].map((topic) => ({
      title: topic,
      evidence: `第一方日柱${firstDay.stem}${firstDay.branch}、日主${first.chart.dayMaster}；第二方日柱${secondDay.stem}${secondDay.branch}、日主${second.chart.dayMaster}；两盘表层五行合计为${combined}。`,
      interpretation: "两张命盘的相似处可能带来默契，也可能放大盲点；差异既可能形成互补，也可能造成节奏和表达方式的摩擦。这里不以单一分数替代真实关系质量。",
      action: "把结论落实到四项可观察行为：如何提出需求、如何分配责任、如何处理压力、冲突后能否修复。",
      keyPoints: ["共同资源与短板", "沟通和责任边界", "压力下的修复方式"],
    }));
    return {
      kind: "compatibility",
      mode: "bazi",
      engine: "cantian-ai/bazi-mcp 0.1.0 · 双盘确定性分析",
      profiles: [
        { label: "第一方", headline: `${first.chart.dayMaster}日主 · ${first.chart.bazi}`, facts: [`生肖 ${first.chart.zodiac}`, `日支 ${firstDay.branch}`, `五行 ${Object.entries(first.chart.elements).map(([key, value]) => `${key}${value}`).join(" ")}`] },
        { label: "第二方", headline: `${second.chart.dayMaster}日主 · ${second.chart.bazi}`, facts: [`生肖 ${second.chart.zodiac}`, `日支 ${secondDay.branch}`, `五行 ${Object.entries(second.chart.elements).map(([key, value]) => `${key}${value}`).join(" ")}`] },
      ],
      report: {
        summary: "默认采用八字双盘分析，从日主、日支、十神和五行资源观察双方互动；不以“匹配分数”裁决关系。",
        evidence: [`第一方：${first.chart.bazi}`, `第二方：${second.chart.bazi}`, `两盘五行合计：${combined}`],
        topics,
        disclaimer: relationshipDisclaimer(),
      },
    };
  }

  const [first, second] = [
    generateZiweiChart(input.first),
    generateZiweiChart(input.second),
  ];
  const palaceEvidence = (chart: ZiweiChartResult["chart"], names: string[]) => names.map((name) => {
    const palace = findPalace(chart, [name]);
    return `${name}${palace?.majorStars.map((star) => star.name).join("、") || "无主星"}`;
  }).join("；");
  const requested = input.topics.length ? input.topics : ["关系总览"];
  const topics = [...new Set(["命身互动", ...requested, "夫妻与福德", "现实协作"])].map((topic) => ({
    title: topic,
    evidence: `第一方命宫${first.chart.soulPalaceBranch}（${palaceEvidence(first.chart, ["命宫", "夫妻", "福德"])}）；第二方命宫${second.chart.soulPalaceBranch}（${palaceEvidence(second.chart, ["命宫", "夫妻", "福德"])}）。`,
    interpretation: "紫微合盘用于并置两人的命身结构、夫妻宫、福德宫与相关三方四正，观察需求、亲密感和压力恢复方式；并非把两张盘机械叠加后给出命定结论。",
    action: "分别说清楚自己对安全感、独处、承诺和现实协作的需要，再用具体事件验证理解是否准确。",
    keyPoints: ["命身表达差异", "亲密与恢复需求", "现实合作方式"],
  }));
  return {
    kind: "compatibility",
    mode: "ziwei",
    engine: "SiwuXue 工具契约 · iztro 2.5.8 双盘分析",
    profiles: [
      { label: "第一方", headline: `${first.chart.yinYangGender} · ${first.chart.fiveElementsClass}`, facts: [`命宫 ${first.chart.soulPalaceBranch}`, `身宫 ${first.chart.bodyPalaceBranch}`, `命主 ${first.chart.soul} · 身主 ${first.chart.body}`] },
      { label: "第二方", headline: `${second.chart.yinYangGender} · ${second.chart.fiveElementsClass}`, facts: [`命宫 ${second.chart.soulPalaceBranch}`, `身宫 ${second.chart.bodyPalaceBranch}`, `命主 ${second.chart.soul} · 身主 ${second.chart.body}`] },
    ],
    report: {
      summary: "紫微双盘分析并置双方命身、夫妻与福德结构，帮助讨论彼此如何感受、表达和修复，不提供绝对匹配分数。",
      evidence: [`第一方：${palaceEvidence(first.chart, ["命宫", "夫妻", "福德"])}`, `第二方：${palaceEvidence(second.chart, ["命宫", "夫妻", "福德"])}`],
      topics,
      disclaimer: relationshipDisclaimer(),
    },
  };
}
