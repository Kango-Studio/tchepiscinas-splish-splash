import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export type AdminAuthState =
  | { status: "not_configured" }
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "error"; message: string; session: Session }
  | { status: "forbidden"; session: Session }
  | { status: "admin"; session: Session };

type AdminAuthContextValue = {
  state: AdminAuthState;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  recheck: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth deve ser usado dentro de <AdminAuthProvider>");
  return ctx;
}

// Verifica permissão no banco: is_admin() consulta admin_users pelo auth.uid().
async function resolveAdmin(session: Session): Promise<AdminAuthState> {
  const { data, error } = await getSupabase().rpc("is_admin");
  if (error) {
    return {
      status: "error",
      message: "Não foi possível verificar a permissão de administrador.",
      session,
    };
  }
  return data === true ? { status: "admin", session } : { status: "forbidden", session };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(
    isSupabaseConfigured ? { status: "loading" } : { status: "not_configured" },
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;
    let currentUserId: string | null = null;

    const apply = async (session: Session | null) => {
      if (!session) {
        currentUserId = null;
        if (!cancelled) setState({ status: "signed_out" });
        return;
      }
      currentUserId = session.user.id;
      const next = await resolveAdmin(session);
      if (!cancelled && currentUserId === session.user.id) setState(next);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Renovação de token não muda a permissão; evita nova consulta.
      if (event === "TOKEN_REFRESHED" && session && session.user.id === currentUserId) {
        setState((prev) => ("session" in prev ? { ...prev, session } : prev));
        return;
      }
      if (event === "INITIAL_SESSION") return;
      // Chamar o Supabase dentro do callback pode travar o lock de auth; adia.
      setTimeout(() => apply(session), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [nonce]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { error: "E-mail ou senha incorretos." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "E-mail ainda não confirmado." };
    }
    return { error: "Não foi possível entrar. Tente novamente." };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    setState({ status: "signed_out" });
  }, []);

  const recheck = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo(
    () => ({ state, signIn, signOut, recheck }),
    [state, signIn, signOut, recheck],
  );
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
