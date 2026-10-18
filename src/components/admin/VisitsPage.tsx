import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Label,
  ListBox,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tooltip,
} from "@heroui/react";
import {
  ArrowRotateRight,
  CircleExclamation,
  Comment,
  ListUl,
  Pencil,
  Plus,
  Pulse,
  TrashBin,
  Tray,
} from "@gravity-ui/icons";
import { Link } from "@tanstack/react-router";
import { endOfMonth, format, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SERVICE_LABELS } from "@/lib/visits/services";
import type { Visit } from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import { TablePager } from "./LeadTable";
import { useVisitsInRange } from "./visits-api";
import { useClientRows } from "./visits-ui";
import { DeleteVisitDialog, VisitModal, type VisitModalState } from "./VisitModal";
import { ContactModal, FrequencyTab, type ContactTarget } from "./FrequencyTab";
import { PendingLabel } from "./ui";

export const VISIT_PERIODS = ["7d", "mes", "mes_anterior", "3m"] as const;
export type VisitPeriod = (typeof VISIT_PERIODS)[number];
const PERIOD_LABELS: Record<VisitPeriod, string> = {
  "7d": "Últimos 7 dias",
  mes: "Este mês",
  mes_anterior: "Mês anterior",
  "3m": "Últimos 3 meses",
};

// "visitas" vira a base da aba Fechamento na etapa 6.
export const VISIT_TABS = ["frequencia", "visitas"] as const;
export type VisitTab = (typeof VISIT_TABS)[number];

export type VisitFilters = { aba?: VisitTab; piscineiro?: string; periodo?: VisitPeriod };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function periodRange(period: VisitPeriod, today: string) {
  const t = parseISO(today);
  switch (period) {
    case "7d":
      return { from: iso(subDays(t, 6)), to: today };
    case "mes_anterior": {
      const prev = subMonths(t, 1);
      return { from: iso(startOfMonth(prev)), to: iso(endOfMonth(prev)) };
    }
    case "3m":
      return { from: iso(subMonths(t, 3)), to: today };
    default:
      return { from: iso(startOfMonth(t)), to: today };
  }
}

const ALL = "__all";
const PAGE_SIZE = 20;
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
          className="rounded-full bg-pool-mist px-2 py-0.5 text-xs font-medium whitespace-nowrap text-pool-deep"
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

export function VisitsPage({
  filters,
  onFiltersChange,
}: {
  filters: VisitFilters;
  onFiltersChange: (filters: VisitFilters) => void;
}) {
  const data = useClientRows();
  const [modal, setModal] = useState<VisitModalState>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);
  const [contact, setContact] = useState<ContactTarget | null>(null);
  const tab = filters.aba ?? "frequencia";

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="animate-admin-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
              Visitas
            </h1>
            <p className="text-sm text-muted">Frequência dos clientes e registro das visitas.</p>
          </div>
          <Button size="lg" onPress={() => setModal({})}>
            <Plus className="size-4" />
            Registrar visita
          </Button>
        </div>

        <Tabs
          selectedKey={tab}
          onSelectionChange={(k) =>
            onFiltersChange({ ...filters, aba: k === "frequencia" ? undefined : (k as VisitTab) })
          }
          className="gap-5"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Seções de visitas">
              <Tabs.Tab id="frequencia" className="gap-1.5">
                <Pulse className="size-4" />
                Frequência
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="visitas" className="gap-1.5">
                <Tabs.Separator />
                <ListUl className="size-4" />
                <span className="sm:hidden">Registradas</span>
                <span className="hidden sm:inline">Visitas registradas</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="frequencia" className="animate-admin-rise">
            <FrequencyTab
              onRegisterVisit={(c) =>
                setModal({ clientId: c.id, techId: c.pool_tech_id ?? undefined })
              }
              onContact={setContact}
            />
          </Tabs.Panel>
          <Tabs.Panel id="visitas" className="animate-admin-rise">
            <VisitsListTab
              filters={filters}
              onFiltersChange={onFiltersChange}
              onRegister={() => setModal({})}
              onEdit={(visit) => setModal({ visit })}
              onDelete={setToDelete}
            />
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Pop-ups fora do Tabs: dentro dele o React Aria os duplicaria. */}
      <VisitModal state={modal} onClose={() => setModal(null)} />
      <DeleteVisitDialog
        visit={toDelete}
        clientName={toDelete ? data.rows.find((c) => c.id === toDelete.client_id)?.name : undefined}
        onClose={() => setToDelete(null)}
      />
      <ContactModal target={contact} onClose={() => setContact(null)} />
    </>
  );
}

