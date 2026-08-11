"use client";

import { useEffect, useState } from "react";

export function GuanchenWait({
  active,
  title,
  detail,
  estimatedSeconds = 20,
  compact = false,
}: {
  active: boolean;
  title: string;
  detail?: string;
  estimatedSeconds?: number;
  compact?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;
  const remaining = Math.max(estimatedSeconds - elapsed, 0);
  const progress = Math.min(96, Math.max(5, (elapsed / estimatedSeconds) * 100));

  return <div className={`guanchen-mini-wait${compact ? " compact" : ""}`} aria-live="polite" aria-label="正在处理，请稍候">
    <div className="taoist-reader" aria-hidden="true"><i className="taoist-hat" /><i className="taoist-head" /><i className="taoist-robe" /><span className="taoist-book"><b /><em /></span></div>
    <div className="guanchen-wait-copy">
      <b>{title}</b>
      <span>{remaining > 0 ? `预计还需 ${remaining} 秒` : "正在完成最后核对，请继续等待"}</span>
      {detail && <small>{detail}</small>}
      <i className="guanchen-wait-progress"><em style={{ width: `${progress}%` }} /></i>
    </div>
  </div>;
}
