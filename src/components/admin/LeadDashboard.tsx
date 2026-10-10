import { useMemo } from "react";
import { Card, CardBody, Skeleton, Tooltip } from "@heroui/react";
import { format, startOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { XCircle } from "lucide-react";
import { LEAD_SOURCES, SOURCE_LABELS, type Lead, type LeadStage } from "@/lib/leads/schema";

// O banco guarda só a etapa atual; cada faixa do funil conta quem chegou
// pelo menos até ela (um lead fechado também passou pelo orçamento).
// Perdidos ficam de fora das faixas seguintes: não sabemos onde pararam.
const FUNNEL: { label: string; stages: LeadStage[]; fill: string; ink: string }[] = [
  {
    label: "Entraram",
    stages: ["novo", "em_atendimento", "orcamento_enviado", "fechado", "perdido"],
    fill: "#7FD3F9",
    ink: "text-pool-deep",
  },
  {
    label: "Em atendimento",
    stages: ["em_atendimento", "orcamento_enviado", "fechado"],
    fill: "#2E9FDB",
    ink: "text-white",
  },
  {
    label: "Orçamento enviado",
    stages: ["orcamento_enviado", "fechado"],
    fill: "#0077BE",
    ink: "text-white",
  },
  { label: "Fechados", stages: ["fechado"], fill: "#005A94", ink: "text-white" },
];

const WEEKS = 8;
const MIN_WIDTH = 0.16;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

function useDashboard(leads: Lead[]) {
  return useMemo(() => {
    const total = leads.length;
    const funnel = FUNNEL.map((f) => ({
      ...f,
      value: leads.filter((l) => f.stages.includes(l.stage)).length,
    }));
    const lost = leads.filter((l) => l.stage === "perdido").length;

    const firstWeek = startOfWeek(subWeeks(new Date(), WEEKS - 1), { weekStartsOn: 1 });
    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const start = startOfWeek(subWeeks(new Date(), WEEKS - 1 - i), { weekStartsOn: 1 });
      return { start, value: 0 };
    });
    for (const l of leads) {
      const created = new Date(l.created_at);
      if (created < firstWeek) continue;
      let i = weeks.length - 1;
      while (i > 0 && created < weeks[i].start) i--;
      weeks[i].value++;
    }

    const sources = LEAD_SOURCES.map((s) => ({
      label: SOURCE_LABELS[s],
      value: leads.filter((l) => l.source === s).length,
    }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);

    return { total, funnel, lost, weeks, sources };
  }, [leads]);
}

