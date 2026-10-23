import { useLayoutEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { I18nProvider } from "react-aria-components";
import { Toast } from "@heroui/react";
import { AdminAuthProvider } from "@/components/admin/auth";
// Tema HeroUI só no admin (carregado junto com o chunk desta rota).
import "../../admin.css";

// Área administrativa: renderizada só no cliente (a sessão do Supabase fica no
// navegador). A segurança dos dados é garantida pelo RLS no banco.
export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel | Tchê Piscinas" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoot,
});

// O tema fica no <html> para alcançar também os overlays (modais, popovers e
// toasts), que o React Aria renderiza fora da árvore, direto no <body>.
function useAdminTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = "tche-admin";
    return () => {
      delete root.dataset.theme;
    };
  }, []);
}

function AdminRoot() {
  useAdminTheme();
  return (
    <I18nProvider locale="pt-BR">
      <Toast.Provider placement="top end" />
      <AdminAuthProvider>
        <Outlet />
      </AdminAuthProvider>
    </I18nProvider>
  );
}
