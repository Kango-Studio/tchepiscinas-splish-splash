import type { ReactNode } from "react";
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { ShieldAlert, Settings } from "lucide-react";
import logo from "@/assets/logo.webp";
import { useAdminAuth, type AdminAuthState } from "./auth";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-pool px-4 py-10">
      <Card className="w-full max-w-md" shadow="lg">
        <CardBody className="gap-5 p-6 sm:p-8">
          <img src={logo} alt="Tchê Piscinas" className="mx-auto h-16 w-auto" />
          {children}
        </CardBody>
      </Card>
    </div>
  );
}

export function NotConfiguredNotice() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Settings className="size-8 text-warning" />
      <p className="font-semibold">Supabase não configurado</p>
      <p className="text-sm text-default-500">
        Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no arquivo{" "}
        <code>.env</code> e reinicie o servidor. Veja <code>docs/ADMIN.md</code>.
      </p>
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
          <ShieldAlert className="size-8 text-danger" />
          <p className="font-semibold">
            {state.status === "forbidden" ? "Acesso não autorizado" : "Erro ao verificar acesso"}
          </p>
          <p className="text-sm text-default-500">
            {state.status === "forbidden"
              ? `A conta ${state.session.user.email ?? ""} não tem permissão de administrador.`
              : state.message}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {state.status === "error" && (
            <Button variant="flat" color="primary" onPress={recheck}>
              Tentar novamente
            </Button>
          )}
          <Button color="primary" onPress={signOut}>
            Sair
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner label="Carregando..." color="primary" />
    </div>
  );
}
