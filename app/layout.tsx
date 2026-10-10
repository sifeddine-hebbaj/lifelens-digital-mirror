import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "LifeLens", template: "%s · LifeLens" },
  description: "A private, thoughtful view of your everyday patterns.",
  applicationName: "LifeLens",
  appleWebApp: { capable: true, title: "LifeLens", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#dce9d9" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body><LanguageProvider><AuthProvider><AppShell>{children}</AppShell></AuthProvider></LanguageProvider></body></html>;
}