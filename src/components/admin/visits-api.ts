import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { toast } from "@heroui/react";
import { getSupabase } from "@/lib/supabase/client";
import { isNotFoundError } from "./leads-api";
import type {
  Client,
  ClientFormValues,
  ClientFrequency,
  LateCase,
  LateCaseFormValues,
  Plan,
  PlanFormValues,
  PoolTech,
  PoolTechFormValues,
  Product,
  ProductFormValues,
  ProductUsage,
  ReportSend,
  UsageFormValues,
  Visit,
  VisitFormValues,
  VisitRate,
} from "@/lib/visits/schema";

// Chaves do React Query. Tudo sob "admin" para sair junto no logout.
export const VISITS_KEYS = {
  plans: ["admin", "plans"] as const,
  poolTechs: ["admin", "pool-techs"] as const,
  clients: ["admin", "clients"] as const,
  frequency: ["admin", "client-frequency"] as const,
  visitRates: ["admin", "visit-rates"] as const,
  clientVisits: (clientId: string) => ["admin", "visits", "client", clientId] as const,
  visitsInRange: (from: string, to: string, techId?: string) =>
    ["admin", "visits", "range", from, to, techId ?? "all"] as const,
  visits: ["admin", "visits"] as const,
  recentVisits: ["admin", "visits", "recent"] as const,
  visit: (id: string) => ["admin", "visits", "detail", id] as const,
  clientLateCases: (clientId: string) => ["admin", "late-cases", "client", clientId] as const,
  lateCases: ["admin", "late-cases"] as const,
  reportSends: (kind: string, periodStart: string) =>
    ["admin", "report-sends", kind, periodStart] as const,
};

const STALE = 30_000;

// Com RLS, um update/delete sem permissão não gera erro: apenas não afeta nada.
function assertAffected<T>(data: T[] | null): T[] {
  if (!data || data.length === 0) throw { code: "42501" } satisfies Partial<PostgrestError>;
  return data;
}

export function usePlans() {
  return useQuery({
    queryKey: VISITS_KEYS.plans,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("plans")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data as Plan[];
    },
  });
}

export function usePoolTechs() {
  return useQuery({
    queryKey: VISITS_KEYS.poolTechs,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("pool_techs").select("*").order("name");
      if (error) throw error;
      return data as PoolTech[];
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: VISITS_KEYS.clients,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClientFrequency() {
  return useQuery({
    queryKey: VISITS_KEYS.frequency,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("client_frequency").select("*");
      if (error) throw error;
      return data as ClientFrequency[];
    },
  });
}

// Histórico do valor por visita (cada valor vale a partir de um mês).
export function useVisitRates() {
  return useQuery({
    queryKey: VISITS_KEYS.visitRates,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("visit_rates")
        .select("month, rate")
        .order("month");
      if (error) throw error;
      return (data as VisitRate[]).map((r) => ({ ...r, rate: Number(r.rate) }));
    },
  });
}

export function useClientVisits(clientId: string) {
  return useQuery({
    queryKey: VISITS_KEYS.clientVisits(clientId),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("visits")
        .select("*")
        .eq("client_id", clientId)
        .order("visit_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Visit[];
    },
  });
}

// Todos os casos de atraso. Antes de ler, abre os casos dos clientes que
// passaram a Atrasado (não depende de tarefa agendada: roda ao carregar).
export function useLateCases() {
  return useQuery({
    queryKey: VISITS_KEYS.lateCases,
    staleTime: STALE,
    queryFn: async () => {
      const supabase = getSupabase();
      const { error: syncError } = await supabase.rpc("sync_late_cases");
      if (syncError) throw syncError;
      const { data, error } = await supabase
        .from("late_cases")
        .select("*")
        .order("late_since", { ascending: false });
      if (error) throw error;
      return data as LateCase[];
    },
  });
}

export function useRegisterContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lateCase,
      values,
    }: {
      lateCase: LateCase;
      values: LateCaseFormValues;
    }) => {
      const { data, error } = await getSupabase()
        .from("late_cases")
        .update({
          ...values,
          status: "acionado",
          // Editar o motivo depois mantém a data do primeiro acionamento.
          contacted_at: lateCase.contacted_at ?? new Date().toISOString(),
        })
        .eq("id", lateCase.id)
        // Só casos ainda abertos (uma visita pode ter fechado o caso).
        .in("status", ["pendente", "acionado"])
        .select("*");
      if (error) throw error;
      return assertAffected(data)[0] as LateCase;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.lateCases });
      toast.success("Acionamento registrado");
    },
  });
}

