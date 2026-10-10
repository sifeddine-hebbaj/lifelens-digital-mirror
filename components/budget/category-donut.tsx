"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useBudget } from "@/components/budget/budget-provider";
import { categoryMeta } from "@/lib/budget/categories";

export function CategoryDonut({ totals }: { totals: Record<string, number> }) {
  const { money, tb } = useBudget();
  const rows = Object.entries(totals).map(([key, value]) => ({ key, value, meta: categoryMeta(key) })).sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!rows.length) return <div className="status-empty">{tb("noExpensesMonth")}</div>;
  return (
    <div className="bd-donut-layout">
      <div className="bd-donut" role="img" aria-label={tb("byCategory")}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={rows} dataKey="value" nameKey="key" innerRadius="64%" outerRadius="100%" paddingAngle={rows.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>{rows.map((row) => <Cell key={row.key} fill={row.meta.color} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="bd-donut-center"><small>{tb("total")}</small><b>{money(total)}</b></div>
      </div>
      <ul className="bd-legend">
        {rows.map((row) => <li key={row.key}><i style={{ background: row.meta.color }} /><span>{tb(row.meta.labelKey)}</span><b>{money(row.value)}</b><small>{Math.round((row.value / total) * 100)}%</small></li>)}
      </ul>
    </div>
  );
}
