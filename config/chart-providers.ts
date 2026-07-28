export const CHART_PROVIDERS = {
  bazi: {
    source: "https://github.com/cantian-ai/bazi-mcp",
    package: "bazi-mcp",
    version: "0.1.0",
    tool: "getBaziDetail",
    productionMode: "direct-core",
  },
  ziwei: {
    source: "https://github.com/SiwuXue/ziwei-mcp",
    tools: ["generate_chart", "interpret_chart"],
    upstreamTransport: "stdio",
    productionAdapter: "iztro@2.5.8",
    compatibilityReason: "Cloudflare Worker cannot spawn stdio/SQLite MCP; upstream core contains explicitly simplified star-placement formulas.",
  },
} as const;
