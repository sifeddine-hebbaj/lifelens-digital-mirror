import type { Entry } from "@/lib/analysis";

export type DailyEntry = Entry & {
  id: string;
  notes: string | null;
  money_spent?: number | null;
  created_at?: string;
};