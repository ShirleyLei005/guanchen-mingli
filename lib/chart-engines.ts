import { getBaziDetail } from "bazi-mcp";
import { astro } from "iztro";

export type ChartTopic = {
  title: string;
  evidence: string;
  interpretation: string;
  action: string;
};

export type ChartReport = {
  summary: string;
  evidence: string[];
  topics: ChartTopic[];
  disclaimer: string;
};

export type BaziPillar = {
  label: string;
  stem: string;
  branch: string;
  stemElement: string;
  branchElement: string;
  tenGod?: string;
  hiddenStems: string[];
  nayin: string;
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
    fetalOrigin: string;
    ownSign: string;
    bodySign: string;
    decades: Array<{
      ganzhi: string;
      startYear: number;
      endYear: number;
      startAge: number;
      endAge: number;
    }>;
  };
  report: ChartReport;
};

export type ZiweiStar = {
  name: string;
  brightness?: string;
  mutagen?: string;
};

export type ZiweiChartResult = {
  kind: "ziwei";
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
    palaces: Array<{
      name: string;
      heavenlyStem: string;
      earthlyBranch: string;
      isBodyPalace: boolean;
      majorStars: ZiweiStar[];
      minorStars: ZiweiStar[];
      decadal: { range: [number, number]; heavenlyStem: string; earthlyBranch: string };
    }>;
  };
  report: ChartReport;
};

type EngineInput = {
  trueSolarTime: string;
  gender: "female" | "male";
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
    nayin: text(pillar["纳音"]),
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
    };
  }
  if (/财富/.test(topic)) {
    return {
      ...base,
      interpretation: "财富主题更适合被理解为资源取得、配置与风险承受方式，不代表确定的收入数字或投资结果。",
      action: "把现金流、安全垫和高风险决策分开管理；重大投资仍应咨询持牌专业人士。",
    };
  }
  if (/感情|关系|正缘|家庭|子女|人际/.test(topic)) {
    return {
      ...base,
      evidence: `关系解读以日支${dayPillar.branch}及四柱互动为依据，本盘日柱为${dayPillar.stem}${dayPillar.branch}。`,
      interpretation: "关系结构揭示的是互动习惯与压力反应，不用来断言某个人是否“注定”适合。",
      action: "优先观察沟通、边界、责任分配和冲突修复四项现实行为。",
    };
  }
  if (/阶段|流年/.test(topic)) {
    return {
      ...base,
      evidence: decadeText ? `当前报告保存的大运序列起始为：${decadeText}。` : base.evidence,
      interpretation: "阶段信息用于安排观察窗口，不把某一年解释为必然发生的吉凶事件。",
      action: "把阶段趋势转换成准备清单、停止条件和复盘日期。",
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
    fetalOrigin: text(raw["胎元"]),
    ownSign: text(raw["命宫"]),
    bodySign: text(raw["身宫"]),
    decades,
  };
  const topics = input.topics.length ? input.topics : ["综合看看"];
  return {
    kind: "bazi",
    engine: { provider: "cantian-ai/bazi-mcp", version: "0.1.0", tool: "getBaziDetail" },
    chart,
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
    evidence: `${palace.name}位于${palace.heavenlyStem}${palace.earthlyBranch}，主星为${stars}。`,
    interpretation: "宫位与星曜描述的是该领域常见的关注方式和应对惯性，不能单独决定事件结果。",
    action: "把这一领域拆成一个可观察问题：事实是什么、惯性反应是什么、下一次可以怎样选择。",
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
    palaces: astrolabe.palaces.map((palace) => ({
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      isBodyPalace: palace.isBodyPalace,
      majorStars: palace.majorStars.map(normalizeStar),
      minorStars: palace.minorStars.map(normalizeStar),
      decadal: {
        range: palace.decadal.range,
        heavenlyStem: palace.decadal.heavenlyStem,
        earthlyBranch: palace.decadal.earthlyBranch,
      },
    })),
  };
  const topics = input.topics.length ? input.topics : ["命盘总览"];
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
      ],
      topics: topics.map((topic) => ziweiTopic(topic, chart)),
      disclaimer: "传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。",
    },
  };
}
