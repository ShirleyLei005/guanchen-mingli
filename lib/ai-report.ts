import type { BaziChartResult, CompatibilityResult, ZiweiChartResult } from "./chart-engines";

export type EvidenceItem = { id: string; text: string };

export type AiReportChapter = {
  id: string;
  title: string;
  headline: string;
  narrative: string[];
  evidenceRefs: string[];
  evidenceExplanation: string[];
  constructiveExpression: string;
  pressureExpression: string;
  timing: Array<{
    period: string;
    theme: string;
    evidenceRefs: string[];
    opportunity: string;
    caution: string;
  }>;
  reflectionQuestions: string[];
  actions: Array<{ horizon: string; title: string; detail: string }>;
};

export type AiDeepReport = {
  status: "generated";
  reportId: string;
  provider: "deepseek" | "siliconflow" | "groq" | "openai";
  model: string;
  promptVersion: string;
  title: string;
  directAnswer: string;
  coreConclusions: Array<{ title: string; conclusion: string; evidenceRefs: string[] }>;
  chapters: AiReportChapter[];
  finalSynthesis: string[];
  boundaries: string[];
  evidenceCatalog: EvidenceItem[];
  quality: { warnings: string[] };
};

type ReportKind = "bazi" | "ziwei" | "compatibility";

export class AiReportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AiReportError";
    this.code = code;
  }
}

const PROMPT_VERSION = "deep-report-2026-08-04-v7";
const REQUIRED_CHAPTERS: Record<ReportKind, string[]> = {
  bazi: ["overview", "career_wealth", "relationships", "health", "children", "family", "timing"],
  ziwei: ["overview", "career_wealth", "relationships", "health", "children", "family", "timing"],
  compatibility: ["overview", "communication", "intimacy", "conflict", "cooperation", "growth"],
};
const BANNED_CERTAINTY = /一定结婚|必然结婚|一定离婚|必然离婚|命中注定|保证收益|稳赚|准确率\s*\d|寿命为|活到\d+岁|必有血光|必得重病/g;
const NEGATED_CERTAINTY = /(?:并非|不是|不可|不能|不会|避免|禁止|不得|不要|不应|非)[^，。；！？]{0,10}$/;

function hasBannedCertainty(text: string) {
  for (const match of text.matchAll(BANNED_CERTAINTY)) {
    const index = match.index ?? 0;
    const prefix = text.slice(Math.max(0, index - 16), index);
    if (!NEGATED_CERTAINTY.test(prefix)) return true;
  }
  return false;
}

function splitNarrativeParagraph(text: string): [string, string] {
  const midpoint = Math.floor(text.length / 2);
  const candidates: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if ("。！？；，".includes(text[index]) && index >= 30 && text.length - index >= 30) candidates.push(index + 1);
  }
  const splitAt = candidates.sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint))[0]
    ?? Math.max(1, midpoint);
  return [text.slice(0, splitAt).trim(), text.slice(splitAt).trim()];
}

function normalizeNarrative(narrative: string[]) {
  const paragraphs = narrative.map((item) => item.trim()).filter(Boolean);
  while (paragraphs.length < 4 && paragraphs.length) {
    const longestIndex = paragraphs.reduce(
      (best, item, index) => item.length > paragraphs[best].length ? index : best,
      0,
    );
    const [first, second] = splitNarrativeParagraph(paragraphs[longestIndex]);
    if (!first || !second) break;
    paragraphs.splice(longestIndex, 1, first, second);
  }
  if (paragraphs.length > 4) paragraphs.splice(3, paragraphs.length - 3, paragraphs.slice(3).join("\n"));
  return paragraphs;
}

function parseEvidenceYear(text: string) {
  const match = text.match(/(20\d{2})年/);
  return match ? Number(match[1]) : null;
}

function buildTimelineFallback(item: EvidenceItem, isDecade: boolean): AiReportChapter["timing"][number] {
  const year = parseEvidenceYear(item.text);
  const period = isDecade
    ? item.text.match(/大运([^：]+)/)?.[1]?.trim() || "当前大运"
    : year ? `${year} 流年` : "流年阶段";
  return {
    period,
    theme: item.text,
    evidenceRefs: [item.id],
    opportunity: "结合本章主题提前安排资源、沟通与行动节奏，并用现实反馈持续校正。",
    caution: "流年只提示议题被激活的时间窗口，不据此承诺具体事件或结果。",
  };
}

