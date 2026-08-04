import assert from "node:assert/strict";
import test from "node:test";

const paragraph = "命盘提供的是一种观察结构：先核对盘面中的动力如何相互支持，再把它放回当事人的经历、资源和现实选择中理解。优势与压力往往来自同一倾向，建设性表达需要清晰边界、持续练习和可复盘的行动；任何阶段提示都不能代替真实反馈与专业判断。";

function mockReport(kind) {
  const refs = kind === "bazi" ? ["B001", "B003"] : kind === "ziwei" ? ["Z001", "Z003"] : ["C001", "C003"];
  const timingRef = kind === "bazi" ? "B050" : kind === "ziwei" ? "Z030" : "C050";
  const chapters = kind === "compatibility"
    ? [["overview", "关系总览"], ["communication", "沟通模式"], ["intimacy", "亲密需求"], ["conflict", "冲突修复"], ["cooperation", "现实协作"], ["growth", "共同成长"]]
    : [["overview", "命盘总览"], ["career_wealth", "事业及财运"], ["relationships", "感情及婚姻"], ["health", "健康"], ["children", "子女"], ["family", "父母及兄弟"], ["timing", "运势节奏及关键节点"]];
  return {
    title: kind === "compatibility" ? "看见彼此的互动方式，也保留共同选择" : "在趋势中辨认课题，在选择中塑造人生",
    directAnswer: kind === "compatibility" ? `第一方与第二方需要把盘面倾向放回真实互动中验证。${paragraph}` : paragraph,
    coreConclusions: [
      { title: "结构主轴", conclusion: paragraph, evidenceRefs: refs },
      { title: "现实表达", conclusion: paragraph, evidenceRefs: refs },
      { title: "阶段准备", conclusion: paragraph, evidenceRefs: [timingRef] },
    ],
    chapters: chapters.map(([id, title]) => ({
      id, title, headline: `${title}：从盘面趋势回到现实选择`,
      narrative: [paragraph, paragraph, paragraph, paragraph],
      evidenceRefs: refs,
      evidenceExplanation: ["第一条证据说明本章的结构起点。", "第二条证据用于交叉校正，避免单点判断。"],
      constructiveExpression: "当资源、边界与行动节奏一致时，这组倾向更容易表现为稳定、清晰和可持续的能力。",
      pressureExpression: "当压力累积时，同一倾向可能变成急迫、摇摆或过度承担，需要通过复盘与沟通修正。",
      timing: [{ period: "未来阶段", theme: "把变化窗口转化为准备期", evidenceRefs: [timingRef], opportunity: "用小规模行动积累反馈。", caution: "不把阶段提示解释为确定事件。" }],
      reflectionQuestions: ["最近有哪些事实支持或修正这一判断？", "下一步可以验证的最小行动是什么？"],
      actions: [{ horizon: "未来30天", title: "建立事实记录", detail: "记录行动、反馈与调整。" }, { horizon: "未来三个月", title: "完成一次复盘", detail: "根据现实结果更新选择。" }],
    })),
    finalSynthesis: ["把盘面当作问题地图。", "用现实反馈校正判断。", "最终决定权始终在自己手中。"],
    boundaries: ["传统文化娱乐与自我反思参考。", "不替代医疗、投资或法律意见。", "不以单一结构决定人生或关系。"],
  };
}

