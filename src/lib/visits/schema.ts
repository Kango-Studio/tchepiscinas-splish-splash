import { z } from "zod";
import { normalizeBrazilPhone } from "@/lib/leads/phone";
import { format } from "date-fns";
import { SERVICE_KEYS, type ServiceKey } from "./services";

// Tabelas da migration 20261016140000_visitas.sql.

export type Plan = {
  id: string;
  name: string;
  default_price: number;
  visits_per_month: number;
  ok_max_days: number;
  attention_max_days: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PoolTech = {
  id: string;
  name: string;
  whatsapp: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export const BILLING_TYPES = ["pago", "parceria"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];
export const BILLING_LABELS: Record<BillingType, string> = {
  pago: "Pago",
  parceria: "Parceria (permuta)",
};

export type Client = {
  id: string;
  name: string;
  whatsapp: string | null;
  active: boolean;
  neighborhood: string | null;
  pool_tech_id: string | null;
  plan_id: string;
  custom_price: number | null;
  billing_type: BillingType;
  partnership_terms: string | null;
  notes: string | null;
  legacy_id: number | null;
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: string;
  client_id: string;
  pool_tech_id: string;
  visit_date: string; // YYYY-MM-DD
  services: ServiceKey[];
  service_other: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export const FREQUENCY_STATUSES = ["ok", "atencao", "atrasado"] as const;
export type FrequencyStatus = (typeof FREQUENCY_STATUSES)[number];
export const FREQUENCY_LABELS: Record<FrequencyStatus, string> = {
  ok: "OK",
  atencao: "Atenção",
  atrasado: "Atrasado",
};

// View client_frequency (calculada no banco com a data de São Paulo).
export type ClientFrequency = {
  client_id: string;
  active: boolean;
  pool_tech_id: string | null;
  plan_id: string;
  last_visit_date: string | null;
  reference_date: string;
  days_without_visit: number;
  status: FrequencyStatus;
  late_since: string;
  visits_this_month: number;
  expected_visits: number;
};

export const LATE_CASE_STATUSES = [
  "pendente",
  "acionado",
  "resolvido",
  "lancamento_atrasado",
] as const;
export type LateCaseStatus = (typeof LATE_CASE_STATUSES)[number];
export const LATE_CASE_STATUS_LABELS: Record<LateCaseStatus, string> = {
  pendente: "Pendente",
  acionado: "Acionado",
  resolvido: "Resolvido",
  lancamento_atrasado: "Lançamento atrasado",
};

export const LATE_REASONS = [
  "cliente_viajou",
  "cliente_pediu_pausa",
  "chuva_clima",
  "piscineiro_sem_agenda",
  "esquecimento",
  "outro",
] as const;
export type LateReason = (typeof LATE_REASONS)[number];
export const LATE_REASON_LABELS: Record<LateReason, string> = {
  cliente_viajou: "Cliente viajou",
  cliente_pediu_pausa: "Cliente pediu pausa",
  chuva_clima: "Chuva/clima",
  piscineiro_sem_agenda: "Piscineiro sem agenda",
  esquecimento: "Esquecimento",
  outro: "Outro",
};

export type LateCase = {
  id: string;
  client_id: string;
  pool_tech_id: string | null;
  late_since: string;
  reference_date: string;
  status: LateCaseStatus;
  reason: LateReason | null;
  reason_text: string | null;
  contacted_at: string | null;
  closed_at: string | null;
  closed_by_visit_id: string | null;
  created_at: string;
  updated_at: string;
};

// Valor pago ao piscineiro por visita, a partir de um mês (month = AAAA-MM-01).
export type VisitRate = { month: string; rate: number };

// Valor vigente num mês ("AAAA-MM"): o último que começou até aquele mês.
export function rateForMonth(rates: VisitRate[], month: string): number | null {
  const start = `${month}-01`;
  const valid = rates
    .filter((r) => r.month <= start)
    .sort((a, b) => a.month.localeCompare(b.month));
  return valid.at(-1)?.rate ?? null;
}

// Valor cobrado do cliente: personalizado ou o padrão do plano.
export const clientPrice = (
  client: Pick<Client, "custom_price">,
  plan?: Pick<Plan, "default_price">,
) => client.custom_price ?? plan?.default_price ?? null;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatMoney = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : brl.format(value);

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || normalizeBrazilPhone(v) !== null, "WhatsApp inválido. Use DDD + número.")
  .transform((v) => (v ? (normalizeBrazilPhone(v) as string) : null));

const nameField = (max: number) =>
  z
    .string({ required_error: "Informe o nome" })
    .trim()
    .min(2, "Informe o nome")
    .max(max, "Nome muito longo");

// NumberField devolve NaN quando o campo fica vazio.
const money = z.number({ invalid_type_error: "Informe o valor" }).min(0, "Valor inválido");
const days = z
  .number({ invalid_type_error: "Informe os dias" })
  .int("Use um número inteiro")
  .min(0, "Valor inválido")
  .max(365, "Valor muito alto");

export const clientFormSchema = z
  .object({
    name: nameField(120),
    whatsapp: optionalPhone,
    active: z.boolean(),
    neighborhood: optionalText(80),
    pool_tech_id: z
      .string()
      .optional()
      .transform((v) => (v ? v : null)),
    plan_id: z.string({ required_error: "Escolha o plano" }).min(1, "Escolha o plano"),
    custom_price: z
      .union([z.number(), z.nan()])
      .optional()
      .transform((v) => (v === undefined || Number.isNaN(v) ? null : v))
      .refine((v) => v === null || v >= 0, "Valor inválido"),
    billing_type: z.enum(BILLING_TYPES),
    partnership_terms: optionalText(500),
    notes: optionalText(5000),
  })
  // A contrapartida só faz sentido para parceiros.
  .transform((v) => ({
    ...v,
    partnership_terms: v.billing_type === "parceria" ? v.partnership_terms : null,
  }));

export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormValues = z.output<typeof clientFormSchema>;

export const planFormSchema = z
  .object({
    name: nameField(60),
    default_price: money,
    visits_per_month: z
      .number({ invalid_type_error: "Informe as visitas" })
      .int("Use um número inteiro")
      .min(1, "Mínimo de 1")
      .max(31, "Máximo de 31"),
    ok_max_days: days,
    attention_max_days: days,
  })
  .refine((v) => v.attention_max_days > v.ok_max_days, {
    path: ["attention_max_days"],
    message: "Precisa ser maior que o limite de OK",
  });

export type PlanFormValues = z.output<typeof planFormSchema>;

export const poolTechFormSchema = z.object({
  name: nameField(80),
  whatsapp: optionalPhone,
  active: z.boolean(),
});

export type PoolTechFormInput = z.input<typeof poolTechFormSchema>;
export type PoolTechFormValues = z.output<typeof poolTechFormSchema>;

// Visita. A data não pode ser futura (o banco também recusa).
export const visitFormSchema = z
  .object({
    pool_tech_id: z.string().min(1, "Escolha o piscineiro"),
    client_id: z.string().min(1, "Escolha o cliente"),
    visit_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data")
      .refine((v) => v <= format(new Date(), "yyyy-MM-dd"), "A data não pode ser no futuro"),
    services: z
      .array(z.enum(SERVICE_KEYS as [ServiceKey, ...ServiceKey[]]))
      .min(1, "Marque ao menos um serviço"),
    service_other: optionalText(200),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.services.includes("outro") && !v.service_other)
      ctx.addIssue({ code: "custom", path: ["service_other"], message: "Descreva o serviço" });
  })
  // O texto de "Outro" só é gravado com o serviço marcado.
  .transform((v) => ({
    ...v,
    service_other: v.services.includes("outro") ? v.service_other : null,
  }));

export type VisitFormInput = z.input<typeof visitFormSchema>;
export type VisitFormValues = z.output<typeof visitFormSchema>;

// Registro de que a gestora falou com o piscineiro sobre o atraso.
export const lateCaseFormSchema = z
  .object({
    reason: z.enum(LATE_REASONS, { errorMap: () => ({ message: "Escolha o motivo" }) }),
    reason_text: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.reason === "outro" && !v.reason_text)
      ctx.addIssue({ code: "custom", path: ["reason_text"], message: "Descreva o motivo" });
  });

export type LateCaseFormInput = z.input<typeof lateCaseFormSchema>;
export type LateCaseFormValues = z.output<typeof lateCaseFormSchema>;

export type ReportSend = {
  id: string;
  kind: "pendentes" | "atendimentos";
  pool_tech_id: string | null;
  client_id: string | null;
  period_start: string;
  period_end: string;
  sent_at: string;
};
