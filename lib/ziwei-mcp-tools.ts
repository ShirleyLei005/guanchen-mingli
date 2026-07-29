import {
  generateZiweiChart,
  type ChartReport,
  type ZiweiChartResult,
  type ZiweiInterpretationModule,
} from "./chart-engines";

export type ZiweiLocation = {
  province: string;
  city: string;
  longitude: number;
  latitude: number;
};

export type GenerateChartArgs = {
  name?: string;
  birthDate: string;
  birthTime: string;
  gender: "female" | "male";
  location?: Partial<ZiweiLocation>;
  timezone?: string;
  calendar?: "solar" | "lunar";
  trueSolarTime?: string;
  topics?: string[];
};

export type InterpretationAspect = ZiweiInterpretationModule["aspect"];

const chartMemory = new Map<string, ZiweiChartResult>();
const DEFAULT_LOCATION: ZiweiLocation = {
  province: "北京市",
  city: "北京市",
  longitude: 116.4,
  latitude: 39.9,
};

const ASPECT_PALACES: Record<InterpretationAspect, string[]> = {
  general: ["命宫", "福德", "官禄"],
  personality: ["命宫", "福德"],
  career: ["官禄", "迁移", "命宫"],
  wealth: ["财帛", "田宅", "福德"],
  relationships: ["夫妻", "福德", "仆役"],
  health: ["疾厄", "福德", "命宫"],
  family: ["父母", "兄弟", "田宅"],
};

const ASPECT_COPY: Record<InterpretationAspect, {
  title: string;
  strength: string;
  challenge: string;
  action: string;
}> = {
  general: { title: "命格总览", strength: "把命身结构转化为稳定的自我认识", challenge: "避免用单一星曜给人生下定论", action: "每季度用真实事件复核一次命盘假设" },
  personality: { title: "性格特质", strength: "看见自己自然采用的判断与表达方式", challenge: "压力下容易把惯性反应当成唯一选择", action: "记录触发事件、第一反应与替代行动" },
  career: { title: "事业发展", strength: "辨认适合承担的角色、节奏与协作方式", challenge: "职业成败仍取决于能力、行业与现实资源", action: "用一个 30 天项目验证优势，不凭星曜直接选职业" },
  wealth: { title: "财富运势", strength: "理解获取、保存和配置资源的倾向", challenge: "命盘不能预测具体收益或替代风险评估", action: "分开管理现金流、安全垫与高风险决策" },
  relationships: { title: "感情关系", strength: "理解亲密关系中的需求、表达与修复方式", challenge: "不能用合盘或单宫裁决一个人是否适合", action: "核对沟通、边界、责任分配和冲突修复" },
  health: { title: "健康状况", strength: "识别压力恢复与日常照顾身体的提醒", challenge: "不从星曜诊断疾病、寿命或生育结果", action: "不适及时就医，把睡眠、运动和检查交给专业判断" },
  family: { title: "家庭关系", strength: "观察原生家庭、手足和居住安全感的互动主题", challenge: "家庭角色会随现实责任与生命周期变化", action: "明确责任边界，用具体协商替代角色猜测" },
};

const STAR_TRAITS: Record<string, string> = {
  紫微: "重视统筹、秩序与责任", 天机: "擅长推演、调整与寻找路径", 太阳: "倾向主动承担并建立影响",
  武曲: "务实、重成果与资源边界", 天同: "重视稳定感与关系中的柔软", 廉贞: "关注原则、欲望与进退尺度",
  天府: "善于积累、承接与稳健托底", 太阴: "细腻审慎，重视内在安全", 贪狼: "资源面广，课题在聚焦与取舍",
  巨门: "通过表达、追问与辨析理解世界", 天相: "重视公平、协作与规则", 天梁: "倾向守护原则并以经验支持他人",
  七杀: "果断开局，也需要清晰风险边界", 破军: "擅长重组旧局并在变化中更新",
};

function palaceByName(chart: ZiweiChartResult, name: string) {
  return chart.chart.palaces.find((palace) => palace.name.includes(name));
}

