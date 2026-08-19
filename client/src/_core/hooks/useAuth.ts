import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setHasSession(Boolean(data.session)); setSessionReady(true); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session)); setSessionReady(true); utils.auth.me.invalidate();
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [utils.auth.me]);

  const meQuery = trpc.auth.me.useQuery(undefined, { enabled: sessionReady && hasSession, retry: false, refetchOnWindowFocus: false });
  const logout = useCallback(async () => {
    const result = await supabase.auth.signOut({ scope: "local" });
    setHasSession(false);
    utils.auth.me.setData(undefined, null);
    void utils.auth.me.cancel();
    void utils.auth.me.invalidate();
    return result;
  }, [utils]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: !sessionReady || (hasSession && meQuery.isLoading),
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [hasSession, meQuery.data, meQuery.error, meQuery.isLoading, sessionReady]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || !sessionReady || meQuery.isLoading || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, sessionReady, meQuery.isLoading, state.user]);

  return { ...state, hasSession, refresh: () => meQuery.refetch(), logout };
}
