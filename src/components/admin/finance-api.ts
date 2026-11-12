import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "@heroui/react";
import { getSupabase } from "@/lib/supabase/client";
import type { Client, OnboardingStage } from "@/lib/visits/schema";
import type {
  Charge,
  ChargeFormValues,
  KitFormValues,
  KitPurchase,
  PaymentFormValues,
} from "@/lib/finance/schema";
import type { StageDateField } from "@/lib/finance/onboarding";
import { describeDbError } from "./leads-api";
import { VISITS_KEYS } from "./visits-api";

export const FINANCE_KEYS = {
  all: ["admin", "finance"] as const,
  clientCharges: (clientId: string) => ["admin", "finance", "charges", clientId] as const,
  clientKits: (clientId: string) => ["admin", "finance", "kits", clientId] as const,
  pending: ["admin", "finance", "pending"] as const,
};

const STALE = 30_000;

// Com RLS, um update sem permissão não gera erro: apenas não afeta nada.
function assertAffected<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) throw { code: "42501" } satisfies Partial<PostgrestError>;
  return data;
}

// Gatilhos do banco mudam a etapa da esteira ao gravar cobranças: depois de
// qualquer gravação, recarrega o financeiro e os clientes.
function refresh(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: FINANCE_KEYS.all });
  void qc.invalidateQueries({ queryKey: VISITS_KEYS.clients });
}

// Mensagens específicas das travas do financeiro; o resto usa a padrão.
export function describeFinanceError(error: unknown): string {
  const e = error as Partial<PostgrestError> | undefined;
  if (e?.code === "23505") {
    if (e.message?.includes("mensalidade"))
      return "Já existe uma mensalidade deste cliente com esse vencimento.";
    if (e.message?.includes("parcela")) return "Essa parcela do kit já existe.";
  }
  return describeDbError(error);
}

const toCharge = (c: Charge): Charge => ({
  ...c,
  valor: Number(c.valor),
  dias_atraso: Number(c.dias_atraso),
});
const toKit = (k: KitPurchase): KitPurchase => ({ ...k, valor_total: Number(k.valor_total) });

// Lança as mensalidades recorrentes que faltam (de um cliente ou de todos).
async function generateFees(clientId?: string) {
  const gen = await getSupabase().rpc(
    "gerar_mensalidades",
    clientId ? { p_cliente_id: clientId } : {},
  );
  // PGRST202 = função ainda não criada (migration não aplicada): só lista.
  if (gen.error && gen.error.code !== "PGRST202") throw gen.error;
}

export function useClientCharges(clientId: string) {
  return useQuery({
    queryKey: FINANCE_KEYS.clientCharges(clientId),
    staleTime: STALE,
    queryFn: async () => {
      await generateFees(clientId);
      const { data, error } = await getSupabase()
        .from("cobrancas_situacao")
        .select("*")
        .eq("cliente_id", clientId)
        .order("vencimento", { ascending: false })
        .order("parcela_atual", { ascending: false });
      if (error) throw error;
      return (data as Charge[]).map(toCharge);
    },
  });
}

export function useClientKits(clientId: string) {
  return useQuery({
    queryKey: FINANCE_KEYS.clientKits(clientId),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("kit_compras")
        .select("*")
        .eq("cliente_id", clientId)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return (data as KitPurchase[]).map(toKit);
    },
  });
}

// Tela Financeiro: lança as mensalidades de todos e traz o que está em aberto
// e as compras de kit (volume pequeno).
export function usePendingFinance() {
  return useQuery({
    queryKey: FINANCE_KEYS.pending,
    staleTime: STALE,
    queryFn: async () => {
      await generateFees();
      const supabase = getSupabase();
      const [charges, kits] = await Promise.all([
        supabase
          .from("cobrancas_situacao")
          .select("*")
          .in("status", ["pendente", "link_enviado", "atrasado"])
          .order("vencimento"),
        supabase.from("kit_compras").select("*").order("data_compra", { ascending: false }),
      ]);
      if (charges.error) throw charges.error;
      if (kits.error) throw kits.error;
      return {
        charges: (charges.data as Charge[]).map(toCharge),
        kits: (kits.data as KitPurchase[]).map(toKit),
      };
    },
  });
}

