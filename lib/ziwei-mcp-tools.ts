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
  question?: string;
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
  side_income: ["财帛", "官禄", "迁移", "仆役"],
  relationships: ["夫妻", "福德", "仆役"],
  marriage_timing: ["夫妻", "福德", "迁移"],
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
  side_income: { title: "副业与偏财", strength: "辨认主业之外可复用的能力与资源接口", challenge: "副业机会不等于无风险收益，更不能替代财务判断", action: "先用低成本试验验证需求、交付与复购" },
  relationships: { title: "感情关系", strength: "理解亲密关系中的需求、表达与修复方式", challenge: "不能用合盘或单宫裁决一个人是否适合", action: "核对沟通、边界、责任分配和冲突修复" },
  marriage_timing: { title: "婚姻与关系时机", strength: "观察关系议题在哪些阶段更容易进入生活中心", challenge: "流年只能提示议题被激活，不能保证在某年结婚", action: "把时机判断落实为认识渠道、关系质量和现实准备度" },
  health: { title: "健康状况", strength: "识别压力恢复与日常照顾身体的提醒", challenge: "不从星曜诊断疾病、寿命或生育结果", action: "不适及时就医，把睡眠、运动和检查交给专业判断" },
  family: { title: "家庭关系", strength: "观察原生家庭、手足和居住安全感的互动主题", challenge: "家庭角色会随现实责任与生命周期变化", action: "明确责任边界，用具体协商替代角色猜测" },
};

