import { useCallback, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import { LeadsPage, type LeadsView } from "@/components/admin/LeadsPage";
import { useAdminAuth } from "@/components/admin/auth";

type LeadsSearch = { view?: LeadsView; lead?: string };

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>): LeadsSearch => ({
    view: search.view === "lista" ? "lista" : undefined,
    // ?lead=<id> abre o pop-up do lead (link direto, recarregar a página).
    lead: typeof search.lead === "string" && search.lead ? search.lead : undefined,
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const { view = "kanban", lead } = Route.useSearch();
  const setSearch = useCallback(
    (patch: LeadsSearch) =>
      navigate({
        to: "/admin",
        search: (prev: LeadsSearch) => ({ ...prev, ...patch }),
        replace: true,
      }),
    [navigate],
  );

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <LeadsPage
        view={view}
        onViewChange={(v) => setSearch({ view: v === "lista" ? "lista" : undefined })}
        leadId={lead}
        onLeadChange={(id) => setSearch({ lead: id })}
      />
    </AdminShell>
  );
}