function normalizePersonalTimeline(chapter: AiReportChapter, catalog: EvidenceItem[], kind: ReportKind) {
  if (kind === "compatibility") return;
  const currentYear = new Date().getFullYear();
  const decadeCandidates = catalog.filter((item) => kind === "bazi" ? /^B05\d$/.test(item.id) : item.id === "Z004");
  const decade = decadeCandidates.find((item) => {
    const range = item.text.match(/(20\d{2})[—–-](20\d{2})/);
    return range && currentYear >= Number(range[1]) && currentYear <= Number(range[2]);
  }) ?? decadeCandidates[0];
  const annualCandidates = catalog
    .filter((item) => kind === "bazi" ? /^B07\d$/.test(item.id) : /^Z03\d$/.test(item.id))
    .map((item) => ({ item, year: parseEvidenceYear(item.text) }))
    .filter((entry): entry is { item: EvidenceItem; year: number } => entry.year !== null)
    .sort((left, right) => left.year - right.year);
  const futureYears = annualCandidates.filter((entry) => entry.year >= currentYear).slice(0, 3);
  const selectedYears = futureYears.length >= 3 ? futureYears : annualCandidates.slice(-3);
  const slots = [decade, ...selectedYears.map((entry) => entry.item)].filter((item): item is EvidenceItem => Boolean(item));
  chapter.timing = slots.map((item, index) => {
    const generated = chapter.timing.find((entry) => entry.evidenceRefs.includes(item.id));
    const fallback = buildTimelineFallback(item, index === 0);
    return generated ? { ...generated, period: fallback.period } : fallback;
  });
}

function normalizeGeneratedReport(report: GeneratedReport, catalog: EvidenceItem[], kind: ReportKind) {
  if (!report || !Array.isArray(report.chapters)) return report;
  report.chapters.forEach((chapter) => {
    if (Array.isArray(chapter?.narrative)) chapter.narrative = normalizeNarrative(chapter.narrative);
    if (Array.isArray(chapter?.timing)) normalizePersonalTimeline(chapter, catalog, kind);
  });
  return report;
}

function evidence(id: string, text: string): EvidenceItem {
  return { id, text };
}

export function buildBaziEvidence(result: BaziChartResult): EvidenceItem[] {
  const items: EvidenceItem[] = [
    evidence("B001", `四柱：${result.chart.bazi}；日主：${result.chart.dayMaster}`),
    evidence("B002", `阳历：${result.chart.solar}；农历：${result.chart.lunar}；生肖：${result.chart.zodiac}`),
    evidence("B003", `藏干加权五行：${Object.entries(result.chart.weightedElements).map(([key, value]) => `${key}${value}%`).join("、")}`),
    evidence("B004", `旺衰复核结论：${result.analysis.strength.classification}；${result.analysis.strength.conclusion}`),
    evidence("B005", `格局候选：${result.analysis.structure.patternCandidate}；${result.analysis.structure.rationale}`),
    evidence("B006", `喜用层次：${result.analysis.elementFlow.useful.map((item) => `${item.level}${item.element}（${item.role}）`).join("、")}`),
  ];
  result.chart.pillars.forEach((pillar, index) => items.push(evidence(
    `B${String(10 + index).padStart(3, "0")}`,
    `${pillar.label}${pillar.stem}${pillar.branch}：天干十神${pillar.tenGod || "日主"}，藏干${pillar.hiddenStems.join("、") || "无"}，藏干十神${pillar.hiddenTenGods.join("、") || "无"}，纳音${pillar.nayin}，星运${pillar.stage}，空亡${pillar.void}`,
  )));
  result.analysis.strength.methods.forEach((method, index) => items.push(evidence(
    `B${String(20 + index).padStart(3, "0")}`,
    `旺衰方法${method.method}：${method.result}；${method.reason}；置信度${method.confidence}`,
  )));
  result.chart.interactions.slice(0, 12).forEach((item, index) => items.push(evidence(`B${String(30 + index).padStart(3, "0")}`, `原局互动：${item}`)));
  result.analysis.decades.forEach((item, index) => items.push(evidence(
    `B${String(50 + index).padStart(3, "0")}`,
    `大运${item.range} ${item.ganzhi}：${item.state}；${item.activated}；观察：${item.observation}`,
  )));
  result.analysis.years.forEach((item, index) => items.push(evidence(
    `B${String(70 + index).padStart(3, "0")}`,
    `${item.year}年${item.ganzhi}（${item.tenGod}）：${item.interaction}；主题${item.theme}；建议${item.action}`,
  )));
  return items;
}

export function buildZiweiEvidence(result: ZiweiChartResult): EvidenceItem[] {
  const items: EvidenceItem[] = [
    evidence("Z001", `命宫地支${result.chart.soulPalaceBranch}，身宫地支${result.chart.bodyPalaceBranch}，${result.chart.yinYangGender}，${result.chart.fiveElementsClass}`),
    evidence("Z002", `命主${result.chart.soul}，身主${result.chart.body}`),
    evidence("Z003", `生年四化：${result.chart.natalMutagens.map((star) => `${star.name}化${star.mutagen}`).join("、") || "资料缺失"}`),
    evidence("Z004", `当前大限：${result.chart.currentFortune.decadal.range.join("—")}岁，落${result.chart.currentFortune.decadal.palaceName}，干支${result.chart.currentFortune.decadal.ganzhi}`),
    evidence("Z005", `当前流年：${result.chart.currentFortune.targetYear}年${result.chart.currentFortune.yearly.ganzhi}，落${result.chart.currentFortune.yearly.palaceName}`),
  ];
  result.chart.palaces.forEach((palace, index) => items.push(evidence(
    `Z${String(10 + index).padStart(3, "0")}`,
    `${palace.name}${palace.heavenlyStem}${palace.earthlyBranch}${palace.isBodyPalace ? "（身宫）" : ""}：主星${palace.majorStars.map((star) => `${star.name}${star.brightness || ""}${star.mutagen ? `化${star.mutagen}` : ""}`).join("、") || "无十四主星"}；辅星${palace.minorStars.slice(0, 8).map((star) => `${star.name}${star.mutagen ? `化${star.mutagen}` : ""}`).join("、") || "无"}；杂曜${palace.adjectiveStars.slice(0, 8).map((star) => star.name).join("、") || "无"}；大限${palace.decadal.range.join("—")}岁；长生十二神${palace.changsheng12}`,
  )));
  result.chart.yearlyFlow.forEach((flow, index) => items.push(evidence(
    `Z${String(30 + index).padStart(3, "0")}`,
    `${flow.year}年${flow.ganzhi}，虚岁${flow.nominalAge}，流年命宫落${flow.palaceName}`,
  )));
  return items;
}

