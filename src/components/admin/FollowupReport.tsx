import { useMemo, useState } from "react";
import {
  Card,
  Skeleton,
  Table,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  type Key,
} from "@heroui/react";
import {
  addMonths,
  addWeeks,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Minus } from "@gravity-ui/icons";
import {
  LEAD_STAGES,
  STAGE_LABELS,
  type Lead,
  type LeadFollowup,
  type LeadStage,
} from "@/lib/leads/schema";
import { CountUp } from "./ui";

type Granularity = "mes" | "semana";
type Period = "mes" | "mes_anterior" | "tudo";

const MONTHS = 6;
const WEEKS = 8;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

const PERIOD_LABELS: Record<Period, string> = {
  mes: "Este mês",
  mes_anterior: "Mês anterior",
  tudo: "Tudo",
};

function periodRange(period: Period, now = new Date()): [Date, Date] | null {
  const month = startOfMonth(now);
  if (period === "mes") return [month, addMonths(month, 1)];
  if (period === "mes_anterior") return [subMonths(month, 1), month];
  return null;
}

const inRange = (f: LeadFollowup, [start, end]: [Date, Date]) => {
  const d = new Date(f.done_at);
  return d >= start && d < end;
};

/* ------------------------------ Total no mês + gráfico ------------------------------ */

function useMonthSummary(followups: LeadFollowup[]) {
  return useMemo(() => {
    const now = new Date();
    const month = startOfMonth(now);
    const prevMonth = subMonths(month, 1);
    // Mesmo dia do mês anterior, para comparar períodos do mesmo tamanho.
    const samePointLastMonth = subMonths(now, 1);

    const current = followups.filter((f) => inRange(f, [month, addMonths(month, 1)]));
    const previous = followups.filter((f) => inRange(f, [prevMonth, month]));
    const previousToDate = previous.filter((f) => new Date(f.done_at) <= samePointLastMonth);

    return {
      month,
      prevMonth,
      current: current.length,
      currentLeads: new Set(current.map((f) => f.lead_id)).size,
      previous: previous.length,
      previousToDate: previousToDate.length,
    };
  }, [followups]);
}

function usePeriodBars(followups: LeadFollowup[], granularity: Granularity) {
  return useMemo(() => {
    const now = new Date();
    const buckets =
      granularity === "mes"
        ? Array.from({ length: MONTHS }, (_, i) => {
            const start = startOfMonth(subMonths(now, MONTHS - 1 - i));
            return { start, end: addMonths(start, 1), value: 0 };
          })
        : Array.from({ length: WEEKS }, (_, i) => {
            const start = startOfWeek(subWeeks(now, WEEKS - 1 - i), { weekStartsOn: 1 });
            return { start, end: addWeeks(start, 1), value: 0 };
          });

    for (const f of followups) {
      const d = new Date(f.done_at);
      const bucket = buckets.find((b) => d >= b.start && d < b.end);
      if (bucket) bucket.value++;
    }
    return buckets;
  }, [followups, granularity]);
}

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

