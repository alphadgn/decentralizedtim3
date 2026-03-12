import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null;
        let role: AppRole | null = null;

        if (user) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();
          role = data?.role ?? null;
        }

        setState({ user, session, role, loading: false });
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      let role: AppRole | null = null;

      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        role = data?.role ?? null;
      }

      setState({ user, session, role, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email: string, password: string) =>
    supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });

  const signOut = () => supabase.auth.signOut();

  const isAdmin = state.role === "admin" || state.role === "super_admin";
  const isSuperAdmin = state.role === "super_admin";

  return { ...state, signIn, signUp, signOut, isAdmin, isSuperAdmin };
}