export function buildCompatibilityEvidence(result: CompatibilityResult): EvidenceItem[] {
  return result.evidenceCatalog;
}

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "directAnswer", "coreConclusions", "chapters", "finalSynthesis", "boundaries"],
  properties: {
    title: { type: "string" },
    directAnswer: { type: "string" },
    coreConclusions: {
      type: "array", minItems: 3, maxItems: 5,
      items: {
        type: "object", additionalProperties: false,
        required: ["title", "conclusion", "evidenceRefs"],
        properties: {
          title: { type: "string" }, conclusion: { type: "string" },
          evidenceRefs: { type: "array", minItems: 1, items: { type: "string" } },
        },
      },
    },
    chapters: {
      type: "array", minItems: 6, maxItems: 9,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "title", "headline", "narrative", "evidenceRefs", "evidenceExplanation", "constructiveExpression", "pressureExpression", "timing", "reflectionQuestions", "actions"],
        properties: {
          id: { type: "string" }, title: { type: "string" }, headline: { type: "string" },
          narrative: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          evidenceRefs: { type: "array", minItems: 2, items: { type: "string" } },
          evidenceExplanation: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
          constructiveExpression: { type: "string" }, pressureExpression: { type: "string" },
          timing: {
            type: "array", maxItems: 4,
            items: {
              type: "object", additionalProperties: false,
              required: ["period", "theme", "evidenceRefs", "opportunity", "caution"],
              properties: {
                period: { type: "string" }, theme: { type: "string" },
                evidenceRefs: { type: "array", minItems: 1, items: { type: "string" } },
                opportunity: { type: "string" }, caution: { type: "string" },
              },
            },
          },
          reflectionQuestions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
          actions: {
            type: "array", minItems: 2, maxItems: 4,
            items: {
              type: "object", additionalProperties: false,
              required: ["horizon", "title", "detail"],
              properties: { horizon: { type: "string" }, title: { type: "string" }, detail: { type: "string" } },
            },
          },
        },
      },
    },
    finalSynthesis: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
    boundaries: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
  },
} as const;

function systemInstructions(kind: ReportKind) {
  const method = kind === "bazi"
    ? "使用子平结构分析顺序：输入审计→日主旺衰多路径复核→格局与制化→十神和五行流通→人生模块→大运流年。不可仅凭五行数量、单一十神或神煞下结论。"
    : kind === "ziwei"
      ? "使用紫微斗数综合顺序：命身主轴→十二宫→三方四正→主辅星与四化→大限流年。不可只凭一颗主星、一个宫位或吉凶词下结论。"
      : "使用双盘关系分析顺序：先分别确认双方结构→寻找互动接口→区分互补与摩擦→讨论沟通、亲密、冲突修复、现实协作与共同成长。不得用单一匹配分数或命定标签裁决关系。";
  const chapterRule = kind === "compatibility"
    ? "chapters 必须且只能包含 id 为 overview、communication、intimacy、conflict、cooperation、growth 的六章，完整覆盖沟通、亲密、冲突修复、现实协作和共同成长，不得省略，也不要增加其他章节。"
    : "chapters 必须且只能包含七章：overview（命盘总览，含性格与人生主轴）、career_wealth（事业及财运）、relationships（感情及婚姻）、health（健康）、children（子女）、family（父母及兄弟）、timing（运势节奏及关键节点）。七章都必须完整生成，不要增加或省略章节。健康章只讨论生活方式、压力反应和一般性保养提醒；子女、婚姻及家庭章不得断言必有、必无或确定事件。";
  return `你是观辰的资深传统命理报告编辑。${method}
你的工作是解释服务端已经计算好的命盘，不是重新排盘。只能使用证据目录里的事实；严禁自行补算、改写或发明星曜、宫位、干支、十神、四化、运限。
写成专业但通俗的简体中文咨询报告，避免堆砌术语。必须使用命理术语时，紧接着用日常语言解释它对工作、关系、情绪或选择意味着什么。先直接回应用户最关心的问题，再解释盘面结构、正向表达、压力表达、阶段变化与现实行动。每项核心结论和时间判断必须引用 evidenceRefs；引用只能是目录中存在的编号。
${chapterRule}每章 narrative 正好四段，每段90至160个汉字：第一段直接说明这组结构对当事人意味着什么；第二段结合至少两条盘面依据解释为什么；第三段给出二至三个容易在工作、关系、情绪或决策中被本人认出的具体表现，并同时写出顺境与压力下的差别；第四段说明如何在现实中验证、调整和运用。不要写“你很重感情、偶尔敏感”一类适用于多数人的空泛句子，不要重复套话。evidenceExplanation 必须用日常语言把多条盘面事实如何共同支持结论讲清楚，不能只复述证据。directAnswer 应先给清晰结论，再给关键依据和当前最值得留意的现实课题。个人命盘每章 timing 正好四项，依次为当前大运、当年流年及随后两个流年；合盘每章 timing 最多一项。actions 两至三项，行动建议要具体到可执行步骤、观察信号和复盘方式。时间判断只能使用目录明确提供的大运或流年；合盘不得把双方阶段不同步写成分手或结婚预言。
命盘揭示趋势与人生课题，不决定人生。禁止确定性婚期、离婚、疾病、寿命、灾祸、投资收益或法律结果；健康、投资、法律事项只给一般性提醒并建议咨询专业人士。不要伪造古籍引文，不要宣称准确率。`;
}

