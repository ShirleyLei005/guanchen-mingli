const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("geocode-smoke", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;

for (const query of ["昆明", "中国 云南省 曲靖市 麒麟区", "中国 广东省 佛山市 顺德区", "France Île-de-France Paris"]) {
  const response = await worker.fetch(
    new Request(`http://localhost/api/geocode?q=${encodeURIComponent(query)}`),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const payload = await response.json();
  const first = payload.results?.[0];
  if (!response.ok || !first) throw new Error(`${query}: ${JSON.stringify(payload)}`);
  const semanticKeys = payload.results.map((item) => `${String(item.admin1 || item.country).replace(/[省市区\s]/g, "")}:${String(item.name).replace(/[省市区\s]/g, "")}`);
  if (new Set(semanticKeys).size !== semanticKeys.length) throw new Error(`${query}: duplicate semantic places ${JSON.stringify(payload.results)}`);
  if (query === "昆明" && payload.results.some((item) => ![item.name, item.admin1, item.admin2, item.admin3, item.admin4].filter(Boolean).join("").includes("昆明"))) throw new Error(`昆明: unrelated result ${JSON.stringify(payload.results)}`);
  console.log(JSON.stringify({ query, resultCount: payload.results.length, name: first.name, country: first.country, admin1: first.admin1, admin2: first.admin2, admin3: first.admin3, latitude: first.latitude, longitude: first.longitude, timezone: first.timezone }));
}
