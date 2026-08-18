"use client";
import { useEffect, useState } from "react";

type Item = { id: string; kind: string; title: string; summary: string; result: any; createdAt: string };
const labels: Record<string, string> = { bazi: "八字测算", ziwei: "紫微斗数", compatibility: "双人合盘" };
export function HistoryList() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { void fetch("/api/history").then(async (response) => { if (response.status === 401) { window.location.href = "/login?returnTo=/history"; return; } const data = await response.json(); setItems(data.items || []); }); }, []);
  return <section className="history-page"><header><p>MEASUREMENT HISTORY</p><h1>测算历史</h1><span>回看曾经生成的命盘与解读结果。</span></header>
    {items === null ? <p className="history-empty">正在读取历史记录…</p> : items.length === 0 ? <div className="history-empty"><b>还没有测算记录</b><span>完成一次八字、紫微或双人合盘后，结果会自动保存在这里。</span><a href="/bazi">开始第一次测算 →</a></div> : <div className="history-list">{items.map((item) => <article key={item.id}><div><span>{labels[item.kind] || "命理测算"}</span><time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time></div><h2>{item.title}</h2><p>{item.summary}</p><details><summary>查看完整结果</summary><HistoryResult result={item.result} /></details></article>)}</div>}
  </section>;
}
function HistoryResult({ result }: { result: any }) { const facts: string[] = result?.report?.facts || result?.analysis?.facts || []; const topics: any[] = result?.report?.topics || result?.analysis?.topics || []; return <div className="history-result">{facts.length > 0 && <ul>{facts.slice(0, 8).map((fact, index) => <li key={index}>{String(fact)}</li>)}</ul>}{topics.slice(0, 6).map((topic, index) => <section key={index}><h3>{topic.title || topic.topic || `分析 ${index + 1}`}</h3><p>{topic.interpretation || topic.summary || topic.evidence || ""}</p></section>)}{!facts.length && !topics.length && <p>{result?.aiReport?.summary || result?.summary || "完整测算数据已保存。"}</p>}</div>; }
