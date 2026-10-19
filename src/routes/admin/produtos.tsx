import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminStatusScreen } from "@/components/admin/AdminStatusScreen";
import { ProductsPage } from "@/components/admin/ProductsPage";
import { useAdminAuth } from "@/components/admin/auth";

export const Route = createFileRoute("/admin/produtos")({
  component: AdminProductsRoute,
});

function AdminProductsRoute() {
  const { state } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === "signed_out") navigate({ to: "/admin/login", replace: true });
  }, [state.status, navigate]);

  if (state.status !== "admin") return <AdminStatusScreen state={state} />;

  return (
    <AdminShell>
      <ProductsPage />
    </AdminShell>
  );
}