// Envios de um relatório num período (ex.: pendentes da semana).
export function useReportSends(kind: ReportSend["kind"], periodStart: string) {
  return useQuery({
    queryKey: VISITS_KEYS.reportSends(kind, periodStart),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("report_sends")
        .select("*")
        .eq("kind", kind)
        .eq("period_start", periodStart);
      if (error) throw error;
      return data as ReportSend[];
    },
  });
}

type ReportTarget = Pick<ReportSend, "kind" | "period_start" | "period_end"> &
  ({ pool_tech_id: string; client_id?: null } | { client_id: string; pool_tech_id?: null });

// Registra o envio (só o registro: a imagem não é guardada).
export function useMarkReportSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: ReportTarget) => {
      const { data, error } = await getSupabase()
        .from("report_sends")
        .insert({ pool_tech_id: null, client_id: null, ...target })
        .select("*");
      // Já registrado (outro clique ou outra aba): não é erro.
      if (error?.code === "23505") return null;
      if (error) throw error;
      return assertAffected(data)[0] as ReportSend;
    },
    onSuccess: (_send, target) => {
      void qc.invalidateQueries({
        queryKey: VISITS_KEYS.reportSends(target.kind, target.period_start),
      });
    },
  });
}

export function useUnmarkReportSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (send: ReportSend) => {
      const { data, error } = await getSupabase()
        .from("report_sends")
        .delete()
        .eq("id", send.id)
        .select("id");
      if (error) throw error;
      assertAffected(data);
      return send;
    },
    onSuccess: (send) => {
      void qc.invalidateQueries({
        queryKey: VISITS_KEYS.reportSends(send.kind, send.period_start),
      });
      toast.success("Envio desfeito");
    },
  });
}

export function useClientLateCases(clientId: string) {
  return useQuery({
    queryKey: VISITS_KEYS.clientLateCases(clientId),
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("late_cases")
        .select("*")
        .eq("client_id", clientId)
        .order("late_since", { ascending: false });
      if (error) throw error;
      return data as LateCase[];
    },
  });
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export function useSaveClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ClientFormValues }) => {
      const table = getSupabase().from("clients");
      const { data, error } = id
        ? await table.update(values).eq("id", id).select("*")
        : await table.insert(values).select("*");
      if (error) throw error;
      return assertAffected(data)[0] as Client;
    },
    onSuccess: (client, { id }) => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.clients });
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.frequency });
      toast.success(id ? "Alterações salvas" : "Cliente cadastrado", { description: client.name });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: Client) => {
      const { data, error } = await getSupabase()
        .from("clients")
        .delete()
        .eq("id", client.id)
        .select("id");
      if (error) throw error;
      assertAffected(data);
      return client;
    },
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.clients });
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.frequency });
      toast.success("Cliente excluído", { description: client.name });
    },
  });
}

// ---------------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------------

