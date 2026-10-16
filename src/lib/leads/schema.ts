import { z } from "zod";
import { normalizeBrazilPhone } from "./phone";

// As chaves "em_atendimento" e "orcamento_enviado" foram mantidas (dados já
// gravados); os rótulos refletem o processo atual de atendimento.
export const LEAD_STAGES = [
  "novo",
  "em_atendimento",
  "proposta_enviada",
  "orcamento_enviado",
  "fechado",
  "perdido",
] as const;
export const CLIENT_TYPES = ["residencial", "condominio", "outro"] as const;
export const LEAD_INTERESTS = [
  "manutencao_recorrente",
  "limpeza_avulsa",
  "produtos",
  "equipamentos",
  "outro",
] as const;
export const LEAD_SOURCES = [
  "site",
  "instagram",
  "whatsapp",
  "indicacao",
  "manual",
  "outro",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];
export type ClientType = (typeof CLIENT_TYPES)[number];
export type LeadInterest = (typeof LEAD_INTERESTS)[number];
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  novo: "Novo",
  em_atendimento: "Aguardando endereço",
  proposta_enviada: "Proposta enviada",
  orcamento_enviado: "Valor enviado",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  residencial: "Residencial",
  condominio: "Condomínio",
  outro: "Outro",
};

export const INTEREST_LABELS: Record<LeadInterest, string> = {
  manutencao_recorrente: "Manutenção recorrente",
  limpeza_avulsa: "Limpeza avulsa",
  produtos: "Produtos",
  equipamentos: "Equipamentos",
  outro: "Outro",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  site: "Site",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  manual: "Manual",
  outro: "Outro",
};

export type Lead = {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  city: string | null;
  neighborhood: string | null;
  client_type: ClientType;
  interest: LeadInterest;
  source: LeadSource;
  stage: LeadStage;
  initial_message: string | null;
  internal_notes: string | null;
  next_contact_date: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
};

export type LeadFollowup = {
  id: string;
  lead_id: string;
  done_at: string;
  note: string | null;
  stage: LeadStage | null; // etapa do lead no momento do follow-up
  created_by: string | null;
  created_at: string;
};

const phoneField = z
  .string({ required_error: "Informe o WhatsApp" })
  .trim()
  .min(1, "Informe o WhatsApp")
  .refine((v) => normalizeBrazilPhone(v) !== null, "WhatsApp inválido. Use DDD + número.")
  .transform((v) => normalizeBrazilPhone(v) as string);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

const nameField = z
  .string({ required_error: "Informe o nome" })
  .trim()
  .min(2, "Informe o nome")
  .max(120, "Nome muito longo");

// Formulário do painel (cadastro manual e edição)
export const leadFormSchema = z.object({
  name: nameField,
  whatsapp: phoneField,
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "E-mail inválido")
    .transform((v) => (v ? v.toLowerCase() : null)),
  city: optionalText(80),
  neighborhood: optionalText(80),
  client_type: z.enum(CLIENT_TYPES),
  interest: z.enum(LEAD_INTERESTS),
  source: z.enum(LEAD_SOURCES),
  stage: z.enum(LEAD_STAGES),
  initial_message: optionalText(2000),
  internal_notes: optionalText(5000),
  next_contact_date: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida")
    .transform((v) => (v ? v : null)),
});

export type LeadFormInput = z.input<typeof leadFormSchema>;
export type LeadFormValues = z.output<typeof leadFormSchema>;

// Formulário público do site. Não aceita etapa, origem, observações etc.
export const publicLeadSchema = z.object({
  name: nameField,
  whatsapp: phoneField,
  city: z.string({ required_error: "Informe a cidade" }).trim().min(2, "Informe a cidade").max(80),
  interest: z.enum(LEAD_INTERESTS, { errorMap: () => ({ message: "Escolha um interesse" }) }),
  client_type: z.enum(CLIENT_TYPES).optional(),
  // Rótulo do CTA que abriu o formulário (só para contexto na mensagem inicial).
  cta: z.string().trim().max(60).optional(),
  // Anti-spam: campo isca (deve vir vazio) e tempo de preenchimento.
  website: z.string().max(200).optional(),
  elapsed_ms: z.number().int().nonnegative().max(86_400_000),
});

export type PublicLeadInput = z.input<typeof publicLeadSchema>;
