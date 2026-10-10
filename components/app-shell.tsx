"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Activity, Bot, ChartNoAxesCombined, CheckSquare, CircleUserRound, Clock3, Compass, Leaf, LogOut, Sparkles, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", labelKey: "overview", icon: Compass },
  { href: "/today", labelKey: "today", icon: CheckSquare },
  { href: "/timeline", labelKey: "timeline", icon: Clock3 },
  { href: "/insights", labelKey: "insights", icon: Sparkles },
  { href: "/trends", labelKey: "trends", icon: ChartNoAxesCombined },
  { href: "/goals", labelKey: "goals", icon: Activity },
  { href: "/budget", labelKey: "budget", icon: Wallet },
  { href: "/ai", labelKey: "askAi", icon: Bot },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, configured, signOut } = useAuth();
  const { t } = useLanguage();
  const publicPage = pathname === "/login";
  const isCurrent = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (!loading && !publicPage && (!configured || !user)) router.replace("/login");
    if (!loading && publicPage && configured && user) router.replace("/dashboard");
  }, [configured, loading, publicPage, router, user]);

  if (publicPage) return <>{children}</>;
  if (loading || !configured || !user) {
    return <main className="grid min-h-screen place-items-center"><div className="loading-mark" aria-label={t("loadingLifeLens")} /></main>;
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand"><span className="brand-mark"><Leaf size={19} /></span><span>lifelens</span></Link>
        <div className="sidebar-caption">{t("yourSpace")}</div>
        <nav className="sidebar-nav" aria-label={t("mainNavigation")}>
          {navigation.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} className={cn("nav-link", active && "nav-link-active")}><Icon size={18} strokeWidth={1.8} /><span>{t(labelKey)}</span>{active && <span className="nav-indicator" />}</Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <LanguageSwitcher className="sidebar-language" />
          <div className="privacy-note"><span className="privacy-dot" />{t("privateEntries")}</div>
          <Link href="/profile" className={cn("nav-link", pathname === "/profile" && "nav-link-active")}><CircleUserRound size={18} strokeWidth={1.8} /><span>{t("profile")}</span></Link>
          <button className="nav-link signout-link" onClick={() => void signOut()}><LogOut size={18} strokeWidth={1.8} /><span>{t("signOut")}</span></button>
        </div>
      </aside>
      <div className={cn("main-column", pathname === "/ai" && "main-column-ai")}>
        <header className="mobile-header"><Link href="/dashboard" className="brand"><span className="brand-mark"><Leaf size={18} /></span><span>lifelens</span></Link><div className="mobile-header-actions"><LanguageSwitcher /><Link href="/profile" className="mobile-profile" aria-label={t("profile")}><CircleUserRound size={21} /></Link></div></header>
        <main className={cn("page-content", pathname === "/ai" && "ai-page-content")}>{children}</main>
        <nav className="mobile-nav" aria-label={t("mobileNavigation")}>
          {[navigation[0], navigation[1], navigation[3], navigation[5], navigation[6], navigation[7]].map(({ href, labelKey, icon: Icon }) => { const current = isCurrent(href); return <Link key={href} href={href} aria-label={t(labelKey)} aria-current={current ? "page" : undefined} className={cn("mobile-nav-link", current && "mobile-nav-active")}><Icon size={19} /><span>{t(labelKey)}</span></Link>; })}
        </nav>
      </div>
    </div>
  );
}