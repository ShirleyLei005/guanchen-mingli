import type { BaziChartResult } from "./chart-engines";

export type BaziAnalysisModule = {
  aspect: "overview" | "personality" | "talent" | "career" | "wealth" | "relationships" | "family_children" | "health" | "current_cycle";
  title: string;
  kicker: string;
  headline: string;
  conclusions: string[];
  evidence: string[];
  questions: string[];
  actions: Array<{ horizon: string; title: string; detail: string }>;
  boundary: string;
};

export type BaziAnalysis = {
  focus: string;
  inputAudit: Array<{ item: string; value: string; status: "已确认" | "引擎计算" | "需现实核验" }>;
  strength: {
    classification: "定强型" | "定弱型" | "动态中和型";
    conclusion: string;
    confidence: "高" | "中";
    methods: Array<{ method: string; result: string; reason: string; confidence: "高" | "中" | "低" }>;
    contradiction: string;
  };
  structure: {
    patternCandidate: string;
    rationale: string;
    combinations: string[];
    methodReferences: string[];
  };
  elementFlow: {
    strongest: string;
    weakest: string;
    percentages: Record<string, number>;
    stemChain: string;
    branchChain: string;
    metaphor: string;
    useful: Array<{ level: string; element: string; role: string }>;
    caution: string;
  };
  modules: BaziAnalysisModule[];
  decades: Array<{
    range: string;
    ganzhi: string;
    state: string;
    activated: string;
    observation: string;
  }>;
  years: Array<{
    year: number;
    ganzhi: string;
    tenGod: string;
    interaction: string;
    theme: string;
    action: string;
    current: boolean;
  }>;
  boundaries: string[];
};

type Chart = BaziChartResult["chart"];

const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const STEM_ELEMENT: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const BRANCH_ELEMENT: Record<string, string> = {
  寅: "木", 卯: "木", 巳: "火", 午: "火", 辰: "土", 戌: "土", 丑: "土", 未: "土", 申: "金", 酉: "金", 亥: "水", 子: "水",
};
const GENERATES: Record<string, string> = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
const CONTROLS: Record<string, string> = { 木: "土", 火: "金", 土: "水", 金: "木", 水: "火" };
const CLASH: Record<string, string> = { 子: "午", 午: "子", 丑: "未", 未: "丑", 寅: "申", 申: "寅", 卯: "酉", 酉: "卯", 辰: "戌", 戌: "辰", 巳: "亥", 亥: "巳" };

function producerOf(element: string) {
  return ELEMENTS.find((candidate) => GENERATES[candidate] === element) ?? "";
}

function controllerOf(element: string) {
  return ELEMENTS.find((candidate) => CONTROLS[candidate] === element) ?? "";
}

function elementRole(element: string, dayElement: string) {
  if (element === dayElement) return "比劫";
  if (GENERATES[element] === dayElement) return "印星";
  if (GENERATES[dayElement] === element) return "食伤";
  if (CONTROLS[dayElement] === element) return "财星";
  if (CONTROLS[element] === dayElement) return "官杀";
  return "中性";
}

function tenGodForStem(dayStem: string, targetStem: string) {
  const dayElement = STEM_ELEMENT[dayStem];
  const targetElement = STEM_ELEMENT[targetStem];
  const samePolarity = STEMS.indexOf(dayStem) % 2 === STEMS.indexOf(targetStem) % 2;
  const role = elementRole(targetElement, dayElement);
  if (role === "比劫") return samePolarity ? "比肩" : "劫财";
  if (role === "印星") return samePolarity ? "偏印" : "正印";
  if (role === "食伤") return samePolarity ? "食神" : "伤官";
  if (role === "财星") return samePolarity ? "偏财" : "正财";
  if (role === "官杀") return samePolarity ? "七杀" : "正官";
  return "日主";
}

function ganzhiForYear(year: number) {
  const offset = ((year - 1984) % 60 + 60) % 60;
  return `${STEMS[offset % 10]}${BRANCHES[offset % 12]}`;
}