// Seletor de opção única (segmentado) com o ToggleButtonGroup do HeroUI v3.
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set<Key>([value])}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next) onChange(next as T);
      }}
    >
      {(Object.keys(options) as T[]).map((k, i) => (
        <ToggleButton key={k} id={k} size="sm">
          {i > 0 && <ToggleButtonGroup.Separator />}
          {options[k]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export function FollowupSummaryCard({
  followups,
  isLoading,
}: {
  followups: LeadFollowup[];
  isLoading: boolean;
}) {
  const [granularity, setGranularity] = useState<Granularity>("mes");
  const s = useMonthSummary(followups);
  const bars = usePeriodBars(followups, granularity);

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(3)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-extrabold text-pool-deep">Follow-ups</h2>
          <p className="text-xs text-muted">Contatos registrados pela equipe</p>
        </div>
        <Segmented
          label="Agrupar gráfico por"
          value={granularity}
          options={{ mes: "Por mês", semana: "Por semana" }}
          onChange={setGranularity}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-20 rounded-md" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            index={0}
            label={`Em ${format(s.month, "MMMM", { locale: ptBR })}`}
            value={s.current}
            hint={<Delta current={s.current} previous={s.previousToDate} />}
          />
          <Stat
            index={1}
            label={`Em ${format(s.prevMonth, "MMMM", { locale: ptBR })}`}
            value={s.previous}
            hint={`${s.previousToDate} até o dia ${format(new Date(), "d")}`}
          />
          <Stat
            index={2}
            label="Leads contatados"
            value={s.currentLeads}
            hint={
              s.currentLeads
                ? `${(s.current / s.currentLeads).toFixed(1).replace(".", ",")} por lead`
                : "—"
            }
            className="col-span-2 sm:col-span-1"
          />
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-28 rounded-md" />
      ) : (
        // key: refaz a animação de crescimento ao trocar mês/semana
        <PeriodBars key={granularity} bars={bars} granularity={granularity} />
      )}
    </Card>
  );
}

function Stat({
  index,
  label,
  value,
  hint,
  className = "",
}: {
  index: number;
  label: string;
  value: number;
  hint: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`animate-admin-rise rounded-xl bg-pool-mist/30 px-3 py-2.5 ${className}`}
      style={stagger(index)}
    >
      <p className="line-clamp-2 text-xs leading-tight font-medium text-muted first-letter:uppercase">
        {label}
      </p>
      <p className="font-display text-2xl font-extrabold text-foreground">
        <CountUp value={value} />
      </p>
      <div className="text-[11px] text-muted">{hint}</div>
    </div>
  );
}

// Compara com o mês anterior até o mesmo dia, para o mês em andamento não parecer pior.
function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span>{current ? "Sem base no mês anterior" : "—"}</span>;
  const diff = Math.round(((current - previous) / previous) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tone = diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-muted";
  return (
    <span className="flex flex-col">
      <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
        <Icon className="size-3.5" aria-hidden />
        {diff > 0 ? "+" : ""}
        {diff}%
      </span>
      <span className="text-muted">vs. mesmo dia do mês passado</span>
    </span>
  );
}

