import { useMemo, useState } from "react";
import { Card, CardBody, Skeleton, Tab, Tabs, Tooltip } from "@heroui/react";
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
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  LEAD_STAGES,
  STAGE_LABELS,
  type Lead,
  type LeadFollowup,
  type LeadStage,
} from "@/lib/leads/schema";

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
    <Card shadow="sm" className="border border-default-100">
      <CardBody className="gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-extrabold text-pool-deep">Follow-ups</h2>
            <p className="text-xs text-default-500">Contatos registrados pela equipe</p>
          </div>
          <Tabs
            aria-label="Agrupar gráfico por"
            selectedKey={granularity}
            onSelectionChange={(k) => setGranularity(k as Granularity)}
            color="primary"
            radius="full"
            size="sm"
          >
            <Tab key="mes" title="Por mês" />
            <Tab key="semana" title="Por semana" />
          </Tabs>
        </div>

        {isLoading ? (
          <Skeleton className="h-20 rounded-md" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label={`Em ${format(s.month, "MMMM", { locale: ptBR })}`}
              value={s.current}
              hint={<Delta current={s.current} previous={s.previousToDate} />}
            />
            <Stat
              label={`Em ${format(s.prevMonth, "MMMM", { locale: ptBR })}`}
              value={s.previous}
              hint={`${s.previousToDate} até o dia ${format(new Date(), "d")}`}
            />
            <Stat
              label="Leads contatados no mês"
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
          <PeriodBars bars={bars} granularity={granularity} />
        )}
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: number;
  hint: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-pool-mist/30 px-3 py-2.5 ${className}`}>
      <p className="truncate text-xs font-medium capitalize text-default-500">{label}</p>
      <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
      <div className="text-[11px] text-default-500">{hint}</div>
    </div>
  );
}

// Compara com o mês anterior até o mesmo dia, para o mês em andamento não parecer pior.
function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span>{current ? "Sem base no mês anterior" : "—"}</span>;
  const diff = Math.round(((current - previous) / previous) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tone = diff > 0 ? "text-success-600" : diff < 0 ? "text-danger-600" : "text-default-500";
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${tone}`}>
      <Icon className="size-3.5" aria-hidden />
      {diff > 0 ? "+" : ""}
      {diff}% <span className="font-normal text-default-500">vs. mesmo dia</span>
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
        className="flex h-28 items-end gap-1.5 border-b border-default-200"
        aria-label={granularity === "mes" ? "Follow-ups por mês" : "Follow-ups por semana"}
      >
        {bars.map((b, i) => (
          <li key={b.start.toISOString()} className="flex h-full flex-1 items-end">
            <Tooltip
              content={
                <div className="px-1 py-0.5 text-xs">
                  <p className="font-semibold capitalize">{long(b.start)}</p>
                  <p>
                    {b.value} follow-up{b.value === 1 ? "" : "s"}
                  </p>
                </div>
              }
              placement="top"
              closeDelay={0}
            >
              <div
                className="flex h-full w-full cursor-default flex-col items-center justify-end"
                aria-label={`${long(b.start)}: ${b.value}`}
              >
                {b.value > 0 && (
                  <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-default-600">
                    {b.value}
                  </span>
                )}
                <div
                  className={`w-full rounded-t ${i === bars.length - 1 ? "bg-pool" : "bg-pool-light"}`}
                  style={{ height: b.value ? `${(b.value / max) * 80}%` : 0 }}
                />
              </div>
            </Tooltip>
          </li>
        ))}
      </ol>
      <ol className="mt-1.5 flex gap-1.5 text-[10px] text-default-500" aria-hidden>
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

  return (
    <Card shadow="sm" className="border border-default-100">
      <CardBody className="gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="font-display text-lg font-extrabold text-pool-deep">
              Follow-ups por etapa
            </h2>
            <p className="text-xs text-default-500">
              Quantos contatos foram feitos em cada etapa do funil
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              aria-label="Visualização"
              selectedKey={view}
              onSelectionChange={(k) => setView(k as View)}
              variant="underlined"
              color="primary"
              size="sm"
            >
              {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
                <Tab key={v} title={VIEW_LABELS[v]} />
              ))}
            </Tabs>
            <Tabs
              aria-label="Período"
              selectedKey={period}
              onSelectionChange={(k) => setPeriod(k as Period)}
              color="primary"
              radius="full"
              size="sm"
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <Tab key={p} title={PERIOD_LABELS[p]} />
              ))}
            </Tabs>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-md" />
        ) : !report.total ? (
          <p className="py-6 text-center text-sm text-default-500">
            Nenhum follow-up registrado neste período.
          </p>
        ) : view === "tabela" ? (
          <StageTable {...report} />
        ) : (
          <>
            {view === "funil" ? (
              <FollowupFunnel flow={report.flow} lost={report.lost} total={report.total} />
            ) : (
              <StageBars flow={report.flow} lost={report.lost} total={report.total} />
            )}
            <ConversionList flow={report.flow} />
          </>
        )}

        {!isLoading && withoutStage > 0 && (
          <p className="text-xs text-default-500">
            {view === "tabela"
              ? "“Sem etapa”: follow-ups registrados antes de o painel guardar a etapa."
              : `${withoutStage} follow-up(s) sem etapa registrada ficam fora do gráfico.`}
          </p>
        )}
      </CardBody>
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
              <Tooltip
                content={
                  <div className="px-1 py-0.5 text-xs">
                    <p className="font-semibold">{STAGE_LABELS[s.stage]}</p>
                    <p>
                      {s.followups} follow-ups ({pct(s.followups, total)})
                    </p>
                    <p>
                      {s.leads} leads · {perLead(s)} por lead
                    </p>
                  </div>
                }
                placement="top"
                closeDelay={0}
              >
                <div className="relative h-11 cursor-default">
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
                    {s.followups}
                  </span>
                </div>
              </Tooltip>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {STAGE_LABELS[s.stage]}
                </p>
                <p className="text-xs text-default-500">
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
    <div className="flex items-center justify-between gap-2 self-start rounded-xl border border-dashed border-default-300 bg-default-50 px-3 py-2.5 sm:flex-col sm:items-start">
      <div>
        <p className="text-xs font-medium text-default-500">Perdidos</p>
        <p className="font-display text-2xl font-extrabold tabular-nums text-slate-500">
          {lost.followups}
        </p>
      </div>
      <p className="text-right text-[11px] text-default-500 sm:text-left">
        follow-ups ({pct(lost.followups, total)})
        <br />
        em {lost.leads} leads · saída do funil
      </p>
    </div>
  );
}