function extractOpenAiOutputText(payload: unknown) {
  const response = payload as { status?: string; incomplete_details?: { reason?: string }; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }> };
  if (response.status === "incomplete") throw new AiReportError("INCOMPLETE", `模型输出未完成：${response.incomplete_details?.reason || "未知原因"}`);
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "refusal") throw new AiReportError("REFUSAL", content.refusal || "模型拒绝生成报告");
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new AiReportError("EMPTY_OUTPUT", "模型没有返回可用报告");
}

function extractGroqOutputText(payload: unknown) {
  const response = payload as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  const choice = response.choices?.[0];
  if (choice?.finish_reason === "length") throw new AiReportError("INCOMPLETE", "AI 报告达到输出长度上限，请重新生成");
  const content = choice?.message?.content;
  if (!content) throw new AiReportError("EMPTY_OUTPUT", "Groq 没有返回可用报告");
  return content;
}

type GeneratedReport = Omit<AiDeepReport, "status" | "reportId" | "provider" | "model" | "promptVersion" | "evidenceCatalog" | "quality">;

function validateReport(report: GeneratedReport, catalog: EvidenceItem[], kind: ReportKind) {
  const validIds = new Set(catalog.map((item) => item.id));
  const errors: string[] = [];
  if (!report || typeof report !== "object") return ["报告不是 JSON 对象"];
  if (typeof report.title !== "string" || typeof report.directAnswer !== "string") return ["标题或直接回答字段缺失"];
  if (!Array.isArray(report.coreConclusions) || !Array.isArray(report.chapters)) return ["核心结论或章节字段缺失"];
  if (!Array.isArray(report.finalSynthesis) || !Array.isArray(report.boundaries)) return ["总结或边界字段缺失"];
  if (report.coreConclusions.some((item) => !item || !Array.isArray(item.evidenceRefs))) return ["核心结论证据字段无效"];
  if (report.chapters.some((chapter) => !chapter || !Array.isArray(chapter.evidenceRefs) || !Array.isArray(chapter.timing) || !Array.isArray(chapter.narrative))) return ["章节结构无效"];
  if (report.chapters.some((chapter) => chapter.timing.some((item) => !item || !Array.isArray(item.evidenceRefs)))) return ["时间线证据字段无效"];
  const references = [
    ...report.coreConclusions.flatMap((item) => item.evidenceRefs),
    ...report.chapters.flatMap((chapter) => [...chapter.evidenceRefs, ...chapter.timing.flatMap((item) => item.evidenceRefs)]),
  ];
  const unknown = [...new Set(references.filter((id) => !validIds.has(id)))];
  if (unknown.length) errors.push(`存在无效证据编号：${unknown.join("、")}`);
  for (const id of REQUIRED_CHAPTERS[kind]) if (!report.chapters.some((chapter) => chapter.id === id)) errors.push(`缺少章节：${id}`);
  if (report.directAnswer.trim().length < 100) errors.push("直接回答过短");
  report.chapters.forEach((chapter) => {
    if (chapter.narrative.length !== 4) errors.push(`${chapter.id}章节段落数量不完整`);
    if (chapter.narrative.join("").length < 320) errors.push(`${chapter.id}章节正文过短`);
    const chapterContent = [
      ...chapter.narrative,
      ...chapter.evidenceExplanation,
      chapter.constructiveExpression,
      chapter.pressureExpression,
      ...chapter.timing.flatMap((item) => [item.theme, item.opportunity, item.caution]),
      ...chapter.actions.flatMap((item) => [item.title, item.detail]),
    ].join("");
    if (chapterContent.length < 520) errors.push(`${chapter.id}章节内容过短`);
  });
  if (hasBannedCertainty(JSON.stringify(report))) errors.push("出现禁止的确定性断言");
  return errors;
}

