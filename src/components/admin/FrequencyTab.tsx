import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Accordion,
  Button,
  Card,
  FieldError,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  Skeleton,
  Table,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  type Key,
} from "@heroui/react";
import {
  ArrowRotateRight,
  CircleCheck,
  CircleExclamation,
  Clock,
  Megaphone,
  Persons,
  Plus,
  TriangleExclamation,
} from "@gravity-ui/icons";
import { Link } from "@tanstack/react-router";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { reportWeek } from "@/lib/visits/frequency";
import {
  FREQUENCY_LABELS,
  FREQUENCY_STATUSES,
  LATE_REASONS,
  LATE_REASON_LABELS,
  lateCaseFormSchema,
  type FrequencyStatus,
  type LateCase,
  type LateCaseFormInput,
  type LateCaseFormValues,
  type LateReason,
} from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import { useLateCases, useRegisterContact, useReportSends } from "./visits-api";
import {
  FREQUENCY_STYLES,
  LateCaseChip,
  daysLabel,
  useClientRows,
  type ClientRow,
} from "./visits-ui";
import { CountUp, PendingLabel, StatusAlert, formatDate, formatDateTime } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;
const NO_TECH = "__none";
const STATUS_ICONS = { ok: CircleCheck, atencao: Clock, atrasado: TriangleExclamation };

// Fundo e borda de cada cliente na lista do piscineiro.
const ROW_STYLES: Record<FrequencyStatus, string> = {
  atrasado: "border-red-400 bg-red-50/80",
  atencao: "border-amber-400 bg-amber-50/80",
  ok: "border-transparent bg-surface-secondary/60",
};

const isOpenCase = (c: LateCase) => c.status === "pendente" || c.status === "acionado";

export type ContactTarget = { lateCase: LateCase; client: ClientRow };

