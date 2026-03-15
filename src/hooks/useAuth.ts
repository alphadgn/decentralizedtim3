import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

const SUPER_ADMIN_EMAIL = "a1cust0msenterprises@gmail.com";

interface AuthState {
  role: AppRole | null;
  loading: boolean;
  userId: string | null;
  blocked: boolean;
  unauthorized: boolean;
  attemptCount: number;
}

const BLOCKED_KEY = "dgtn_blocked";

export function useAuth() {
  const { user: privyUser, authenticated, login, logout, ready, getAccessToken } = usePrivy();
  const [state, setState] = useState<AuthState>({
    role: null,
    loading: true,
    userId: null,
    blocked: false,
    unauthorized: false,
    attemptCount: 0,
  });

  const email = privyUser?.email?.address ?? null;

  const syncRole = useCallback(async () => {
    if (!authenticated || !email) {
      setState((prev) => ({ ...prev, role: null, loading: false, userId: null, unauthorized: false }));
      return;
    }

    const isSuperAdminEmail = email.toLowerCase() === SUPER_ADMIN_EMAIL;

    // Get Privy access token for authenticated requests
    let accessToken: string | null = null;
    try {
      accessToken = await getAccessToken();
    } catch (e) {
      console.error("Failed to get access token:", e);
    }

    // Step 1: Check if email is approved via edge function
    // Super admin is ALWAYS exempt — skip approval check entirely
    if (!isSuperAdminEmail) {
      const { data: approvalData, error: approvalError } = await supabase.functions.invoke(
        "sync-privy-user",
        {
          body: { email, action: "check_approval" },
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      );

      if (approvalError || !approvalData?.approved) {
        const attempts = approvalData?.attempts ?? 1;
        const isBlocked = approvalData?.blocked ?? attempts >= 2;

        if (isBlocked) {
          localStorage.setItem(BLOCKED_KEY, "true");
        }

        await logout();

        setState({
          role: null,
          loading: false,
          userId: null,
          blocked: isBlocked,
          unauthorized: true,
          attemptCount: attempts,
        });
        return;
      }
    }

    // Step 2: Approved — sync profile & role
    const userId = await emailToUuid(email.toLowerCase());

    // Always invoke sync to ensure role enforcement (especially super_admin)
    let accessToken2: string | null = null;
    try {
      accessToken2 = await getAccessToken();
    } catch (e) {
      console.error("Failed to get access token for sync:", e);
    }

    const { data: syncData, error: syncError } = await supabase.functions.invoke("sync-privy-user", {
      body: { email, userId },
      headers: accessToken2 ? { Authorization: `Bearer ${accessToken2}` } : {},
    });

    // Use role returned directly from edge function (avoids RLS blocking)
    let syncedRole = syncData?.role ?? null;

    // CRITICAL: If edge function fails or returns wrong role for super admin,
    // enforce super_admin role on the frontend as well
    if (isSuperAdminEmail && syncedRole !== "super_admin") {
      console.warn("Super admin role mismatch detected, enforcing super_admin");
      syncedRole = "super_admin";
    }

    setState({
      role: syncedRole,
      loading: false,
      userId,
      blocked: false,
      unauthorized: false,
      attemptCount: 0,
    });
  }, [authenticated, email, getAccessToken, logout]);

  useEffect(() => {
    if (ready) syncRole();
  }, [ready, syncRole]);

  const isAdmin = state.role === "admin" || state.role === "super_admin";
  const isSuperAdmin = state.role === "super_admin";

  return {
    user: authenticated && !state.unauthorized && !state.blocked ? privyUser : null,
    userId: state.userId,
    session: null,
    role: state.role,
    loading: !ready || state.loading,
    login,
    signOut: logout,
    isAdmin,
    isSuperAdmin,
    blocked: state.blocked,
    unauthorized: state.unauthorized,
    attemptCount: state.attemptCount,
    getAccessToken,
  };
}

async function emailToUuid(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}
