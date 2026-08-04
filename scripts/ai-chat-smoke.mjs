const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("chat-smoke", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;

const response = await worker.fetch(
  new Request("http://localhost/api/charts/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "bazi",
      question: "未来一年事业上最值得提前准备什么？请结合盘面依据给出具体建议。",
      report: {
        title: "虚构样本命盘问答测试",
        directAnswer: "这是一份仅用于接口验证的虚构命盘摘要。",
        coreConclusions: [{ title: "结构主轴", conclusion: "先稳定能力输出，再观察资源承接。", evidenceRefs: ["B001", "B050"] }],
        evidenceCatalog: [
          { id: "B001", text: "虚构测试四柱：甲子、丙寅、戊辰、庚申；日主戊土。" },
          { id: "B003", text: "虚构测试藏干加权五行：木24%、火18%、土28%、金17%、水13%。" },
          { id: "B050", text: "虚构测试当前大运2024—2033癸酉：观察资源、责任与表达如何形成闭环。" },
          { id: "B070", text: "虚构测试2026年丙午：主题为提升专业输出与行动节奏；建议用可交付成果验证方向。" },
        ],
      },
      history: [],
    }),
  }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
console.log(JSON.stringify({
  status: result.status,
  creditCost: result.creditCost,
  answerLength: result.answer.length,
  evidenceRefs: result.evidenceRefs,
  actionCount: result.actions.length,
}));
