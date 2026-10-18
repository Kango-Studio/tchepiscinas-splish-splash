import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  Select,
  Skeleton,
  Table,
  Tooltip,
  type SortDescriptor,
} from "@heroui/react";
import {
  ArrowRotateRight,
  CircleCheck,
  CircleExclamation,
  Clock,
  Eye,
  Plus,
  Tray,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import { useNavigate } from "@tanstack/react-router";
import {
  FREQUENCY_LABELS,
  FREQUENCY_STATUSES,
  formatMoney,
  clientPrice,
  type FrequencyStatus,
} from "@/lib/visits/schema";
import { describeDbError } from "./leads-api";
import { TablePager } from "./LeadTable";
import { ClientDrawer } from "./ClientDrawer";
import {
  FREQUENCY_STYLES,
  FrequencyChip,
  daysLabel,
  useClientRows,
  type ClientRow,
} from "./visits-ui";
import { CountUp, LeadWhatsAppButton, PendingLabel } from "./ui";

export const CLIENT_SITUATIONS = ["ativos", "inativos", "todos"] as const;
export type ClientSituation = (typeof CLIENT_SITUATIONS)[number];

export type ClientFilters = {
  q?: string;
  situacao?: ClientSituation;
  status?: FrequencyStatus;
  piscineiro?: string;
  plano?: string;
};

const ALL = "__all";
const NO_TECH = "__none";
const PAGE_SIZE = 15;

const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

function applyFilters(rows: ClientRow[], f: ClientFilters) {
  const situacao = f.situacao ?? "ativos";
  const term = normalize(f.q ?? "");
  const digits = (f.q ?? "").replace(/\D/g, "");
  return rows.filter((r) => {
    if (situacao === "ativos" && !r.active) return false;
    if (situacao === "inativos" && r.active) return false;
    if (f.status && (!r.active || r.frequency?.status !== f.status)) return false;
    if (f.piscineiro === NO_TECH ? r.pool_tech_id : f.piscineiro && r.pool_tech_id !== f.piscineiro)
      return false;
    if (f.plano && r.plan_id !== f.plano) return false;
    if (term) {
      const inName = normalize(r.name).includes(term);
      const inHood = normalize(r.neighborhood ?? "").includes(term);
      const inPhone = digits.length >= 3 && (r.whatsapp ?? "").includes(digits);
      if (!inName && !inHood && !inPhone) return false;
    }
    return true;
  });
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "Todos",
}: {
  label: string;
  value: string | undefined;
  options: { id: string; label: string }[];
  onChange: (value: string | undefined) => void;
  allLabel?: string;
}) {
  return (
    <Select
      fullWidth
      value={value ?? ALL}
      onChange={(key) => {
        const v = String(key ?? ALL);
        onChange(v === ALL ? undefined : v);
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {[{ id: ALL, label: allLabel }, ...options].map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

const STATUS_ICONS = { ok: CircleCheck, atencao: Clock, atrasado: TriangleExclamation };

export function ClientsPage({
  filters,
  onFiltersChange,
}: {
  filters: ClientFilters;
  onFiltersChange: (filters: ClientFilters) => void;
}) {
  const navigate = useNavigate();
  const data = useClientRows();
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDescriptor>({ column: "days", direction: "descending" });

  const set = <K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value || undefined });

  const filtered = useMemo(() => applyFilters(data.rows, filters), [data.rows, filters]);
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort.column === "name") list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    else
      list.sort(
        (a, b) =>
          (a.frequency?.days_without_visit ?? 0) - (b.frequency?.days_without_visit ?? 0) ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
    return sort.direction === "descending" ? list.reverse() : list;
  }, [filtered, sort]);

  // Contagem por status: só ativos e sem o filtro de status (os cards são o filtro).
  const counts = useMemo(() => {
    const base = applyFilters(data.rows, { ...filters, status: undefined, situacao: "ativos" });
    return Object.fromEntries(
      FREQUENCY_STATUSES.map((s) => [s, base.filter((r) => r.frequency?.status === s).length]),
    ) as Record<FrequencyStatus, number>;
  }, [data.rows, filters]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const filtersKey = JSON.stringify(filters);
  useEffect(() => setPage(1), [filtersKey]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters =
    !!filters.q ||
    !!filters.status ||
    !!filters.piscineiro ||
    !!filters.plano ||
    (filters.situacao ?? "ativos") !== "ativos";

  const openClient = (id: string) =>
    navigate({ to: "/admin/clientes/$clientId", params: { clientId: id } });

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-admin-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
            Clientes
          </h1>
          <p className="text-sm text-muted">Cadastro, plano e frequência de visitas.</p>
        </div>
        <Button onPress={() => setCreating(true)} isDisabled={data.isPending}>
          <Plus className="size-4" />
          Novo cliente
        </Button>
      </div>

      <section aria-label="Clientes ativos por status" className="grid grid-cols-3 gap-3">
        {FREQUENCY_STATUSES.map((s, i) => {
          const Icon = STATUS_ICONS[s];
          const selected = filters.status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={selected}
              onClick={() => set("status", selected ? undefined : s)}
              className={`animate-admin-rise group flex items-center gap-3 rounded-3xl bg-surface p-3 text-left shadow-surface transition-[translate,box-shadow,outline-color] duration-300 outline-2 outline-offset-2 hover:-translate-y-0.5 hover:shadow-overlay sm:p-4 ${
                selected ? "outline-accent" : "outline-transparent"
              }`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span
                className={`hidden size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 sm:grid ${FREQUENCY_STYLES[s].chip}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-normal text-muted">
                  <span className={`size-2 rounded-full sm:hidden ${FREQUENCY_STYLES[s].dot}`} />
                  {FREQUENCY_LABELS[s]}
                </span>
                {data.isPending ? (
                  <Skeleton className="mt-1 h-7 w-10 rounded-md" />
                ) : (
                  <span className="block font-display text-2xl font-medium tracking-tight text-foreground">
                    <CountUp value={counts[s]} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </section>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
        <SearchField
          aria-label="Buscar cliente"
          className="col-span-2 sm:col-span-3 lg:w-72 lg:flex-none"
          fullWidth
          value={filters.q ?? ""}
          onChange={(v) => set("q", v)}
          onClear={() => set("q", undefined)}
        >
          <Label className="sr-only lg:not-sr-only">Buscar</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Nome, bairro ou telefone" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <div className="lg:w-40">
          <FilterSelect
            label="Situação"
            value={filters.situacao === "ativos" ? undefined : filters.situacao}
            allLabel="Ativos"
            options={[
              { id: "inativos", label: "Inativos" },
              { id: "todos", label: "Todos" },
            ]}
            onChange={(v) => set("situacao", v as ClientSituation | undefined)}
          />
        </div>
        <div className="lg:w-40">
          <FilterSelect
            label="Status"
            value={filters.status}
            options={FREQUENCY_STATUSES.map((s) => ({ id: s, label: FREQUENCY_LABELS[s] }))}
            onChange={(v) => set("status", v as FrequencyStatus | undefined)}
          />
        </div>
        <div className="lg:w-44">
          <FilterSelect
            label="Piscineiro"
            value={filters.piscineiro}
            options={[
              ...data.techs.map((t) => ({ id: t.id, label: t.name })),
              { id: NO_TECH, label: "Sem piscineiro" },
            ]}
            onChange={(v) => set("piscineiro", v)}
          />
        </div>
        <div className="lg:w-44">
          <FilterSelect
            label="Plano"
            value={filters.plano}
            options={data.plans.map((p) => ({ id: p.id, label: p.name }))}
            onChange={(v) => set("plano", v)}
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            className="animate-admin-rise self-end"
            onPress={() => onFiltersChange({})}
          >
            <Xmark className="size-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {data.error ? (
        <Card className="animate-admin-rise border border-danger/30">
          <Card.Content className="items-center gap-3 py-10 text-center">
            <CircleExclamation className="size-8 text-danger" />
            <div>
              <p className="font-semibold">Não foi possível carregar os clientes</p>
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
      ) : data.isPending ? (
        <Card className="skeleton--shimmer gap-3 p-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} animationType="none" className="h-10 rounded-lg" />
          ))}
        </Card>
      ) : (
        <Table className="animate-admin-rise">
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Lista de clientes"
              sortDescriptor={sort}
              onSortChange={setSort}
              onRowAction={(key) => openClient(String(key))}
            >
              <Table.Header>
                <Table.Column id="name" isRowHeader allowsSorting>
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Cliente
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                <Table.Column id="status" className="hidden sm:table-cell">
                  Status
                </Table.Column>
                <Table.Column id="days" allowsSorting>
                  {({ sortDirection }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>
                      Sem visita
                    </Table.SortableColumnHeader>
                  )}
                </Table.Column>
                <Table.Column id="month" className="hidden md:table-cell">
                  Visitas no mês
                </Table.Column>
                <Table.Column id="plan" className="hidden sm:table-cell">
                  Plano
                </Table.Column>
                <Table.Column id="tech" className="hidden md:table-cell">
                  Piscineiro
                </Table.Column>
                <Table.Column id="price" className="hidden lg:table-cell">
                  Valor
                </Table.Column>
                <Table.Column id="actions" className="hidden text-end sm:table-cell">
                  Ações
                </Table.Column>
              </Table.Header>
              <Table.Body
                items={pageItems}
                renderEmptyState={() => (
                  <EmptyState className="flex flex-col items-center gap-2 py-10 text-center">
                    <Tray className="size-8 text-muted" />
                    <p className="text-sm text-muted">
                      {data.rows.length === 0
                        ? "Nenhum cliente cadastrado."
                        : "Nenhum cliente encontrado com esses filtros."}
                    </p>
                    {hasFilters && (
                      <Button size="sm" variant="tertiary" onPress={() => onFiltersChange({})}>
                        Limpar filtros
                      </Button>
                    )}
                  </EmptyState>
                )}
              >
                {(row) => {
                  const f = row.frequency;
                  const tone = row.active && f ? FREQUENCY_STYLES[f.status].text : "text-muted";
                  return (
                    <Table.Row id={row.id} className="cursor-pointer">
                      <Table.Cell>
                        <span className="block font-normal sm:whitespace-nowrap">{row.name}</span>
                        {/* No celular: plano e bairro embaixo do nome. */}
                        <span className="block text-xs text-muted">
                          <span className="sm:hidden">
                            {row.plan?.name}
                            {row.neighborhood && " · "}
                          </span>
                          {row.neighborhood}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="hidden sm:table-cell">
                        {f && <FrequencyChip status={f.status} active={row.active} />}
                      </Table.Cell>
                      <Table.Cell>
                        {f && (
                          <span
                            className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap tabular-nums ${tone}`}
                          >
                            {/* O status vira só a cor no celular. */}
                            <span
                              aria-hidden
                              className={`size-2 rounded-full sm:hidden ${
                                row.active ? FREQUENCY_STYLES[f.status].dot : "bg-slate-400"
                              }`}
                            />
                            {daysLabel(f.days_without_visit)}
                          </span>
                        )}
                        {f && !f.last_visit_date && (
                          <span className="block text-xs text-muted">desde o cadastro</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="hidden whitespace-nowrap tabular-nums md:table-cell">
                        {f ? `${f.visits_this_month} de ${f.expected_visits}` : "—"}
                      </Table.Cell>
                      <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
                        {row.plan?.name ?? "—"}
                      </Table.Cell>
                      <Table.Cell className="hidden whitespace-nowrap md:table-cell">
                        {row.tech?.name ?? <span className="text-muted">—</span>}
                      </Table.Cell>
                      <Table.Cell className="hidden whitespace-nowrap lg:table-cell">
                        {row.billing_type === "parceria" ? (
                          <span className="text-muted">Parceria</span>
                        ) : (
                          formatMoney(clientPrice(row, row.plan))
                        )}
                      </Table.Cell>
                      <Table.Cell className="hidden sm:table-cell">
                        <div className="flex justify-end gap-1.5">
                          {row.whatsapp && (
                            <LeadWhatsAppButton lead={{ name: row.name, whatsapp: row.whatsapp }} />
                          )}
                          <Tooltip delay={300} closeDelay={0}>
                            <Tooltip.Trigger>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="tertiary"
                                className="rounded-full"
                                aria-label={`Abrir ${row.name}`}
                                onPress={() => openClient(row.id)}
                              >
                                <Eye className="size-4" />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content>Abrir cliente</Tooltip.Content>
                          </Tooltip>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          {pages > 1 && (
            <Table.Footer>
              <TablePager
                page={page}
                pages={pages}
                onPageChange={setPage}
                summary={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} de ${sorted.length} clientes`}
              />
            </Table.Footer>
          )}
        </Table>
      )}

      <ClientDrawer
        isOpen={creating}
        plans={data.plans}
        techs={data.techs}
        onClose={() => setCreating(false)}
        onSaved={(client) => openClient(client.id)}
      />
    </div>
  );
}
