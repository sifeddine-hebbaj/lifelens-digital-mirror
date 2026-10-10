"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBudget } from "@/components/budget/budget-provider";
import { currentMonth, shiftMonth } from "@/lib/budget/calc";

export function MonthSwitcher() {
  const { month, setMonth, monthLabel, tb } = useBudget();
  const isCurrent = month === currentMonth();
  return (
    <div className="bd-month bd-noprint" role="group" aria-label={monthLabel(month)}>
      <button type="button" className="icon-button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={tb("prevMonth")}><ChevronLeft className="bd-flip" size={18} /></button>
      <span className="bd-month-label" aria-live="polite">{monthLabel(month)}</span>
      <button type="button" className="icon-button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={tb("nextMonth")}><ChevronRight className="bd-flip" size={18} /></button>
      {!isCurrent && <button type="button" className="bd-month-today" onClick={() => setMonth(currentMonth())}>{tb("thisMonth")}</button>}
    </div>
  );
}
