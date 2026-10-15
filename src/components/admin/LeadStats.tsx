import { Card, CardBody, Skeleton } from "@heroui/react";
import { CheckCircle2, ClipboardList, FileText, Headphones, Sparkles, Users } from "lucide-react";
import type { Lead } from "@/lib/leads/schema";

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
    { label: "Total de leads", value: leads.length, icon: Users, tone: "bg-pool-deep text-white" },
    { label: "Novos", value: count("novo"), icon: Sparkles, tone: "bg-pool-mist text-pool-deep" },
    {
      label: "Aguardando endereço",
      value: count("em_atendimento"),
      icon: Headphones,
      tone: "bg-sky-100 text-pool",
    },
    {
      label: "Propostas enviadas",
      value: count("proposta_enviada"),
      icon: ClipboardList,
      tone: "bg-violet-100 text-violet-700",
    },
    {
      label: "Valores enviados",
      value: count("orcamento_enviado"),
      icon: FileText,
      tone: "bg-sun/25 text-amber-800",
    },
    {
      label: "Fechados",
      value: count("fechado"),
      icon: CheckCircle2,
      tone: "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <section aria-label="Resumo dos leads">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((it) => (
          <Card key={it.label} shadow="sm" className="border border-default-100">
            <CardBody className="flex flex-row items-center gap-3 p-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${it.tone}`}>
                <it.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-default-500">{it.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-6 w-10 rounded-md" />
                ) : (
                  <p className="font-display text-2xl font-extrabold text-foreground">{it.value}</p>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      {filtered && !isLoading && (
        <p className="mt-2 text-xs text-default-500">Números considerando os filtros aplicados.</p>
      )}
    </section>
  );
}
