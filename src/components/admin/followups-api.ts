import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "@heroui/react";
import { getSupabase } from "@/lib/supabase/client";
import type { LeadFollowup } from "@/lib/leads/schema";
import { describeDbError } from "./leads-api";

export const FOLLOWUPS_QUERY_KEY = ["admin", "lead_followups"] as const;
const PAGE = 1000;
const EMPTY: LeadFollowup[] = [];

async function fetchAllFollowups(): Promise<LeadFollowup[]> {
  const supabase = getSupabase();
  const all: LeadFollowup[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("lead_followups")
      .select("*")
      .order("done_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data as LeadFollowup[]));
    if (data.length < PAGE) return all;
  }
}

// Todos os follow-ups (relatórios do dashboard). Mesma consulta e cache dos cards.
export function useAllFollowups() {
  return useQuery({ queryKey: FOLLOWUPS_QUERY_KEY, queryFn: fetchAllFollowups, staleTime: 30_000 });
}

const byDoneAt = (a: LeadFollowup, b: LeadFollowup) => a.done_at.localeCompare(b.done_at);

// Uma única consulta para todos os follow-ups; cada card lê só os do seu lead.
export function useLeadFollowups(leadId: string) {
  const query = useQuery({
    queryKey: FOLLOWUPS_QUERY_KEY,
    queryFn: fetchAllFollowups,
    staleTime: 30_000,
    select: (list) => list.filter((f) => f.lead_id === leadId),
  });
  return { ...query, followups: query.data ?? EMPTY };
}

export function useAddFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { lead_id: string; done_at: string; note: string | null }) => {
      const { data, error } = await getSupabase()
        .from("lead_followups")
        .insert(values)
        .select("*")
        .single();
      if (error) throw error;
      return data as LeadFollowup;
    },
    onSuccess: (followup) => {
      qc.setQueryData<LeadFollowup[]>(FOLLOWUPS_QUERY_KEY, (list) =>
        [...(list ?? []), followup].sort(byDoneAt),
      );
      toast.success("Follow-up registrado");
    },
    onError: (error) => {
      toast.danger("Não foi possível registrar o follow-up", {
        description: describeDbError(error),
      });
    },
  });
}

export function useRemoveFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (followup: LeadFollowup) => {
      const { data, error } = await getSupabase()
        .from("lead_followups")
        .delete()
        .eq("id", followup.id)
        .select("id");
      if (error) throw error;
      // Com RLS, um delete sem permissão não gera erro: apenas não remove nada.
      if (!data || data.length === 0) throw { code: "42501" } satisfies Partial<PostgrestError>;
      return followup;
    },
    onSuccess: (followup) => {
      qc.setQueryData<LeadFollowup[]>(FOLLOWUPS_QUERY_KEY, (list) =>
        list?.filter((f) => f.id !== followup.id),
      );
      toast.success("Follow-up removido");
    },
    onError: (error) => {
      toast.danger("Não foi possível remover o follow-up", { description: describeDbError(error) });
    },
  });
}
