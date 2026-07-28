import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

async function render(path = "/") {
  const worker = await getWorker();
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the finished Guanchen product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /观辰/);
  assert.match(html, /八字命盘/);
  assert.match(html, /紫微斗数/);
  assert.match(html, /合盘分析/);
  assert.match(html, /命盘问答/);
  assert.match(html, /真太阳时/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("each navigation item has its own renderable URL", async () => {
  const routes = [
    ["/bazi", /<h1>八字测算<\/h1>/],
    ["/ziwei", /<h1>紫微斗数测算<\/h1>/],
    ["/match", /<h1>合盘测算<\/h1>/],
    ["/chat", /<h1>命盘问答<\/h1>/],
    ["/knowledge", /命理课堂/],
    ["/login", /登录观辰/],
  ];

  for (const [path, expected] of routes) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} should render`);
    assert.match(await response.text(), expected);
  }
});

test("Bazi and Ziwei forms expose the requested start button", async () => {
  for (const path of ["/bazi", "/ziwei"]) {
    const response = await render(path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<button class="measure-submit">开始测算/);
  }
});

test("contains commercial data model and safety copy", async () => {
  const [schema, page] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/mingli-app.tsx", import.meta.url), "utf8"),
  ]);
  for (const entity of ["birthProfiles", "charts", "reports", "creditLedger", "orders", "paymentEvents"]) {
    assert.match(schema, new RegExp(`export const ${entity}`));
  }
  assert.match(page, /传统文化娱乐与自我反思参考/);
  assert.match(page, /支付沙箱/);
});

test("true solar time endpoint applies historical timezone, longitude and equation-of-time correction", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/solar-time", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        localDateTime: "1992-08-18T08:30",
        longitude: 102.7183,
        timezone: "Asia/Shanghai",
      }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.timezoneOffsetMinutes, 480);
  assert.equal(result.standardMeridian, 120);
  assert.equal(result.longitudeCorrectionMinutes, -69.13);
  assert.match(result.trueSolarTime, /^1992-08-18T07:/);
  assert.match(result.method, /IANA历史时区/);
});

test("lunar input converts leap month before true-solar-time correction", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/solar-time", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        localDateTime: "2020-04-01T12:00",
        longitude: 116.4074,
        timezone: "Asia/Shanghai",
        calendar: "lunar",
        isLeapMonth: true,
      }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.normalizedSolarDateTime, "2020-05-23T12:00:00");
  assert.match(result.trueSolarTime, /^2020-05-23T11:/);
});

test("Cantian Bazi MCP golden sample returns the documented four pillars", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/charts/bazi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trueSolarTime: "1998-07-31T14:10:00",
        gender: "male",
        topics: ["综合看看", "事业方向"],
      }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.engine.provider, "cantian-ai/bazi-mcp");
  assert.equal(result.engine.tool, "getBaziDetail");
  assert.equal(result.chart.bazi, "戊寅 己未 己卯 辛未");
  assert.deepEqual(result.chart.pillars.map((item) => `${item.stem}${item.branch}`), ["戊寅", "己未", "己卯", "辛未"]);
  assert.ok(result.report.topics.length >= 5);
  assert.ok(result.report.topics.every((topic) => topic.evidence && topic.action));
});

test("Ziwei MCP contract adapter returns twelve palaces and stable golden fields", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/charts/ziwei", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trueSolarTime: "1990-01-01T08:30:00",
        gender: "male",
        topics: ["命盘总览", "事业迁移"],
      }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.engine.provider, "SiwuXue/ziwei-mcp");
  assert.equal(result.engine.contract, "generate_chart + interpret_chart");
  assert.equal(result.engine.adapter, "iztro");
  assert.equal(result.chart.palaces.length, 12);
  assert.equal(result.chart.soulPalaceBranch, "酉");
  assert.equal(result.chart.bodyPalaceBranch, "巳");
  assert.equal(result.chart.fiveElementsClass, "金四局");
  assert.ok(result.report.topics.length >= 5);
  assert.equal(result.chart.yearlyFlow.length, 10);
  assert.ok(result.chart.palaces.every((palace) => Array.isArray(palace.adjectiveStars) && Array.isArray(palace.ages)));
  assert.ok(result.chart.currentFortune.yearly.ganzhi);
});

test("screenshot-like Ziwei golden sample retains full traditional chart facts", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/charts/ziwei", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trueSolarTime: "1995-01-05T19:50:00",
        gender: "female",
        topics: ["命盘总览"],
      }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.chart.soul, "文曲");
  assert.equal(result.chart.body, "文昌");
  assert.equal(result.chart.fiveElementsClass, "火六局");
  assert.equal(result.chart.palaces.length, 12);
  assert.ok(result.chart.natalMutagens.length >= 4);
});

test("compatibility defaults to Bazi and also supports Ziwei without a fake score", async () => {
  const worker = await getWorker();
  for (const mode of ["bazi", "ziwei"]) {
    const response = await worker.fetch(
      new Request("http://localhost/api/charts/compatibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          first: { trueSolarTime: "1990-01-01T08:30:00", gender: "male" },
          second: { trueSolarTime: "1995-01-05T19:50:00", gender: "female" },
          topics: ["关系总览"],
        }),
      }),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, mode);
    assert.equal(result.profiles.length, 2);
    assert.equal("score" in result, false);
    assert.ok(result.report.topics.length >= 4);
  }
});

test("chart provider configuration records both requested upstream projects", async () => {
  const [providers, packageFile] = await Promise.all([
    readFile(new URL("../config/chart-providers.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(providers, /cantian-ai\/bazi-mcp/);
  assert.match(providers, /SiwuXue\/ziwei-mcp/);
  assert.match(providers, /generate_chart/);
  assert.match(providers, /interpret_chart/);
  assert.equal(JSON.parse(packageFile).dependencies["bazi-mcp"], "0.1.0");
});
