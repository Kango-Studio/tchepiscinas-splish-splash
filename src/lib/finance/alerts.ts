import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatMoney, type Client } from "@/lib/visits/schema";
import {
  CHARGE_TYPE_LABELS,
  isOpenCharge,
  type Charge,
  type KitPurchase,
} from "@/lib/finance/schema";

// Pendências financeiras da tela inicial (etapa 4).

export type AlertColor = "red" | "yellow" | "blue";
export type AlertKind =
  | "link_pendente" // 1ª visita feita e link da mensalidade não enviado
  | "link_sem_pagamento" // link enviado e não pago em 3 dias
  | "mensalidade_vencida"
  | "kit_vencido"
  | "cobranca_vencida" // produtos, manutenção extra, outro
  | "reposicao_kit"; // kit comprado há ~3 meses

export type AlertClient = Pick<
  Client,
  | "id"
  | "name"
  | "whatsapp"
  | "active"
  | "etapa_onboarding"
  | "primeira_visita_em"
  | "link_enviado_em"
>;

export type FinanceAlert = {
  id: string;
  kind: AlertKind;
  color: AlertColor;
  client: AlertClient;
  charge?: Charge;
  kit?: KitPurchase;
  title: string;
  detail: string;
  // Dias de atraso / desde o evento (ordenação e destaque).
  days: number;
};

export const LINK_WAIT_DAYS = 3;
// "Cerca de 3 meses" para oferecer a reposição do kit.
export const KIT_REFILL_DAYS = 80;

const COLOR_ORDER: Record<AlertColor, number> = { red: 0, yellow: 1, blue: 2 };

const daysSince = (iso: string, today: string) =>
  differenceInCalendarDays(parseISO(today), parseISO(iso));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortDate = (iso: string) => format(parseISO(iso), "dd/MM");

export const chargeLabel = (c: Charge) =>
  c.tipo === "kit"
    ? `Parcela ${c.parcela_atual}/${c.total_parcelas} do kit`
    : c.tipo === "mensalidade"
      ? `Mensalidade de ${monthName(c.vencimento)}`
      : CHARGE_TYPE_LABELS[c.tipo];

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];

export function buildAlerts({
  clients,
  charges,
  kits,
  today,
}: {
  clients: AlertClient[];
  charges: Charge[];
  kits: KitPurchase[];
  today: string;
}): FinanceAlert[] {
  const byId = new Map(clients.map((c) => [c.id, c]));
  const open = charges.filter(isOpenCharge);
  const alerts: FinanceAlert[] = [];
  // Clientes que já têm alerta de cobrança (evita repetir o da esteira).
  const withChargeAlert = new Set<string>();

  for (const c of open) {
    const client = byId.get(c.cliente_id);
    if (!client) continue;
    const amount = formatMoney(c.valor);
    if (c.situacao === "atrasado") {
      const kind: AlertKind =
        c.tipo === "mensalidade"
          ? "mensalidade_vencida"
          : c.tipo === "kit"
            ? "kit_vencido"
            : "cobranca_vencida";
      alerts.push({
        id: `vencida-${c.id}`,
        kind,
        color: "red",
        client,
        charge: c,
        title:
          kind === "mensalidade_vencida"
            ? "Mensalidade vencida"
            : kind === "kit_vencido"
              ? "Parcela do kit vencida"
              : `${CHARGE_TYPE_LABELS[c.tipo]} vencido`,
        detail: `${chargeLabel(c)} · ${amount} · venceu ${shortDate(c.vencimento)} · ${plural(c.dias_atraso, "dia", "dias")} de atraso`,
        days: c.dias_atraso,
      });
      withChargeAlert.add(c.cliente_id);
    } else if (
      c.situacao === "link_enviado" &&
      c.data_envio_link &&
      daysSince(c.data_envio_link, today) >= LINK_WAIT_DAYS
    ) {
      const days = daysSince(c.data_envio_link, today);
      alerts.push({
        id: `link-${c.id}`,
        kind: "link_sem_pagamento",
        color: "yellow",
        client,
        charge: c,
        title: "Link enviado e não pago",
        detail: `${chargeLabel(c)} · ${amount} · link enviado há ${plural(days, "dia", "dias")} (${shortDate(c.data_envio_link)})`,
        days,
      });
      withChargeAlert.add(c.cliente_id);
    }
  }

  // Mensalidade em aberto mais antiga do cliente (para os botões da esteira).
  const firstOpenFee = (clientId: string) =>
    open
      .filter((c) => c.cliente_id === clientId && c.tipo === "mensalidade")
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];

  for (const client of clients) {
    if (!client.active) continue;
    if (client.etapa_onboarding === "aguardando_link") {
      const days = client.primeira_visita_em ? daysSince(client.primeira_visita_em, today) : 0;
      alerts.push({
        id: `esteira-link-${client.id}`,
        kind: "link_pendente",
        color: "red",
        client,
        charge: firstOpenFee(client.id),
        title: "1ª visita feita e link não enviado",
        detail: client.primeira_visita_em
          ? `1ª visita em ${shortDate(client.primeira_visita_em)} (${days <= 0 ? "hoje" : `há ${plural(days, "dia", "dias")}`}) · falta enviar o link da mensalidade`
          : "Falta enviar o link da mensalidade",
        days,
      });
    } else if (
      client.etapa_onboarding === "link_enviado" &&
      client.link_enviado_em &&
      daysSince(client.link_enviado_em, today) >= LINK_WAIT_DAYS &&
      !withChargeAlert.has(client.id)
    ) {
      const days = daysSince(client.link_enviado_em, today);
      alerts.push({
        id: `esteira-pago-${client.id}`,
        kind: "link_sem_pagamento",
        color: "yellow",
        client,
        charge: firstOpenFee(client.id),
        title: "Link enviado e não pago",
        detail: `Link da 1ª mensalidade enviado há ${plural(days, "dia", "dias")} (${shortDate(client.link_enviado_em)})`,
        days,
      });
    }
  }

  // Reposição: só a compra de kit mais recente de cada cliente ativo.
  const latestKit = new Map<string, KitPurchase>();
  for (const k of kits) {
    const prev = latestKit.get(k.cliente_id);
    if (!prev || k.data_compra > prev.data_compra) latestKit.set(k.cliente_id, k);
  }
  for (const k of latestKit.values()) {
    const client = byId.get(k.cliente_id);
    if (!client?.active || k.reposicao_oferecida_em) continue;
    const days = daysSince(k.data_compra, today);
    if (days < KIT_REFILL_DAYS) continue;
    alerts.push({
      id: `reposicao-${k.id}`,
      kind: "reposicao_kit",
      color: "blue",
      client,
      kit: k,
      title: "Hora de oferecer a reposição do kit",
      detail: `Kit de ${formatMoney(k.valor_total)} comprado em ${format(parseISO(k.data_compra), "dd/MM/yyyy")} (há ${plural(days, "dia", "dias")})`,
      days,
    });
  }

  return alerts.sort((a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || b.days - a.days);
}

