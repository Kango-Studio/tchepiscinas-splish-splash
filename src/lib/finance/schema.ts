import { z } from "zod";
import { addMonths, format, lastDayOfMonth, parseISO, setDate } from "date-fns";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/visits/schema";

// Tabelas das migrations 20261112120000_financeiro.sql e 20261112130000_financeiro_kit.sql.

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cartao: "Cartão de crédito",
  pix: "Pix",
  pix_automatico: "Pix automático",
  boleto: "Boleto",
};

export const CHARGE_TYPES = [
  "mensalidade",
  "kit",
  "produtos",
  "manutencao_extra",
  "avulso",
] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];
export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  mensalidade: "Mensalidade",
  kit: "Kit de produtos",
  produtos: "Produtos",
  manutencao_extra: "Manutenção extra",
  // Valor antigo do banco; no painel aparece como "Outro".
  avulso: "Outro",
};
// Tipos que podem ser lançados à mão (kit só pelo "Nova compra").
export const MANUAL_CHARGE_TYPES = [
  "produtos",
  "manutencao_extra",
  "avulso",
  "mensalidade",
] as const;

// Status gravado. "atrasado" existe no banco, mas o painel não grava: a
// situação real vem da view cobrancas_situacao.
export const CHARGE_STATUSES = [
  "pendente",
  "link_enviado",
  "pago",
  "atrasado",
  "cancelado",
] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];
export const EDITABLE_STATUSES = ["pendente", "link_enviado", "pago", "cancelado"] as const;
export type EditableStatus = (typeof EDITABLE_STATUSES)[number];

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  pendente: "Pendente",
  link_enviado: "Link enviado",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export type Charge = {
  id: string;
  cliente_id: string;
  tipo: ChargeType;
  kit_compra_id: string | null;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  parcela_atual: number;
  total_parcelas: number;
  link_pagamento: string | null;
  data_envio_link: string | null;
  data_pagamento: string | null;
  status: ChargeStatus;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  // Da view cobrancas_situacao.
  situacao: ChargeStatus;
  dias_atraso: number;
};

export type KitPurchase = {
  id: string;
  cliente_id: string;
  valor_total: number;
  parcelas: number;
  data_compra: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

export const isOpenCharge = (c: Pick<Charge, "situacao">) =>
  c.situacao === "pendente" || c.situacao === "link_enviado" || c.situacao === "atrasado";

// Próximo vencimento a partir de hoje. Dia 29–31 em mês curto = último dia.
export function nextDueDate(day: number, todayIso: string): string {
  const today = parseISO(todayIso);
  const inMonth = (base: Date) => {
    const last = lastDayOfMonth(base).getDate();
    return setDate(base, Math.min(day, last));
  };
  let due = inMonth(today);
  if (format(due, "yyyy-MM-dd") < todayIso) due = inMonth(addMonths(setDate(today, 1), 1));
  return format(due, "yyyy-MM-dd");
}

// Mesma divisão da função registrar_kit: centavos que sobram vão na 1ª parcela.
export function splitInstallments(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, i) =>
    i === 0 ? (cents - base * (count - 1)) / 100 : base / 100,
  );
}

// Mesma regra de vencimento da função registrar_kit (31/01 + 1 mês = 28/02).
export const installmentDueDates = (first: string, count: number) =>
  Array.from({ length: count }, (_, i) => format(addMonths(parseISO(first), i), "yyyy-MM-dd"));

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data");
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));
const notFuture = (v: string) => v <= format(new Date(), "yyyy-MM-dd");

// Forma de pagamento, valor da mensalidade (clients.custom_price) e vencimento.
// Mensalidade recorrente: só é gerada com dia de vencimento e mês de início.
export const paymentFormSchema = z
  .object({
    forma_pagamento: z
      .union([z.enum(PAYMENT_METHODS), z.literal("")])
      .optional()
      .transform((v) => (v ? v : null)),
    custom_price: z
      .union([z.number(), z.nan()])
      .optional()
      .transform((v) => (v === undefined || Number.isNaN(v) ? null : v))
      .refine((v) => v === null || v >= 0, "Valor inválido"),
    dia_vencimento: z
      .union([z.number(), z.nan()])
      .optional()
      .transform((v) => (v === undefined || Number.isNaN(v) ? null : v))
      .refine(
        (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 31),
        "Use um dia de 1 a 31",
      ),
    // Campo de mês ("AAAA-MM"); grava o dia 1.
    mensalidade_desde: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{4}-\d{2}$/.test(v), "Informe o mês")
      .transform((v) => (v ? `${v}-01` : null)),
  })
  .superRefine((v, ctx) => {
    if (v.mensalidade_desde && v.dia_vencimento === null)
      ctx.addIssue({
        code: "custom",
        path: ["dia_vencimento"],
        message: "Informe o dia para gerar a mensalidade",
      });
  });

// Mês "AAAA-MM-01" → "nov/2026".
export const formatMonth = (iso: string) => {
  const [y, m] = iso.split("-");
  const names = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${names[Number(m) - 1]}/${y}`;
};

export type PaymentFormInput = z.input<typeof paymentFormSchema>;
export type PaymentFormValues = z.output<typeof paymentFormSchema>;

export const kitFormSchema = z
  .object({
    valor_total: z
      .number({ invalid_type_error: "Informe o valor" })
      .positive("Informe o valor")
      .max(99999, "Valor muito alto"),
    parcelas: z.number().int().min(1).max(3),
    data_compra: isoDate.refine(notFuture, "A data não pode ser no futuro"),
    primeiro_vencimento: isoDate,
    primeira_paga: z.boolean(),
    observacao: optionalText(2000),
  })
  .refine((v) => v.valor_total / v.parcelas >= 1, {
    path: ["valor_total"],
    message: "Cada parcela precisa ser de pelo menos R$ 1,00",
  });

export type KitFormInput = z.input<typeof kitFormSchema>;
export type KitFormValues = z.output<typeof kitFormSchema>;

export const chargeFormSchema = z
  .object({
    tipo: z.enum(CHARGE_TYPES, { errorMap: () => ({ message: "Escolha o tipo" }) }),
    valor: z
      .number({ invalid_type_error: "Informe o valor" })
      .positive("Informe o valor")
      .max(99999, "Valor muito alto"),
    vencimento: isoDate,
    status: z.enum(EDITABLE_STATUSES),
    link_pagamento: optionalText(1000),
    data_envio_link: optionalDate,
    data_pagamento: optionalDate,
    observacao: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.status === "link_enviado" && !v.data_envio_link)
      ctx.addIssue({ code: "custom", path: ["data_envio_link"], message: "Informe quando enviou" });
    if (v.status === "pago" && !v.data_pagamento)
      ctx.addIssue({ code: "custom", path: ["data_pagamento"], message: "Informe quando pagou" });
    if (v.data_pagamento && !notFuture(v.data_pagamento))
      ctx.addIssue({ code: "custom", path: ["data_pagamento"], message: "Não pode ser no futuro" });
    if (v.data_envio_link && !notFuture(v.data_envio_link))
      ctx.addIssue({
        code: "custom",
        path: ["data_envio_link"],
        message: "Não pode ser no futuro",
      });
  })
  // O banco exige: data de pagamento só quando pago.
  .transform((v) => ({ ...v, data_pagamento: v.status === "pago" ? v.data_pagamento : null }));

export type ChargeFormInput = z.input<typeof chargeFormSchema>;
export type ChargeFormValues = z.output<typeof chargeFormSchema>;