export function LeadDashboard({
  leads,
  isLoading,
  filtered,
}: {
  leads: Lead[];
  isLoading: boolean;
  filtered: boolean;
}) {
  const { total, funnel, lost, weeks, sources } = useDashboard(leads);
  const closed = funnel[funnel.length - 1].value;

  return (
    <section aria-label="Dashboard de leads" className="grid gap-3 lg:grid-cols-5">
      <Card shadow="sm" className="border border-default-100 lg:col-span-3">
        <CardBody className="gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-extrabold text-pool-deep">
                Funil de vendas
              </h2>
              <p className="text-xs text-default-500">Leads que chegaram a cada etapa</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-default-500">Taxa de fechamento</p>
              {isLoading ? (
                <Skeleton className="ml-auto mt-1 h-7 w-14 rounded-md" />
              ) : (
                <p className="font-display text-2xl font-extrabold text-foreground">
                  {pct(closed, total)}
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center gap-0.5">
              {FUNNEL.map((f, i) => (
                <Skeleton
                  key={f.label}
                  className="h-12 rounded-md"
                  style={{ width: `${100 - i * 18}%` }}
                />
              ))}
            </div>
          ) : (
            <Funnel rows={funnel} total={total} />
          )}

          {!isLoading && (
            <p className="flex items-center gap-1.5 text-xs text-default-500">
              <XCircle className="size-3.5 shrink-0 text-slate-400" aria-hidden />
              <span>
                <strong className="font-semibold text-default-700">{lost} perdidos</strong> (
                {pct(lost, total)}) — ficam fora das etapas seguintes, pois não é registrado onde
                pararam.
              </span>
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
        <Card shadow="sm" className="border border-default-100">
          <CardBody className="gap-3 p-4 sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">Novos leads por semana</h2>
              <p className="text-xs text-default-500">Últimas {WEEKS} semanas</p>
            </div>
            {isLoading ? <Skeleton className="h-28 rounded-md" /> : <WeeklyBars weeks={weeks} />}
          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-default-100">
          <CardBody className="gap-3 p-4 sm:p-5">
            <h2 className="text-sm font-bold text-foreground">Por origem</h2>
            {isLoading ? (
              <Skeleton className="h-24 rounded-md" />
            ) : (
              <SourceBars sources={sources} total={total} />
            )}
          </CardBody>
        </Card>
      </div>

      {filtered && !isLoading && (
        <p className="text-xs text-default-500 lg:col-span-5">
          Números considerando os filtros aplicados.
        </p>
      )}
    </section>
  );
}

function Funnel({
  rows,
  total,
}: {
  rows: ((typeof FUNNEL)[number] & { value: number })[];
  total: number;
}) {
  // Largura proporcional ao total, com mínimo para a faixa continuar legível.
  const widths = rows.map((r) => (total ? Math.max(MIN_WIDTH, r.value / total) : MIN_WIDTH));

  return (
    <ol className="flex flex-col gap-0.5" aria-label="Funil de vendas">
      {rows.map((row, i) => {
        const top = widths[i];
        const bottom = i < rows.length - 1 ? widths[i + 1] : top * 0.7;
        const previous = i > 0 ? rows[i - 1].value : null;
        const points = [
          [(1 - top) * 50, 0],
          [(1 + top) * 50, 0],
          [(1 + bottom) * 50, 100],
          [(1 - bottom) * 50, 100],
        ]
          .map((p) => p.join(","))
          .join(" ");

        return (
          <li
            key={row.label}
            className="grid grid-cols-[minmax(0,1fr)_8.5rem] sm:grid-cols-[minmax(0,1fr)_11.5rem] items-center gap-3"
          >
            <Tooltip
              content={
                <div className="px-1 py-0.5 text-xs">
                  <p className="font-semibold">{row.label}</p>
                  <p>
                    {row.value} de {total} leads ({pct(row.value, total)})
                  </p>
                  {previous !== null && <p>{pct(row.value, previous)} da etapa anterior</p>}
                </div>
              }
              placement="top"
              closeDelay={0}
            >
              <div className="relative h-12 cursor-default">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full"
                  aria-hidden
                >
                  <polygon points={points} fill={row.fill} />
                </svg>
                <span
                  className={`relative grid h-full place-items-center font-display text-lg font-extrabold ${row.ink}`}
                >
                  {row.value}
                </span>
              </div>
            </Tooltip>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{row.label}</p>
              <p className="text-xs text-default-500">
                {pct(row.value, total)} do total
                {previous !== null && (
                  <>
                    {" · "}
                    <span className="text-default-600">{pct(row.value, previous)} avançaram</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WeeklyBars({ weeks }: { weeks: { start: Date; value: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.value));
  const last = weeks[weeks.length - 1];

  return (
    <div>
      <ol
        className="flex h-28 items-end gap-1.5 border-b border-default-200"
        aria-label="Novos leads por semana"
      >
        {weeks.map((w, i) => {
          const label = `Semana de ${format(w.start, "dd/MM", { locale: ptBR })}`;
          return (
            <li key={w.start.toISOString()} className="flex h-full flex-1 items-end">
              <Tooltip
                content={
                  <div className="px-1 py-0.5 text-xs">
                    <p className="font-semibold">{label}</p>
                    <p>
                      {w.value} {w.value === 1 ? "lead" : "leads"}
                    </p>
                  </div>
                }
                placement="top"
                closeDelay={0}
              >
                {/* Alvo do hover ocupa a coluna inteira, não só a barra. */}
                <div
                  className="flex h-full w-full cursor-default items-end"
                  aria-label={`${label}: ${w.value}`}
                >
                  <div
                    className={`w-full rounded-t ${i === weeks.length - 1 ? "bg-pool" : "bg-pool-light"}`}
                    style={{ height: w.value ? `${(w.value / max) * 100}%` : 0 }}
                  />
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <div className="mt-1.5 flex justify-between text-[11px] text-default-500">
        <span>{format(weeks[0].start, "dd/MM", { locale: ptBR })}</span>
        <span>
          Esta semana: <strong className="font-semibold text-default-700">{last.value}</strong>
        </span>
      </div>
    </div>
  );
}

function SourceBars({
  sources,
  total,
}: {
  sources: { label: string; value: number }[];
  total: number;
}) {
  if (!sources.length) return <p className="text-xs text-default-500">Sem leads no período.</p>;
  const max = sources[0].value;

  return (
    <ul className="flex flex-col gap-2" aria-label="Leads por origem">
      {sources.map((s) => (
        <li
          key={s.label}
          className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs"
        >
          <span className="truncate font-medium text-default-700">{s.label}</span>
          <div className="h-2.5 rounded-full bg-default-100">
            <div
              className="h-full rounded-full bg-pool"
              style={{ width: `${(s.value / max) * 100}%` }}
            />
          </div>
          <span className="text-right tabular-nums text-default-600">
            {s.value} <span className="text-default-400">· {pct(s.value, total)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