export function FrequencyTab({
  onRegisterVisit,
  onContact,
}: {
  onRegisterVisit: (client: ClientRow) => void;
  onContact: (target: ContactTarget) => void;
}) {
  const data = useClientRows();
  const casesQuery = useLateCases();
  const today = todayISO();
  const week = reportWeek(today);
  const sendsQuery = useReportSends("pendentes", week.start);
  const [status, setStatus] = useState<FrequencyStatus | undefined>();
  const [expanded, setExpanded] = useState<Set<Key>>(new Set());

  const active = useMemo(() => data.rows.filter((r) => r.active && r.frequency), [data.rows]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FREQUENCY_STATUSES.map((s) => [s, active.filter((r) => r.frequency!.status === s).length]),
      ) as Record<FrequencyStatus, number>,
    [active],
  );

  const openCaseByClient = useMemo(
    () => new Map((casesQuery.data ?? []).filter(isOpenCase).map((c) => [c.client_id, c])),
    [casesQuery.data],
  );

  // Um bloco por piscineiro (ativos ou com clientes), mais "Sem piscineiro".
  const groups = useMemo(() => {
    const byTech = new Map<string, ClientRow[]>();
    for (const r of active) {
      const key = r.pool_tech_id ?? NO_TECH;
      byTech.set(key, [...(byTech.get(key) ?? []), r]);
    }
    const list = [
      ...data.techs
        .filter((t) => t.active || byTech.has(t.id))
        .map((t) => ({ id: t.id, name: t.name, tech: t, clients: byTech.get(t.id) ?? [] })),
      ...(byTech.has(NO_TECH)
        ? [{ id: NO_TECH, name: "Sem piscineiro", tech: undefined, clients: byTech.get(NO_TECH)! }]
        : []),
    ].map((g) => {
      const sorted = [...g.clients].sort(
        (a, b) =>
          b.frequency!.days_without_visit - a.frequency!.days_without_visit ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
      return {
        ...g,
        late: sorted.filter((c) => c.frequency!.status === "atrasado").length,
        attention: sorted.filter((c) => c.frequency!.status === "atencao").length,
        visible: status ? sorted.filter((c) => c.frequency!.status === status) : sorted,
      };
    });
    // Quem tem mais atrasados primeiro.
    return list.sort(
      (a, b) =>
        b.late - a.late || b.attention - a.attention || a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [active, data.techs, status]);

  // Filtrar por status abre os blocos que têm clientes nesse status.
  useEffect(() => {
    if (status) setExpanded(new Set(groups.filter((g) => g.visible.length > 0).map((g) => g.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const sentFor = (techId: string) =>
    (sendsQuery.data ?? []).find((s) => s.pool_tech_id === techId);

  if (data.error || casesQuery.error) {
    return (
      <Card className="animate-admin-rise border border-danger/30">
        <Card.Content className="items-center gap-3 py-10 text-center">
          <CircleExclamation className="size-8 text-danger" />
          <div>
            <p className="font-semibold">Não foi possível carregar a frequência</p>
            <p className="text-sm text-muted">{describeDbError(data.error ?? casesQuery.error)}</p>
          </div>
          <Button
            variant="tertiary"
            onPress={() => {
              data.refetch();
              void casesQuery.refetch();
            }}
            isPending={data.isFetching || casesQuery.isFetching}
          >
            {({ isPending }) => (
              <PendingLabel isPending={isPending} icon={<ArrowRotateRight className="size-4" />}>
                Tentar novamente
              </PendingLabel>
            )}
          </Button>
        </Card.Content>
      </Card>
    );
  }

  const isPending = data.isPending || casesQuery.isPending;

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Clientes ativos por status" className="grid grid-cols-3 gap-3">
        {FREQUENCY_STATUSES.map((s, i) => {
          const Icon = STATUS_ICONS[s];
          const selected = status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatus(selected ? undefined : s)}
              className={`animate-admin-rise group flex items-center gap-3 rounded-3xl bg-surface p-3 text-left shadow-surface outline-2 outline-offset-2 transition-[translate,box-shadow,outline-color] duration-300 hover:-translate-y-0.5 hover:shadow-overlay sm:p-4 ${
                selected ? "outline-accent" : "outline-transparent"
              }`}
              style={stagger(i)}
            >
              <span
                className={`hidden size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 sm:grid ${FREQUENCY_STYLES[s].chip}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <span className={`size-2 rounded-full sm:hidden ${FREQUENCY_STYLES[s].dot}`} />
                  {s === "ok" ? "OK" : s === "atencao" ? "Em atenção" : "Atrasados"}
                </span>
                {isPending ? (
                  <Skeleton className="mt-1 h-7 w-10 rounded-md" />
                ) : (
                  <span className="block font-display text-2xl font-semibold tracking-tight text-foreground">
                    <CountUp value={counts[s]} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </section>

      {status && (
        <p className="animate-admin-rise -mt-2 flex items-center gap-2 text-sm text-muted">
          Mostrando só clientes em <strong>{FREQUENCY_LABELS[status]}</strong>.
          <Button size="sm" variant="ghost" onPress={() => setStatus(undefined)}>
            Mostrar todos
          </Button>
        </p>
      )}

      {/* Blocos por piscineiro */}
      <section aria-label="Clientes por piscineiro">
        {isPending ? (
          <div className="skeleton--shimmer flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} animationType="none" className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <Accordion
            allowsMultipleExpanded
            expandedKeys={expanded}
            onExpandedChange={setExpanded}
            className="animate-admin-rise rounded-3xl bg-surface shadow-surface"
          >
            {groups.map((g) => {
              const sent = g.tech ? sentFor(g.tech.id) : undefined;
              return (
                <Accordion.Item key={g.id} id={g.id}>
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
                      {/* No celular, as contagens descem para baixo do nome. */}
                      <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pool-mist text-pool-deep">
                            <Persons className="size-4.5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-foreground">{g.name}</span>
                            <span className="block text-xs text-muted">
                              {g.clients.length} {g.clients.length === 1 ? "cliente" : "clientes"}
                              {g.tech &&
                                (sent ? (
                                  <span className="text-emerald-700">
                                    {" "}
                                    · relatório enviado em {formatDate(sent.sent_at)}
                                  </span>
                                ) : (
                                  <> · relatório da semana pendente</>
                                ))}
                            </span>
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5 pl-12 text-xs font-semibold sm:pl-0">
                          <span
                            className={`rounded-full px-2.5 py-1 ${g.late ? FREQUENCY_STYLES.atrasado.chip : "bg-surface-secondary text-muted"}`}
                          >
                            {g.late} {g.late === 1 ? "atrasado" : "atrasados"}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 ${g.attention ? FREQUENCY_STYLES.atencao.chip : "bg-surface-secondary text-muted"}`}
                          >
                            {g.attention} em atenção
                          </span>
                        </span>
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="px-3 pb-4 sm:px-5">
                      {g.visible.length === 0 ? (
                        <p className="py-3 text-center text-sm text-muted">
                          Nenhum cliente {status ? `em ${FREQUENCY_LABELS[status]}` : "ativo"}.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {g.visible.map((c) => (
                            <ClientFrequencyRow
                              key={c.id}
                              client={c}
                              lateCase={openCaseByClient.get(c.id)}
                              onRegisterVisit={() => onRegisterVisit(c)}
                              onContact={(lateCase) => onContact({ lateCase, client: c })}
                            />
                          ))}
                        </ul>
                      )}
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        )}
      </section>

      <LateReasonsCard
        cases={casesQuery.data ?? []}
        techName={(id) => data.techs.find((t) => t.id === id)?.name ?? "Sem piscineiro"}
        isPending={isPending}
      />
    </div>
  );
}

function ClientFrequencyRow({
  client,
  lateCase,
  onRegisterVisit,
  onContact,
}: {
  client: ClientRow;
  lateCase?: LateCase;
  onRegisterVisit: () => void;
  onContact: (lateCase: LateCase) => void;
}) {
  const f = client.frequency!;
  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border-l-4 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 ${ROW_STYLES[f.status]}`}
    >
      <div className="min-w-0 flex-1">
        <Link
          to="/admin/clientes/$clientId"
          params={{ clientId: client.id }}
          className="font-medium text-foreground hover:text-accent hover:underline"
        >
          {client.name}
        </Link>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{client.plan?.name}</span>
          <span>·</span>
          <span className="tabular-nums">
            {f.visits_this_month} de {f.expected_visits} no mês
          </span>
          {lateCase && (
            <>
              <LateCaseChip status={lateCase.status} />
              {lateCase.reason && (
                <span>
                  {LATE_REASON_LABELS[lateCase.reason]}
                  {lateCase.reason_text && ` — ${lateCase.reason_text}`}
                </span>
              )}
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:justify-end">
        <span
          className={`text-sm font-semibold whitespace-nowrap tabular-nums ${FREQUENCY_STYLES[f.status].text}`}
        >
          {daysLabel(f.days_without_visit)}
          <span className="font-normal text-muted"> sem visita</span>
        </span>
        <div className="flex gap-1.5 max-sm:w-full max-sm:*:flex-1">
          {lateCase && (
            <Button size="sm" variant="secondary" onPress={() => onContact(lateCase)}>
              <Megaphone className="size-3.5" />
              {lateCase.status === "acionado" ? "Motivo" : "Acionamento"}
            </Button>
          )}
          <Button size="sm" onPress={onRegisterVisit}>
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">Registrar visita</span>
            <span className="sm:hidden">Visita</span>
          </Button>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Motivos de atraso por piscineiro
// ---------------------------------------------------------------------------

const REASON_PERIODS = { mes: "Este mês", anterior: "Mês anterior", tudo: "Tudo" } as const;
type ReasonPeriod = keyof typeof REASON_PERIODS;
const NO_REASON = "sem_motivo";
type ReasonKey = LateReason | typeof NO_REASON;
const REASON_COLUMNS: { key: ReasonKey; label: string }[] = [
  ...LATE_REASONS.map((r) => ({ key: r as ReasonKey, label: LATE_REASON_LABELS[r] })),
  { key: NO_REASON, label: "Sem motivo" },
];

function LateReasonsCard({
  cases,
  techName,
  isPending,
}: {
  cases: LateCase[];
  techName: (id: string | null) => string;
  isPending: boolean;
}) {
  const [period, setPeriod] = useState<ReasonPeriod>("mes");

  const rows = useMemo(() => {
    const today = parseISO(todayISO());
    const range =
      period === "mes"
        ? [startOfMonth(today), today]
        : period === "anterior"
          ? [startOfMonth(subMonths(today, 1)), endOfMonth(subMonths(today, 1))]
          : null;
    const [from, to] = range ? range.map((d) => format(d, "yyyy-MM-dd")) : ["", "9999"];
    // "Lançamento atrasado" não foi atraso real: fica fora do relatório.
    const relevant = cases.filter(
      (c) => c.status !== "lancamento_atrasado" && c.late_since >= from && c.late_since <= to,
    );
    const byTech = new Map<string, Record<ReasonKey, number> & { total: number }>();
    for (const c of relevant) {
      const key = c.pool_tech_id ?? NO_TECH;
      const row =
        byTech.get(key) ??
        ({ total: 0, ...Object.fromEntries(REASON_COLUMNS.map((r) => [r.key, 0])) } as Record<
          ReasonKey,
          number
        > & { total: number });
      row[c.reason ?? NO_REASON] += 1;
      row.total += 1;
      byTech.set(key, row);
    }
    return [...byTech.entries()]
      .map(([id, counts]) => ({ id, name: techName(id === NO_TECH ? null : id), counts }))
      .sort((a, b) => b.counts.total - a.counts.total);
  }, [cases, period, techName]);

  const totals = Object.fromEntries(
    REASON_COLUMNS.map((r) => [r.key, rows.reduce((sum, row) => sum + row.counts[r.key], 0)]),
  ) as Record<ReasonKey, number>;
  // Só mostra colunas com algum caso, para caber no celular.
  const columns = REASON_COLUMNS.filter((r) => totals[r.key] > 0);

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(4)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Motivos de atraso
          </h2>
          <p className="text-xs text-muted">
            Casos por piscineiro, pela data em que o cliente ficou atrasado.
          </p>
        </div>
        <ToggleButtonGroup
          aria-label="Período"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set<Key>([period])}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next) setPeriod(next as ReasonPeriod);
          }}
        >
          {(Object.keys(REASON_PERIODS) as ReasonPeriod[]).map((k, i) => (
            <ToggleButton key={k} id={k} size="sm">
              {i > 0 && <ToggleButtonGroup.Separator />}
              {REASON_PERIODS[k]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      {isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum caso de atraso neste período.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Motivos de atraso por piscineiro">
              <Table.Header>
                <Table.Column id="tech" isRowHeader>
                  Piscineiro
                </Table.Column>
                <Table.Column id="total" className="text-end">
                  Casos
                </Table.Column>
                {columns.map((c) => (
                  <Table.Column key={c.key} id={c.key} className="text-end whitespace-nowrap">
                    {c.label}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body items={rows}>
                {(row) => (
                  <Table.Row id={row.id}>
                    <Table.Cell className="font-medium whitespace-nowrap">{row.name}</Table.Cell>
                    <Table.Cell className="text-end font-semibold tabular-nums">
                      {row.counts.total}
                    </Table.Cell>
                    {columns.map((c) => (
                      <Table.Cell
                        key={c.key}
                        className={`text-end tabular-nums ${row.counts[c.key] ? "" : "text-muted"}`}
                      >
                        {row.counts[c.key] || "—"}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Registrar acionamento (fica fora do Tabs, junto dos outros pop-ups)
// ---------------------------------------------------------------------------

export function ContactModal({
  target,
  onClose,
}: {
  target: ContactTarget | null;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={!!target} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Fechar" />
          {target && <ContactForm key={target.lateCase.id} target={target} onClose={onClose} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ContactForm({ target, onClose }: { target: ContactTarget; onClose: () => void }) {
  const { lateCase, client } = target;
  const registerContact = useRegisterContact();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LateCaseFormInput, unknown, LateCaseFormValues>({
    resolver: zodResolver(lateCaseFormSchema),
    defaultValues: {
      reason: lateCase.reason ?? undefined,
      reason_text: lateCase.reason_text ?? "",
    },
  });
  const reason = useWatch({ control, name: "reason" });

  const onSubmit = async (values: LateCaseFormValues) => {
    setSubmitError(null);
    try {
      await registerContact.mutateAsync({ lateCase, values });
      onClose();
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  const f = client.frequency;
  return (
    <>
      <Modal.Header>
        <Modal.Heading>Registrar acionamento</Modal.Heading>
        <p className="text-sm text-muted">
          <strong className="font-semibold text-foreground">{client.name}</strong> · atrasado desde{" "}
          {formatDate(lateCase.late_since)}
          {f && ` · ${daysLabel(f.days_without_visit)} sem visita`}
          {client.tech && ` · ${client.tech.name}`}
        </p>
      </Modal.Header>
      <Modal.Body>
        <form
          id="contact-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          {lateCase.contacted_at && (
            <p className="text-xs text-muted">
              Acionado em {formatDateTime(lateCase.contacted_at)}. Você pode corrigir o motivo.
            </p>
          )}
          <Controller
            control={control}
            name="reason"
            render={({ field, fieldState }) => (
              <RadioGroup
                variant="secondary"
                value={field.value ?? null}
                onChange={field.onChange}
                isInvalid={!!fieldState.error}
              >
                <Label>Motivo do atraso, segundo o piscineiro</Label>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {LATE_REASONS.map((r) => (
                    <Radio key={r} value={r}>
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        {LATE_REASON_LABELS[r]}
                      </Radio.Content>
                    </Radio>
                  ))}
                </div>
                <FieldError>{fieldState.error?.message}</FieldError>
              </RadioGroup>
            )}
          />
          <Controller
            control={control}
            name="reason_text"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isRequired={reason === "outro"}
                name={field.name}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
                maxLength={500}
              >
                <Label>{reason === "outro" ? "Qual motivo?" : "Detalhes"}</Label>
                <Input
                  variant="secondary"
                  placeholder={
                    reason === "outro" ? "Descreva o motivo" : "Opcional. Ex.: volta dia 25"
                  }
                />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <p className="text-xs text-muted">
            O caso fecha sozinho quando uma visita nova do cliente for registrada.
          </p>
          {submitError && (
            <StatusAlert
              status="danger"
              title="Não foi possível salvar"
              description={submitError}
            />
          )}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="contact-form"
          isPending={isSubmitting || registerContact.isPending}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {lateCase.status === "acionado" ? "Salvar motivo" : "Registrar acionamento"}
            </PendingLabel>
          )}
        </Button>
      </Modal.Footer>
    </>
  );
}
