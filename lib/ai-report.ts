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
  provider: "groq" | "openai";
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

const PROMPT_VERSION = "deep-report-2026-08-03-v2";
const REQUIRED_CHAPTERS: Record<ReportKind, string[]> = {
  bazi: ["overview", "personality", "career", "wealth", "relationships", "timing"],
  ziwei: ["overview", "personality", "career", "wealth", "relationships", "timing"],
  compatibility: ["overview", "communication", "intimacy", "conflict", "cooperation", "growth"],
};
const BANNED_CERTAINTY = /一定结婚|必然结婚|一定离婚|必然离婚|命中注定|保证收益|稳赚|准确率\s*\d|寿命为|活到\d+岁|必有血光|必得重病/;

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
          narrative: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
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
    ? "必须完整包含 id 为 overview、communication、intimacy、conflict、cooperation、growth 的六章。"
    : "必须完整包含 id 为 overview、personality、career、wealth、relationships、timing 的六章；可按用户重点增加 family、health 或 growth。";
  return `你是观辰的资深传统命理报告编辑。${method}
你的工作是解释服务端已经计算好的命盘，不是重新排盘。只能使用证据目录里的事实；严禁自行补算、改写或发明星曜、宫位、干支、十神、四化、运限。
写成专业咨询式的简体中文长报告：先直接回应用户最关心的问题，再解释盘面结构、正向表达、压力表达、阶段变化与现实行动。每项核心结论和时间判断必须引用 evidenceRefs；引用只能是目录中存在的编号。
${chapterRule}每章 narrative 至少三段，每段应有实质内容，避免重复套话。时间判断只能使用目录明确提供的大运或流年；合盘不得把双方阶段不同步写成分手或结婚预言。
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
  const response = payload as { choices?: Array<{ message?: { content?: string } }> };
  const content = response.choices?.[0]?.message?.content;
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
    if (chapter.narrative.join("").length < 260) errors.push(`${chapter.id}章节内容过短`);
  });
  if (BANNED_CERTAINTY.test(JSON.stringify(report))) errors.push("出现禁止的确定性断言");
  return errors;
}

async function requestStructuredReport(args: {
  kind: ReportKind;
  question: string;
  topics: string[];
  catalog: EvidenceItem[];
  correction?: string;
}) {
  const provider = (process.env.AI_REPORT_PROVIDER || "groq").toLowerCase();
  if (provider === "openai") return requestOpenAiReport(args);
  if (provider === "groq") return requestGroqReport(args);
  throw new AiReportError("AI_PROVIDER_INVALID", `不支持的 AI 报告服务：${provider}`);
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

function parseReportJson(content: string): GeneratedReport {
  try {
    return JSON.parse(content) as GeneratedReport;
  } catch {
    throw new AiReportError("INVALID_JSON", "AI 返回的报告格式无效，请重新生成");
  }
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
  let errors = validateReport(result.parsed, catalog, args.kind);
  if (errors.length) {
    result = await requestStructuredReport({ kind: args.kind, question, topics: args.topics, catalog, correction: `上一版未通过质量检查，请重写并修复：${errors.join("；")}` });
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
