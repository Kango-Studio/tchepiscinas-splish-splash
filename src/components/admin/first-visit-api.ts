import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";

export const SALE_ITEMS = {
  plano: "Plano recorrente",
  servico: "Serviço avulso",
  kit: "Kit",
  produtos: "Produtos",
};
export type SaleItem = keyof typeof SALE_ITEMS;
export type Sale = {
  lead_id: string;
  client_id: string | null;
  address: string;
  pool_tech_id: string;
  expected_date: string | null;
  estimate: string | null;
  review_date: string | null;
  items: SaleItem[];
  plan_id: string | null;
  agreed_value: number;
  service_chargeable: boolean;
  confirmed_date: string | null;
  confirmed_at: string | null;
};
export type LinkTask = {
  lead_id: string;
  kind: "pagamento" | "produtos";
  due_date: string;
  sent_date: string | null;
};
export const reminderDate = (sale: Sale) => sale.expected_date ?? sale.review_date!;
export const saleSummary = (sale: Sale) => sale.items.map((item) => SALE_ITEMS[item]).join(" + ");
export function useSales() {
  return useQuery({
    queryKey: ["admin", "sales"],
    staleTime: 30_000,
    queryFn: async () => {
      const [sales, tasks] = await Promise.all([
        getSupabase().from("lead_sales").select("*"),
        getSupabase().from("sale_link_tasks").select("*"),
      ]);
      if (sales.error) throw sales.error;
      if (tasks.error) throw tasks.error;
      return { sales: sales.data as Sale[], tasks: tasks.data as LinkTask[] };
    },
  });
}
type Action =
  | {
      action: "schedule_first_visit";
      args: { p_lead_id: string; p_values: Record<string, unknown> };
    }
  | { action: "confirm_first_visit"; args: { p_lead_id: string; p_date: string } }
  | { action: "mark_sale_link_sent"; args: { p_lead_id: string; p_kind: string; p_date: string } };
export function useSaleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, args }: Action) => {
      const { error } = await getSupabase().rpc(action, args);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}
