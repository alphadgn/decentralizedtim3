import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface AuthState {
  role: AppRole | null;
  loading: boolean;
  userId: string | null;
}

export function useAuth() {
  const { user: privyUser, authenticated, login, logout, ready } = usePrivy();
  const [state, setState] = useState<AuthState>({ role: null, loading: true });

  const email = privyUser?.email?.address ?? null;

  const syncRole = useCallback(async () => {
    if (!authenticated || !email) {
      setState({ role: null, loading: false });
      return;
    }

    // Use a deterministic UUID based on email for consistency
    const userId = await emailToUuid(email);

    // Check if profile exists
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      // Create profile + role via edge function (bypasses RLS)
      await supabase.functions.invoke("sync-privy-user", {
        body: { email, userId },
      });
    }

    // Fetch role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    setState({ role: roleData?.role ?? null, loading: false });
  }, [authenticated, email]);

  useEffect(() => {
    if (ready) syncRole();
  }, [ready, syncRole]);

  const isAdmin = state.role === "admin" || state.role === "super_admin";
  const isSuperAdmin = state.role === "super_admin";

  return {
    user: authenticated ? privyUser : null,
    session: null,
    role: state.role,
    loading: !ready || state.loading,
    login,
    signOut: logout,
    isAdmin,
    isSuperAdmin,
  };
}

// Deterministic UUID v5-like from email (simple hash approach)
async function emailToUuid(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Format as UUID
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}