async function requestStructuredReport(args: {
  kind: ReportKind;
  question: string;
  topics: string[];
  catalog: EvidenceItem[];
  correction?: string;
}) {
  const provider = (process.env.AI_REPORT_PROVIDER || "deepseek").toLowerCase();
  if (provider === "openai") return requestOpenAiReport(args);
  if (provider === "deepseek") return requestDeepSeekReport(args);
  if (provider === "siliconflow") return requestSiliconFlowReport(args);
  if (provider === "groq") return requestGroqReport(args);
  throw new AiReportError("AI_PROVIDER_INVALID", `不支持的 AI 报告服务：${provider}`);
}

async function requestDeepSeekReport(args: {
  kind: ReportKind;
  question: string;
  topics: string[];
  catalog: EvidenceItem[];
  correction?: string;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AiReportError("AI_NOT_CONFIGURED", "DeepSeek 深度报告服务尚未配置，请管理员设置 DEEPSEEK_API_KEY");
  const model = process.env.DEEPSEEK_REPORT_MODEL || "deepseek-v4-flash";
  const chapterTitles: Record<string, string> = {
    overview: "命盘总览", career_wealth: "事业及财运", relationships: "感情及婚姻", health: "健康",
    children: "子女", family: "父母及兄弟", timing: "运势节奏及关键节点", communication: "沟通模式", intimacy: "亲密需求",
    conflict: "冲突修复", cooperation: "现实协作", growth: "共同成长",
  };
  const context = { reportKind: args.kind, question: args.question, selectedTopics: args.topics, evidenceCatalog: args.catalog, correction: args.correction || "" };
  const jobs: Array<() => Promise<unknown>> = [
    () => callDeepSeekJson({
      apiKey, model, maxTokens: 2400,
      system: `${systemInstructions(args.kind)}\n本次只生成整份报告的总览对象，不生成 chapters。directAnswer 为180至300字；coreConclusions 正好3项；finalSynthesis 正好3至5项；boundaries 正好3项。只返回合法 JSON。`,
      user: { ...context, requiredJsonShape: { title: "报告标题", directAnswer: "直接回应", coreConclusions: [{ title: "标题", conclusion: "结论", evidenceRefs: ["有效证据编号"] }], finalSynthesis: ["综合收束"], boundaries: ["分析边界"] } },
    }),
    ...REQUIRED_CHAPTERS[args.kind].map((id) => () => callDeepSeekJson({
      apiKey, model, maxTokens: 3000,
      system: `${systemInstructions(args.kind)}\n本次忽略整份 chapters 数组的格式要求，只生成“${chapterTitles[id]}”一个章节对象。id 必须为 ${id}；narrative 正好4段，每段90至150字，并包含具体生活场景；evidenceRefs 2至3项；evidenceExplanation 正好2至3项；${args.kind === "compatibility" ? "timing 最多1项" : "timing 正好4项，依次分析当前大运、当年流年及随后两个流年，每项必须引用对应运限证据"}；reflectionQuestions 正好2项；actions 正好2项。只返回合法 JSON。`,
      user: { ...context, chapterId: id, chapterTitle: chapterTitles[id], requiredJsonShape: { id, title: chapterTitles[id], headline: "本章核心判断", narrative: ["含义", "依据", "具体表现", "验证与运用"], evidenceRefs: ["有效证据编号1", "有效证据编号2"], evidenceExplanation: ["推导说明1", "推导说明2"], constructiveExpression: "顺势发挥时", pressureExpression: "容易卡住时", timing: [{ period: "证据明确的阶段", theme: "主题", evidenceRefs: ["有效证据编号"], opportunity: "可把握", caution: "需留意" }], reflectionQuestions: ["问题1", "问题2"], actions: [{ horizon: "时间范围", title: "行动", detail: "步骤与观察信号" }, { horizon: "时间范围", title: "行动", detail: "步骤与复盘方式" }] } },
    })),
  ];
  const outputs: unknown[] = [];
  for (let index = 0; index < jobs.length; index += 4) outputs.push(...await Promise.all(jobs.slice(index, index + 4).map((job) => job())));
  const chapters = outputs.slice(1) as AiReportChapter[];
  const summary = outputs[0] as Partial<Omit<GeneratedReport, "chapters">>;
  const coreConclusions = Array.isArray(summary.coreConclusions) ? summary.coreConclusions : [];
  const parsed: GeneratedReport = {
    title: summary.title || (args.kind === "compatibility" ? "看见彼此的互动，也保留共同选择" : "在趋势中辨认课题，在选择中塑造人生"),
    directAnswer: summary.directAnswer || coreConclusions.map((item) => item.conclusion).join("\n"),
    coreConclusions,
    chapters,
    finalSynthesis: Array.isArray(summary.finalSynthesis) ? summary.finalSynthesis : chapters.slice(0, 3).map((chapter) => chapter.constructiveExpression),
    boundaries: Array.isArray(summary.boundaries) ? summary.boundaries : ["传统文化娱乐与自我反思参考。", "不替代医疗、投资或法律等专业意见。", "命盘揭示趋势与课题，不决定人生或关系。"],
  };
  return { parsed, model, provider: "deepseek" as const };
}

async function callDeepSeekJson(args: { apiKey: string; model: string; maxTokens: number; system: string; user: unknown }) {
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({ model: args.model, stream: false, thinking: { type: "disabled" }, temperature: 0.4, max_tokens: args.maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: args.system }, { role: "user", content: JSON.stringify(args.user) }] }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new AiReportError("AI_TIMEOUT", "DeepSeek 生成超时，本次请求已停止，请稍后重试");
    throw new AiReportError("DEEPSEEK_REQUEST_FAILED", "无法连接 DeepSeek 服务，请稍后重试");
  }
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) {
    const message = payload?.error?.message || "";
    if (response.status === 401 || /invalid.*key|authentication|unauthorized/i.test(message)) throw new AiReportError("AI_AUTHENTICATION_FAILED", "DeepSeek 服务认证失败，请检查 DEEPSEEK_API_KEY");
    if (response.status === 402 || /balance|余额|insufficient/i.test(message)) throw new AiReportError("AI_QUOTA_EXHAUSTED", "DeepSeek API 余额不足，请检查账户余额");
    if (response.status === 429) throw new AiReportError("AI_RATE_LIMITED", "DeepSeek 请求较多，请稍后重试");
    if (response.status === 413 || /token|context|too large/i.test(message)) throw new AiReportError("AI_TOKEN_LIMIT", "本次盘面资料超过 DeepSeek 上下文限制，请稍后重试");
    throw new AiReportError("DEEPSEEK_REQUEST_FAILED", message || `DeepSeek 请求失败（${response.status}）`);
  }
  return parseJsonObject(extractGroqOutputText(payload));
}

