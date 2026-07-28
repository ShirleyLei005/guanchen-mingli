import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

async function render() {
  const worker = await getWorker();
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
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
