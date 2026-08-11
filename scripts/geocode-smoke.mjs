const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("geocode-smoke", `${Date.now()}`);
const worker = (await import(workerUrl.href)).default;

for (const query of ["中国 云南省 曲靖市 麒麟区", "中国 广东省 佛山市 顺德区", "France Île-de-France Paris"]) {
  const response = await worker.fetch(
    new Request(`http://localhost/api/geocode?q=${encodeURIComponent(query)}`),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const payload = await response.json();
  const first = payload.results?.[0];
  if (!response.ok || !first) throw new Error(`${query}: ${JSON.stringify(payload)}`);
  console.log(JSON.stringify({ query, name: first.name, country: first.country, admin1: first.admin1, admin2: first.admin2, admin3: first.admin3, latitude: first.latitude, longitude: first.longitude, timezone: first.timezone }));
}