function VisitsListTab({
  filters,
  onFiltersChange,
  onRegister,
  onEdit,
  onDelete,
}: {
  filters: VisitFilters;
  onFiltersChange: (filters: VisitFilters) => void;
  onRegister: () => void;
  onEdit: (visit: Visit) => void;
  onDelete: (visit: Visit) => void;
}) {
  const period = filters.periodo ?? "mes";
  const today = todayISO();
  const range = periodRange(period, today);
  const visitsQuery = useVisitsInRange({ ...range, techId: filters.piscineiro });
  const data = useClientRows();
  const [page, setPage] = useState(1);

  const visits = useMemo(() => visitsQuery.data ?? [], [visitsQuery.data]);
  const clientName = (id: string) => data.rows.find((c) => c.id === id)?.name ?? "—";
  const techName = (id: string) => data.techs.find((t) => t.id === id)?.name ?? "—";

  const pages = Math.max(1, Math.ceil(visits.length / PAGE_SIZE));
  const filtersKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [filtersKey]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const pageItems = visits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const clientsServed = new Set(visits.map((v) => v.client_id)).size;
  const isPending = visitsQuery.isPending || data.isPending;
  const error = visitsQuery.error ?? data.error;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 items-end gap-2.5 sm:flex sm:flex-wrap">
        <div className="sm:w-48">
          <Select
            fullWidth
            value={filters.piscineiro ?? ALL}
            onChange={(key) => {
              const v = String(key ?? ALL);
              onFiltersChange({ ...filters, piscineiro: v === ALL ? undefined : v });
            }}
          >
            <Label>Piscineiro</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {[
                  { id: ALL, label: "Todos" },
                  ...data.techs.map((t) => ({ id: t.id, label: t.name })),
                ].map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    {o.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="sm:w-48">
          <Select
            fullWidth
            value={period}
            onChange={(key) =>
              onFiltersChange({
                ...filters,
                periodo: key === "mes" || !key ? undefined : (key as VisitPeriod),
              })
            }
          >
            <Label>Período</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {VISIT_PERIODS.map((p) => (
                  <ListBox.Item key={p} id={p} textValue={PERIOD_LABELS[p]}>
                    {PERIOD_LABELS[p]}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        {!isPending && !error && (
          <p className="animate-admin-rise col-span-2 text-sm text-muted sm:ml-auto sm:self-center">
            <strong className="font-semibold text-foreground">{visits.length}</strong>{" "}
            {visits.length === 1 ? "visita" : "visitas"} ·{" "}
            <strong className="font-semibold text-foreground">{clientsServed}</strong>{" "}
            {clientsServed === 1 ? "cliente" : "clientes"} · {format(parseISO(range.from), "dd/MM")}{" "}
            a {format(parseISO(range.to), "dd/MM")}
          </p>
        )}
      </div>

      {error ? (
        <Card className="animate-admin-rise border border-danger/30">
          <Card.Content className="items-center gap-3 py-10 text-center">
            <CircleExclamation className="size-8 text-danger" />
            <div>
              <p className="font-semibold">Não foi possível carregar as visitas</p>
              <p className="text-sm text-muted">{describeDbError(error)}</p>
            </div>
            <Button
              variant="tertiary"
              onPress={() => {
                void visitsQuery.refetch();
                data.refetch();
              }}
              isPending={visitsQuery.isFetching}
            >
              {({ isPending }) => (
                <PendingLabel isPending={isPending} icon={<ArrowRotateRight className="size-4" />}>
                  Tentar novamente
                </PendingLabel>
              )}
            </Button>
          </Card.Content>
        </Card>
      ) : isPending ? (
        <Card className="skeleton--shimmer gap-3 p-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} animationType="none" className="h-10 rounded-lg" />
          ))}
        </Card>
      ) : (
        <Table className="animate-admin-rise">
          <Table.ScrollContainer>
            <Table.Content aria-label="Visitas registradas">
              <Table.Header>
                <Table.Column id="date" isRowHeader>
                  Data
                </Table.Column>
                <Table.Column id="client">Cliente</Table.Column>
                <Table.Column id="tech" className="hidden sm:table-cell">
                  Piscineiro
                </Table.Column>
                <Table.Column id="services" className="hidden md:table-cell">
                  Serviços
                </Table.Column>
                <Table.Column id="actions" className="text-end">
                  Ações
                </Table.Column>
              </Table.Header>
              <Table.Body
                items={pageItems}
                renderEmptyState={() => (
                  <EmptyState className="flex flex-col items-center gap-2 py-10 text-center">
                    <Tray className="size-8 text-muted" />
                    <p className="text-sm text-muted">Nenhuma visita neste período.</p>
                    <Button size="sm" variant="tertiary" onPress={onRegister}>
                      <Plus className="size-4" />
                      Registrar visita
                    </Button>
                  </EmptyState>
                )}
              >
                {(v) => (
                  <Table.Row id={v.id}>
                    <Table.Cell>
                      <span className="block font-medium whitespace-nowrap tabular-nums">
                        {format(parseISO(v.visit_date), "dd/MM/yyyy")}
                      </span>
                      <span className="block text-xs text-muted">
                        {format(parseISO(v.visit_date), "EEEE", { locale: ptBR })}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <Link
                        to="/admin/clientes/$clientId"
                        params={{ clientId: v.client_id }}
                        className="font-medium text-foreground hover:text-accent hover:underline"
                      >
                        {clientName(v.client_id)}
                      </Link>
                      <span className="block text-xs text-muted sm:hidden">
                        {techName(v.pool_tech_id)}
                      </span>
                      {v.notes && (
                        <span className="mt-0.5 flex items-start gap-1 text-xs text-muted md:max-w-72">
                          <Comment className="mt-0.5 size-3 shrink-0" aria-label="Observação" />
                          <span className="line-clamp-1">{v.notes}</span>
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
                      {techName(v.pool_tech_id)}
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
          {pages > 1 && (
            <Table.Footer>
              <TablePager
                page={page}
                pages={pages}
                onPageChange={setPage}
                summary={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, visits.length)} de ${visits.length} visitas`}
              />
            </Table.Footer>
          )}
        </Table>
      )}
    </div>
  );
}
