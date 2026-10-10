import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BudgetProvider } from "@/components/budget/budget-provider";
import { BudgetSubnav } from "@/components/budget/budget-subnav";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetLayout({ children }: { children: ReactNode }) {
  return <BudgetProvider><BudgetSubnav />{children}</BudgetProvider>;
}
