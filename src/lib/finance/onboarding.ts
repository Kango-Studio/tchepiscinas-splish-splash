import { ONBOARDING_STAGES, type Client, type OnboardingStage } from "@/lib/visits/schema";

// Esteira do cliente novo (migration 20261112160000_financeiro_esteira.sql).

export const STAGE_LABELS: Record<OnboardingStage, string> = {
  venda_fechada: "Venda fechada",
  kit_pago: "Kit pago",
  aguardando_link: "1ª visita realizada",
  link_enviado: "Link da mensalidade enviado",
  ativo: "Mensalidade paga (ativo)",
};

// Texto curto da etapa ATUAL (o que falta fazer).
export const STAGE_STATUS: Record<OnboardingStage, string> = {
  venda_fechada: "Aguardando kit",
  kit_pago: "Aguardando 1ª visita",
  aguardando_link: "Aguardando envio do link",
  link_enviado: "Aguardando pagamento",
  ativo: "Ativo",
};

export const STAGE_DATE_FIELD = {
  venda_fechada: "venda_fechada_em",
  kit_pago: "kit_pago_em",
  aguardando_link: "primeira_visita_em",
  link_enviado: "link_enviado_em",
  ativo: "ativo_em",
} as const satisfies Record<OnboardingStage, keyof Client>;

export type StageDateField = (typeof STAGE_DATE_FIELD)[OnboardingStage];

export const stageIndex = (stage: OnboardingStage) => ONBOARDING_STAGES.indexOf(stage);

export const STAGE_CHIP: Record<OnboardingStage, string> = {
  venda_fechada: "bg-slate-100 text-slate-700",
  kit_pago: "bg-sky-100 text-sky-800",
  aguardando_link: "bg-red-100 text-red-800",
  link_enviado: "bg-amber-100 text-amber-900",
  ativo: "bg-emerald-100 text-emerald-800",
};
