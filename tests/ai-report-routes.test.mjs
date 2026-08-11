import assert from "node:assert/strict";
import test from "node:test";

const paragraph = "命盘提供的是一种观察结构：先核对盘面中的动力如何相互支持，再把它放回当事人的经历、资源和现实选择中理解。优势与压力往往来自同一倾向，建设性表达需要清晰边界、持续练习和可复盘的行动；任何阶段提示都不能代替真实反馈与专业判断。";

function mockReport(kind) {
  const refs = kind === "bazi" ? ["B001", "B003"] : kind === "ziwei" ? ["Z001", "Z003"] : ["C001", "C003"];
  const timingRef = kind === "bazi" ? "B050" : kind === "ziwei" ? "Z030" : "C050";
  const chapters = kind === "compatibility"
    ? [["overview", "关系总览"], ["communication", "沟通模式"], ["intimacy", "亲密需求"], ["conflict", "冲突修复"], ["cooperation", "现实协作"], ["growth", "共同成长"]]
    : [["overview", "命盘总览"], ["career_wealth", "事业及财运"], ["relationships", "感情及婚姻"], ["health", "健康"], ["children", "子女"], ["family", "父母及兄弟"], ["timing", "流年运势及关键节点"]];
  return {
    title: kind === "compatibility" ? "看见彼此的互动方式，也保留共同选择" : "在趋势中辨认课题，在选择中塑造人生",
    directAnswer: kind === "compatibility" ? `第一方与第二方需要把盘面倾向放回真实互动中验证。${paragraph}` : paragraph,
    coreConclusions: [
      { title: "结构主轴", conclusion: paragraph, evidenceRefs: refs },
      { title: "现实表达", conclusion: paragraph, evidenceRefs: refs },
      { title: "行动准备", conclusion: paragraph, evidenceRefs: refs },
    ],
    chapters: chapters.map(([id, title]) => ({
      id, title, headline: `${title}：从盘面趋势回到现实选择`,
      narrative: kind === "compatibility" ? [paragraph.slice(0, 90), paragraph.slice(0, 90)] : [paragraph, paragraph, paragraph, paragraph],
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

async function getWorkerWithDeepSeekMock(options = {}) {
  process.env.AI_REPORT_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "mock-key";
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /api\.deepseek\.com\/chat\/completions/);
    const request = JSON.parse(String(init?.body || "{}"));
    const context = JSON.parse(request.messages[1].content);
    options.calls = (options.calls || 0) + 1;
    if (context.chapterId === "timing" && options.malformedTimingOnce && !options.malformedTimingReturned) {
      options.malformedTimingReturned = true;
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"id":"timing","title":"流年运势及关键节点"' } }] });
    }
    if (context.task === "chart_question") {
      const shortAnswer = String(context.question).includes("短回答恢复测试");
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
        answer: shortAnswer ? paragraph.repeat(2).slice(0, 230) : `${paragraph.repeat(5)}具体到现实行动，可以先记录触发情境、自己的第一反应和实际结果，再对照盘面证据做复盘。`.slice(0, 520),
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
    if (context.chapterId === "health" && context.reportKind !== "compatibility") {
      output = { ...output, narrative: ["注意作息。"] };
    }
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] });
  };
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("ai-routes", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

async function call(worker, path, body, credits = 1000) {
  return worker.fetch(
    new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", cookie: `guanchen_credits=${credits}` }, body: JSON.stringify(body) }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("Bazi, Ziwei and compatibility routes all generate evidence-grounded DeepSeek reports", async () => {
  const worker = await getWorkerWithDeepSeekMock();
  let baziReport;
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
    assert.equal(result.aiReport.chapters.length, 6);
    assert.equal(result.creditCost, path.includes("compatibility") ? 10 : 5);
    assert.equal(result.creditBalance, path.includes("compatibility") ? 990 : 995);
    assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.length === 4), true);
    assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.every((paragraph) => /[。！？]$/.test(paragraph))), true);
    if (!path.includes("compatibility")) {
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing.length === 0), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.join("").length <= 400), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.length === 4), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.every((paragraph) => paragraph.length >= 65 && paragraph.length <= 95)), true);
      assert.equal(result.aiReport.chapters.some((chapter) => chapter.id === "timing"), false);
      if (path.includes("/bazi")) baziReport = result.aiReport;
    }
    const valid = new Set(result.aiReport.evidenceCatalog.map((item) => item.id));
    const cited = result.aiReport.chapters.flatMap((chapter) => [...chapter.evidenceRefs, ...chapter.timing.flatMap((item) => item.evidenceRefs)]);
    assert.equal(cited.every((id) => valid.has(id)), true);
    if (path.includes("compatibility")) {
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.narrative.join("").length >= 400), true);
      assert.equal(result.aiReport.chapters.every((chapter) => /[。！？]$/.test(chapter.narrative.at(-1))), true, JSON.stringify(result.aiReport.chapters.map((chapter) => chapter.narrative.at(-1))));
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing.length === 4), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing[0].period === "双方当前大限"), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing.slice(1).every((item) => /20\d{2} 流年/.test(item.period))), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.timing.flatMap((item) => item.evidenceRefs).join(",") === "C050,C051,C052,C053"), true);
      assert.equal(result.aiReport.chapters.every((chapter) => chapter.constructiveExpression.length >= 70 && chapter.pressureExpression.length >= 70), true);
      assert.equal(["C050", "C051", "C052", "C053"].every((id) => result.aiReport.evidenceCatalog.some((item) => item.id === id)), true);
      assert.match(result.aiReport.directAnswer, /子安与清和/);
      assert.doesNotMatch(result.aiReport.directAnswer, /第一方|第二方/);
    }
  }

  const timingResponse = await call(worker, "/api/charts/timing", { kind: "bazi", evidenceCatalog: baziReport.evidenceCatalog }, 100);
  assert.equal(timingResponse.status, 200);
  const timing = await timingResponse.json();
  assert.equal(timing.creditCost, 3);
  assert.equal(timing.remainingCredits, 97);
  assert.equal(timing.chapter.id, "timing");
  assert.equal(timing.chapter.title, "流年运势及关键节点");
  assert.equal(timing.chapter.timing.length, 4);
  assert.ok(timing.chapter.narrative.join("").length <= 600);
  assert.equal(timing.chapter.narrative.every((paragraph) => paragraph.length >= 100 && paragraph.length <= 145), true);
  assert.equal(timing.chapter.narrative.every((paragraph) => /[。！？]$/.test(paragraph)), true);
});