async function requestSiliconFlowReport(args: {
  kind: ReportKind;
  question: string;
  topics: string[];
  catalog: EvidenceItem[];
  correction?: string;
}) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) throw new AiReportError("AI_NOT_CONFIGURED", "免费 AI 报告服务尚未配置，请管理员设置 SILICONFLOW_API_KEY");
  const defaultModel = process.env.SILICONFLOW_REPORT_MODEL || "THUDM/GLM-4-9B-0414";
  const model = args.kind === "compatibility"
    ? process.env.SILICONFLOW_COMPATIBILITY_MODEL || "Qwen/Qwen3-8B"
    : defaultModel;
  const chapterTitles: Record<string, string> = {
    overview: "命盘总览", career_wealth: "事业及财运", relationships: "感情及婚姻", health: "健康",
    children: "子女", family: "父母及兄弟", timing: "运势节奏及关键节点", communication: "沟通模式", intimacy: "亲密需求",
    conflict: "冲突修复", cooperation: "现实协作", growth: "共同成长",
  };
  const baseContext = {
    reportKind: args.kind,
    question: args.question,
    selectedTopics: args.topics,
    evidenceCatalog: args.catalog,
    correction: args.correction || "",
  };
  const jobs: Array<() => Promise<unknown>> = [
    () => callSiliconFlowJson({
      apiKey, model, maxTokens: 2200,
      system: `${systemInstructions(args.kind)}\n本次只生成报告总览。directAnswer 为150至250个汉字；coreConclusions 正好3项；finalSynthesis 正好3项；boundaries 正好3项。每项核心结论引用有效证据编号。只返回合法 JSON。`,
      user: {
        ...baseContext,
        requiredJsonShape: {
          title: "报告标题",
          directAnswer: "150至250字直接回应",
          coreConclusions: [{ title: "结论标题", conclusion: "结论正文", evidenceRefs: ["有效证据编号"] }],
          finalSynthesis: ["总结1", "总结2", "总结3"],
          boundaries: ["边界1", "边界2", "边界3"],
        },
      },
    }),
    ...REQUIRED_CHAPTERS[args.kind].map((id) => () => callSiliconFlowJson({
      apiKey, model, maxTokens: 3000,
      system: `${systemInstructions(args.kind)}\n本次只生成“${chapterTitles[id]}”一个章节，id 必须严格为 ${id}。narrative 正好4段，每段90至150个汉字；evidenceRefs 正好2至3项且必须有效；evidenceExplanation 正好2项；${args.kind === "compatibility" ? "timing 最多1项" : "timing 正好4项，依次分析当前大运、当年流年及随后两个流年，每项引用对应证据"}；reflectionQuestions 正好2项；actions 正好2项。正向表达、压力表达和行动建议均须具体。只返回合法 JSON。`,
      user: {
        ...baseContext,
        chapterId: id,
        chapterTitle: chapterTitles[id],
        requiredJsonShape: {
          id,
          title: chapterTitles[id],
          headline: "本章核心判断",
          narrative: ["含义", "依据", "具体表现", "验证与运用"],
          evidenceRefs: ["有效证据编号1", "有效证据编号2"],
          evidenceExplanation: ["证据如何支持判断1", "证据如何支持判断2"],
          constructiveExpression: "建设性表达",
          pressureExpression: "压力下表达",
          timing: [{ period: "仅使用证据明确提供的阶段", theme: "主题", evidenceRefs: ["有效证据编号"], opportunity: "机会", caution: "提醒" }],
          reflectionQuestions: ["问题1", "问题2"],
          actions: [{ horizon: "时间范围", title: "行动标题", detail: "行动细节" }, { horizon: "时间范围", title: "行动标题", detail: "行动细节" }],
        },
      },
    })),
  ];
  const outputs: unknown[] = [];
  for (let index = 0; index < jobs.length; index += 4) {
    outputs.push(...await Promise.all(jobs.slice(index, index + 4).map((job) => job())));
  }
  const chapters = outputs.slice(1) as AiReportChapter[];
  const rawSummary = outputs[0] as Partial<Omit<GeneratedReport, "chapters">>;
  const coreConclusions = Array.isArray(rawSummary.coreConclusions) && rawSummary.coreConclusions.length >= 3
    ? rawSummary.coreConclusions
    : chapters.slice(0, 3).map((chapter) => ({
      title: chapter.title,
      conclusion: chapter.narrative[0] || chapter.headline,
      evidenceRefs: chapter.evidenceRefs,
    }));
  let directAnswer = typeof rawSummary.directAnswer === "string" ? rawSummary.directAnswer : "";
  if (directAnswer.trim().length < 100) {
    directAnswer = [directAnswer, ...coreConclusions.map((item) => item.conclusion)]
      .filter(Boolean)
      .join("\n")
      .slice(0, 600);
  }
  const parsed: GeneratedReport = {
    title: typeof rawSummary.title === "string" && rawSummary.title.trim()
      ? rawSummary.title
      : args.kind === "compatibility" ? "看见彼此的互动，也保留共同选择" : "在趋势中辨认课题，在选择中塑造人生",
    directAnswer,
    coreConclusions,
    chapters,
    finalSynthesis: Array.isArray(rawSummary.finalSynthesis) && rawSummary.finalSynthesis.length >= 3
      ? rawSummary.finalSynthesis
      : chapters.slice(0, 3).map((chapter) => chapter.constructiveExpression),
    boundaries: Array.isArray(rawSummary.boundaries) && rawSummary.boundaries.length >= 3
      ? rawSummary.boundaries
      : ["传统文化娱乐与自我反思参考。", "不替代医疗、投资或法律等专业意见。", "命盘揭示趋势与课题，不决定人生或关系。"],
  };
  return { parsed, model, provider: "siliconflow" as const };
}

