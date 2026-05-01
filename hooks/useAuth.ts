import { useEffect, useState } from "react";
import { Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function isRefreshTokenError(error: AuthError | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("refresh token not found") ||
    msg.includes("invalid refresh token")
  );
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (isRefreshTokenError(error as AuthError | null)) {
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(session);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && !session) {
        supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(session);
    });

    supabase.auth.refreshSession().then(({ error }) => {
      if (isRefreshTokenError(error)) {
        supabase.auth.signOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading, user: session?.user ?? null };
}
