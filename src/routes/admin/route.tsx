import { createFileRoute, Outlet } from "@tanstack/react-router";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { AdminAuthProvider } from "@/components/admin/auth";

// Área administrativa: renderizada só no cliente (a sessão do Supabase fica no
// navegador). A segurança dos dados é garantida pelo RLS no banco.
export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel | Tchê Piscinas" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminRoot,
});

function AdminRoot() {
  return (
    <HeroUIProvider locale="pt-BR">
      <ToastProvider placement="top-right" toastOffset={12} />
      <AdminAuthProvider>
        <Outlet />
      </AdminAuthProvider>
    </HeroUIProvider>
  );
}