// ---------------------------------------------------------------------------
// Mensagem de cobrança (WhatsApp, informal, gaúcho, com "tu")
// ---------------------------------------------------------------------------

const firstName = (name: string) => name.trim().split(/\s+/)[0];

const LINK_PLACEHOLDER = "[cola aqui o link de pagamento]";

export function buildChargeMessage(alert: FinanceAlert): string {
  const name = firstName(alert.client.name);
  const c = alert.charge;
  const link = c?.link_pagamento;
  const what = (charge: Charge) =>
    charge.tipo === "mensalidade"
      ? `a mensalidade de *${monthName(charge.vencimento)}*`
      : charge.tipo === "kit"
        ? `a parcela *${charge.parcela_atual}/${charge.total_parcelas}* do kit de produtos`
        : `a cobrança de *${CHARGE_TYPE_LABELS[charge.tipo].toLowerCase()}*`;

  switch (alert.kind) {
    case "link_pendente": {
      const value = c
        ? ` de *${monthName(c.vencimento)}*: *${formatMoney(c.valor)}*, com vencimento dia *${shortDate(c.vencimento)}*`
        : "";
      return [
        `Bah, ${name}! Tudo tri? 😊`,
        "",
        `Aqui é da *Tchê Piscinas*. Tô te mandando o link da tua mensalidade${value}.`,
        "",
        `👉 ${link ?? LINK_PLACEHOLDER}`,
        "",
        "Qualquer dúvida é só me chamar. Valeu! 💙",
      ].join("\n");
    }
    case "link_sem_pagamento": {
      const ref = c
        ? `do link ${what(c).replace(/^a /, "da ")} (*${formatMoney(c.valor)}*)`
        : "do link da tua mensalidade";
      const sent = c?.data_envio_link ?? alert.client.link_enviado_em;
      return [
        `Oi, ${name}! Tudo certo por aí? 😊`,
        "",
        `Tô passando só pra lembrar ${ref}${sent ? ` que te mandei no dia *${shortDate(sent)}*` : ""}.`,
        "",
        `👉 ${link ?? LINK_PLACEHOLDER}`,
        "",
        "Se tu já pagou, desconsidera! Valeu, tchê! 💙",
      ].join("\n");
    }
    case "mensalidade_vencida":
    case "kit_vencido":
    case "cobranca_vencida": {
      if (!c) return "";
      const lines = [
        `Oi, ${name}! Tudo bem contigo? 😊`,
        "",
        `${what(c).replace(/^a/, "A")} (*${formatMoney(c.valor)}*) venceu no dia *${shortDate(c.vencimento)}* e ainda não encontrei o pagamento por aqui.`,
        "",
      ];
      if (link) lines.push(`👉 ${link}`, "");
      else lines.push("Se precisar, te mando o link de pagamento de novo.", "");
      lines.push("Se tu já pagou, me manda o comprovante que eu dou baixa. Valeu, tchê! 💙");
      return lines.join("\n");
    }
    case "reposicao_kit":
      return [
        `Bah, ${name}! Tudo tri? 😊`,
        "",
        "Já faz uns 3 meses que tu pegou o kit de produtos da piscina, então ele já deve estar no fim.",
        "Quer que eu separe a reposição pra ti? 🧪💧",
        "",
        "É só me dizer que a gente já leva na próxima visita!",
      ].join("\n");
  }
}
