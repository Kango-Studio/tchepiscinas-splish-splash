import { formatBrazilPhone } from "@/lib/leads/phone";
import { formatMoney, type PaymentMethod } from "@/lib/visits/schema";
import { PAYMENT_METHOD_LABELS, splitInstallments, type Charge, type KitPurchase } from "./schema";

export const LINK_STATES = {
  request: "Solicitar link ao gerente",
  opened: "Aguardando confirmação da solicitação",
  waiting: "Aguardando link do gerente",
  ready: "Pronto para enviar ao cliente",
  sent: "Link enviado",
} as const;

export type LinkState = keyof typeof LINK_STATES;
export type LinkItem = {
  key: string;
  title: string;
  charges: Charge[];
  amount: number;
  installments: number[];
  description: string;
};

export function linkItems(charges: Charge[], kits: KitPurchase[]): LinkItem[] {
  const items = new Map<string, LinkItem>();
  for (const charge of charges) {
    if (
      !["mensalidade", "kit", "produtos"].includes(charge.tipo) ||
      charge.status === "pago" ||
      charge.status === "cancelado"
    )
      continue;

    const key = charge.kit_compra_id ?? charge.id;
    const existing = items.get(key);
    if (existing) {
      existing.charges.push(charge);
      continue;
    }
    const kit = kits.find(({ id }) => id === charge.kit_compra_id);
    if (charge.tipo === "kit" && !kit) continue;
    const title =
      charge.tipo === "mensalidade"
        ? "Mensalidade"
        : charge.tipo === "kit"
          ? "Kit de produtos"
          : "Produtos avulsos";
    const installments =
      kit && kit.parcelas > 1
        ? splitInstallments(kit.valor_total, kit.parcelas).map(
            (value, i) =>
              charges.find(
                (row) =>
                  row.kit_compra_id === kit.id &&
                  row.parcela_atual === i + 1 &&
                  row.status !== "cancelado",
              )?.valor ?? value,
          )
        : [];
    items.set(key, {
      key,
      title,
      charges: [charge],
      amount: kit?.valor_total ?? charge.valor,
      installments,
      description: charge.tipo === "produtos" ? (charge.observacao?.trim() ?? "") : "",
    });
  }
  return [...items.values()].sort(
    (a, b) =>
      ["Mensalidade", "Kit de produtos", "Produtos avulsos"].indexOf(a.title) -
      ["Mensalidade", "Kit de produtos", "Produtos avulsos"].indexOf(b.title),
  );
}

export function managerMessage(
  name: string,
  whatsapp: string,
  items: Pick<LinkItem, "title" | "description" | "amount" | "installments">[],
  method: PaymentMethod | null,
) {
  const lines = items.map((item) => {
    const identity = item.description ? `${item.title}: ${item.description} — ` : `${item.title}: `;
    const terms = [
      method ? PAYMENT_METHOD_LABELS[method] : "",
      item.installments.length > 0
        ? `${item.installments.length} parcelas (${item.installments.map(formatMoney).join(" + ")})`
        : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `• ${identity}${formatMoney(item.amount)}${terms ? ` — ${terms}` : ""}`;
  });

  return [
    "Oi! Consegue gerar os links de pagamento desse cliente pra mim? 😊",
    `Cliente: ${name}\nWhatsApp: ${formatBrazilPhone(whatsapp)}`,
    lines.join("\n"),
    "Me manda por aqui que eu encaminho para o cliente\nObrigada!",
  ].join("\n\n");
}

export function clientLinkMessage(name: string, entries: { title: string; link: string }[]) {
  const links = new Map<string, Set<string>>();
  for (const { title, link } of entries) {
    const titles = links.get(link) ?? new Set<string>();
    titles.add(title);
    links.set(link, titles);
  }
  return [
    `Oi, ${name}! Aqui estão os links de pagamento da Tchê Piscinas:`,
    [...links].map(([link, titles]) => `• ${[...titles].join(" + ")}: ${link}`).join("\n"),
    "Obrigada!",
  ].join("\n\n");
}

export function validPaymentUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      value.length <= 1000 &&
      !/\s/.test(value)
    );
  } catch {
    return false;
  }
}