const ASPECT_NARRATIVE: Record<InterpretationAspect, {
  kicker: string; conclusion: string; context: string; risk: string; near: string; mid: string;
}> = {
  general: {
    kicker: "先看人生主轴，再看当下选择",
    conclusion: "这张盘更适合用来辨认你反复面对的课题，而不是替你预告一个不可更改的结局。",
    context: "命宫、身宫与三方四正共同描述了你如何理解世界、如何行动，以及压力出现时容易回到哪种惯性。",
    risk: "只抓住一颗主星或一个吉凶词，就容易忽略同宫、对宫和现实环境带来的修正。",
    near: "写下最近三个月反复出现的三个现实问题，与命盘提示逐一核对。",
    mid: "选择一个最值得改变的惯性，用季度复盘观察它是否真的影响了结果。",
  },
  personality: {
    kicker: "理解惯性，不给性格贴死标签",
    conclusion: "你的优势与压力反应来自同一组心理动力；关键不是消灭某种性格，而是学会在不同情境下切换表达方式。",
    context: "命宫呈现外在行动风格，福德宫补充内在需求与恢复方式，两者不一致时尤其值得关注。",
    risk: "把命盘描述当成固定身份，会让可训练的能力变成自我设限。",
    near: "记录一周内三个触发事件，分别写下第一反应、真实需求和替代做法。",
    mid: "请熟悉你的人反馈：你最可靠的优点和最常见的盲点是否来自同一种倾向。",
  },
  career: {
    kicker: "职业价值来自可验证的能力组合",
    conclusion: "事业判断的重点不是一个职业名称，而是你更容易在哪类任务、责任边界和协作结构中持续创造价值。",
    context: "官禄宫看承担方式，迁移宫看外部舞台，命宫看个人驱动力；三者交叉后才适合谈职业方向。",
    risk: "仅凭星曜决定跳槽、创业或转行，会忽略行业周期、现金流、能力证据和机会成本。",
    near: "挑一个三十天能完成的真实项目，验证你的优势究竟体现在启动、整合、表达还是交付。",
    mid: "把职业目标拆成作品、能力与关系网络三条线，每季度只推进一个关键指标。",
  },
  wealth: {
    kicker: "先看资源模式，再谈财富节奏",
    conclusion: "财富部分揭示的是取得、使用与保存资源的习惯，不代表确定收入，更不能替代投资风险评估。",
    context: "财帛宫说明资源交换方式，田宅宫补充长期沉淀，福德宫则影响安全感与消费决策。",
    risk: "把流年提示直接等同于买卖时点或收益承诺，属于命盘无法支持的推断。",
    near: "先把日常现金流、安全垫和高风险资金分开，记录一个月真实收支。",
    mid: "优先建立可重复的收入能力，再决定是否扩大投入；重大决策咨询持牌专业人士。",
  },
  side_income: {
    kicker: "副业不是运气题，而是能力复用题",
    conclusion: "副业机会更适合从已有技能、外部需求和协作网络的交集寻找，而不是追逐所谓偏财年份。",
    context: "财帛、官禄、迁移与仆役宫共同说明资源如何通过专业、市场和人际接口流动。",
    risk: "在尚未验证需求时重投入，或把短期偶然收入误判为稳定商业模式。",
    near: "用两周做一次最小规模试卖，验证是否有人愿意为明确结果付费。",
    mid: "只有在连续交付、毛利和复购都可观察后，才考虑扩大时间和资金投入。",
  },
  relationships: {
    kicker: "关系质量比标签与时点更重要",
    conclusion: "感情分析更适合帮助你看见需要、表达、边界与修复模式，而不是判定某个人是不是命中注定。",
    context: "夫妻宫描述亲密互动，福德宫补充内在安全感，仆役宫反映社交与协作中的关系入口。",
    risk: "用星曜替对方定性，或为了迎合预测而忽略现实中的尊重、责任与安全。",
    near: "观察一次分歧：双方能否说清需求、承担责任并在冲突后完成修复。",
    mid: "在关系推进前谈清时间安排、金钱边界、家庭期待与长期生活方式。",
  },
  marriage_timing: {
    kicker: "时机是议题升温，不是事件保证",
    conclusion: "流年落宫可以提示关系议题何时更容易进入注意力中心，但不能单独断定恋爱、订婚或结婚一定发生。",
    context: "需要同时看夫妻宫的互动结构、当前大限的生活重心，以及流年是否让关系、社交或迁移议题更突出。",
    risk: "为了追赶所谓婚期降低择偶标准，或把没有发生的事件解释为自己错过命运。",
    near: "明确自己的关系底线、可协商项和现实准备度，并扩大与生活方式相符的认识渠道。",
    mid: "当关系进入稳定阶段，用共同决策、冲突修复和责任分配评估是否适合进一步承诺。",
  },
  health: {
    kicker: "把盘面提醒转化为日常照顾",
    conclusion: "健康宫位只能用于反思压力与恢复习惯，不能用来诊断疾病、预测寿命、生育或治疗结果。",
    context: "疾厄宫需连同福德与命宫理解，重点是压力如何累积、身体信号是否被忽略，以及恢复是否稳定。",
    risk: "因命盘描述延误检查、停药或替代正规治疗。",
    near: "优先稳定睡眠、活动与就医记录；出现持续不适时及时咨询专业医务人员。",
    mid: "把体检和复诊交给医生，把命盘只作为提醒自己照顾身体的文化工具。",
  },
  family: {
    kicker: "看见角色传承，也重写相处边界",
    conclusion: "家庭主题呈现的是角色期待、责任分配与安全感来源，不代表你必须重复原生家庭的模式。",
    context: "父母、兄弟与田宅宫分别补充长辈互动、同辈协作和居住归属感，需要结合真实经历核对。",
    risk: "用传统角色替具体的人下判断，或把长期牺牲误认成唯一的家庭责任。",
    near: "列出自己正在承担的家庭责任，区分必须承担、可以协商和并不属于你的部分。",
    mid: "围绕照护、金钱和居住安排建立可执行的沟通机制，而不是等待彼此猜中需求。",
  },
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
  const narrative = ASPECT_NARRATIVE[aspect];
  const currentYear = chart.chart.currentFortune.targetYear;
  const futureFlows = chart.chart.yearlyFlow.filter((flow) => flow.year >= currentYear).slice(0, 3);
  const evidence = palaceNames.map((name) => starsText(chart, name));
  const timing = (futureFlows.length ? futureFlows : chart.chart.yearlyFlow.slice(0, 3)).map((flow) => {
    const flowPalace = palaceByName(chart, flow.palaceName);
    const stars = flowPalace?.majorStars.map((star) => star.name).join("、") || "";
    const directlyRelevant = palaceNames.some((name) => flow.palaceName.includes(name));
    return {
      year: flow.year,
      label: `${flow.ganzhi} · 流年落${flow.palaceName}`,
      theme: directlyRelevant
        ? `${flow.palaceName}与本章主题直接相连，相关议题更适合进入现实计划与复盘。`
        : `${flow.palaceName}成为年度情境入口，需要连同${palaceNames.join("、")}理解。`,
      opportunity: `以${flow.palaceName}${stars ? `的${stars}` : ""}为线索，寻找能够被现实反馈验证的行动。`,
      caution: "流年表示注意力与情境变化，不等于事件一定发生，也不用于替代重要决策。",
    };
  });
  return {
    aspect,
    title: copy.title,
    kicker: narrative.kicker,
    headline: mainStars.length ? `${mainStars.join("、")}入${primary.name}：${trait}` : `${primary.name}借对宫与三方观察`,
    lead: narrative.context,
    summary: `${primary.name}是本模块的起点，并结合${palaceNames.slice(1).join("、")}交叉观察。${trait}。这些是可验证的关注方式和行动惯性，不是确定事件。`,
    evidence,
    strengths: [copy.strength, `当前盘面可重点观察${primary.changsheng12}、${primary.boshi12}所提示的阶段表达`],
    challenges: [copy.challenge, `大限 ${primary.decadal.range.join("—")} 岁只作为观察窗口，不解释为必然吉凶`],
    actions: [copy.action, "把结论写成一个现实问题、一个可执行动作和一个复盘日期"],
    conclusions: [narrative.conclusion, narrative.context],
    analysis: [
      {
        heading: `一、${primary.name}：本章的核心结构`,
        conclusion: mainStars.length
          ? `${mainStars.join("、")}共同塑造了这一领域的主要关注方式。`
          : `${primary.name}无十四主星，必须借对宫与三方四正合看。`,
        evidence: [evidence[0]],
        explanation: [`${trait}。这描述的是更容易出现的行动倾向，并不是能力高低或吉凶判决。`],
      },
      {
        heading: "二、三方联动：为什么不能只看一个宫位",
        conclusion: `${palaceNames.slice(1).join("、")}会修正${primary.name}的表达，现实结果取决于这些领域能否互相支持。`,
        evidence: evidence.slice(1),
        explanation: [copy.strength, `当前大限落${chart.chart.currentFortune.decadal.palaceName}，观察窗口为${chart.chart.currentFortune.decadal.range.join("—")}岁。`],
      },
      {
        heading: "三、四化与运限：把动力放回时间中",
        conclusion: narrative.context,
        evidence: [`生年四化：${chart.chart.natalMutagens.map((star) => `${star.name}化${star.mutagen}`).join("、") || "资料缺失"}`],
        explanation: ["四化用于观察动力如何流动，但不能跳过现实经历、能力积累与关系互动直接推导事件。"],
      },
    ],
    timing,
    risks: [
      { title: "最需要避免的误读", detail: narrative.risk },
      { title: "阶段判断的边界", detail: `当前大限与未来三年只表示观察窗口；${copy.challenge}。` },
    ],
    actionPlan: [
      { horizon: "现在—30 天", title: "先做一次现实验证", detail: narrative.near },
      { horizon: "未来 3—6 个月", title: "建立可复盘的改变", detail: narrative.mid },
    ],
    boundaries: [
      "不以单一星曜、宫位或流年断言确定事件。",
      aspect === "health" ? "不提供医疗诊断、寿命或生育判断。" : "不替代医疗、投资、法律与重大关系决策。",
      "出生时间误差、流派设置与现实环境都可能影响解读，应以真实经历持续校正。",
    ],
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
    aspects: ["personality", "side_income", "marriage_timing", "health", "family"],
    detailLevel: "comprehensive",
  });
  const modules = [...immediate.modules, ...additional.modules];
  generated.chart.interpretation = modules;
  generated.chart.reportFocus = args.question?.trim() || (args.topics?.length ? `本次优先回应：${args.topics.join("、")}` : "本次从命格总览开始理解");
  generated.chart.selectedTopics = args.topics ?? [];
  generated.chart.report = modulesToReport(generated.chart, modules);
  generated.chart.toolTrace = [
    { tool: "generate_chart", status: "success" },
    { tool: "interpret_chart", status: "success", aspects: ["general", "career", "wealth", "relationships"], detailLevel: "detailed" },
    { tool: "interpret_chart", status: "success", aspects: ["personality", "side_income", "marriage_timing", "health", "family"], detailLevel: "comprehensive" },
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
