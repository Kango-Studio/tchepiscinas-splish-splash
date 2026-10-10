import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import { LeadsPage, type LeadsView } from "@/components/admin/LeadsPage";
import { useAdminAuth } from "@/components/admin/auth";

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>): { view?: LeadsView } =>
    search.view === "lista" ? { view: "lista" } : {},
  component: AdminDashboard,
});

function AdminDashboard() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();
  const { view = "kanban" } = Route.useSearch();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <LeadsPage
        view={view}
        onViewChange={(v) =>
          navigate({ to: "/admin", search: v === "lista" ? { view: "lista" } : {}, replace: true })
        }
      />
    </AdminShell>
  );
}