function StageBars({ flow, lost, total }: { flow: StageStat[]; lost: StageStat; total: number }) {
  const max = Math.max(1, lost.followups, ...flow.map((s) => s.followups));
  const row = (s: StageStat, fill: string) => (
    <li key={s.stage} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-default-700">{STAGE_LABELS[s.stage]}</span>
        <span className="shrink-0 text-default-500">
          {s.leads} leads · {perLead(s)} por lead
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3.5 flex-1 rounded-full bg-default-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${(s.followups / max) * 100}%`, background: fill }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-xs tabular-nums">
          <strong className="font-bold text-foreground">{s.followups}</strong>{" "}
          <span className="text-default-400">{pct(s.followups, total)}</span>
        </span>
      </div>
    </li>
  );

  return (
    <ul className="flex flex-col gap-2.5" aria-label="Follow-ups por etapa">
      {flow.map((s) => row(s, FLOW_STYLE[s.stage].fill))}
      <li aria-hidden className="border-t border-dashed border-default-200" />
      {row(lost, LOST_FILL)}
    </ul>
  );
}

// Dos leads que receberam follow-up na etapa, quantos já estão numa etapa seguinte.
function ConversionList({ flow }: { flow: StageStat[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-pool-mist/30 p-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">Taxa de conversão entre etapas</h3>
        <p className="text-[11px] text-default-500">
          Dos leads que receberam follow-up na etapa, quantos já avançaram.
        </p>
      </div>
      <ol className="grid gap-1.5 sm:grid-cols-2">
        {flow.slice(0, -1).map((s, i) => (
          <li
            key={s.stage}
            className="flex items-center justify-between gap-2 rounded-lg bg-content1 px-2.5 py-1.5 text-xs"
          >
            <span className="min-w-0 truncate text-default-600">
              {STAGE_LABELS[s.stage]} → {STAGE_LABELS[flow[i + 1].stage]}
            </span>
            <span className="shrink-0 tabular-nums">
              <strong className="font-bold text-pool-deep">{pct(s.advanced, s.leads)}</strong>{" "}
              <span className="text-default-400">
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

  return (
    <div className="max-h-[26rem] overflow-auto rounded-lg border border-default-100">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-default-50 text-xs text-default-500">
          <tr>
            <th className="sticky left-0 bg-default-50 px-3 py-2 text-left font-semibold">Lead</th>
            {columns.map((k) => (
              <th key={k} className="px-2 py-2 text-center font-semibold">
                {label(k)}
              </th>
            ))}
            <th className="px-3 py-2 text-center font-bold text-default-700">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-default-100">
              <td className="sticky left-0 max-w-[12rem] bg-content1 px-3 py-2">
                <span className="block truncate font-medium">{r.name}</span>
              </td>
              {columns.map((k) => (
                <td key={k} className="px-2 py-2 text-center tabular-nums">
                  {r.counts[k] ? (
                    <span className="font-semibold text-foreground">{r.counts[k]}</span>
                  ) : (
                    <span className="text-default-300">·</span>
                  )}
                </td>
              ))}
              <td className="px-3 py-2 text-center font-bold tabular-nums text-pool-deep">
                {r.counts.total}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0 bg-default-50 text-xs">
          <tr className="border-t border-default-200">
            <th className="sticky left-0 bg-default-50 px-3 py-2 text-left font-bold">
              Total ({rows.length} leads)
            </th>
            {columns.map((k) => (
              <td key={k} className="px-2 py-2 text-center font-bold tabular-nums">
                {totals[k] ?? 0}
                <span className="block font-normal text-default-500">
                  {pct(totals[k] ?? 0, total)}
                </span>
              </td>
            ))}
            <td className="px-3 py-2 text-center font-bold tabular-nums text-pool-deep">{total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
