"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { useBudget } from "@/components/budget/budget-provider";
import { CategoryDonut } from "@/components/budget/category-donut";
import { Messages, ProgressBar } from "@/components/budget/ui";
import { listExpenses, listIncome, listMonthSettings } from "@/lib/budget/api";
import { bucketsByMonth, csvCell, currentMonth, effectiveAnnualBudget, isoDate, monthBounds, percentUsed, resolveSettings, sumBy, totalsByCategory, yearBounds } from "@/lib/budget/calc";
import { categoryMeta } from "@/lib/budget/categories";
import type { Expense, Income, MonthSettings } from "@/lib/budget/types";

type Period = "month" | "year" | "custom";

export default function BudgetReportsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { money, locale, monthLabel, currency, currencyRate, tb } = useBudget();
  const [period, setPeriod] = useState<Period>("month");
  const [pickedMonth, setPickedMonth] = useState(currentMonth());
  const [pickedYear, setPickedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(monthBounds(currentMonth()).start);
  const [customEnd, setCustomEnd] = useState(isoDate());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [settingsRows, setSettingsRows] = useState<MonthSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    if (period === "month") return pickedMonth ? monthBounds(pickedMonth) : null;
    if (period === "year") return pickedYear >= 2000 && pickedYear <= 2100 ? yearBounds(pickedYear) : null;
    return customStart && customEnd && customStart <= customEnd ? { start: customStart, end: customEnd } : null;
  }, [period, pickedMonth, pickedYear, customStart, customEnd]);

  useEffect(() => {
    if (!user || !range) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    Promise.all([listExpenses(range.start, range.end), listIncome(range.start, range.end), listMonthSettings()])
      .then(([e, i, s]) => { if (alive) { setExpenses(e); setIncome(i); setSettingsRows(s); setError(""); setLoading(false); } })
      .catch((reason: unknown) => { if (alive) { setError(`${tb("loadError")} ${reason instanceof Error ? reason.message : String(reason)}`); setLoading(false); } });
    return () => { alive = false; };
  }, [user, range, tb]);

  const totalExpenses = sumBy(expenses, (item) => item.amount);
  const totalIncome = sumBy(income, (item) => item.amount);
  const budget = period === "month" ? resolveSettings(settingsRows, pickedMonth).spend_budget : period === "year" ? effectiveAnnualBudget(settingsRows, pickedYear) : 0;
  const used = percentUsed(totalExpenses, budget);
  const categoryTotals = useMemo(() => totalsByCategory(expenses), [expenses]);
  const buckets = useMemo(() => (range ? bucketsByMonth(expenses, income, range.start, range.end) : []), [expenses, income, range]);
  const chartData = buckets.map((bucket) => ({ label: new Date(`${bucket.month}-01T12:00:00`).toLocaleDateString(locale, { month: "short", ...(range && range.start.slice(0, 4) !== range.end.slice(0, 4) ? { year: "2-digit" as const } : {}) }), income: bucket.income, expenses: bucket.expenses }));

  const rows = useMemo(() => [
    ...expenses.map((item) => ({ id: item.id, date: item.expense_date, type: "expense" as const, name: item.name, category: item.category, amount: item.amount })),
    ...income.map((item) => ({ id: item.id, date: item.income_date, type: "income" as const, name: item.source, category: "", amount: item.amount })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [expenses, income]);

  const periodTitle = period === "month" ? monthLabel(pickedMonth) : period === "year" ? String(pickedYear) : range ? `${range.start} → ${range.end}` : "";
  const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  function exportCsv() {
    if (!range) return;
    const separator = language === "en" ? "," : ";";
    const amountText = (value: number) => (language === "en" ? value.toFixed(2) : value.toFixed(2).replace(".", ","));
    const lines = [[tb("date"), tb("type"), tb("name"), tb("category"), tb("amount")].map(csvCell).join(separator)];
    for (const row of rows) {
      lines.push([row.date, row.type === "expense" ? tb("expenseType") : tb("incomeType"), row.name, row.category ? tb(categoryMeta(row.category).labelKey) : "", amountText(row.type === "expense" ? -row.amount : row.amount)].map((cell) => csvCell(cell)).join(separator));
    }
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `lifelens-budget-${range.start}_${range.end}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{tb("title")}</p><h1 className="page-title">{tb("reportsTitle")}</h1><p className="page-subtitle bd-noprint">{tb("reportsSubtitle")}</p></div>
      <div className="bd-actions bd-noprint"><Button variant="outline" onClick={exportCsv} disabled={!range || loading || !rows.length}><Download size={15} />{tb("exportCsv")}</Button><Button onClick={() => window.print()} disabled={!range || loading}><Printer size={15} />{tb("printPdf")}</Button></div></header>
    <Messages error={error} />

    <section className="surface bd-panel bd-noprint">
      <div className="bd-segment" role="group">
        {(["month", "year", "custom"] as const).map((value) => <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "month" ? tb("periodMonth") : value === "year" ? tb("periodYear") : tb("periodCustom")}</button>)}
      </div>
      <div className="bd-period-fields">
        {period === "month" && <label className="field-label">{tb("monthLabel")}<input className="field" type="month" value={pickedMonth} onChange={(event) => setPickedMonth(event.target.value)} /></label>}
        {period === "year" && <label className="field-label">{tb("year")}<input className="field" type="number" min={2000} max={2100} value={pickedYear} onChange={(event) => setPickedYear(Number(event.target.value))} /></label>}
        {period === "custom" && <>
          <label className="field-label">{tb("from")}<input className="field" type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
          <label className="field-label">{tb("to")}<input className="field" type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
        </>}
      </div>
      {!range && period === "custom" && <p className="bd-hint bd-hint-over">{tb("invalidRange")}</p>}
      <p className="bd-hint">{tb("printHint")}</p>
    </section>

    {range && <section className="bd-report">
      <div className="bd-print-brand"><span className="bd-print-wordmark">LifeLens</span><span className="bd-print-context">{tb("title")}</span></div>
      <div className="bd-report-head"><h2 className="section-title">{tb("reportFor", { period: periodTitle })}</h2><p className="muted-copy small-copy">{tb("generatedOn", { date: shortDate(isoDate()) })} · {tb("transactions", { count: rows.length })}</p>{currencyRate && <p className="muted-copy small-copy">{tb("exchangeRateUsed", { from: currencyRate.from, rate: new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(currencyRate.value), to: currency, date: new Date(currencyRate.date).toLocaleDateString(locale) })}</p>}</div>
      {loading ? <div className="chart-loading"><LoaderCircle className="animate-spin" size={20} /></div> : <>
        <div className="bd-stat-grid">
          <article className="surface bd-stat bd-stat-income"><span className="bd-stat-value">{money(totalIncome)}</span><span className="stat-label">{tb("income")}</span></article>
          <article className="surface bd-stat bd-stat-expenses"><span className="bd-stat-value">{money(totalExpenses)}</span><span className="stat-label">{tb("expenses")}</span></article>
          <article className="surface bd-stat bd-stat-balance"><span className="bd-stat-value">{money(totalIncome - totalExpenses)}</span><span className="stat-label">{tb("balance")}</span></article>
          <article className="surface bd-stat bd-stat-budget"><span className="bd-stat-value">{budget > 0 ? money(budget) : "—"}</span><span className="stat-label">{tb("budgetLabel")}</span>{budget > 0 && <><ProgressBar percent={used} tone={used > 100 ? "coral" : "green"} /><small className={used > 100 ? "bd-hint bd-hint-over" : "bd-hint"}>{tb("budgetUsed", { percent: used })}</small></>}</article>
        </div>

        {rows.length === 0 ? <div className="status-empty">{tb("noData")}</div> : <>
          <div className="bd-grid bd-grid-even">
            <article className="surface bd-panel bd-report-chart"><h3 className="section-title">{tb("byCategory")}</h3><CategoryDonut totals={categoryTotals} /></article>
            {chartData.length > 1 && <article className="surface bd-panel bd-report-chart"><h3 className="section-title">{tb("byMonth")}</h3>
              <div className="bd-bars"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 6, left: -14, bottom: 0 }}><CartesianGrid stroke="#e8ece5" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#849086", fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#849086", fontSize: 10 }} /><Tooltip formatter={(value: number) => money(value)} contentStyle={{ border: "1px solid #e2e8de", borderRadius: 6, fontSize: 12 }} /><Bar dataKey="income" name={tb("income")} fill="#5b8c65" radius={[3, 3, 0, 0]} isAnimationActive={false} /><Bar dataKey="expenses" name={tb("expenses")} fill="#ca7656" radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
              <div className="chart-legend"><span><i className="legend-dot energy-dot" />{tb("income")}</span><span><i className="legend-dot mood-dot" />{tb("expenses")}</span></div></article>}
          </div>
          <article className="surface bd-panel bd-report-details"><h3 className="section-title">{tb("details")}</h3>
            <div className="bd-table-wrap"><table className="bd-table"><thead><tr><th>{tb("date")}</th><th>{tb("type")}</th><th>{tb("name")}</th><th>{tb("category")}</th><th className="bd-num">{tb("amount")}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={`${row.type}-${row.id}`}><td>{shortDate(row.date)}</td><td>{row.type === "expense" ? tb("expenseType") : tb("incomeType")}</td><td>{row.name || "—"}</td><td>{row.category ? tb(categoryMeta(row.category).labelKey) : "—"}</td><td className={`bd-num ${row.type === "income" ? "bd-positive" : ""}`}>{row.type === "income" ? "+" : "−"}{money(row.amount)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={4}>{tb("balance")}</td><td className="bd-num">{money(totalIncome - totalExpenses)}</td></tr></tfoot></table></div>
          </article>
        </>}
        <footer className="bd-signature">
          <div className="bd-signature-name"><span>{tb("preparedBy")}</span><strong>Lifelens</strong></div>
          <div className="bd-signature-mark"><span>{tb("signature")}</span><strong className="bd-signature-text">LifeLens</strong><span className="bd-signature-line" /></div>
        </footer>
      </>}
    </section>}
  </div>;
}
