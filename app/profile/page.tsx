"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleUserRound, LoaderCircle, LogOut, Save } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { supabaseBrowser } from "@/lib/supabase/client";

const profileSchema = z.object({ display_name: z.string().trim().max(80), units: z.enum(["metric", "imperial"]), currency: z.string().length(3) });

export default function ProfilePage() {
  const { t, language } = useLanguage();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [currency, setCurrency] = useState("USD");
  const [savedCurrency, setSavedCurrency] = useState("USD");
  const [currencyRate, setCurrencyRate] = useState<{ from: string; value: number; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const client = supabaseBrowser(); if (!client || !user) return;
    Promise.all([
      client.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      client.from("user_preferences").select("units,currency,last_currency_rate_from,last_currency_rate,last_currency_rate_date").eq("user_id", user.id).maybeSingle(),
    ]).then(([profileResult, preferencesResult]) => {
      if (profileResult.error) setError(profileResult.error.message);
      setDisplayName(profileResult.data?.display_name ?? user.user_metadata?.display_name ?? "");
      setUnits(preferencesResult.data?.units === "imperial" ? "imperial" : "metric");
      setCurrency(preferencesResult.data?.currency ?? "USD");
      setSavedCurrency(preferencesResult.data?.currency ?? "USD");
      const rate = Number(preferencesResult.data?.last_currency_rate);
      const rateFrom = preferencesResult.data?.last_currency_rate_from;
      const rateDate = preferencesResult.data?.last_currency_rate_date;
      setCurrencyRate(rateFrom && rateDate && Number.isFinite(rate) && rate > 0 ? { from: rateFrom, value: rate, date: rateDate } : null);
      setLoading(false);
    });
  }, [user]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = profileSchema.safeParse({ display_name: displayName, units, currency });
    if (!parsed.success || !user) { setError(t("checkProfile")); return; }
    const client = supabaseBrowser(); if (!client) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const [profileResult, preferencesResult, authResult] = await Promise.all([
        client.from("profiles").upsert({ id: user.id, display_name: parsed.data.display_name || null }),
        client.from("user_preferences").upsert({ user_id: user.id, units: parsed.data.units }),
        client.auth.updateUser({ data: { display_name: parsed.data.display_name } }),
      ]);
      const failure = profileResult.error ?? preferencesResult.error ?? authResult.error;
      if (failure) { setCurrency(savedCurrency); setError(failure.message); return; }

      if (parsed.data.currency !== savedCurrency) {
        const response = await fetch("/api/budget/currency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetCurrency: parsed.data.currency }),
        });
        const result = await response.json() as { from?: string; to?: string; rate?: number; rateDate?: string };
        if (!response.ok || !result.from || !result.to || !result.rate || !result.rateDate)
          throw new Error(t("currencyConversionFailed"));
        const nextRate = { from: result.from, value: result.rate, date: result.rateDate };
        setCurrency(parsed.data.currency);
        setSavedCurrency(parsed.data.currency);
        setCurrencyRate(nextRate);
        const formattedRate = new Intl.NumberFormat(language, { maximumFractionDigits: 6 }).format(nextRate.value);
        const formattedDate = new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(nextRate.date));
        setNotice(`${t("currencyUpdated")} ${t("currencyRateApplied")}: 1 ${nextRate.from} = ${formattedRate} ${parsed.data.currency} · ${formattedDate}`);
      } else {
        setNotice(t("profileSaved"));
      }
    } catch (reason) {
      setCurrency(savedCurrency);
      setError(reason instanceof Error ? reason.message : t("currencyConversionFailed"));
    } finally {
      setSaving(false);
    }
  }

  return <div className="page-enter">
    <header className="page-heading"><div><p className="eyebrow">{t("account")}</p><h1 className="page-title">{t("profile")}</h1><p className="page-subtitle">{t("profileSubtitle")}</p></div></header>
    {error && <div className="status-message status-error profile-message" role="alert">{t("profileLoadError")} {error}</div>}{notice && <div className="status-message status-info profile-message" role="status">{notice}</div>}
    {loading ? <div className="surface profile-loading"><LoaderCircle className="animate-spin" size={19} /> {t("loadingProfile")}</div> : <div className="profile-layout">
      <form className="surface profile-form" onSubmit={(event) => void save(event)}>
        <div className="profile-section-title"><span className="profile-icon"><CircleUserRound size={19} /></span><div><h2>{t("personalDetails")}</h2><p>{t("nameUsage")}</p></div></div>
        <label className="field-label">{t("displayName")}<input className="field" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t("namePlaceholder")} /></label>
        <label className="field-label">{t("emailAddress")}<input className="field readonly-field" value={user?.email ?? ""} readOnly aria-readonly="true" /><small className="field-hint">{t("managedByProvider")}</small></label>
        <hr className="divider profile-divider" />
        <div className="profile-section-title"><span className="profile-icon profile-icon-coral"><Save size={18} /></span><div><h2>{t("preferences")}</h2><p>{t("preferenceDescription")}</p></div></div>
        <div className="preferences-row"><label className="field-label">{t("measurementUnits")}<select className="field" value={units} onChange={(event) => setUnits(event.target.value as "metric" | "imperial")}><option value="metric">{t("metric")}</option><option value="imperial">{t("imperial")}</option></select></label><label className="field-label">{t("currency")}<select className="field" value={currency} onChange={(event) => setCurrency(event.target.value)}>{["MAD", "USD", "CAD", "EUR", "GBP", "AUD", "JPY"].map((code) => <option value={code} key={code}>{code === "MAD" ? "MAD (DH)" : code}</option>)}</select>{currencyRate ? <small className="field-hint">{t("currencyRateApplied")}: 1 {currencyRate.from} = {new Intl.NumberFormat(language, { maximumFractionDigits: 6 }).format(currencyRate.value)} {currency} · {new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(currencyRate.date))}</small> : <small className="field-hint">{t("currencyChangeNote")}</small>}</label></div>
        <Button className="profile-save" type="submit" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={15} /> : <Save size={15} />}{saving ? t("saving") : t("saveChanges")}</Button>
      </form>
      <aside className="profile-side"><div className="surface account-card"><span className="account-avatar">{(displayName || user?.email || "L").slice(0, 1).toUpperCase()}</span><h2>{displayName || t("profileNameDefault")}</h2><p>{user?.email}</p><span className="tag">{t("personalAccount")}</span></div><div className="privacy-card"><span className="privacy-dot" /><div><strong>{t("dataIsYours")}</strong><p>{t("dataProtected")}</p></div></div><Button variant="outline" className="profile-signout" onClick={() => void signOut()}><LogOut size={15} />{t("signOut")}</Button></aside>
    </div>}
  </div>;
}