// Visitas por data da visita (inclusive), mais recentes primeiro.
export function useVisitsInRange({
  from,
  to,
  techId,
}: {
  from: string;
  to: string;
  techId?: string;
}) {
  return useQuery({
    queryKey: VISITS_KEYS.visitsInRange(from, to, techId),
    staleTime: STALE,
    queryFn: async () => {
      const all: Visit[] = [];
      for (let start = 0; ; start += 1000) {
        let query = getSupabase()
          .from("visits")
          .select("*")
          .gte("visit_date", from)
          .lte("visit_date", to)
          .order("visit_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(start, start + 999);
        if (techId) query = query.eq("pool_tech_id", techId);
        const { data, error } = await query;
        if (error) throw error;
        all.push(...(data as Visit[]));
        if (data.length < 1000) return all;
      }
    },
  });
}

// Últimas visitas lançadas (pela hora do registro, não pela data da visita).
export function useRecentVisits(limit = 3) {
  return useQuery({
    queryKey: VISITS_KEYS.recentVisits,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("visits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Visit[];
    },
  });
}

// Visita aberta pela URL (?visita=<id>): sempre busca no banco. null = não existe.
export function useVisit(id: string | undefined) {
  return useQuery({
    queryKey: VISITS_KEYS.visit(id ?? ""),
    enabled: !!id,
    staleTime: 0,
    retry: (count, error) => !isNotFoundError(error) && count < 2,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("visits")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (isNotFoundError(error)) return null;
      if (error) throw error;
      return data as Visit | null;
    },
  });
}

// Outras visitas do cliente na mesma data (aviso de visita repetida).
export async function findSameDayVisits(clientId: string, date: string, excludeId?: string) {
  let query = getSupabase()
    .from("visits")
    .select("id, pool_tech_id, created_at")
    .eq("client_id", clientId)
    .eq("visit_date", date);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data as Pick<Visit, "id" | "pool_tech_id" | "created_at">[];
}

// Toda mudança em visitas recalcula frequência e pode fechar casos de atraso.
function invalidateVisitData(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: VISITS_KEYS.visits });
  void qc.invalidateQueries({ queryKey: VISITS_KEYS.frequency });
  void qc.invalidateQueries({ queryKey: VISITS_KEYS.lateCases });
}

export function useSaveVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: VisitFormValues }) => {
      const table = getSupabase().from("visits");
      const { data, error } = id
        ? await table.update(values).eq("id", id).select("*")
        : await table.insert(values).select("*");
      if (error) throw error;
      return assertAffected(data)[0] as Visit;
    },
    onSuccess: (_visit, { id }) => {
      invalidateVisitData(qc);
      toast.success(id ? "Visita atualizada" : "Visita registrada");
    },
  });
}

export function useDeleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (visit: Visit) => {
      const { data, error } = await getSupabase()
        .from("visits")
        .delete()
        .eq("id", visit.id)
        .select("id");
      if (error) throw error;
      assertAffected(data);
      return visit;
    },
    onSuccess: () => {
      invalidateVisitData(qc);
      toast.success("Visita excluída");
    },
  });
}

// ---------------------------------------------------------------------------
// Configurações: planos, piscineiros e valor por visita
// ---------------------------------------------------------------------------

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PlanFormValues }) => {
      const table = getSupabase().from("plans");
      let result;
      if (id) {
        result = await table.update(values).eq("id", id).select("*");
      } else {
        // Plano novo vai para o fim da lista.
        const plans = qc.getQueryData<Plan[]>(VISITS_KEYS.plans) ?? [];
        const sort_order = Math.max(0, ...plans.map((p) => p.sort_order)) + 1;
        result = await table.insert({ ...values, sort_order }).select("*");
      }
      if (result.error) throw result.error;
      return assertAffected(result.data)[0] as Plan;
    },
    onSuccess: (plan, { id }) => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.plans });
      // Mudar as faixas muda o status de todos os clientes do plano.
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.frequency });
      toast.success(id ? "Plano atualizado" : "Plano cadastrado", { description: plan.name });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Plan) => {
      const { data, error } = await getSupabase()
        .from("plans")
        .delete()
        .eq("id", plan.id)
        .select("id");
      if (error) throw error;
      assertAffected(data);
      return plan;
    },
    onSuccess: (plan) => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.plans });
      toast.success("Plano excluído", { description: plan.name });
    },
  });
}

