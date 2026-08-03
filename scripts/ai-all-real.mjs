const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("ai-all-real", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;

const cases = [
  {
    name: "bazi",
    path: "/api/charts/bazi",
    body: {
      trueSolarTime: "2000-01-01T12:00:00",
      gender: "male",
      topics: ["综合看看", "看工作", "看感情"],
      notes: "虚构测试样本：请分析发展课题与未来阶段准备。",
      deepReport: true,
    },
  },
  {
    name: "compatibility",
    path: "/api/charts/compatibility",
    body: {
      mode: "bazi",
      first: { trueSolarTime: "2000-01-01T12:00:00", gender: "male" },
      second: { trueSolarTime: "2001-02-02T13:00:00", gender: "female" },
      topics: ["关系总览", "沟通模式", "共同成长"],
      notes: "虚构双盘测试样本：分析互动方式，不做确定性关系结论。",
      deepReport: true,
    },
  },
];

const selectedCases = process.env.AI_REAL_CASE
  ? cases.filter((item) => item.name === process.env.AI_REAL_CASE)
  : cases;

for (const item of selectedCases) {
  const response = await worker.fetch(
    new Request(`http://localhost${item.path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item.body),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(`${item.name}: ${JSON.stringify(result)}`);
  const validEvidence = new Set(result.aiReport.evidenceCatalog.map((evidence) => evidence.id));
  const citations = result.aiReport.chapters.flatMap((chapter) => [
    ...chapter.evidenceRefs,
    ...chapter.timing.flatMap((entry) => entry.evidenceRefs),
  ]);
  console.log(JSON.stringify({
    name: item.name,
    status: result.aiReport.status,
    provider: result.aiReport.provider,
    model: result.aiReport.model,
    chapterIds: result.aiReport.chapters.map((chapter) => chapter.id),
    directAnswerLength: result.aiReport.directAnswer.length,
    chapterLengths: result.aiReport.chapters.map((chapter) => chapter.narrative.join("").length),
    invalidEvidence: [...new Set(citations.filter((id) => !validEvidence.has(id)))],
  }));
}