test("new test registrations receive five credits without resetting an existing balance", async () => {
  const worker = await getWorkerWithDeepSeekMock();
  const registration = await worker.fetch(
    new Request("http://localhost/api/credits/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "new@example.com", password: "123456" }) }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(registration.status, 200);
  assert.deepEqual(await registration.json(), { status: "success", credits: 5, isNew: true });
  assert.match(registration.headers.get("set-cookie") || "", /guanchen_credits=5/);
});

test("Guanchen analysis answers 400-600 characters and charges two credits only on success", async () => {
  const worker = await getWorkerWithDeepSeekMock();
  const report = mockReport("bazi");
  report.evidenceCatalog = [{ id: "B001", text: "四柱测试依据" }, { id: "B003", text: "五行结构测试依据" }];
  const response = await call(worker, "/api/charts/chat", {
    kind: "bazi",
    question: "未来一年事业上应该优先准备什么？",
    report,
    history: [],
  }, 5);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.creditCost, 2);
  assert.equal(result.remainingCredits, 3);
  assert.ok(result.answer.length >= 400 && result.answer.length <= 600);
  assert.deepEqual(result.evidenceRefs, ["B001", "B003"]);
  assert.match(response.headers.get("set-cookie") || "", /guanchen_credits=3/);

  const insufficient = await worker.fetch(
    new Request("http://localhost/api/charts/chat", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "guanchen_credits=1" },
      body: JSON.stringify({ kind: "bazi", question: "继续追问", report, history: [] }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(insufficient.status, 402);
});

test("short but evidence-grounded model output is completed instead of discarded", async () => {
  const worker = await getWorkerWithDeepSeekMock();
  const report = mockReport("bazi");
  report.evidenceCatalog = [
    { id: "B001", text: "四柱测试依据显示日主与月令形成明确的力量关系，需要结合现实承担方式观察。" },
    { id: "B003", text: "五行结构测试依据显示资源、表达与行动之间存在需要协调的环节。" },
  ];
  const response = await call(worker, "/api/charts/chat", { kind: "bazi", question: "短回答恢复测试", report, history: [] }, 5);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.answer.length >= 400 && result.answer.length <= 600);
  assert.equal(result.remainingCredits, 3);
});

test("timing report retries one malformed AI response, succeeds, and charges only after success", async () => {
  const options = { malformedTimingOnce: true, calls: 0 };
  const worker = await getWorkerWithDeepSeekMock(options);
  const report = mockReport("bazi");
  report.evidenceCatalog = [
    { id: "B001", text: "四柱结构测试依据" },
    { id: "B003", text: "五行结构测试依据" },
    { id: "B050", text: "大运2024—2033 癸酉：当前阶段主题" },
    { id: "B070", text: "2026年丙午：当年流年主题" },
    { id: "B071", text: "2027年丁未：下一年流年主题" },
    { id: "B072", text: "2028年戊申：随后流年主题" },
  ];
  const response = await call(worker, "/api/charts/timing", { kind: "bazi", evidenceCatalog: report.evidenceCatalog }, 20);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.chapter.id, "timing");
  assert.equal(result.remainingCredits, 17);
  assert.equal(options.calls, 2, "one malformed response should trigger exactly one retry without a redundant summary request");
});
