if (process.env.AI_SMOKE_MOCK === "1") {
  process.env.OPENAI_API_KEY = "mock-key-used-only-for-local-structure-test";
  const paragraph = "命盘提供的是一种观察结构：先核对盘面中的动力如何相互支持，再把它放回当事人的经历、资源和现实选择中理解。优势与压力往往来自同一倾向，建设性表达需要清晰边界、持续练习和可复盘的行动；任何阶段提示都不能代替真实反馈与专业判断。";
  const chapter = (id, title, refs) => ({
    id, title, headline: `${title}：从盘面趋势回到现实选择`,
    narrative: [paragraph, paragraph, paragraph],
    evidenceRefs: refs,
    evidenceExplanation: ["第一条证据说明本章的结构起点。", "第二条证据用于交叉校正，避免单点判断。"],
    constructiveExpression: "当资源、边界与行动节奏彼此一致时，这组倾向更容易表现为稳定、清晰和可持续的能力。",
    pressureExpression: "当压力累积或现实条件不足时，同一倾向可能变成急迫、摇摆或过度承担，需要通过复盘与沟通修正。",
    timing: [{ period: "未来三年", theme: "把变化窗口转化为准备期", evidenceRefs: ["Z030"], opportunity: "用小规模尝试积累反馈。", caution: "不把阶段提示解释为确定事件。" }],
    reflectionQuestions: ["最近三个月有哪些事实支持或修正这一判断？", "下一步可以验证的最小行动是什么？"],
    actions: [{ horizon: "未来30天", title: "建立事实记录", detail: "记录行动、反馈与调整。" }, { horizon: "未来三个月", title: "完成一次复盘", detail: "根据现实结果更新选择。" }],
  });
  const mockReport = {
    title: "在趋势中辨认课题，在选择中塑造人生",
    directAnswer: paragraph,
    coreConclusions: [
      { title: "人生主轴", conclusion: paragraph, evidenceRefs: ["Z001", "Z002"] },
      { title: "现实发展", conclusion: paragraph, evidenceRefs: ["Z013", "Z020"] },
      { title: "阶段准备", conclusion: paragraph, evidenceRefs: ["Z004", "Z030"] },
    ],
    chapters: [
      chapter("overview", "命格总览", ["Z001", "Z002"]),
      chapter("personality", "性格特质", ["Z001", "Z013"]),
      chapter("career", "事业发展", ["Z015", "Z004"]),
      chapter("wealth", "财富与资源", ["Z020", "Z003"]),
      chapter("relationships", "感情关系", ["Z018", "Z002"]),
      chapter("timing", "阶段节奏", ["Z004", "Z030"]),
    ],
    finalSynthesis: ["把盘面当作问题地图。", "用现实反馈校正判断。", "最终决定权始终在自己手中。"],
    boundaries: ["传统文化娱乐与自我反思参考。", "不替代医疗、投资或法律意见。", "不以单一星曜或流年决定人生。"],
  };
  globalThis.fetch = async (input) => {
    if (String(input).includes("api.openai.com/v1/responses")) return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(mockReport) }] }] });
    throw new Error(`Unexpected fetch in mock smoke test: ${String(input)}`);
  };
}

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("smoke", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;

const response = await worker.fetch(
  new Request("http://localhost/api/charts/ziwei", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      trueSolarTime: "2000-01-01T12:00:00",
      gender: "male",
      topics: ["命盘总览", "事业迁移", "关系情感"],
      notes: "这是自动化虚构样本：请分析未来三年的事业准备、资源安排与关系课题。",
      deepReport: true,
    }),
  }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
const validEvidence = new Set(result.aiReport.evidenceCatalog.map((item) => item.id));
const cited = [
  ...result.aiReport.coreConclusions.flatMap((item) => item.evidenceRefs),
  ...result.aiReport.chapters.flatMap((chapter) => [
    ...chapter.evidenceRefs,
    ...chapter.timing.flatMap((item) => item.evidenceRefs),
  ]),
];
const invalidEvidence = [...new Set(cited.filter((id) => !validEvidence.has(id)))];
console.log(JSON.stringify({
  status: result.aiReport.status,
  model: result.aiReport.model,
  chapterIds: result.aiReport.chapters.map((chapter) => chapter.id),
  directAnswerLength: result.aiReport.directAnswer.length,
  chapterLengths: result.aiReport.chapters.map((chapter) => chapter.narrative.join("").length),
  evidenceCount: result.aiReport.evidenceCatalog.length,
  invalidEvidence,
}));
