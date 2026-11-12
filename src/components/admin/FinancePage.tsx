import { useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  toast,
  type Key,
} from "@heroui/react";
import {
  ArrowRotateRight,
  Check,
  CircleCheck,
  CircleExclamation,
  Copy,
  PaperPlane,
} from "@gravity-ui/icons";
import { Link } from "@tanstack/react-router";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { whatsappChatLink } from "@/lib/leads/phone";
import { formatMoney } from "@/lib/visits/schema";
import {
  KIT_REFILL_DAYS,
  LINK_WAIT_DAYS,
  buildAlerts,
  buildChargeMessage,
  type AlertColor,
  type FinanceAlert,
} from "@/lib/finance/alerts";
import { todayISO } from "./filters";
import { describeFinanceError, usePendingFinance } from "./finance-api";
import { PayDialog } from "./ClientFinanceTab";
import {
  LinkSentDialog,
  RefillDialog,
  type LinkSentTarget,
  type RefillTarget,
} from "./finance-dialogs";
import { useClientRows } from "./visits-ui";
import { PendingLabel } from "./ui";
import type { Charge } from "@/lib/finance/schema";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

const COLOR_STYLES: Record<
  AlertColor,
  { bar: string; chip: string; tile: string; text: string; label: string }
> = {
  red: {
    bar: "bg-red-500",
    chip: "bg-red-100 text-red-800",
    tile: "bg-red-50",
    text: "text-red-700",
    label: "Urgentes",
  },
  yellow: {
    bar: "bg-amber-400",
    chip: "bg-amber-100 text-amber-900",
    tile: "bg-amber-50",
    text: "text-amber-800",
    label: "Atenção",
  },
  blue: {
    bar: "bg-sky-500",
    chip: "bg-sky-100 text-sky-800",
    tile: "bg-sky-50",
    text: "text-sky-800",
    label: "Oportunidades",
  },
};

type Filter = "todas" | AlertColor;