async function getWorkerWithDeepSeekMock() {
  process.env.AI_REPORT_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "mock-key";
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /api\.deepseek\.com\/chat\/completions/);
    const request = JSON.parse(String(init?.body || "{}"));
    const context = JSON.parse(request.messages[1].content);
    if (context.task === "chart_question") {
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
        answer: `${paragraph}${paragraph}具体到现实行动，可以先记录触发情境、自己的第一反应和实际结果，再对照盘面证据做复盘。`,
        evidenceRefs: [context.evidenceCatalog[0].id, context.evidenceCatalog[1].id],
        actions: ["记录三次真实事件与反馈", "一个月后复盘选择是否更清晰"],
        boundary: "命盘提示趋势，不替代现实判断。",
      }) } }] });
    }
    const full = mockReport(context.reportKind);
    let output = context.chapterId
      ? full.chapters.find((chapter) => chapter.id === context.chapterId)
      : { title: full.title, directAnswer: full.directAnswer, coreConclusions: full.coreConclusions, finalSynthesis: full.finalSynthesis, boundaries: full.boundaries };
    if (context.chapterId === "relationships" || context.chapterId === "family") {
      output = {
        ...output,
        narrative: [
          `${output.narrative[0]}这不是命中注定，而是需要结合现实经历持续验证的观察角度。`,
          output.narrative[1],
          output.narrative.slice(2).join(""),
        ],
      };
    }
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] });
  };
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("ai-routes", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

async function call(worker, path, body) {
  return worker.fetch(
    new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("Bazi, Ziwei and compatibility routes all generate evidence-grounded DeepSeek reports", async () => {
  const worker = await getWorkerWithDeepSeekMock();
  const cases = [
    ["/api/charts/bazi", { trueSolarTime: "2000-01-01T12:00:00", gender: "male", topics: ["综合看看"], notes: "虚构测试样本", deepReport: true }],
    ["/api/charts/ziwei", { trueSolarTime: "2000-01-01T12:00:00", gender: "male", topics: ["命盘总览"], notes: "虚构测试样本", deepReport: true }],
    ["/api/charts/compatibility", { mode: "bazi", first: { name: "子安", trueSolarTime: "2000-01-01T12:00:00", gender: "male" }, second: { name: "清和", trueSolarTime: "2001-02-02T13:00:00", gender: "female" }, topics: ["关系总览"], notes: "虚构双盘测试样本", deepReport: true }],
  ];
  for (const [path, body] of cases) {
    const response = await call(worker, path, body);
    assert.equal(response.status, 200, `${path} should generate a report`);
    const result = await response.json();
    assert.equal(result.aiReport.provider, "deepseek");
    assert.equal(result.aiReport.model, "deepseek-v4-flash");
    assert.equal(result.aiReport.chapters.length, path.includes("compatibility") ? 6 : 7);
    assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.length === 4), true);
    if (!path.includes("compatibility")) {
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing.length === 4), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing.slice(1).every((item) => /流年/.test(item.period))), true);
    }
    const valid = new Set(result.aiReport.evidenceCatalog.map((item) => item.id));
    const cited = result.aiReport.chapters.flatMap((chapter) => [...chapter.evidenceRefs, ...chapter.timing.flatMap((item) => item.evidenceRefs)]);
    assert.equal(cited.every((id) => valid.has(id)), true);
    if (path.includes("compatibility")) {
      assert.match(result.aiReport.directAnswer, /子安与清和/);
      assert.doesNotMatch(result.aiReport.directAnswer, /第一方|第二方/);
    }
  }
});

test("chart report dialogue answers from fixed evidence and charges three credits only on success", async () => {
  const worker = await getWorkerWithDeepSeekMock();
  const report = mockReport("bazi");
  report.evidenceCatalog = [{ id: "B001", text: "四柱测试依据" }, { id: "B003", text: "五行结构测试依据" }];
  const response = await call(worker, "/api/charts/chat", {
    kind: "bazi",
    question: "未来一年事业上应该优先准备什么？",
    report,
    history: [],
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.creditCost, 3);
  assert.equal(result.remainingCredits, 2);
  assert.ok(result.answer.length >= 180);
  assert.deepEqual(result.evidenceRefs, ["B001", "B003"]);
  assert.match(response.headers.get("set-cookie") || "", /guanchen_test_credits=2/);

  const insufficient = await worker.fetch(
    new Request("http://localhost/api/charts/chat", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "guanchen_test_credits=2" },
      body: JSON.stringify({ kind: "bazi", question: "继续追问", report, history: [] }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(insufficient.status, 402);
});