export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ client, values }: { client: Client; values: PaymentFormValues }) => {
      const { data, error } = await getSupabase()
        .from("clients")
        .update(values)
        .eq("id", client.id)
        .select("*");
      if (error) throw error;
      return assertAffected(data)[0] as Client;
    },
    onSuccess: (client) => {
      // Recarregar as cobranças gera as mensalidades com a configuração nova.
      refresh(qc);
      toast.success("Pagamento atualizado", { description: client.name });
    },
  });
}

// Esteira: etapa atual e a data de cada etapa (edição manual).
export type OnboardingPatch = { etapa_onboarding?: OnboardingStage } & Partial<
  Record<StageDateField, string | null>
>;

export function useSaveOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      patch,
    }: {
      clientId: string;
      patch: OnboardingPatch;
      message?: string;
    }) => {
      const { data, error } = await getSupabase()
        .from("clients")
        .update(patch)
        .eq("id", clientId)
        .select("id");
      if (error) throw error;
      return assertAffected(data)[0];
    },
    onSuccess: (_row, { message }) => {
      refresh(qc);
      toast.success(message ?? "Esteira atualizada");
    },
  });
}

export function useRegisterKit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, values }: { clientId: string; values: KitFormValues }) => {
      const { data, error } = await getSupabase().rpc("registrar_kit", {
        p_cliente_id: clientId,
        p_valor_total: values.valor_total,
        p_parcelas: values.parcelas,
        p_data_compra: values.data_compra,
        p_primeiro_vencimento: values.primeiro_vencimento,
        p_primeira_paga: values.primeira_paga,
        p_observacao: values.observacao,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, { values }) => {
      refresh(qc);
      toast.success("Kit registrado", {
        description:
          values.parcelas === 1 ? "Parcela única gerada" : `${values.parcelas} parcelas geradas`,
      });
    },
  });
}

export function useMarkRefillOffered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kit, date }: { kit: KitPurchase; date: string }) => {
      const { data, error } = await getSupabase()
        .from("kit_compras")
        .update({ reposicao_oferecida_em: date })
        .eq("id", kit.id)
        .select("id");
      if (error) throw error;
      return assertAffected(data)[0];
    },
    onSuccess: () => {
      refresh(qc);
      toast.success("Reposição marcada como oferecida");
    },
  });
}

export function useSaveCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      id,
      values,
    }: {
      clientId: string;
      id?: string;
      values: ChargeFormValues;
    }) => {
      const table = getSupabase().from("cobrancas");
      const { data, error } = id
        ? await table.update(values).eq("id", id).select("id")
        : await table.insert({ ...values, cliente_id: clientId }).select("id");
      if (error) throw error;
      return assertAffected(data)[0];
    },
    onSuccess: (_row, { id }) => {
      refresh(qc);
      toast.success(id ? "Cobrança atualizada" : "Cobrança lançada");
    },
  });
}

// Ações rápidas: marcar paga, link enviado, cancelar.
export function useUpdateChargeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      charge,
      patch,
    }: {
      charge: Charge;
      patch: Partial<
        Pick<Charge, "status" | "data_pagamento" | "data_envio_link" | "link_pagamento">
      >;
      message: string;
    }) => {
      const { data, error } = await getSupabase()
        .from("cobrancas")
        .update(patch)
        .eq("id", charge.id)
        .select("id");
      if (error) throw error;
      return assertAffected(data)[0];
    },
    onSuccess: (_row, { message }) => {
      refresh(qc);
      toast.success(message);
    },
  });
}
