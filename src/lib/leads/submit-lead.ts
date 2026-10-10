import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { publicLeadSchema, INTEREST_LABELS } from "./schema";
import { getServiceSupabase } from "@/lib/supabase/service.server";

export type SubmitLeadResult =
  | { ok: true }
  | {
      ok: false;
      code: "too_fast" | "rate_limited" | "not_configured" | "server_error";
      message: string;
    };

const MIN_FILL_TIME_MS = 2500;
const IP_WINDOW_MIN = 15;
const IP_MAX_ATTEMPTS = 5;
const PHONE_WINDOW_MIN = 60;
const PHONE_MAX_ATTEMPTS = 3;
const DEDUP_WINDOW_HOURS = 24;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function minutesAgo(min: number) {
  return new Date(Date.now() - min * 60_000).toISOString();
}

// Envio público do formulário de orçamento. Roda apenas no servidor e grava
// com service_role; o navegador nunca tem permissão direta na tabela leads.
export const submitSiteLead = createServerFn({ method: "POST" })
  .validator((input: unknown) => publicLeadSchema.parse(input))
  .handler(async ({ data }): Promise<SubmitLeadResult> => {
    // Honeypot preenchido: responde como sucesso sem gravar nada.
    if (data.website) return { ok: true };

    if (data.elapsed_ms < MIN_FILL_TIME_MS) {
      return {
        ok: false,
        code: "too_fast",
        message: "Envio muito rápido. Confira os dados e tente de novo.",
      };
    }

    const supabase = getServiceSupabase();
    if (!supabase) {
      console.error("[leads] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes no servidor");
      return {
        ok: false,
        code: "not_configured",
        message: "Não foi possível enviar agora. Fale com a gente pelo WhatsApp.",
      };
    }

    try {
      // Só confia no header da plataforma em que está rodando: fora dela o
      // visitante pode forjá-lo e burlar o limite por IP.
      const ip =
        (process.env.VERCEL
          ? getRequestHeader("x-real-ip")
          : getRequestHeader("cf-connecting-ip")) ??
        getRequestIP({ xForwardedFor: true }) ??
        "unknown";
      const ipHash = await sha256(`${process.env.LEAD_RATE_LIMIT_SALT ?? "tche-piscinas"}:${ip}`);

      const [ipAttempts, phoneAttempts] = await Promise.all([
        supabase
          .from("lead_submission_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", minutesAgo(IP_WINDOW_MIN)),
        supabase
          .from("lead_submission_attempts")
          .select("id", { count: "exact", head: true })
          .eq("whatsapp", data.whatsapp)
          .gte("created_at", minutesAgo(PHONE_WINDOW_MIN)),
      ]);
      if (ipAttempts.error) throw ipAttempts.error;
      if (phoneAttempts.error) throw phoneAttempts.error;

      if (
        (ipAttempts.count ?? 0) >= IP_MAX_ATTEMPTS ||
        (phoneAttempts.count ?? 0) >= PHONE_MAX_ATTEMPTS
      ) {
        return {
          ok: false,
          code: "rate_limited",
          message:
            "Recebemos muitos envios em pouco tempo. Tente novamente mais tarde ou chame no WhatsApp.",
        };
      }

      const attempt = await supabase
        .from("lead_submission_attempts")
        .insert({ ip_hash: ipHash, whatsapp: data.whatsapp });
      if (attempt.error) throw attempt.error;

      // Mesmo número enviado recentemente: não duplica o lead.
      const recent = await supabase
        .from("leads")
        .select("id")
        .eq("whatsapp", data.whatsapp)
        .gte("created_at", minutesAgo(DEDUP_WINDOW_HOURS * 60))
        .limit(1);
      if (recent.error) throw recent.error;
      if (recent.data.length > 0) return { ok: true };

      const initialMessage = [
        "Pedido de orçamento enviado pelo formulário do site.",
        `Interesse: ${INTEREST_LABELS[data.interest]}.`,
        data.cta ? `Botão: "${data.cta}".` : null,
      ]
        .filter(Boolean)
        .join(" ");

      const insert = await supabase.from("leads").insert({
        name: data.name,
        whatsapp: data.whatsapp,
        city: data.city,
        interest: data.interest,
        client_type: data.client_type ?? "outro",
        source: "site",
        stage: "novo",
        initial_message: initialMessage,
      });
      if (insert.error) throw insert.error;

      // Limpeza ocasional das tentativas antigas.
      if (Math.random() < 0.05) {
        await supabase
          .from("lead_submission_attempts")
          .delete()
          .lt("created_at", minutesAgo(60 * 24 * 2));
      }

      return { ok: true };
    } catch (error) {
      console.error("[leads] falha ao salvar lead do site", error);
      return {
        ok: false,
        code: "server_error",
        message: "Não conseguimos salvar teu pedido agora. Tente novamente ou chame no WhatsApp.",
      };
    }
  });
