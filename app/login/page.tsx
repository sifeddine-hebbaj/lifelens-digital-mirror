"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Leaf, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { configured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const client = supabaseBrowser();
    if (!client) {
      setError(t("invalidSupabaseConfig"));
      setBusy(false);
      return;
    }
    const result = mode === "signin"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage(t("confirmEmail"));
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <Link className="brand login-brand" href="/"><span className="brand-mark"><Leaf size={19} /></span><span>lifelens</span></Link>
          <div className="login-message">
            <span className="eyebrow">{t("perspective")}</span>
            <h1>{t("loginHeadlineFirst")}<br />{t("loginHeadlineSecond")}</h1>
            <p>{t("loginCopy")}</p>
          </div>
          <div className="login-footnote"><span className="privacy-dot" />{t("privateByDesign")}</div>
        </div>
        <div className="story-ring story-ring-one" /><div className="story-ring story-ring-two" />
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <div className="login-language-bar"><LanguageSwitcher /></div>
          <div className="login-mobile-brand"><Link className="brand" href="/"><span className="brand-mark"><Leaf size={19} /></span><span>lifelens</span></Link></div>
          <p className="eyebrow">{t("personalSpace")}</p>
          <h2>{mode === "signin" ? t("welcomeBack") : t("startJournal")}</h2>
          <p className="login-subtitle">{mode === "signin" ? t("signInContinue") : t("createAccountIntro")}</p>
          {!configured && <div className="status-message status-info login-config"><strong>{t("connectSupabase")}</strong><br />{t("configureSupabase")}</div>}
          <form className="login-form" onSubmit={submit}>
            <label className="field-label"><span>{t("emailAddress")}</span><span className="input-icon"><Mail size={16} /><input className="field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("emailPlaceholder")} /></span></label>
            <label className="field-label"><span>{t("password")}</span><span className="input-icon"><LockKeyhole size={16} /><input className="field" type="password" minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("passwordPlaceholder")} /></span></label>
            {error && <div className="status-message status-error" role="alert">{error}</div>}
            {message && <div className="status-message status-info" role="status">{message}</div>}
            <Button className="login-submit" type="submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="animate-spin" size={16} /> : <>{mode === "signin" ? t("signIn") : t("createAccount")}<ArrowRight size={16} /></>}</Button>
          </form>
          <p className="login-switch">{mode === "signin" ? t("newToLifeLens") : t("alreadyHaveAccount")} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{mode === "signin" ? t("createAccount") : t("signIn")}</button></p>
          <p className="login-terms">{t("loginTerms")}</p>
        </div>
      </section>
    </main>
  );
}