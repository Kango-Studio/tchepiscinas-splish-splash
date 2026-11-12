import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import { ClientDetailPage } from "@/components/admin/ClientDetailPage";
import { useAdminAuth } from "@/components/admin/auth";

// ?visita=<id> abre a visita para editar. ?aba=financeiro abre a aba Financeiro.
type ClientSearch = { visita?: string; aba?: "financeiro" };

export const Route = createFileRoute("/admin/clientes/$clientId")({
  validateSearch: (search: Record<string, unknown>): ClientSearch => ({
    visita: typeof search.visita === "string" && search.visita ? search.visita : undefined,
    aba: search.aba === "financeiro" ? "financeiro" : undefined,
  }),
  component: AdminClientRoute,
});

function AdminClientRoute() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const { clientId } = Route.useParams();
  const { visita, aba } = Route.useSearch();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  const setSearch = (patch: ClientSearch) =>
    navigate({
      to: "/admin/clientes/$clientId",
      params: { clientId },
      search: { visita, aba, ...patch },
      replace: true,
    });

  return (
    <AdminShell>
      <ClientDetailPage
        key={clientId}
        clientId={clientId}
        visitId={visita}
        onVisitChange={(id) => setSearch({ visita: id })}
        tab={aba ?? "geral"}
        onTabChange={(tab) => setSearch({ aba: tab === "financeiro" ? "financeiro" : undefined })}
      />
    </AdminShell>
  );
}
