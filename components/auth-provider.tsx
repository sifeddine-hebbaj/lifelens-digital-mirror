"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";

type AuthContextValue = { user: User | null; loading: boolean; configured: boolean; signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client) {
      setLoading(false);
      return;
    }
    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabaseBrowser()?.auth.signOut();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, configured, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}