function PeriodBars({
  bars,
  granularity,
}: {
  bars: { start: Date; value: number }[];
  granularity: Granularity;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const short = (d: Date) =>
    granularity === "mes" ? format(d, "MMM", { locale: ptBR }) : format(d, "dd/MM");
  const long = (d: Date) =>
    granularity === "mes"
      ? format(d, "MMMM 'de' yyyy", { locale: ptBR })
      : `Semana de ${format(d, "dd/MM", { locale: ptBR })}`;

  return (
    <div>
      <ol
        className="flex h-28 items-end gap-1.5 border-b border-separator"
        aria-label={granularity === "mes" ? "Follow-ups por mês" : "Follow-ups por semana"}
      >
        {bars.map((b, i) => (
          <li key={b.start.toISOString()} className="flex h-full flex-1 items-end">
            <Tooltip delay={0} closeDelay={0}>
              <Tooltip.Trigger
                className="group flex h-full w-full cursor-default flex-col items-center justify-end"
                aria-label={`${long(b.start)}: ${b.value}`}
              >
                {b.value > 0 && (
                  <span
                    className="animate-admin-rise mb-0.5 text-[10px] font-semibold text-muted tabular-nums"
                    style={stagger(i)}
                  >
                    {b.value}
                  </span>
                )}
                <div
                  className={`animate-admin-grow-y w-full rounded-t transition-[filter] duration-200 group-hover:brightness-110 ${
                    i === bars.length - 1 ? "bg-pool" : "bg-pool-light"
                  }`}
                  style={{ ...stagger(i), height: b.value ? `${(b.value / max) * 80}%` : 0 }}
                />
              </Tooltip.Trigger>
              <Tooltip.Content placement="top">
                <p className="font-semibold capitalize">{long(b.start)}</p>
                <p>
                  {b.value} follow-up{b.value === 1 ? "" : "s"}
                </p>
              </Tooltip.Content>
            </Tooltip>
          </li>
        ))}
      </ol>
      <ol className="mt-1.5 flex gap-1.5 text-[10px] text-muted" aria-hidden>
        {bars.map((b) => (
          <li key={b.start.toISOString()} className="flex-1 truncate text-center capitalize">
            {short(b.start)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------ Por etapa ------------------------------ */

type StageKey = LeadStage | "sem_etapa";
type View = "funil" | "barras" | "tabela";

// Etapas em ordem de avanço. "Perdido" é uma saída do funil, não uma etapa seguinte.
const FLOW: LeadStage[] = LEAD_STAGES.filter((s) => s !== "perdido");
const FLOW_STYLE: Record<string, { fill: string; ink: string }> = {
  novo: { fill: "#7FD3F9", ink: "text-pool-deep" },
  em_atendimento: { fill: "#4DB8EC", ink: "text-white" },
  proposta_enviada: { fill: "#2E9FDB", ink: "text-white" },
  orcamento_enviado: { fill: "#0077BE", ink: "text-white" },
  fechado: { fill: "#005A94", ink: "text-white" },
};
const LOST_FILL = "#94A3B8";
const MIN_WIDTH = 0.16;

const VIEW_LABELS: Record<View, string> = { funil: "Funil", barras: "Barras", tabela: "Tabela" };

type StageStat = {
  stage: LeadStage;
  followups: number;
  leads: number;
  // Leads que receberam follow-up nesta etapa e hoje estão numa etapa seguinte.
  advanced: number;
};

function useStageReport(leads: Lead[], followups: LeadFollowup[], period: Period) {
  return useMemo(() => {
    const range = periodRange(period);
    const list = range ? followups.filter((f) => inRange(f, range)) : followups;
    const leadById = new Map(leads.map((l) => [l.id, l]));

    const byLead = new Map<string, Partial<Record<StageKey, number>> & { total: number }>();
    const totals: Partial<Record<StageKey, number>> = {};
    const leadsByStage = new Map<LeadStage, Set<string>>();
    for (const f of list) {
      const key: StageKey = f.stage ?? "sem_etapa";
      const row = byLead.get(f.lead_id) ?? { total: 0 };
      row[key] = (row[key] ?? 0) + 1;
      row.total++;
      byLead.set(f.lead_id, row);
      totals[key] = (totals[key] ?? 0) + 1;
      if (f.stage) {
        const set = leadsByStage.get(f.stage) ?? new Set<string>();
        set.add(f.lead_id);
        leadsByStage.set(f.stage, set);
      }
    }

    const stats = (stage: LeadStage): StageStat => {
      const ids = [...(leadsByStage.get(stage) ?? [])];
      const from = FLOW.indexOf(stage);
      const advanced = ids.filter((id) => {
        const current = leadById.get(id)?.stage;
        return !!current && current !== "perdido" && FLOW.indexOf(current) > from;
      }).length;
      return { stage, followups: totals[stage] ?? 0, leads: ids.length, advanced };
    };

    const columns: StageKey[] = [...LEAD_STAGES];
    if (totals.sem_etapa) columns.push("sem_etapa");

    const rows = [...byLead.entries()]
      .map(([id, counts]) => ({ id, name: leadById.get(id)?.name ?? "Lead removido", counts }))
      .sort((a, b) => b.counts.total - a.counts.total || a.name.localeCompare(b.name, "pt-BR"));

    return {
      rows,
      totals,
      columns,
      total: list.length,
      flow: FLOW.map(stats),
      lost: stats("perdido"),
    };
  }, [leads, followups, period]);
}

export function FollowupsByStageCard({
  leads,
  followups,
  isLoading,
}: {
  leads: Lead[];
  followups: LeadFollowup[];
  isLoading: boolean;
}) {
  const [period, setPeriod] = useState<Period>("mes");
  const [view, setView] = useState<View>("funil");
  const report = useStageReport(leads, followups, period);
  const withoutStage = report.totals.sem_etapa ?? 0;

  const charts = (
    <>
      {view === "funil" ? (
        <FollowupFunnel flow={report.flow} lost={report.lost} total={report.total} />
      ) : (
        <StageBars flow={report.flow} lost={report.lost} total={report.total} />
      )}
      <ConversionList flow={report.flow} />
    </>
  );

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(4)}>
      <Tabs
        selectedKey={view}
        onSelectionChange={(k) => setView(k as View)}
        variant="secondary"
        className="gap-4"
      >
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="font-display text-lg font-extrabold text-pool-deep">
              Follow-ups por etapa
            </h2>
            <p className="text-xs text-muted">
              Quantos contatos foram feitos em cada etapa do funil
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Visualização">
                {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
                  <Tabs.Tab key={v} id={v}>
                    {VIEW_LABELS[v]}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            <Segmented
              label="Período"
              value={period}
              options={PERIOD_LABELS}
              onChange={setPeriod}
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-md" />
        ) : !report.total ? (
          <p className="animate-admin-rise py-6 text-center text-sm text-muted">
            Nenhum follow-up registrado neste período.
          </p>
        ) : (
          // key: reanima os gráficos ao trocar o período
          <div key={period} className="contents">
            <Tabs.Panel id="funil" className="flex flex-col gap-4">
              {charts}
            </Tabs.Panel>
            <Tabs.Panel id="barras" className="flex flex-col gap-4">
              {charts}
            </Tabs.Panel>
            <Tabs.Panel id="tabela">
              <StageTable {...report} />
            </Tabs.Panel>
          </div>
        )}

        {!isLoading && withoutStage > 0 && (
          <p className="text-xs text-muted">
            {view === "tabela"
              ? "“Sem etapa”: follow-ups registrados antes de o painel guardar a etapa."
              : `${withoutStage} follow-up(s) sem etapa registrada ficam fora do gráfico.`}
          </p>
        )}
      </Tabs>
    </Card>
  );
}

const perLead = (s: StageStat) =>
  s.leads ? (s.followups / s.leads).toFixed(1).replace(".", ",") : "—";

function FollowupFunnel({
  flow,
  lost,
  total,
}: {
  flow: StageStat[];
  lost: StageStat;
  total: number;
}) {
  const max = Math.max(1, ...flow.map((s) => s.followups));
  const widths = flow.map((s) => Math.max(MIN_WIDTH, s.followups / max));

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
      <ol className="flex flex-col gap-0.5" aria-label="Funil de follow-ups">
        {flow.map((s, i) => {
          const top = widths[i];
          const bottom = i < flow.length - 1 ? widths[i + 1] : top * 0.7;
          const points = [
            [(1 - top) * 50, 0],
            [(1 + top) * 50, 0],
            [(1 + bottom) * 50, 100],
            [(1 - bottom) * 50, 100],
          ]
            .map((p) => p.join(","))
            .join(" ");
          const style = FLOW_STYLE[s.stage];

          return (
            <li
              key={s.stage}
              className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
            >
              <Tooltip delay={0} closeDelay={0}>
                <Tooltip.Trigger
                  className="animate-admin-grow-x relative h-11 origin-center cursor-default transition-[filter] duration-200 hover:brightness-105"
                  style={stagger(i)}
                >
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 size-full"
                    aria-hidden
                  >
                    <polygon points={points} fill={style.fill} />
                  </svg>
                  <span
                    className={`relative grid h-full place-items-center font-display text-lg font-extrabold ${style.ink}`}
                  >
                    <CountUp value={s.followups} />
                  </span>
                </Tooltip.Trigger>
                <Tooltip.Content placement="top">
                  <p className="font-semibold">{STAGE_LABELS[s.stage]}</p>
                  <p>
                    {s.followups} follow-ups ({pct(s.followups, total)})
                  </p>
                  <p>
                    {s.leads} leads · {perLead(s)} por lead
                  </p>
                </Tooltip.Content>
              </Tooltip>
              <div className="animate-admin-rise min-w-0" style={stagger(i)}>
                <p className="truncate text-sm font-semibold text-foreground">
                  {STAGE_LABELS[s.stage]}
                </p>
                <p className="text-xs text-muted">
                  {pct(s.followups, total)} · {s.leads} leads
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <LostBox lost={lost} total={total} />
    </div>
  );
}

function LostBox({ lost, total }: { lost: StageStat; total: number }) {
  return (
    <div
      className="animate-admin-rise flex items-center justify-between gap-2 self-start rounded-xl border border-dashed border-border bg-surface-secondary px-3 py-2.5 sm:flex-col sm:items-start"
      style={stagger(5)}
    >
      <div>
        <p className="text-xs font-medium text-muted">Perdidos</p>
        <p className="font-display text-2xl font-extrabold text-slate-500">
          <CountUp value={lost.followups} />
        </p>
      </div>
      <p className="text-right text-[11px] text-muted sm:text-left">
        follow-ups ({pct(lost.followups, total)})
        <br />
        em {lost.leads} leads · saída do funil
      </p>
    </div>
  );
}

function StageBars({ flow, lost, total }: { flow: StageStat[]; lost: StageStat; total: number }) {
  const max = Math.max(1, lost.followups, ...flow.map((s) => s.followups));
  const row = (s: StageStat, fill: string, i: number) => (
    <li key={s.stage} className="animate-admin-rise flex flex-col gap-1" style={stagger(i)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-foreground">{STAGE_LABELS[s.stage]}</span>
        <span className="shrink-0 text-muted">
          {s.leads} leads · {perLead(s)} por lead
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3.5 flex-1 rounded-full bg-default">
          <div
            className="animate-admin-grow-x h-full rounded-full"
            style={{ ...stagger(i), width: `${(s.followups / max) * 100}%`, background: fill }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-xs tabular-nums">
          <strong className="font-bold text-foreground">{s.followups}</strong>{" "}
          <span className="text-muted">{pct(s.followups, total)}</span>
        </span>
      </div>
    </li>
  );

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Follow-ups por etapa">
      {flow.map((s, i) => row(s, FLOW_STYLE[s.stage].fill, i))}
      <li aria-hidden className="border-t border-dashed border-border" />
      {row(lost, LOST_FILL, flow.length)}
    </ul>
  );
}

// Dos leads que receberam follow-up na etapa, quantos já estão numa etapa seguinte.
function ConversionList({ flow }: { flow: StageStat[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-pool-mist/30 p-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">Taxa de conversão entre etapas</h3>
        <p className="text-[11px] text-muted">
          Dos leads que receberam follow-up na etapa, quantos já avançaram.
        </p>
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {flow.slice(0, -1).map((s, i) => (
          <li
            key={s.stage}
            className="animate-admin-rise flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs shadow-surface"
            style={stagger(i)}
          >
            <span className="min-w-0 truncate text-muted">
              {STAGE_LABELS[s.stage]} → {STAGE_LABELS[flow[i + 1].stage]}
            </span>
            <span className="shrink-0 tabular-nums">
              <strong className="font-bold text-pool-deep">{pct(s.advanced, s.leads)}</strong>{" "}
              <span className="text-muted">
                ({s.advanced}/{s.leads})
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StageTable({ rows, totals, columns, total }: ReturnType<typeof useStageReport>) {
  const label = (k: StageKey) => (k === "sem_etapa" ? "Sem etapa" : STAGE_LABELS[k]);
  const sticky = "sticky left-0 z-1 bg-surface";

  return (
    <Table variant="secondary">
      <Table.ScrollContainer className="max-h-[26rem]">
        <Table.Content aria-label="Follow-ups por lead e etapa" className="min-w-[42rem]">
          <Table.Header>
            <Table.Column id="lead" isRowHeader className={sticky}>
              Lead
            </Table.Column>
            {columns.map((k) => (
              <Table.Column key={k} id={k} className="text-center">
                {label(k)}
              </Table.Column>
            ))}
            <Table.Column id="total" className="text-center font-bold">
              Total
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.id} id={r.id}>
                <Table.Cell className={`${sticky} max-w-[12rem]`}>
                  <span className="block truncate font-medium">{r.name}</span>
                </Table.Cell>
                {columns.map((k) => (
                  <Table.Cell key={k} className="text-center tabular-nums">
                    {r.counts[k] ? (
                      <span className="font-semibold text-foreground">{r.counts[k]}</span>
                    ) : (
                      <span className="text-muted/50">·</span>
                    )}
                  </Table.Cell>
                ))}
                <Table.Cell className="text-center font-bold text-pool-deep tabular-nums">
                  {r.counts.total}
                </Table.Cell>
              </Table.Row>
            ))}
            <Table.Row id="__totais" className="bg-surface-secondary font-bold">
              <Table.Cell className={`${sticky} bg-surface-secondary`}>
                Total ({rows.length} leads)
              </Table.Cell>
              {columns.map((k) => (
                <Table.Cell key={k} className="text-center tabular-nums">
                  {totals[k] ?? 0}
                  <span className="block text-[11px] font-normal text-muted">
                    {pct(totals[k] ?? 0, total)}
                  </span>
                </Table.Cell>
              ))}
              <Table.Cell className="text-center text-pool-deep tabular-nums">{total}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
