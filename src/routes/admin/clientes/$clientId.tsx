import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import { ClientDetailPage } from "@/components/admin/ClientDetailPage";
import { useAdminAuth } from "@/components/admin/auth";

export const Route = createFileRoute("/admin/clientes/$clientId")({
  // ?visita=<id> abre a visita para editar.
  validateSearch: (search: Record<string, unknown>): { visita?: string } => ({
    visita: typeof search.visita === "string" && search.visita ? search.visita : undefined,
  }),
  component: AdminClientRoute,
});

function AdminClientRoute() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const { clientId } = Route.useParams();
  const { visita } = Route.useSearch();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <ClientDetailPage
        key={clientId}
        clientId={clientId}
        visitId={visita}
        onVisitChange={(id) =>
          navigate({
            to: "/admin/clientes/$clientId",
            params: { clientId },
            search: { visita: id },
            replace: true,
          })
        }
      />
    </AdminShell>
  );
}