function starsText(chart: ZiweiChartResult, name: string) {
  const palace = palaceByName(chart, name);
  if (!palace) return `${name}资料缺失`;
  const stars = palace.majorStars.map((star) => `${star.name}${star.mutagen ? `化${star.mutagen}` : ""}`).join("、") || "无十四主星";
  const assistants = palace.minorStars.slice(0, 5).map((star) => star.name).join("、") || "无主要辅曜";
  return `${palace.name}${palace.heavenlyStem}${palace.earthlyBranch}：${stars}；辅曜${assistants}`;
}

function buildModule(chart: ZiweiChartResult, aspect: InterpretationAspect): ZiweiInterpretationModule {
  const palaceNames = ASPECT_PALACES[aspect];
  const primary = palaceByName(chart, palaceNames[0]) ?? chart.chart.palaces[0];
  const mainStars = primary.majorStars.map((star) => star.name);
  const trait = mainStars.map((star) => STAR_TRAITS[star]).filter(Boolean).join("；")
    || "本宫无十四主星，需要连同对宫与三方四正理解";
  const copy = ASPECT_COPY[aspect];
  return {
    aspect,
    title: copy.title,
    headline: mainStars.length ? `${mainStars.join("、")}入${primary.name}：${trait}` : `${primary.name}借对宫与三方观察`,
    summary: `${primary.name}是本模块的起点，并结合${palaceNames.slice(1).join("、")}交叉观察。${trait}。这些是可验证的关注方式和行动惯性，不是确定事件。`,
    evidence: palaceNames.map((name) => starsText(chart, name)),
    strengths: [copy.strength, `当前盘面可重点观察${primary.changsheng12}、${primary.boshi12}所提示的阶段表达`],
    challenges: [copy.challenge, `大限 ${primary.decadal.range.join("—")} 岁只作为观察窗口，不解释为必然吉凶`],
    actions: [copy.action, "把结论写成一个现实问题、一个可执行动作和一个复盘日期"],
  };
}

function modulesToReport(chart: ZiweiChartResult, modules: ZiweiInterpretationModule[]): ChartReport {
  return {
    summary: `命宫在${chart.chart.soulPalaceBranch}，身宫在${chart.chart.bodyPalaceBranch}，五行局为${chart.chart.fiveElementsClass}。报告已按命宫、三方四正及运限证据分层组织。`,
    evidence: [
      `命盘编号：${chart.chartId}`,
      `命主${chart.chart.soul}，身主${chart.chart.body}`,
      `生年四化：${chart.chart.natalMutagens.map((star) => `${star.name}化${star.mutagen}`).join("、")}`,
    ],
    topics: modules.map((module) => ({
      title: module.title,
      evidence: module.evidence.join("；"),
      interpretation: module.summary,
      action: module.actions.join("；"),
      keyPoints: [...module.strengths, ...module.challenges],
    })),
    disclaimer: "传统文化娱乐与自我反思参考，不构成医疗、投资、法律或其他专业建议。",
  };
}

export async function callGenerateChart(args: GenerateChartArgs) {
  if (!args.birthDate || !args.birthTime) throw new Error("出生日期和时间不能为空");
  if (!["female", "male"].includes(args.gender)) throw new Error("性别参数无效");
  const location: ZiweiLocation = {
    province: args.location?.province || DEFAULT_LOCATION.province,
    city: args.location?.city || DEFAULT_LOCATION.city,
    longitude: Number.isFinite(args.location?.longitude) ? args.location!.longitude! : DEFAULT_LOCATION.longitude,
    latitude: Number.isFinite(args.location?.latitude) ? args.location!.latitude! : DEFAULT_LOCATION.latitude,
  };
  const timezone = args.timezone || "Asia/Shanghai";
  const calendar = args.calendar || "solar";
  const trueSolarTime = args.trueSolarTime || `${args.birthDate}T${args.birthTime}:00`;
  const chart = generateZiweiChart({ trueSolarTime, gender: args.gender, topics: args.topics ?? [] });
  const chartId = crypto.randomUUID();
  chart.chartId = chartId;
  chartMemory.set(chartId, chart);
  return { status: "success" as const, chartId, chart, normalizedInput: { location, timezone, calendar } };
}

