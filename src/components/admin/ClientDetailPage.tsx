import { useMemo, useState } from "react";
import { Button, Card, Chip, EmptyState, Skeleton, Tooltip, buttonVariants } from "@heroui/react";
import {
  ArrowLeft,
  ArrowRotateRight,
  CircleExclamation,
  Pencil,
  Plus,
  TrashBin,
  Tray,
} from "@gravity-ui/icons";
import { Link, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBrazilPhone } from "@/lib/leads/phone";
import { averageDaysBetweenVisits } from "@/lib/visits/frequency";
import { SERVICE_LABELS } from "@/lib/visits/services";
import {
  BILLING_LABELS,
  LATE_REASON_LABELS,
  clientPrice,
  formatMoney,
  type Visit,
} from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import { useClientLateCases, useClientVisits } from "./visits-api";
import { ClientDrawer } from "./ClientDrawer";
import { DeleteVisitDialog, VisitModal, type VisitModalState } from "./VisitModal";
import {
  FREQUENCY_STYLES,
  FrequencyChip,
  LateCaseChip,
  daysLabel,
  useClientRows,
} from "./visits-ui";
import { LeadWhatsAppButton, PendingLabel, formatDate, formatDateTime } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ClientDetailPage({
  clientId,
  visitId,
  onVisitChange,
}: {
  clientId: string;
  // Visita aberta para editar, vinda da URL (?visita=<id>).
  visitId?: string;
  onVisitChange: (id: string | undefined) => void;
}) {
  const navigate = useNavigate();
  const data = useClientRows();
  const visitsQuery = useClientVisits(clientId);
  const casesQuery = useClientLateCases(clientId);
  const [editing, setEditing] = useState(false);
  const [visitModal, setVisitModal] = useState<VisitModalState>(null);
  const [visitToDelete, setVisitToDelete] = useState<Visit | null>(null);

  const client = data.rows.find((c) => c.id === clientId);
  const techName = (id: string | null) => data.techs.find((t) => t.id === id)?.name ?? "—";
  const visits = useMemo(() => visitsQuery.data ?? [], [visitsQuery.data]);
  const today = todayISO();
  const avgGap = useMemo(
    () =>
      averageDaysBetweenVisits(
        visits.map((v) => v.visit_date),
        today,
      ),
    [visits, today],
  );

  const backLink = (
    <Link
      to="/admin/clientes"
      className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 self-start" })}
    >
      <ArrowLeft className="size-4" />
      Clientes
    </Link>
  );

  if (data.error) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <Card className="animate-admin-rise border border-danger/30">
          <Card.Content className="items-center gap-3 py-10 text-center">
            <CircleExclamation className="size-8 text-danger" />
            <div>
              <p className="font-semibold">Não foi possível carregar o cliente</p>
              <p className="text-sm text-muted">{describeDbError(data.error)}</p>
            </div>
            <Button variant="tertiary" onPress={data.refetch} isPending={data.isFetching}>
              {({ isPending }) => (
                <PendingLabel isPending={isPending} icon={<ArrowRotateRight className="size-4" />}>
                  Tentar novamente
                </PendingLabel>
              )}
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (data.isPending) {
    return (
      <div className="skeleton--shimmer flex flex-col gap-4" aria-busy="true">
        <Skeleton animationType="none" className="h-8 w-24 rounded-lg" />
        <Skeleton animationType="none" className="h-10 w-72 rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton animationType="none" className="h-72 rounded-3xl" />
          <Skeleton animationType="none" className="h-72 rounded-3xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col gap-4">
        {backLink}
        <Card className="animate-admin-rise">
          <EmptyState className="flex flex-col items-center gap-2 py-14 text-center">
            <Tray className="size-8 text-muted" />
            <p className="font-semibold">Cliente não encontrado</p>
            <p className="text-sm text-muted">Ele pode ter sido excluído.</p>
          </EmptyState>
        </Card>
      </div>
    );
  }

  const f = client.frequency;
  const price = clientPrice(client, client.plan);

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-admin-rise flex flex-col gap-3">
        {backLink}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
                {client.name}
              </h1>
              {f && <FrequencyChip status={f.status} active={client.active} size="md" />}
              {client.billing_type === "parceria" && (
                <Chip
                  size="md"
                  variant="soft"
                  className="bg-violet-100 font-semibold text-violet-800"
                >
                  <Chip.Label>Parceria</Chip.Label>
                </Chip>
              )}
            </div>
            <p className="text-sm text-muted">
              {[client.plan?.name, client.tech?.name, client.neighborhood]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {client.whatsapp && (
              <LeadWhatsAppButton
                lead={{ name: client.name, whatsapp: client.whatsapp }}
                size="md"
                withLabel
              />
            )}
            <Button variant="secondary" onPress={() => setEditing(true)}>
              <Pencil className="size-4" />
              Editar
            </Button>
            <Button
              onPress={() =>
                setVisitModal({ clientId: client.id, techId: client.pool_tech_id ?? undefined })
              }
            >
              <Plus className="size-4" />
              Registrar visita
            </Button>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          {/* Frequência */}
          <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(1)}>
            <h2 className="font-display text-base font-semibold text-foreground">Frequência</h2>
            {f && (
              <>
                <div className="flex items-end gap-3">
                  <p
                    className={`font-display text-4xl leading-none font-semibold tracking-tight tabular-nums ${
                      client.active ? FREQUENCY_STYLES[f.status].text : "text-muted"
                    }`}
                  >
                    {f.days_without_visit}
                  </p>
                  <p className="pb-0.5 text-sm text-muted">
                    {f.days_without_visit === 1 ? "dia" : "dias"} sem visita
                    {!f.last_visit_date && " (desde o cadastro)"}
                  </p>
                </div>
                <dl className="divide-y divide-separator">
                  <InfoRow label="Última visita">{formatDate(f.last_visit_date)}</InfoRow>
                  <InfoRow label="Visitas no mês">
                    <span className="tabular-nums">
                      {f.visits_this_month} de {f.expected_visits}
                    </span>
                  </InfoRow>
                  <InfoRow label="Média entre visitas (3 meses)">
                    {avgGap === null
                      ? "—"
                      : `${avgGap.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`}
                  </InfoRow>
                  {client.active && f.status !== "atrasado" && (
                    <InfoRow label="Fica atrasado em">{formatDate(f.late_since)}</InfoRow>
                  )}
                </dl>
              </>
            )}
          </Card>

          {/* Dados */}
          <Card className="animate-admin-rise gap-2 p-4 sm:p-5" style={stagger(2)}>
            <h2 className="font-display text-base font-semibold text-foreground">Dados</h2>
            <dl className="divide-y divide-separator">
              <InfoRow label="Situação">{client.active ? "Ativo" : "Inativo"}</InfoRow>
              <InfoRow label="Plano">{client.plan?.name ?? "—"}</InfoRow>
              <InfoRow label="Valor">
                {client.billing_type === "parceria" ? (
                  <span className="text-muted">Não entra na receita</span>
                ) : (
                  <>
                    {formatMoney(price)}
                    <span className="block text-xs font-normal text-muted">
                      {client.custom_price !== null ? "personalizado" : "padrão do plano"}
                    </span>
                  </>
                )}
              </InfoRow>
              <InfoRow label="Cobrança">{BILLING_LABELS[client.billing_type]}</InfoRow>
              {client.billing_type === "parceria" && (
                <InfoRow label="Contrapartida">{client.partnership_terms ?? "—"}</InfoRow>
              )}
              <InfoRow label="Piscineiro">{client.tech?.name ?? "—"}</InfoRow>
              <InfoRow label="WhatsApp">
                {client.whatsapp ? (
                  formatBrazilPhone(client.whatsapp)
                ) : (
                  <span className="text-muted">Não informado</span>
                )}
              </InfoRow>
              <InfoRow label="Bairro">{client.neighborhood ?? "—"}</InfoRow>
              <InfoRow label="Cadastrado em">{formatDate(client.created_at)}</InfoRow>
            </dl>
            {client.notes && (
              <div className="rounded-xl bg-surface-secondary p-3 text-sm whitespace-pre-line">
                {client.notes}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Histórico de visitas */}
          <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(3)}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                Histórico de visitas
              </h2>
              {visitsQuery.isSuccess && (
                <span className="text-xs text-muted">
                  {visits.length} {visits.length === 1 ? "visita" : "visitas"}
                </span>
              )}
            </div>
            {visitsQuery.isError ? (
              <p className="text-sm text-danger">{describeDbError(visitsQuery.error)}</p>
            ) : visitsQuery.isPending ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : visits.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhuma visita registrada.</p>
            ) : (
              <ol className="relative flex flex-col">
                {visits.map((v, i) => {
                  const gap =
                    i < visits.length - 1
                      ? Math.round(
                          (parseISO(v.visit_date).getTime() -
                            parseISO(visits[i + 1].visit_date).getTime()) /
                            86_400_000,
                        )
                      : null;
                  return (
                    <li key={v.id} className="group relative flex gap-3 pb-5 last:pb-0">
                      {/* Linha do tempo */}
                      <span
                        aria-hidden
                        className="absolute top-3 bottom-0 left-1.25 w-0.5 bg-separator group-last:hidden"
                      />
                      <span
                        aria-hidden
                        className="relative mt-1.5 size-3 shrink-0 rounded-full border-2 border-pool bg-surface"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <div>
                            <p className="font-semibold text-foreground">
                              {format(parseISO(v.visit_date), "dd/MM/yyyy", { locale: ptBR })}
                              <span className="ml-2 text-xs font-normal text-muted">
                                {format(parseISO(v.visit_date), "EEEE", { locale: ptBR })}
                              </span>
                            </p>
                            <p className="text-xs text-muted">
                              {techName(v.pool_tech_id)}
                              {gap !== null && ` · ${daysLabel(gap)} depois da anterior`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Tooltip delay={300} closeDelay={0}>
                              <Tooltip.Trigger>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full text-muted hover:text-accent"
                                  aria-label={`Editar visita de ${formatDate(v.visit_date)}`}
                                  onPress={() => onVisitChange(v.id)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Editar visita</Tooltip.Content>
                            </Tooltip>
                            <Tooltip delay={300} closeDelay={0}>
                              <Tooltip.Trigger>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-full text-muted hover:text-danger"
                                  aria-label={`Excluir visita de ${formatDate(v.visit_date)}`}
                                  onPress={() => setVisitToDelete(v)}
                                >
                                  <TrashBin className="size-4" />
                                </Button>
                              </Tooltip.Trigger>
                              <Tooltip.Content>Excluir visita</Tooltip.Content>
                            </Tooltip>
                          </div>
                        </div>
                        {v.services.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {v.services.map((s) => (
                              <li
                                key={s}
                                className="rounded-full bg-pool-mist px-2.5 py-0.5 text-xs font-medium text-pool-deep"
                              >
                                {s === "outro" && v.service_other
                                  ? v.service_other
                                  : SERVICE_LABELS[s]}
                              </li>
                            ))}
                          </ul>
                        )}
                        {v.notes && (
                          <p className="mt-2 rounded-lg bg-sun/15 px-3 py-2 text-sm whitespace-pre-line text-amber-950">
                            <span className="font-semibold">Obs.:</span> {v.notes}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-muted">
                          Registrada em {formatDateTime(v.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* Casos de atraso */}
          <Card className="animate-admin-rise gap-3 p-4 sm:p-5" style={stagger(4)}>
            <h2 className="font-display text-base font-semibold text-foreground">
              Casos de atraso
            </h2>
            {casesQuery.isError ? (
              <p className="text-sm text-danger">{describeDbError(casesQuery.error)}</p>
            ) : casesQuery.isPending ? (
              <Skeleton className="h-14 rounded-xl" />
            ) : casesQuery.data.length === 0 ? (
              <p className="py-3 text-sm text-muted">Nenhum caso de atraso registrado.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-separator">
                {casesQuery.data.map((c) => (
                  <li key={c.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <LateCaseChip status={c.status} />
                      <span className="text-sm font-medium">
                        Atrasado desde {formatDate(c.late_since)}
                      </span>
                      <span className="text-xs text-muted">· {techName(c.pool_tech_id)}</span>
                    </div>
                    {c.reason && (
                      <p className="text-sm text-muted">
                        Motivo: {LATE_REASON_LABELS[c.reason]}
                        {c.reason_text && ` — ${c.reason_text}`}
                      </p>
                    )}
                    {c.closed_at && (
                      <p className="text-xs text-muted">Fechado em {formatDateTime(c.closed_at)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ClientDrawer
        isOpen={editing}
        client={client}
        plans={data.plans}
        techs={data.techs}
        hasVisits={visits.length > 0 || !visitsQuery.isSuccess}
        onClose={() => setEditing(false)}
        onDeleted={() => navigate({ to: "/admin/clientes" })}
      />

      <VisitModal
        state={visitModal}
        editId={visitId}
        onClose={() => setVisitModal(null)}
        onEditChange={onVisitChange}
      />
      <DeleteVisitDialog visit={visitToDelete} onClose={() => setVisitToDelete(null)} />
    </div>
  );
}
