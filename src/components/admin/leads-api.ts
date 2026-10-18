import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "@heroui/react";
import { getSupabase } from "@/lib/supabase/client";
import { STAGE_LABELS, type Lead, type LeadFormValues, type LeadStage } from "@/lib/leads/schema";

export const LEADS_QUERY_KEY = ["admin", "leads"] as const;
const PAGE = 1000;

export function describeDbError(error: unknown): string {
  const e = error as Partial<PostgrestError> | undefined;
  if (e?.code === "PGRST116" || e?.code === "42501") {
    return "Sem permissão para esta operação ou o registro não existe mais.";
  }
  if (e?.code === "23514") return "Algum campo está fora do formato aceito.";
  if (e?.code === "23505") return "Já existe um cadastro com esse nome.";
  if (e?.code === "23503") return "Não é possível excluir: há registros ligados a este cadastro.";
  if (e?.message?.toLowerCase().includes("jwt")) return "Sessão expirada. Entre novamente.";
  if (e?.message?.toLowerCase().includes("failed to fetch")) return "Sem conexão com o servidor.";
  return "Ocorreu um erro inesperado. Tente novamente.";
}

async function fetchAllLeads(): Promise<Lead[]> {
  const supabase = getSupabase();
  const all: Lead[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data as Lead[]));
    if (data.length < PAGE) return all;
  }
}

export function useLeads() {
  return useQuery({ queryKey: LEADS_QUERY_KEY, queryFn: fetchAllLeads, staleTime: 30_000 });
}

export async function findLeadsByPhone(whatsapp: string, excludeId?: string) {
  let query = getSupabase()
    .from("leads")
    .select("id, name, stage, created_at")
    .eq("whatsapp", whatsapp)
    .order("created_at", { ascending: false })
    .limit(5);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data as Pick<Lead, "id" | "name" | "stage" | "created_at">[];
}

function upsertInCache(list: Lead[] | undefined, lead: Lead): Lead[] {
  if (!list) return [lead];
  const exists = list.some((l) => l.id === lead.id);
  const next = exists ? list.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...list];
  return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: LeadFormValues) => {
      const { data, error } = await getSupabase().from("leads").insert(values).select("*").single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: (lead) => {
      qc.setQueryData<Lead[]>(LEADS_QUERY_KEY, (list) => upsertInCache(list, lead));
      toast.success("Lead cadastrado", { description: lead.name });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: LeadFormValues }) => {
      const { data, error } = await getSupabase()
        .from("leads")
        .update(values)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Lead;
    },
    onSuccess: (lead) => {
      qc.setQueryData<Lead[]>(LEADS_QUERY_KEY, (list) => upsertInCache(list, lead));
      toast.success("Alterações salvas", { description: lead.name });
    },
  });
}

// Mudança de etapa com atualização otimista. Em caso de falha, só este lead
// volta para a etapa anterior (sem desfazer outras movimentações).
export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LeadStage; previous: LeadStage }) => {
      const { data, error } = await getSupabase()
        .from("leads")
        .update({ stage })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Lead;
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: LEADS_QUERY_KEY });
      qc.setQueryData<Lead[]>(LEADS_QUERY_KEY, (list) =>
        list?.map((l) => (l.id === id ? { ...l, stage } : l)),
      );
    },
    onError: (error, { id, stage, previous }) => {
      qc.setQueryData<Lead[]>(LEADS_QUERY_KEY, (list) =>
        list?.map((l) => (l.id === id && l.stage === stage ? { ...l, stage: previous } : l)),
      );
      toast.danger("Não foi possível mover o lead", {
        description: `${describeDbError(error)} O card voltou para "${STAGE_LABELS[previous]}".`,
      });
    },
    onSuccess: (lead, { stage }) => {
      qc.setQueryData<Lead[]>(LEADS_QUERY_KEY, (list) =>
        list?.map((l) => (l.id === lead.id && l.stage === stage ? lead : l)),
      );
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Lead) => {
      const { data, error } = await getSupabase()
        .from("leads")
        .delete()
        .eq("id", lead.id)
        .select("id");
      if (error) throw error;
      // Com RLS, um delete sem permissão não gera erro: apenas não remove nada.
      if (!data || data.length === 0) throw { code: "42501" } satisfies Partial<PostgrestError>;
      return lead;
    },
    onSuccess: (lead) => {
      qc.setQueryData<Lead[]>(LEADS_QUERY_KEY, (list) => list?.filter((l) => l.id !== lead.id));
      toast.success("Lead excluído", { description: lead.name });
    },
  });
}
