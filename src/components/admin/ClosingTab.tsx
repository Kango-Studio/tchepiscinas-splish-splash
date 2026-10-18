import { useMemo, useState } from "react";
import {
  Accordion,
  Button,
  Card,
  Label,
  ListBox,
  Select,
  Skeleton,
  Table,
  Tooltip,
  type Key,
} from "@heroui/react";
import {
  ArrowRotateRight,
  CircleExclamation,
  Comment,
  Pencil,
  Persons,
  TrashBin,
} from "@gravity-ui/icons";
import { Link } from "@tanstack/react-router";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SERVICE_LABELS } from "@/lib/visits/services";
import { formatMoney, type Visit } from "@/lib/visits/schema";
import { currentMonth, monthLabel } from "@/lib/visits/frequency";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import { useAppSettings, useVisitsInRange } from "./visits-api";
import { useClientRows } from "./visits-ui";
import { CountUp, PendingLabel } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;
const MONTHS_BACK = 12;

const MAX_SERVICE_CHIPS = 3;

function ServiceChips({ visit }: { visit: Visit }) {
  const labels = visit.services.map((s) =>
    s === "outro" && visit.service_other ? visit.service_other : SERVICE_LABELS[s],
  );
  const shown = labels.slice(0, MAX_SERVICE_CHIPS);
  return (
    <span className="flex flex-wrap gap-1" title={labels.join(", ")}>
      {shown.map((l) => (
        <span
          key={l}
          className="rounded-full bg-pool-mist px-2 py-0.5 text-xs whitespace-nowrap text-pool-deep"
        >
          {l}
        </span>
      ))}
      {labels.length > shown.length && (
        <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted">
          +{labels.length - shown.length}
        </span>
      )}
    </span>
  );
}