export function FinancePage() {
  const data = useClientRows();
  const pending = usePendingFinance();
  const [filter, setFilter] = useState<Filter>("todas");
  const [payCharge, setPayCharge] = useState<Charge | null>(null);
  const [linkTarget, setLinkTarget] = useState<LinkSentTarget>(null);
  const [refillTarget, setRefillTarget] = useState<RefillTarget>(null);
  const today = todayISO();

  const alerts = useMemo(
    () =>
      pending.data
        ? buildAlerts({
            clients: data.rows,
            charges: pending.data.charges,
            kits: pending.data.kits,
            today,
          })
        : [],
    [pending.data, data.rows, today],
  );
  const counts = {
    red: alerts.filter((a) => a.color === "red").length,
    yellow: alerts.filter((a) => a.color === "yellow").length,
    blue: alerts.filter((a) => a.color === "blue").length,
  };
  const open = pending.data?.charges ?? [];
  const totalOpen = open.reduce((s, c) => s + c.valor, 0);
  const totalLate = open.filter((c) => c.situacao === "atrasado").reduce((s, c) => s + c.valor, 0);
  const shown = filter === "todas" ? alerts : alerts.filter((a) => a.color === filter);

  const error = data.error ?? pending.error;
  const isPending = data.isPending || pending.isPending;

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="animate-admin-rise">
          <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
            Financeiro
          </h1>
          <p className="text-sm text-muted">
            Pendências de cobrança de todos os clientes. As mensalidades do mês e do próximo mês são
            lançadas ao abrir esta tela.
          </p>
        </div>

        {error ? (
          <Card className="animate-admin-rise border border-danger/30">
            <Card.Content className="items-center gap-3 py-10 text-center">
              <CircleExclamation className="size-8 text-danger" />
              <div>
                <p className="font-semibold">Não foi possível carregar o financeiro</p>
                <p className="text-sm text-muted">{describeFinanceError(error)}</p>
              </div>
              <Button
                variant="tertiary"
                onPress={() => {
                  data.refetch();
                  void pending.refetch();
                }}
              >
                <ArrowRotateRight className="size-4" />
                Tentar novamente
              </Button>
            </Card.Content>
          </Card>
        ) : isPending ? (
          <div className="skeleton--shimmer flex flex-col gap-4" aria-busy="true">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} animationType="none" className="h-20 rounded-2xl" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} animationType="none" className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div
              className="animate-admin-rise grid grid-cols-2 gap-3 lg:grid-cols-5"
              style={stagger(1)}
            >
              {(["red", "yellow", "blue"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(filter === c ? "todas" : c)}
                  className={`rounded-2xl p-4 text-left transition-shadow hover:shadow-md ${COLOR_STYLES[c].tile} ${
                    filter === c ? "ring-2 ring-current " + COLOR_STYLES[c].text : ""
                  }`}
                >
                  <p className="text-xs text-muted">{COLOR_STYLES[c].label}</p>
                  <p
                    className={`font-display text-3xl font-semibold tabular-nums ${COLOR_STYLES[c].text}`}
                  >
                    {counts[c]}
                  </p>
                </button>
              ))}
              <div className="rounded-2xl bg-surface p-4">
                <p className="text-xs text-muted">Vencido</p>
                <p className="font-display text-xl font-semibold text-red-700 tabular-nums">
                  {formatMoney(totalLate)}
                </p>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <p className="text-xs text-muted">Em aberto (total)</p>
                <p className="font-display text-xl font-semibold tabular-nums">
                  {formatMoney(totalOpen)}
                </p>
              </div>
            </div>

            {/* Pendências */}
            <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(2)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-foreground">
                  Pendências financeiras
                </h2>
                {/* No celular os filtros rolam de lado dentro do card, sem alargar a página. */}
                <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1">
                  <ToggleButtonGroup
                    aria-label="Filtrar pendências"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set<Key>([filter])}
                    onSelectionChange={(keys) => {
                      const next = [...keys][0];
                      if (next) setFilter(next as Filter);
                    }}
                  >
                    {(["todas", "red", "yellow", "blue"] as const).map((k, i) => (
                      <ToggleButton key={k} id={k} size="sm">
                        {i > 0 && <ToggleButtonGroup.Separator />}
                        {k === "todas"
                          ? `Todas (${alerts.length})`
                          : `${COLOR_STYLES[k].label} (${counts[k]})`}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              </div>

              {shown.length === 0 ? (
                <EmptyState className="flex flex-col items-center gap-2 py-12 text-center">
                  <CircleCheck className="size-8 text-emerald-600" />
                  <p className="font-semibold">
                    Nenhuma pendência {filter === "todas" ? "" : "aqui"}
                  </p>
                  <p className="text-sm text-muted">Tudo em dia por enquanto. Bah, que beleza!</p>
                </EmptyState>
              ) : (
                <ul className="flex flex-col gap-3">
                  {shown.map((a) => (
                    <AlertItem
                      key={a.id}
                      alert={a}
                      onPay={(charge) => setPayCharge(charge)}
                      onLinkSent={() => setLinkTarget({ client: a.client, charge: a.charge })}
                      onRefill={() => a.kit && setRefillTarget({ client: a.client, kit: a.kit })}
                    />
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted">
                Vermelho: 1ª visita feita sem link enviado, mensalidade ou parcela vencida. Amarelo:
                link enviado há {LINK_WAIT_DAYS} dias ou mais sem pagamento. Azul: kit comprado há
                cerca de 3 meses ({KIT_REFILL_DAYS} dias), hora de oferecer a reposição.
              </p>
            </Card>
          </>
        )}
      </div>

      <PayDialog charge={payCharge} onClose={() => setPayCharge(null)} />
      <LinkSentDialog target={linkTarget} onClose={() => setLinkTarget(null)} />
      <RefillDialog target={refillTarget} onClose={() => setRefillTarget(null)} />
    </>
  );
}

function AlertItem({
  alert: a,
  onPay,
  onLinkSent,
  onRefill,
}: {
  alert: FinanceAlert;
  onPay: (charge: Charge) => void;
  onLinkSent: () => void;
  onRefill: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const style = COLOR_STYLES[a.color];
  const message = buildChargeMessage(a);
  const isRefill = a.kind === "reposicao_kit";

  const copy = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada", {
        description: `Agora é só colar no WhatsApp de ${a.client.name}.`,
      });
    } catch {
      toast.danger("Não foi possível copiar", {
        description: "O navegador bloqueou a área de transferência.",
      });
    } finally {
      setCopying(false);
    }
  };

  return (
    <li className="relative flex overflow-hidden rounded-2xl border border-separator bg-surface">
      <span aria-hidden className={`w-1.5 shrink-0 ${style.bar}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/clientes/$clientId"
              params={{ clientId: a.client.id }}
              search={{ aba: "financeiro" }}
              className="font-semibold text-foreground hover:text-accent hover:underline"
            >
              {a.client.name}
            </Link>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.chip}`}>
              {a.title}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isRefill && (
            <Button size="sm" variant="secondary" onPress={onLinkSent}>
              <PaperPlane className="size-4" />
              {a.kind === "link_sem_pagamento" ? "Link reenviado" : "Marcar link enviado"}
            </Button>
          )}
          {!isRefill && a.charge && (
            <Button size="sm" variant="secondary" onPress={() => a.charge && onPay(a.charge)}>
              <Check className="size-4" />
              Marcar pago
            </Button>
          )}
          {isRefill && (
            <Button size="sm" variant="secondary" onPress={onRefill}>
              <Check className="size-4" />
              Já ofereci
            </Button>
          )}
          <Button size="sm" onPress={copy} isPending={copying}>
            {({ isPending }) => (
              <PendingLabel isPending={isPending} icon={<Copy className="size-4" />}>
                {isRefill ? "Copiar mensagem" : "Copiar mensagem de cobrança"}
              </PendingLabel>
            )}
          </Button>
          {a.client.whatsapp && (
            <Tooltip delay={300} closeDelay={0}>
              <Tooltip.Trigger>
                <a
                  href={whatsappChatLink(a.client.whatsapp, message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir WhatsApp de ${a.client.name} com a mensagem`}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-whatsapp text-white hover:bg-whatsapp/90"
                >
                  <WhatsappIcon className="size-4" />
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content>Abrir no WhatsApp com a mensagem</Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>
    </li>
  );
}