async function callSiliconFlowJson(args: {
  apiKey: string;
  model: string;
  maxTokens: number;
  system: string;
  user: unknown;
}) {
  let response: Response;
  try {
    response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.apiKey}` },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: args.model,
        stream: false,
        temperature: 0.4,
        top_p: 0.8,
        max_tokens: args.maxTokens,
        enable_thinking: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: JSON.stringify(args.user) },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiReportError("AI_TIMEOUT", "免费模型生成时间较长，本次请求已停止，请稍后重试");
    }
    throw new AiReportError("SILICONFLOW_REQUEST_FAILED", "无法连接硅基流动服务，请稍后重试");
  }
  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
  if (!response.ok) {
    const providerMessage = payload?.error?.message || "";
    if (response.status === 401 || /invalid.*key|unauthorized/i.test(providerMessage)) throw new AiReportError("AI_AUTHENTICATION_FAILED", "硅基流动报告服务认证失败，请检查 SILICONFLOW_API_KEY");
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new AiReportError("AI_RATE_LIMITED", retryAfter ? `免费模型触发限流，请在 ${retryAfter} 秒后重试` : "免费模型触发限流，请稍后重试");
    }
    if (response.status === 402 || /balance|余额|insufficient/i.test(providerMessage)) throw new AiReportError("AI_QUOTA_EXHAUSTED", "当前模型余额不足，请确认选择的是硅基流动免费模型 THUDM/GLM-4-9B-0414");
    if (response.status === 413 || /token|context|too large/i.test(providerMessage)) throw new AiReportError("AI_TOKEN_LIMIT", "本次盘面资料超过免费模型限制，请减少分析方向后重试");
    throw new AiReportError("SILICONFLOW_REQUEST_FAILED", providerMessage || `硅基流动请求失败（${response.status}）`);
  }
  return parseJsonObject(extractGroqOutputText(payload));
}

async function requestOpenAiReport(args: {
  kind: ReportKind;
  question: string;
  topics: string[];
  catalog: EvidenceItem[];
  correction?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AiReportError("AI_NOT_CONFIGURED", "深度报告服务尚未配置，请联系管理员设置 OPENAI_API_KEY");
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-5.6";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "medium" },
      max_output_tokens: 14000,
      text: { verbosity: "high", format: { type: "json_schema", name: "guanchen_deep_report", strict: true, schema: reportSchema } },
      input: [
        { role: "system", content: systemInstructions(args.kind) },
        { role: "user", content: JSON.stringify({ reportKind: args.kind, question: args.question, selectedTopics: args.topics, evidenceCatalog: args.catalog, correction: args.correction || "" }) },
      ],
    }),
  });
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  if (!response.ok) {
    const providerMessage = payload?.error?.message || "";
    if (/current quota|billing quota|run out of credits|no balance/i.test(providerMessage)) {
      throw new AiReportError("AI_QUOTA_EXHAUSTED", "深度报告服务当前额度不足，请管理员检查 OpenAI API 计费余额或项目用量上限");
    }
    if (response.status === 401 || /invalid_api_key/i.test(providerMessage)) {
      throw new AiReportError("AI_AUTHENTICATION_FAILED", "深度报告服务认证失败，请管理员检查服务端 API 密钥");
    }
    if (response.status === 429) {
      throw new AiReportError("AI_RATE_LIMITED", "深度报告请求较多，请稍后重试");
    }
    throw new AiReportError("OPENAI_REQUEST_FAILED", providerMessage || `OpenAI 请求失败（${response.status}）`);
  }
  const parsed = parseReportJson(extractOpenAiOutputText(payload));
  return { parsed, model, provider: "openai" as const };
}

async function requestGroqReport(args: {
  kind: ReportKind;
  question: string;
  topics: string[];
  catalog: EvidenceItem[];
  correction?: string;
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AiReportError("AI_NOT_CONFIGURED", "免费 AI 报告服务尚未配置，请管理员设置 GROQ_API_KEY");
  const model = process.env.GROQ_REPORT_MODEL || "qwen/qwen3.6-27b";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.55,
      reasoning_effort: "none",
      max_completion_tokens: 6500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemInstructions(args.kind)}\n只返回一个合法 JSON 对象，不要输出 Markdown、代码围栏或额外说明。输出必须符合用户消息中的 outputSchema。`,
        },
        {
          role: "user",
          content: JSON.stringify({
            reportKind: args.kind,
            question: args.question,
            selectedTopics: args.topics,
            evidenceCatalog: args.catalog,
            correction: args.correction || "",
            outputSchema: reportSchema,
          }),
        },
      ],
    }),
  });
  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string } } | null;
  if (!response.ok) {
    const providerMessage = payload?.error?.message || "";
    if (response.status === 401) throw new AiReportError("AI_AUTHENTICATION_FAILED", "Groq 免费报告服务认证失败，请检查 GROQ_API_KEY");
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      throw new AiReportError("AI_RATE_LIMITED", retryAfter ? `Groq 免费额度触发限流，请在 ${retryAfter} 秒后重试` : "Groq 免费额度触发限流，请稍后重试");
    }
    if (response.status === 413 || /token|context|too large/i.test(providerMessage)) {
      throw new AiReportError("AI_TOKEN_LIMIT", "本次盘面资料超过 Groq 免费层限制，请减少分析方向后重试");
    }
    throw new AiReportError("GROQ_REQUEST_FAILED", providerMessage || `Groq 请求失败（${response.status}）`);
  }
  const parsed = parseReportJson(extractGroqOutputText(payload));
  return { parsed, model, provider: "groq" as const };
}

