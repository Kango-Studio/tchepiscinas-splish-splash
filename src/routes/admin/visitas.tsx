import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import {
  VISIT_PERIODS,
  VISIT_TABS,
  VisitsPage,
  type VisitFilters,
  type VisitPeriod,
  type VisitTab,
} from "@/components/admin/VisitsPage";
import { useAdminAuth } from "@/components/admin/auth";

export const Route = createFileRoute("/admin/visitas")({
  validateSearch: (search: Record<string, unknown>): VisitFilters => ({
    aba:
      VISIT_TABS.includes(search.aba as VisitTab) && search.aba !== "frequencia"
        ? (search.aba as VisitTab)
        : undefined,
    piscineiro:
      typeof search.piscineiro === "string" && search.piscineiro ? search.piscineiro : undefined,
    periodo: VISIT_PERIODS.includes(search.periodo as VisitPeriod)
      ? (search.periodo as VisitPeriod)
      : undefined,
  }),
  component: AdminVisitsRoute,
});

function AdminVisitsRoute() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const filters = Route.useSearch();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <VisitsPage
        filters={filters}
        onFiltersChange={(next) => navigate({ to: "/admin/visitas", search: next, replace: true })}
      />
    </AdminShell>
  );
}