export function useSavePoolTech() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: PoolTechFormValues }) => {
      const table = getSupabase().from("pool_techs");
      const { data, error } = id
        ? await table.update(values).eq("id", id).select("*")
        : await table.insert(values).select("*");
      if (error) throw error;
      return assertAffected(data)[0] as PoolTech;
    },
    onSuccess: (tech, { id }) => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.poolTechs });
      toast.success(id ? "Piscineiro atualizado" : "Piscineiro cadastrado", {
        description: tech.name,
      });
    },
  });
}

// Novo valor a partir de um mês (atual ou futuro; o banco recusa meses passados).
export function useSaveVisitRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: VisitRate) => {
      const { data, error } = await getSupabase()
        .from("visit_rates")
        .upsert(values, { onConflict: "month" })
        .select("month, rate");
      if (error) throw error;
      return assertAffected(data)[0] as VisitRate;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.visitRates });
      toast.success("Valor por visita atualizado");
    },
  });
}

// Cancela um valor agendado para um mês futuro.
export function useDeleteVisitRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rate: VisitRate) => {
      const { data, error } = await getSupabase()
        .from("visit_rates")
        .delete()
        .eq("month", rate.month)
        .select("month");
      if (error) throw error;
      assertAffected(data);
      return rate;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: VISITS_KEYS.visitRates });
      toast.success("Mudança de valor cancelada");
    },
  });
}

// ---------------------------------------------------------------------------
// Produtos e gasto por piscineiro
// ---------------------------------------------------------------------------

export const PRODUCT_KEYS = {
  products: ["admin", "products"] as const,
  usages: ["admin", "product-usages"] as const,
};

export function useProducts() {
  return useQuery({
    queryKey: PRODUCT_KEYS.products,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("products").select("*").order("name");
      if (error) throw error;
      return (data as Product[]).map((p) => ({
        ...p,
        unit_price: p.unit_price === null ? null : Number(p.unit_price),
      }));
    },
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: ProductFormValues }) => {
      const table = getSupabase().from("products");
      const { data, error } = id
        ? await table.update(values).eq("id", id).select("*")
        : await table.insert(values).select("*");
      if (error) throw error;
      return assertAffected(data)[0] as Product;
    },
    onSuccess: (product, { id }) => {
      void qc.invalidateQueries({ queryKey: PRODUCT_KEYS.products });
      toast.success(id ? "Produto atualizado" : "Produto cadastrado", {
        description: product.name,
      });
    },
  });
}

// Todos os lançamentos (volume pequeno: algumas dezenas por mês).
export function useProductUsages() {
  return useQuery({
    queryKey: PRODUCT_KEYS.usages,
    staleTime: STALE,
    queryFn: async () => {
      const all: ProductUsage[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await getSupabase()
          .from("product_usages")
          .select("*")
          .order("used_on", { ascending: false })
          .order("created_at", { ascending: false })
          .range(start, start + 999);
        if (error) throw error;
        all.push(...(data as ProductUsage[]).map((u) => ({ ...u, quantity: Number(u.quantity) })));
        if (data.length < 1000) return all;
      }
    },
  });
}

export function useSaveUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: UsageFormValues }) => {
      const table = getSupabase().from("product_usages");
      const { data, error } = id
        ? await table.update(values).eq("id", id).select("*")
        : await table.insert(values).select("*");
      if (error) throw error;
      return assertAffected(data)[0] as ProductUsage;
    },
    onSuccess: (_usage, { id }) => {
      void qc.invalidateQueries({ queryKey: PRODUCT_KEYS.usages });
      toast.success(id ? "Lançamento atualizado" : "Gasto lançado");
    },
  });
}

export function useDeleteUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (usage: ProductUsage) => {
      const { data, error } = await getSupabase()
        .from("product_usages")
        .delete()
        .eq("id", usage.id)
        .select("id");
      if (error) throw error;
      assertAffected(data);
      return usage;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PRODUCT_KEYS.usages });
      toast.success("Lançamento excluído");
    },
  });
}
