import type { AppStore, StoreUser } from "./store";

export async function saveHistory(store: AppStore, user: StoreUser, kind: string, input: unknown, result: any, title: string) {
  const summary = String(result?.analysis?.summary || result?.aiReport?.summary || result?.summary || "测算结果已生成并保存。\n").slice(0, 500);
  await store.saveMeasurement({ id: crypto.randomUUID(), userId: user.id, kind, title: title.slice(0, 80), summary, input, result });
}
