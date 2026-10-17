import type { ReactNode } from "react";
import { Button, Card, Spinner } from "@heroui/react";
import { Gear, ShieldExclamation } from "@gravity-ui/icons";
import logo from "@/assets/logo.webp";
import { useAdminAuth, type AdminAuthState } from "./auth";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-pool px-4 py-10">
      {/* Bolhas de luz suaves ao fundo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-pool-light/30 blur-3xl motion-safe:animate-float"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-28 size-80 rounded-full bg-white/15 blur-3xl motion-safe:animate-float [animation-delay:-3s]"
      />
      <Card className="animate-admin-rise relative w-full max-w-md gap-5 p-6 shadow-overlay sm:p-8">
        <img src={logo} alt="Tchê Piscinas" className="mx-auto h-16 w-auto" />
        {children}
      </Card>
    </div>
  );
}

export function NotConfiguredNotice() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Gear className="size-8 text-warning" />
      <p className="font-semibold">Supabase não configurado</p>
      <p className="text-sm text-muted">
        Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo{" "}
        <code>.env</code> e reinicie o servidor. Veja <code>docs/ADMIN.md</code>.
      </p>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
      <Spinner size="lg" />
      <span className="text-sm text-muted">Carregando...</span>
    </div>
  );
}

// Tela para estados que não são "admin autenticado".
export function AdminStatusScreen({ state }: { state: AdminAuthState }) {
  const { signOut, recheck } = useAdminAuth();

  if (state.status === "not_configured") {
    return (
      <AuthCard>
        <NotConfiguredNotice />
      </AuthCard>
    );
  }

  if (state.status === "forbidden" || state.status === "error") {
    return (
      <AuthCard>
        <div className="flex flex-col items-center gap-2 text-center" role="alert">
          <ShieldExclamation className="size-8 text-danger" />
          <p className="font-semibold">
            {state.status === "forbidden" ? "Acesso não autorizado" : "Erro ao verificar acesso"}
          </p>
          <p className="text-sm text-muted">
            {state.status === "forbidden"
              ? `A conta ${state.session.user.email ?? ""} não tem permissão de administrador.`
              : state.message}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {state.status === "error" && (
            <Button variant="tertiary" onPress={recheck}>
              Tentar novamente
            </Button>
          )}
          <Button onPress={signOut}>Sair</Button>
        </div>
      </AuthCard>
    );
  }

  return <FullPageSpinner />;
}