export async function callInterpretChart(args: {
  chartId: string;
  aspects: InterpretationAspect[];
  detailLevel: "detailed" | "comprehensive";
}) {
  const chart = chartMemory.get(args.chartId);
  if (!chart) throw new Error(`未找到命盘：${args.chartId}`);
  const modules = [...new Set(args.aspects)].map((aspect) => buildModule(chart, aspect));
  return { status: "success" as const, chartId: args.chartId, detailLevel: args.detailLevel, modules };
}

export async function runZiweiWorkflow(args: GenerateChartArgs): Promise<ZiweiChartResult> {
  const generated = await callGenerateChart(args);
  if (!generated.chartId) throw new Error("generate_chart 未返回 chartId");
  const immediate = await callInterpretChart({
    chartId: generated.chartId,
    aspects: ["general", "career", "wealth", "relationships"],
    detailLevel: "detailed",
  });
  const additional = await callInterpretChart({
    chartId: generated.chartId,
    aspects: ["personality", "health", "family"],
    detailLevel: "comprehensive",
  });
  const modules = [...immediate.modules, ...additional.modules];
  generated.chart.interpretation = modules;
  generated.chart.report = modulesToReport(generated.chart, modules);
  generated.chart.toolTrace = [
    { tool: "generate_chart", status: "success" },
    { tool: "interpret_chart", status: "success", aspects: ["general", "career", "wealth", "relationships"], detailLevel: "detailed" },
    { tool: "interpret_chart", status: "success", aspects: ["personality", "health", "family"], detailLevel: "comprehensive" },
  ];
  chartMemory.set(generated.chartId, generated.chart);
  return generated.chart;
}

function inferAspect(question: string): InterpretationAspect {
  if (/工作|事业|职业|升职|跳槽|创业/.test(question)) return "career";
  if (/钱|财富|收入|投资|房产/.test(question)) return "wealth";
  if (/感情|婚姻|伴侣|恋爱|关系/.test(question)) return "relationships";
  if (/健康|睡眠|身体|压力/.test(question)) return "health";
  if (/家庭|父母|兄弟|子女/.test(question)) return "family";
  if (/性格|自己|天赋|优势/.test(question)) return "personality";
  return "general";
}

export async function callZiweiQuestion(args: { chartId: string; question: string }) {
  const chart = chartMemory.get(args.chartId);
  if (!chart) throw new Error("命盘会话已失效，请重新生成命盘");
  const aspect = inferAspect(args.question);
  const fortuneRequested = /今年|明年|流年|大限|什么时候|近期|未来/.test(args.question);
  const interpreted = await callInterpretChart({ chartId: args.chartId, aspects: [aspect], detailLevel: "comprehensive" });
  const analysisModule = interpreted.modules[0];
  const fortune = fortuneRequested
    ? `${chart.chart.currentFortune.targetYear} 流年为${chart.chart.currentFortune.yearly.ganzhi}，落${chart.chart.currentFortune.yearly.palaceName}；当前大限为${chart.chart.currentFortune.decadal.range.join("—")}岁，落${chart.chart.currentFortune.decadal.palaceName}。`
    : "";
  return {
    status: "success" as const,
    chartId: args.chartId,
    tool: fortuneRequested ? "analyze_fortune" : "interpret_chart",
    aspect,
    answer: `${analysisModule.headline}。${analysisModule.summary}${fortune ? ` ${fortune}` : ""} 针对你的问题“${args.question}”，建议先执行：${analysisModule.actions.join("；")}。`,
    evidence: analysisModule.evidence,
    disclaimer: aspect === "health" ? "不进行医疗诊断；如有不适请咨询专业医务人员。" : "命盘用于自我反思，不替代现实判断。",
  };
}