function strengthMethods(chart: Chart) {
  const dayElement = chart.pillars[2].stemElement;
  const resource = producerOf(dayElement);
  const support = (chart.weightedElements[dayElement] ?? 0) + (chart.weightedElements[resource] ?? 0);
  const monthElement = chart.pillars[1].branchElement;
  const roots = chart.pillars.flatMap((pillar) => pillar.hiddenStems).filter((stem) => STEM_ELEMENT[stem] === dayElement).length;
  const supportingGods = new Set(["比肩", "劫财", "正印", "偏印"]);
  const gods = chart.pillars.flatMap((pillar) => [pillar.tenGod, ...pillar.hiddenTenGods]).filter(Boolean) as string[];
  const supportGodCount = gods.filter((god) => supportingGods.has(god)).length;
  const strongest = Object.entries(chart.weightedElements).sort((a, b) => b[1] - a[1])[0];
  const season = chart.pillars[1].branch;
  const climate = ["亥", "子", "丑"].includes(season) ? "寒湿偏重，调候需关注温暖与流通"
    : ["巳", "午", "未"].includes(season) ? "燥热倾向明显，调候需关注润泽与节律"
      : ["寅", "卯", "辰"].includes(season) ? "春气升发，需观察疏泄是否有承接"
        : "秋气收敛，需观察肃杀与生发是否平衡";
  return {
    support,
    methods: [
      {
        method: "月令旺衰法",
        result: [dayElement, resource].includes(monthElement) ? "偏强" : "偏弱",
        reason: `月支${chart.pillars[1].branch}属${monthElement}，与日主${dayElement}形成${elementRole(monthElement, dayElement)}关系。`,
        confidence: "高" as const,
      },
      {
        method: "地支通根法",
        result: roots >= 2 ? "偏强" : roots === 1 ? "中和" : "偏弱",
        reason: `四支藏干中与日主同元素的根气共${roots}处；根气还需结合刑冲合会复核。`,
        confidence: roots === 1 ? "中" as const : "高" as const,
      },
      {
        method: "十神力量法",
        result: supportGodCount > gods.length / 2 ? "偏强" : supportGodCount === Math.floor(gods.length / 2) ? "中和" : "偏弱",
        reason: `可识别十神${gods.length}项，其中印比类${supportGodCount}项、克泄耗类${gods.length - supportGodCount}项。`,
        confidence: "中" as const,
      },
      {
        method: "气势形象法",
        result: strongest?.[1] >= 38 && [dayElement, resource].includes(strongest[0]) ? "偏强" : strongest?.[1] >= 38 ? "偏弱" : "中和",
        reason: `藏干加权后${strongest?.[0]}约占${strongest?.[1]}%，${strongest?.[1] >= 38 ? "形成较明显气势" : "尚未形成单一五行压倒性气势"}。`,
        confidence: strongest?.[1] >= 38 ? "中" as const : "低" as const,
      },
      {
        method: "调候优先法",
        result: "需调候复核",
        reason: `${climate}；调候与扶抑分开记录，不以寒暖直接替代身强身弱。`,
        confidence: "中" as const,
      },
    ],
  };
}

