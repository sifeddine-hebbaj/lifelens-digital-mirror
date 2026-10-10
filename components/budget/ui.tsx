"use client";

import { categoryMeta } from "@/lib/budget/categories";
import { useBudget } from "@/components/budget/budget-provider";

export function CategoryTile({ category, size = 36 }: { category: string; size?: number }) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  return <span className="bd-tile" style={{ width: size, height: size, background: `${meta.color}22`, color: meta.color }} aria-hidden="true"><Icon size={Math.round(size * 0.5)} /></span>;
}

export function CategorySelect({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  const { tb } = useBudget();
  const options = ["food", "transport", "phone", "subscriptions", "clothes", "health", "entertainment", "family", "shopping", "other"] as const;
  return <select id={id} className="field" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((key) => <option key={key} value={key}>{tb(categoryMeta(key).labelKey)}</option>)}</select>;
}

export function Messages({ error, notice }: { error?: string; notice?: string }) {
  const { tb } = useBudget();
  const missingBudgetFunction = Boolean(error && /Could not find the function public\.budget_[\w]+/i.test(error));
  const displayedError = missingBudgetFunction ? tb("missingTables") : error;
  return <>
    {error && <div className="status-message status-error bd-message" role="alert">{displayedError}{!missingBudgetFunction && <small className="bd-hint-line">{tb("missingTables")}</small>}</div>}
    {notice && <div className="status-message status-info bd-message" role="status">{notice}</div>}
  </>;
}

export function ProgressBar({ percent, tone = "green" }: { percent: number; tone?: "green" | "coral" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return <div className="bd-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}><span className={tone === "coral" ? "bd-bar-coral" : undefined} style={{ width: `${clamped}%` }} /></div>;
}
