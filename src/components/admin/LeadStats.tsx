import { Card, Skeleton } from "@heroui/react";
import { CircleCheck, FileDollar, FileText, MapPin, Persons, Sparkles } from "@gravity-ui/icons";
import type { Lead } from "@/lib/leads/schema";
import { CountUp } from "./ui";

export function LeadStats({
  leads,
  isLoading,
  filtered,
}: {
  leads: Lead[];
  isLoading: boolean;
  filtered: boolean;
}) {
  const count = (stage: Lead["stage"]) => leads.filter((l) => l.stage === stage).length;
  const items = [
    {
      label: "Total de leads",
      value: leads.length,
      icon: Persons,
      tone: "bg-pool-deep text-white",
    },
    { label: "Novos", value: count("novo"), icon: Sparkles, tone: "bg-pool-mist text-pool-deep" },
    {
      label: "Aguardando endereço",
      value: count("em_atendimento"),
      icon: MapPin,
      tone: "bg-sky-100 text-pool",
    },
    {
      label: "Propostas enviadas",
      value: count("proposta_enviada"),
      icon: FileText,
      tone: "bg-violet-100 text-violet-700",
    },
    {
      label: "Valores enviados",
      value: count("orcamento_enviado"),
      icon: FileDollar,
      tone: "bg-sun/25 text-amber-800",
    },
    {
      label: "Fechados",
      value: count("fechado"),
      icon: CircleCheck,
      tone: "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <section aria-label="Resumo dos leads">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((it, i) => (
          <Card
            key={it.label}
            className="animate-admin-rise group flex-row items-center gap-3 transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-overlay"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${it.tone}`}
            >
              <it.icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-xs leading-tight font-medium text-muted">
                {it.label}
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-7 w-10 rounded-md" />
              ) : (
                <p className="font-display text-2xl font-semibold tracking-tight text-foreground">
                  <CountUp value={it.value} />
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
      {filtered && !isLoading && (
        <p className="mt-2 text-xs text-muted">Números considerando os filtros aplicados.</p>
      )}
    </section>
  );
}