export function ClosingTab({
  month,
  onMonthChange,
  onEdit,
  onDelete,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  onEdit: (visit: Visit) => void;
  onDelete: (visit: Visit) => void;
}) {
  const from = `${month}-01`;
  const to = format(endOfMonth(parseISO(from)), "yyyy-MM-dd");
  const visitsQuery = useVisitsInRange({ from, to });
  const settings = useAppSettings();
  const data = useClientRows();
  const [expanded, setExpanded] = useState<Set<Key>>(new Set());

  const monthOptions = useMemo(() => {
    const now = startOfMonth(parseISO(todayISO()));
    return Array.from({ length: MONTHS_BACK + 1 }, (_, i) => {
      const id = format(subMonths(now, i), "yyyy-MM");
      return { id, label: monthLabel(id) };
    });
  }, []);

  const rate = settings.data?.visit_rate ?? 0;
  const visits = useMemo(() => visitsQuery.data ?? [], [visitsQuery.data]);
  const clientName = (id: string) => data.rows.find((c) => c.id === id)?.name ?? "—";

  // Uma linha por piscineiro: ativos sempre, inativos só se tiverem visitas no mês.
  const groups = useMemo(() => {
    const byTech = new Map<string, Visit[]>();
    for (const v of visits) byTech.set(v.pool_tech_id, [...(byTech.get(v.pool_tech_id) ?? []), v]);
    return data.techs
      .filter((t) => t.active || byTech.has(t.id))
      .map((t) => {
        // Para conferir, em ordem de data.
        const list = [...(byTech.get(t.id) ?? [])].sort(
          (a, b) =>
            a.visit_date.localeCompare(b.visit_date) || a.created_at.localeCompare(b.created_at),
        );
        return { tech: t, visits: list, amount: list.length * rate };
      })
      .sort((a, b) => b.visits.length - a.visits.length || a.tech.name.localeCompare(b.tech.name));
  }, [visits, data.techs, rate]);

  const error = visitsQuery.error ?? settings.error ?? data.error;
  const isPending = visitsQuery.isPending || settings.isPending || data.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-60">
          <Select fullWidth value={month} onChange={(key) => key && onMonthChange(String(key))}>
            <Label>Mês</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {monthOptions.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    {o.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        {month === currentMonth() && (
          <p className="text-xs text-muted sm:pb-2.5">
            Mês em andamento: o total ainda pode mudar.
          </p>
        )}
      </div>

      {error ? (
        <Card className="animate-admin-rise border border-danger/30">
          <Card.Content className="items-center gap-3 py-10 text-center">
            <CircleExclamation className="size-8 text-danger" />
            <div>
              <p className="font-medium">Não foi possível carregar o fechamento</p>
              <p className="text-sm text-muted">{describeDbError(error)}</p>
            </div>
            <Button
              variant="tertiary"
              onPress={() => {
                void visitsQuery.refetch();
                void settings.refetch();
                data.refetch();
              }}
              isPending={visitsQuery.isFetching || settings.isFetching}
            >
              {({ isPending }) => (
                <PendingLabel isPending={isPending} icon={<ArrowRotateRight className="size-4" />}>
                  Tentar novamente
                </PendingLabel>
              )}
            </Button>
          </Card.Content>
        </Card>
      ) : (
        <>
          <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Visitas no mês", value: <CountUp value={visits.length} /> },
              {
                label: "Valor por visita",
                value: formatMoney(rate),
                hint: (
                  <Link to="/admin/configuracoes" className="text-accent hover:underline">
                    alterar
                  </Link>
                ),
              },
              {
                label: "Total a pagar",
                value: formatMoney(visits.length * rate),
                className: "col-span-2 sm:col-span-1",
              },
            ].map((it, i) => (
              <Card
                key={it.label}
                className={`animate-admin-rise gap-0.5 p-4 ${it.className ?? ""}`}
                style={stagger(i)}
              >
                <p className="flex items-baseline justify-between gap-2 text-xs text-muted">
                  {it.label}
                  {it.hint}
                </p>
                {isPending ? (
                  <Skeleton className="mt-1 h-7 w-24 rounded-md" />
                ) : (
                  <p className="font-display text-2xl font-medium tracking-tight text-foreground tabular-nums">
                    {it.value}
                  </p>
                )}
              </Card>
            ))}
          </section>

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
              {groups.map((g) => (
                <Accordion.Item key={g.tech.id} id={g.tech.id}>
                  <Accordion.Heading>
                    <Accordion.Trigger className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pool-mist text-pool-deep">
                        <Persons className="size-4.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          {g.tech.name}
                          {!g.tech.active && (
                            <span className="ml-2 text-xs font-normal text-muted">inativo</span>
                          )}
                        </span>
                        <span className="block text-xs text-muted tabular-nums">
                          {g.visits.length} {g.visits.length === 1 ? "visita" : "visitas"} ×{" "}
                          {formatMoney(rate)}
                        </span>
                      </span>
                      <span className="font-display text-lg font-medium text-foreground tabular-nums">
                        {formatMoney(g.amount)}
                      </span>
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="px-3 pb-4 sm:px-5">
                      {g.visits.length === 0 ? (
                        <p className="py-3 text-center text-sm text-muted">
                          Nenhuma visita em {monthLabel(month).toLowerCase()}.
                        </p>
                      ) : (
                        <Table>
                          <Table.ScrollContainer>
                            <Table.Content aria-label={`Visitas de ${g.tech.name}`}>
                              <Table.Header>
                                <Table.Column id="date" isRowHeader>
                                  Data
                                </Table.Column>
                                <Table.Column id="client">Cliente</Table.Column>
                                <Table.Column id="services" className="hidden md:table-cell">
                                  Serviços
                                </Table.Column>
                                <Table.Column id="actions" className="text-end">
                                  Ações
                                </Table.Column>
                              </Table.Header>
                              <Table.Body items={g.visits}>
                                {(v) => (
                                  <Table.Row id={v.id}>
                                    <Table.Cell className="whitespace-nowrap tabular-nums">
                                      {format(parseISO(v.visit_date), "dd/MM")}
                                      <span className="ml-1.5 hidden text-xs text-muted sm:inline">
                                        {format(parseISO(v.visit_date), "EEE", { locale: ptBR })}
                                      </span>
                                    </Table.Cell>
                                    <Table.Cell>
                                      <Link
                                        to="/admin/clientes/$clientId"
                                        params={{ clientId: v.client_id }}
                                        className="text-foreground hover:text-accent hover:underline"
                                      >
                                        {clientName(v.client_id)}
                                      </Link>
                                      {v.notes && (
                                        <span className="mt-0.5 flex items-start gap-1 text-xs text-muted md:max-w-72">
                                          <Comment
                                            className="mt-0.5 size-3 shrink-0"
                                            aria-label="Observação"
                                          />
                                          <span className="line-clamp-1">{v.notes}</span>
                                        </span>
                                      )}
                                    </Table.Cell>
                                    <Table.Cell className="hidden md:table-cell">
                                      <ServiceChips visit={v} />
                                    </Table.Cell>
                                    <Table.Cell>
                                      <div className="flex justify-end gap-1">
                                        <Tooltip delay={300} closeDelay={0}>
                                          <Tooltip.Trigger>
                                            <Button
                                              isIconOnly
                                              size="sm"
                                              variant="tertiary"
                                              className="rounded-full"
                                              aria-label={`Editar visita de ${clientName(v.client_id)}`}
                                              onPress={() => onEdit(v)}
                                            >
                                              <Pencil className="size-4" />
                                            </Button>
                                          </Tooltip.Trigger>
                                          <Tooltip.Content>Editar</Tooltip.Content>
                                        </Tooltip>
                                        <Tooltip delay={300} closeDelay={0}>
                                          <Tooltip.Trigger>
                                            <Button
                                              isIconOnly
                                              size="sm"
                                              variant="ghost"
                                              className="rounded-full text-muted hover:text-danger"
                                              aria-label={`Excluir visita de ${clientName(v.client_id)}`}
                                              onPress={() => onDelete(v)}
                                            >
                                              <TrashBin className="size-4" />
                                            </Button>
                                          </Tooltip.Trigger>
                                          <Tooltip.Content>Excluir</Tooltip.Content>
                                        </Tooltip>
                                      </div>
                                    </Table.Cell>
                                  </Table.Row>
                                )}
                              </Table.Body>
                            </Table.Content>
                          </Table.ScrollContainer>
                        </Table>
                      )}
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
          <p className="-mt-2 text-xs text-muted">
            O valor por visita vale para todos os meses: se mudar em Configurações, o fechamento de
            meses anteriores também muda.
          </p>
        </>
      )}
    </div>
  );
}
