const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("timing-smoke", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;
const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };

const baseResponse = await worker.fetch(new Request("http://localhost/api/charts/bazi", {
  method: "POST",
  headers: { "content-type": "application/json", cookie: "guanchen_credits=100" },
  body: JSON.stringify({ trueSolarTime: "2000-01-01T12:00:00", gender: "male", topics: ["命盘总览"], notes: "虚构样本，仅用于验证报告分层。", deepReport: true }),
}), env, ctx);
const base = await baseResponse.json();
if (!baseResponse.ok) throw new Error(JSON.stringify(base));

const timingResponse = await worker.fetch(new Request("http://localhost/api/charts/timing", {
  method: "POST",
  headers: { "content-type": "application/json", cookie: "guanchen_credits=95" },
  body: JSON.stringify({ kind: "bazi", evidenceCatalog: base.aiReport.evidenceCatalog }),
}), env, ctx);
const timing = await timingResponse.json();
if (!timingResponse.ok) throw new Error(JSON.stringify(timing));

console.log(JSON.stringify({
  baseCost: base.creditCost,
  baseChapterIds: base.aiReport.chapters.map((chapter) => chapter.id),
  baseLengths: base.aiReport.chapters.map((chapter) => chapter.narrative.join("").length),
  baseTimelineCounts: base.aiReport.chapters.map((chapter) => chapter.timing.length),
  timingCost: timing.creditCost,
  timingTitle: timing.chapter.title,
  timingLength: timing.chapter.narrative.join("").length,
  timingCount: timing.chapter.timing.length,
  remainingCredits: timing.remainingCredits,
}));