function makeModules(chart: Chart, gender: "female" | "male", classification: BaziAnalysis["strength"]["classification"], useful: string[]): BaziAnalysisModule[] {
  const day = chart.pillars[2];
  const month = chart.pillars[1];
  const hour = chart.pillars[3];
  const visibleGods = chart.pillars.map((pillar) => pillar.tenGod || "日主");
  const allGods = chart.pillars.flatMap((pillar) => [pillar.tenGod, ...pillar.hiddenTenGods]).filter(Boolean) as string[];
  const currentYear = new Date().getFullYear();
  const currentDecade = chart.decades.find((decade) => currentYear >= decade.startYear && currentYear <= decade.endYear);
  const companionGods = gender === "male" ? ["正财", "偏财"] : ["正官", "七杀"];
  const companionCount = allGods.filter((god) => companionGods.includes(god)).length;
  const baseEvidence = [
    `四柱：${chart.bazi}`,
    `日主${chart.dayMaster}，月令${month.branch}，日支${day.branch}`,
    `藏干加权五行：${Object.entries(chart.weightedElements).map(([name, value]) => `${name}${value}%`).join("、")}`,
  ];
  const createModule = (
    aspect: BaziAnalysisModule["aspect"],
    title: string,
    kicker: string,
    headline: string,
    conclusions: string[],
    evidence: string[],
    questions: string[],
    actions: BaziAnalysisModule["actions"],
    boundary: string,
  ): BaziAnalysisModule => ({ aspect, title, kicker, headline, conclusions, evidence, questions, actions, boundary });
  return [
    createModule("overview", "命局总览", "先定结构，再谈人事",
      `${classification} · ${month.hiddenTenGods[0] || month.tenGod || "月令"}为月令主气`,
      [
        `本报告把旺衰裁定作为后续解释的共同前提，当前综合判为${classification}。`,
        `四柱最值得观察的不是单一“吉凶”，而是${chart.interactions.length ? chart.interactions.join("、") : "五行如何流通与承接"}如何在现实中表现。`,
      ], baseEvidence, ["哪些惯性在不同人生领域反复出现？", "哪些结论能被近三个月经历验证？"],
      [{ horizon: "现在", title: "建立事实清单", detail: "分别记录资源、压力、反应和结果，再与命盘结构核对。" }],
      "格局候选与旺衰属于传统方法模型，不等于客观人格测验或事件判决。"),
    createModule("personality", "性格与内在模式", "分开看外显与内隐",
      `天干显${visibleGods.join("、")}，日支${day.branch}藏${day.hiddenTenGods.join("、") || "主气"}`,
      [
        "天干十神更适合观察公开场合的行动方式，地支藏干用于补充内在需求和压力反应。",
        chart.interactions.length ? `原局见${chart.interactions.join("、")}，可重点核对变化、拉扯或重复议题。` : "原局未见引擎标出的明显刑冲合会，仍需结合现实经历理解性格弹性。",
      ], [`天干十神：${visibleGods.join("、")}`, `日支藏干：${day.hiddenStems.join("、")}（${day.hiddenTenGods.join("、")}）`],
      ["压力出现时，我会先控制、退让、表达还是寻求支持？", "公开形象与真实需要之间是否存在落差？"],
      [{ horizon: "7 天", title: "做一次触发记录", detail: "记录事件、第一反应、真正需求和替代行动，不把命盘标签当作借口。" }],
      "不根据十神诊断人格障碍，也不把性格倾向解释成不可改变的身份。"),
    createModule("talent", "天赋与能力", "月令、透干与日支交叉观察",
      `${month.hiddenTenGods[0] || "月令主气"}提供社会能力入口，${visibleGods.filter((god) => god !== "日主").join("、")}是外显工具`,
      [
        "能力优势需要从实际任务中验证：命盘只能提供更值得尝试的思维与工作方式。",
        `时柱${hour.stem}${hour.branch}显${hour.tenGod || "日主"}，可作为长期输出与技能沉淀的观察线索。`,
      ], [`月柱${month.stem}${month.branch}：${month.tenGod || "日主"}，藏${month.hiddenTenGods.join("、")}`, `时柱${hour.stem}${hour.branch}：${hour.tenGod || "日主"}`],
      ["我更擅长研究、表达、组织、执行还是资源整合？", "哪一种能力已有作品或他人反馈支持？"],
      [{ horizon: "30 天", title: "用项目验证能力", detail: "选择一个可交付项目，记录投入、反馈、质量和复用性。" }],
      "职业原型仅作探索方向，不建议仅凭八字选择专业或辞职转行。"),
    createModule("career", "事业发展", "看责任、输出与资源能否形成闭环",
      `${visibleGods.join("—")}构成外显职业链，当前大运${currentDecade?.ganzhi || "待核对"}`,
      [
        `若按${classification}基准，事业判断需优先观察${useful.join("、")}所代表的现实能力能否被使用。`,
        "真正的职业结论必须同时考虑行业、技能、现金流、机会成本与可验证成绩。",
      ], [...baseEvidence.slice(0, 2), `当前大运：${currentDecade ? `${currentDecade.ganzhi}（${currentDecade.startYear}—${currentDecade.endYear}）` : "未落入已保存区间"}`],
      ["现阶段最需要补的是能力、平台、资源还是边界？", "未来三十天可以交付什么证据？"],
      [{ horizon: "30 天", title: "验证事业主轴", detail: "用真实项目验证优势，不以用神直接映射具体职业。" }, { horizon: "3 个月", title: "建立职业资产", detail: "持续积累作品、能力证明与可信合作关系。" }],
      "不据此保证升职、创业成功或具体职业结果。"),
    createModule("wealth", "财富与资源", "把财星翻译为资源交换方式",
      `全局见财星类${allGods.filter((god) => god.includes("财")).length}处，重点看取得、保存与风险边界`,
      [
        "财星的透藏与强弱用于讨论资源交换倾向，不代表收入金额或财富等级。",
        "命盘无法提供买卖时点、收益率或投资产品建议；重大财务决定应依据现金流和专业意见。",
      ], [`财星分布：${chart.pillars.map((pillar) => `${pillar.label}${[pillar.tenGod, ...pillar.hiddenTenGods].filter((god) => god?.includes("财")).join("、") || "未见"}`).join("；")}`, `五行结构：${Object.entries(chart.weightedElements).map(([key, value]) => `${key}${value}%`).join("、")}`],
      ["收入更依赖专业交付、资源整合还是长期积累？", "当前风险预算和停止条件是否清晰？"],
      [{ horizon: "本月", title: "分开三类资金", detail: "日常现金流、安全垫和高风险资金分别管理。" }, { horizon: "每季度", title: "复盘收入能力", detail: "只扩大已经出现稳定需求与复购的投入。" }],
      "不提供投资、博彩、借贷或具体收益预测。"),
    createModule("relationships", "感情与亲密关系", "配偶星与日支只作互动观察",
      `${gender === "male" ? "男命传统取财星为关系参照" : "女命传统取官杀为关系参照"}，原局可识别${companionCount}处`,
      [
        `关系分析以日支${day.branch}、${companionGods.join("与")}及刑冲合会共同观察，不用单项结构断言婚期、离婚或忠诚。`,
        "比“正缘标签”更重要的是尊重、边界、共同决策、责任分配和冲突修复。",
      ], [`日柱${day.stem}${day.branch}，日支藏${day.hiddenTenGods.join("、") || "主气"}`, `配偶星参照：${companionGods.join("、")}，全局可识别${companionCount}处`],
      ["关系中能否直接表达需求并承担责任？", "冲突后是否能恢复安全感与合作？"],
      [{ horizon: "下一次分歧", title: "观察修复能力", detail: "记录双方是否能澄清事实、表达需求、承担责任并形成新约定。" }],
      "不预测出轨、家暴、离婚次数、配偶外貌职业或确定婚期；如存在现实安全风险，应及时寻求可信支持和专业帮助。"),
    createModule("family_children", "家庭与子女课题", "区分传统取象与现实角色",
      `年柱${chart.pillars[0].stem}${chart.pillars[0].branch}、时柱${hour.stem}${hour.branch}分别作为早年与后期角色的观察入口`,
      [
        "年、月柱可用于反思早年规则与资源经验，时柱可作为长期责任、传承与照顾方式的文化观察。",
        "子女数量、生育结果和家人命运不能由八字可靠推定。",
      ], [`年柱：${chart.pillars[0].stem}${chart.pillars[0].branch}，${chart.pillars[0].tenGod || "日主"}`, `时柱：${hour.stem}${hour.branch}，${hour.tenGod || "日主"}，藏${hour.hiddenTenGods.join("、")}`],
      ["哪些家庭责任确实属于我，哪些需要重新协商？", "我希望传递哪些能力，而不是重复哪些压力模式？"],
      [{ horizon: "本月", title: "画出责任边界", detail: "把照护、金钱和时间责任写清楚，与相关家人进行具体协商。" }],
      "不预测生育、子女数量、家人疾病、寿命或灾祸。"),
    createModule("health", "身心平衡", "五行只作生活习惯提醒",
      `五行最高为${Object.entries(chart.weightedElements).sort((a, b) => b[1] - a[1])[0]?.[0]}，最低为${Object.entries(chart.weightedElements).sort((a, b) => a[1] - b[1])[0]?.[0]}`,
      [
        "五行偏多偏少不等于具体器官疾病，也不能用于诊断、停药或判断寿命。",
        "可把结构差异转化为睡眠、活动、压力恢复与定期检查的提醒。",
      ], [`藏干加权：${Object.entries(chart.weightedElements).map(([key, value]) => `${key}${value}%`).join("、")}`, `刑冲合会：${chart.interactions.join("、") || "未见明显结构"}`],
      ["最近睡眠、精力和压力恢复是否稳定？", "是否有持续不适需要专业评估？"],
      [{ horizon: "现在", title: "回到可观察指标", detail: "关注睡眠、活动、饮食与情绪变化；持续不适及时就医。" }],
      "不提供疾病、寿命、生育或治疗判断，任何不适请咨询专业医务人员。"),
    createModule("current_cycle", "大运与当前十年", "先看阶段变量，再谈事件窗口",
      `${currentDecade ? `${currentDecade.ganzhi}大运（${currentDecade.startAge}—${currentDecade.endAge}岁）` : "当前大运需进一步核对"}`,
      [
        `当前阶段会在${classification}的原局基准上增加新的五行与十神情境，但不把某年写成必然事件。`,
        "流年重点用于安排准备、观察和复盘，不用于预测伤病、婚变、诉讼或暴富。",
      ], [`起运：${chart.fortuneStartDate}，${chart.fortuneStartAge}岁`, `当前大运：${currentDecade ? `${currentDecade.ganzhi}，天干${currentDecade.stemTenGod}` : "未识别"}`],
      ["未来三年最值得提前准备的能力与资源是什么？", "哪些决定需要设置停止条件和备选方案？"],
      [{ horizon: "每季度", title: "做阶段复盘", detail: "把趋势写成准备清单、可逆方案、停止条件和复盘日期。" }],
      "大运流年只表示传统模型中的阶段主题，不保证任何具体事件发生。"),
  ];
}

