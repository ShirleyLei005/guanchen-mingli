import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerUrl = pathToFileURL(resolve(root, "dist/server/index.js"));
workerUrl.searchParams.set("preview", Date.now().toString());
const { default: worker } = await import(workerUrl.href);

const response = await worker.fetch(
  new Request("http://127.0.0.1:4173/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

let html = await response.text();
html = html.replaceAll('href="/', 'href="./').replaceAll('src="/', 'src="./');

const target = resolve(root, "preview/index.html");
await mkdir(dirname(target), { recursive: true });
await cp(resolve(root, "dist/client"), resolve(root, "preview"), { recursive: true });
await writeFile(target, html);

const assetManifest = JSON.parse(await readFile(resolve(root, "dist/client/.vite/manifest.json"), "utf8").catch(() => "{}"));
console.log(`Rendered ${target} with ${Object.keys(assetManifest).length} manifest entries.`);
