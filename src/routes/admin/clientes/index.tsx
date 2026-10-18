import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import {
  CLIENT_SITUATIONS,
  ClientsPage,
  type ClientFilters,
  type ClientSituation,
} from "@/components/admin/ClientsPage";
import { useAdminAuth } from "@/components/admin/auth";
import { FREQUENCY_STATUSES, type FrequencyStatus } from "@/lib/visits/schema";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/admin/clientes/")({
  // Filtros na URL: voltam iguais ao sair da página do cliente.
  validateSearch: (search: Record<string, unknown>): ClientFilters => ({
    q: str(search.q),
    situacao: CLIENT_SITUATIONS.includes(search.situacao as ClientSituation)
      ? (search.situacao as ClientSituation)
      : undefined,
    status: FREQUENCY_STATUSES.includes(search.status as FrequencyStatus)
      ? (search.status as FrequencyStatus)
      : undefined,
    piscineiro: str(search.piscineiro),
    plano: str(search.plano),
  }),
  component: AdminClientsRoute,
});

function AdminClientsRoute() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const filters = Route.useSearch();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <ClientsPage
        filters={filters}
        onFiltersChange={(next) => navigate({ to: "/admin/clientes", search: next, replace: true })}
      />
    </AdminShell>
  );
}
