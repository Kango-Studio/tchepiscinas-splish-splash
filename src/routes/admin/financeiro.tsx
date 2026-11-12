import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import { FinancePage } from "@/components/admin/FinancePage";
import { useAdminAuth } from "@/components/admin/auth";

// Primeira tela do painel: pendências financeiras.
export const Route = createFileRoute("/admin/financeiro")({
  component: AdminFinanceRoute,
});

function AdminFinanceRoute() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <FinancePage />
    </AdminShell>
  );
}
