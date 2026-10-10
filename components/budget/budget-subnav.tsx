"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesColumn, LayoutDashboard, Receipt, Repeat } from "lucide-react";
import { useBudget } from "@/components/budget/budget-provider";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/budget", labelKey: "navOverview", icon: LayoutDashboard },
  { href: "/budget/expenses", labelKey: "navExpenses", icon: Receipt },
  { href: "/budget/recurring", labelKey: "navRecurring", icon: Repeat },
  { href: "/budget/reports", labelKey: "navReports", icon: ChartNoAxesColumn },
] as const;

export function BudgetSubnav() {
  const pathname = usePathname();
  const { tb } = useBudget();
  return (
    <nav className="bd-subnav bd-noprint" aria-label={tb("subnav")}>
      {tabs.map(({ href, labelKey, icon: Icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("bd-tab", pathname === href && "bd-tab-active")}>
          <Icon size={16} strokeWidth={1.9} /><span>{tb(labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