export function buildBaziAnalysis(
  chart: Chart,
  gender: "female" | "male",
  topics: string[],
  question?: string,
): BaziAnalysis {
  const dayElement = chart.pillars[2].stemElement;
  const resource = producerOf(dayElement);
  const { support, methods } = strengthMethods(chart);
  const strongVotes = methods.filter((item) => item.result === "偏强").length;
  const weakVotes = methods.filter((item) => item.result === "偏弱").length;
  const classification = strongVotes >= 3 && support >= 55 ? "定强型"
    : weakVotes >= 3 && support <= 45 ? "定弱型"
      : "动态中和型";
  const strongest = Object.entries(chart.weightedElements).sort((a, b) => b[1] - a[1])[0]?.[0] || "未知";
  const weakest = Object.entries(chart.weightedElements).sort((a, b) => a[1] - b[1])[0]?.[0] || "未知";
  const output = GENERATES[dayElement];
  const wealth = CONTROLS[dayElement];
  const officer = controllerOf(dayElement);
  const useful = classification === "定强型" ? [output, wealth, officer]
    : classification === "定弱型" ? [resource, dayElement, weakest]
      : [weakest, output, resource];
  const monthGod = chart.pillars[1].hiddenTenGods[0] || chart.pillars[1].tenGod || "月令主气";
  const patternCandidate = ["比肩", "劫财"].includes(monthGod) ? `${monthGod === "比肩" ? "建禄" : "月劫"}格候选` : `${monthGod}格候选`;
  const branches = chart.pillars.map((pillar) => pillar.branch);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, index) => currentYear - 4 + index).map((year) => {
    const ganzhi = ganzhiForYear(year);
    const stem = ganzhi[0];
    const branch = ganzhi[1];
    const clashes = branches.filter((item) => CLASH[branch] === item);
    const repeats = branches.filter((item) => item === branch);
    const interaction = clashes.length ? `${branch}与原局${[...new Set(clashes)].join("、")}相冲`
      : repeats.length ? `${branch}与原局同支，形成重复观察`
        : "未见直接冲或同支，仍需结合大运理解";
    const god = tenGodForStem(chart.dayMaster, stem);
    const theme = `${god}主题进入年度情境，可观察${god.includes("财") ? "资源交换与预算" : god.includes("官") || god === "七杀" ? "责任、规则与压力管理" : god.includes("印") ? "学习、支持与恢复" : god === "食神" || god === "伤官" ? "表达、作品与变化" : "自主性、竞争与协作"}。`;
    return {
      year,
      ganzhi,
      tenGod: god,
      interaction,
      theme,
      action: "用季度事实复盘，不因流年标签直接作重大决定。",
      current: year === currentYear,
    };
  });
  const decades = chart.decades.map((decade) => {
    const stemElement = STEM_ELEMENT[decade.ganzhi[0]];
    const branchElement = BRANCH_ELEMENT[decade.ganzhi[1]];
    const roles = [...new Set([elementRole(stemElement, dayElement), elementRole(branchElement, dayElement)])];
    const supports = [stemElement, branchElement].filter((element) => [dayElement, resource].includes(element)).length;
    const state = classification === "动态中和型"
      ? supports === 2 ? "阶段偏强，需重新检查用神优先级" : supports === 0 ? "阶段偏弱，需重新检查承压能力" : "强弱拉扯，仍以流通为先"
      : `${classification}基准保持，阶段不作自动反转`;
    return {
      range: `${decade.startAge}—${decade.endAge}岁 · ${decade.startYear}—${decade.endYear}`,
      ganzhi: decade.ganzhi,
      state,
      activated: `${decade.stemTenGod || roles[0]}；地支${decade.branchTenGods.join("、") || roles[1]}`,
      observation: `重点观察${roles.join("、")}如何影响现实资源、责任与表达，不标注吉凶等级。`,
    };
  });
  return {
    focus: question?.trim() || `本次优先分析：${topics.join("、")}`,
    inputAudit: [
      { item: "四柱", value: chart.bazi, status: "引擎计算" },
      { item: "性别", value: gender === "male" ? "男" : "女", status: "已确认" },
      { item: "真太阳时排盘", value: chart.solar, status: "已确认" },
      { item: "起运", value: `${chart.fortuneStartDate} · ${chart.fortuneStartAge}岁`, status: "引擎计算" },
      { item: "现实经历", value: "未进行事件校验，报告保留核验问题", status: "需现实核验" },
    ],
    strength: {
      classification,
      conclusion: `五种路径中偏强${strongVotes}项、偏弱${weakVotes}项；印比支持能量约${support}%。综合裁定为${classification}。`,
      confidence: classification === "动态中和型" ? "中" : "高",
      methods,
      contradiction: strongVotes && weakVotes
        ? "月令、通根、十神数量或全局气势存在不同指向，因此不把单一路径当作最终答案；大运介入时需要重新检查状态。"
        : "主要方法方向相对一致；若后续极端大运连续改变印比或克泄耗力量，仍需回头复核。",
    },
    structure: {
      patternCandidate,
      rationale: `月支${chart.pillars[1].branch}以${monthGod}为主气，暂列${patternCandidate}；是否成格仍需结合透干、根气、制化与刑冲合会，不从名称直接推出吉凶。`,
      combinations: chart.interactions.length ? chart.interactions : ["排盘引擎未返回明显刑冲合会"],
      methodReferences: [
        "月令提纲：参考《子平真诠》的格局观察路径",
        "通根与制化：参考《三命通会》的子平法框架",
        "气势与流通：参考《滴天髓》的形象与旺衰思路",
        "寒暖燥湿：参考《穷通宝鉴》的调候视角",
      ],
    },
    elementFlow: {
      strongest,
      weakest,
      percentages: chart.weightedElements,
      stemChain: chart.pillars.map((pillar) => `${pillar.stem}${pillar.stemElement}`).join(" → "),
      branchChain: chart.pillars.map((pillar) => `${pillar.branch}〔${pillar.hiddenStems.join("、")}〕`).join(" → "),
      metaphor: `${strongest}像命局中的主要地形，${weakest}则像相对稀少的通道；重点不是机械“补缺”，而是观察能量能否从${strongest}顺畅转向现实需要。`,
      useful: [
        { level: "第一层", element: useful[0], role: classification === "动态中和型" ? "优先疏通最薄弱环节，每步大运复核" : "格局扶抑的首要观察元素" },
        { level: "第二层", element: useful[1], role: "结合季节寒暖与现实资源作辅助判断" },
        { level: "第三层", element: useful[2], role: "作为通关与平衡线索，不机械对应颜色方位" },
      ],
      caution: "喜用层级是传统模型中的工作假设；不能直接等同于行业、投资品、疾病治疗或所谓改运物品。",
    },
    modules: makeModules(chart, gender, classification, useful),
    decades,
    years,
    boundaries: [
      "提示词提供的是分析框架，不会覆盖排盘引擎返回的四柱、大运与十神事实。",
      "典籍仅标注方法来源，不伪造逐字引文、卷次或不存在的专条。",
      "不预测寿命、疾病、灾祸、出轨、家暴、离婚次数、生育结果或确定财富等级。",
      "报告用于传统文化娱乐与自我反思，不构成医疗、投资、法律或重大人生决策建议。",
    ],
  };
}