function parseJsonObject<T = unknown>(content: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        // Fall through to the user-facing structured error below.
      }
    }
    throw new AiReportError("INVALID_JSON", "AI 返回的报告格式无效，请重新生成");
  }
}

function parseReportJson(content: string): GeneratedReport {
  return parseJsonObject<GeneratedReport>(content);
}

export async function generateDeepReport(args: {
  kind: ReportKind;
  question?: string;
  topics: string[];
  chart: BaziChartResult | ZiweiChartResult | CompatibilityResult;
}): Promise<AiDeepReport> {
  const catalog = args.kind === "bazi"
    ? buildBaziEvidence(args.chart as BaziChartResult)
    : args.kind === "ziwei"
      ? buildZiweiEvidence(args.chart as ZiweiChartResult)
      : buildCompatibilityEvidence(args.chart as CompatibilityResult);
  const question = args.question?.trim() || `请围绕${args.topics.join("、") || "命盘总览"}进行完整分析。`;
  let result = await requestStructuredReport({ kind: args.kind, question, topics: args.topics, catalog });
  normalizeGeneratedReport(result.parsed, catalog, args.kind);
  result.parsed.chapters = REQUIRED_CHAPTERS[args.kind]
    .map((id) => result.parsed.chapters.find((chapter) => chapter.id === id))
    .filter((chapter): chapter is AiReportChapter => Boolean(chapter));
  let errors = validateReport(result.parsed, catalog, args.kind);
  if (errors.length) {
    result = await requestStructuredReport({ kind: args.kind, question, topics: args.topics, catalog, correction: `上一版未通过质量检查，请重写并修复：${errors.join("；")}` });
    normalizeGeneratedReport(result.parsed, catalog, args.kind);
    result.parsed.chapters = REQUIRED_CHAPTERS[args.kind]
      .map((id) => result.parsed.chapters.find((chapter) => chapter.id === id))
      .filter((chapter): chapter is AiReportChapter => Boolean(chapter));
    errors = validateReport(result.parsed, catalog, args.kind);
  }
  if (errors.length) throw new AiReportError("REPORT_VALIDATION_FAILED", `报告未通过证据与完整性检查：${errors.join("；")}`);
  return {
    ...result.parsed,
    status: "generated",
    reportId: crypto.randomUUID(),
    provider: result.provider,
    model: result.model,
    promptVersion: PROMPT_VERSION,
    evidenceCatalog: catalog,
    quality: { warnings: [] },
  };
}
