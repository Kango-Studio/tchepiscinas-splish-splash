import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "@heroui/react";
import { getSupabase } from "@/lib/supabase/client";
import type { Client } from "@/lib/visits/schema";
import type {
  Charge,
  ChargeFormValues,
  KitFormValues,
  KitPurchase,
  PaymentFormValues,
} from "@/lib/finance/schema";
import { describeDbError } from "./leads-api";
import { VISITS_KEYS } from "./visits-api";

export const FINANCE_KEYS = {
  all: ["admin", "finance"] as const,
  clientCharges: (clientId: string) => ["admin", "finance", "charges", clientId] as const,
  clientKits: (clientId: string) => ["admin", "finance", "kits", clientId] as const,
};

const STALE = 30_000;

// Com RLS, um update sem permissão não gera erro: apenas não afeta nada.
function assertAffected<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) throw { code: "42501" } satisfies Partial<PostgrestError>;
  return data;
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

export function useClientCharges(clientId: string) {
  return useQuery({
    queryKey: FINANCE_KEYS.clientCharges(clientId),
    staleTime: STALE,
    queryFn: async () => {
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
      return (data as KitPurchase[]).map((k) => ({ ...k, valor_total: Number(k.valor_total) }));
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
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.clients });
      toast.success("Pagamento atualizado", { description: client.name });
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
    onSuccess: (_id, { clientId, values }) => {
      void qc.invalidateQueries({ queryKey: FINANCE_KEYS.clientKits(clientId) });
      void qc.invalidateQueries({ queryKey: FINANCE_KEYS.clientCharges(clientId) });
      toast.success("Kit registrado", {
        description:
          values.parcelas === 1 ? "Parcela única gerada" : `${values.parcelas} parcelas geradas`,
      });
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
    onSuccess: (_row, { clientId, id }) => {
      void qc.invalidateQueries({ queryKey: FINANCE_KEYS.clientCharges(clientId) });
      toast.success(id ? "Cobrança atualizada" : "Cobrança lançada");
    },
  });
}

// Ações rápidas do histórico: marcar paga, cancelar, reabrir.
export function useUpdateChargeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      charge,
      patch,
    }: {
      charge: Charge;
      patch: Partial<Pick<Charge, "status" | "data_pagamento" | "data_envio_link">>;
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
    onSuccess: (_row, { charge, message }) => {
      void qc.invalidateQueries({ queryKey: FINANCE_KEYS.clientCharges(charge.cliente_id) });
      toast.success(message);
    },
  });
}
