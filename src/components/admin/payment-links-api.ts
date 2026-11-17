import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";

export type LinkAction =
  "abriu_gerente" | "confirmou_solicitacao" | "recebeu_link" | "abriu_cliente" | "confirmou_envio";

export type LinkEvent = {
  id: number;
  cobranca_id: string;
  operacao_id: string;
  acao: LinkAction;
  registrado_em: string;
  registrado_por: string;
  mensagem: string | null;
  link: string | null;
};

const managerKey = ["admin", "payment-links", "manager"] as const;

export function useManagerWhatsApp() {
  return useQuery({
    queryKey: managerKey,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("app_settings")
        .select("whatsapp_gerente")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data.whatsapp_gerente as string | null;
    },
  });
}

export function useSaveManagerWhatsApp() {
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (whatsapp: string | null) => {
      const { data, error } = await getSupabase()
        .from("app_settings")
        .update({ whatsapp_gerente: whatsapp })
        .eq("id", true)
        .select("whatsapp_gerente")
        .single();
      if (error) throw error;
      return data.whatsapp_gerente as string | null;
    },
    onSuccess: (whatsapp) => queries.setQueryData(managerKey, whatsapp),
  });
}

export function usePaymentLinkEvents(clientId: string) {
  return useQuery({
    queryKey: ["admin", "payment-links", "events", clientId],
    queryFn: async () => {
      const history: LinkEvent[] = [];
      let before: number | undefined;
      for (;;) {
        const query = getSupabase()
          .from("cobranca_link_eventos")
          .select(
            "id,cobranca_id,operacao_id,acao,registrado_em,registrado_por,mensagem,link,cobrancas!inner(cliente_id)",
          )
          .eq("cobrancas.cliente_id", clientId)
          .order("id", { ascending: false })
          .limit(500);
        if (before !== undefined) query.lt("id", before);
        const { data, error } = await query;
        if (error) throw error;
        const page = data as LinkEvent[];
        history.push(...page);
        if (page.length < 500) return history;
        before = page[page.length - 1].id;
      }
    },
  });
}

export function usePaymentLinkAction(clientId: string) {
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      ids,
      operation,
      data,
    }: {
      action: LinkAction;
      ids: string[];
      operation: string;
      data?: Record<string, unknown>;
    }) => {
      const { error } = await getSupabase().rpc("registrar_fluxo_link", {
        p_cliente_id: clientId,
        p_cobrancas: ids,
        p_acao: action,
        p_operacao_id: operation,
        p_dados: data ?? {},
      });
      if (error) throw error;
    },
    onSettled: async () => {
      await queries.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

export function paymentLinkError(error: unknown) {
  const failure = error as { code?: string; message?: string } | null;
  if (failure?.code === "P0001" && failure.message) return failure.message;
  if (failure?.code === "42501") return "Sua sessão precisa de acesso de administrador.";
  return "Não foi possível salvar. Confira a conexão e tente novamente.";
}
