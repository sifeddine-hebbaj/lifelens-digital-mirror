export type Entry = { entry_date: string; mood: number | null; energy: number | null; sleep_hours: number | null;
  work_minutes: number | null; exercise_minutes: number | null; screen_minutes: number | null; money_spent: number | null };
export const MIN_DAYS = 14;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
const nums = (es: Entry[], k: keyof Entry) => es.map((e) => e[k]).filter((v): v is number => typeof v === "number");

/** Deterministic stats. The AI only interprets these; it never sees raw rows. */
export function summarize(entries: Entry[]) {
  const n = entries.length;
  const keys = ["mood","energy","sleep_hours","work_minutes","exercise_minutes","screen_minutes","money_spent"] as const;
  const pairs = entries.filter((e) => e.sleep_hours != null && e.energy != null);
  const short = pairs.filter((e) => e.sleep_hours! < 6);
  const shortLow = short.filter((e) => e.energy! < 5).length;
  const rest = pairs.filter((e) => e.sleep_hours! >= 6);
  const restLow = rest.filter((e) => e.energy! < 5).length;
  const last7 = entries.slice(-7), prev7 = entries.slice(-14, -7);
  const d = (k: keyof Entry) => { const a = avg(nums(last7, k)), b = avg(nums(prev7, k)); return a != null && b != null ? r1(a - b) : null; };
  return {
    days_logged: n, sufficient: n >= MIN_DAYS,
    averages: Object.fromEntries(keys.map((k) => [k, r1(avg(nums(entries, k)))])),
    sleep_energy: { short_sleep_days: short.length, short_sleep_low_energy: shortLow, other_days: rest.length, other_low_energy: restLow,
      evidence: short.length ? `On ${shortLow} of ${short.length} days with <6h sleep, energy was below 5/10 (vs ${restLow} of ${rest.length} other days).` : null },
    week_over_week: { mood: d("mood"), energy: d("energy"), sleep_hours: d("sleep_hours"), work_minutes: d("work_minutes"), screen_minutes: d("screen_minutes") },
  };
}
