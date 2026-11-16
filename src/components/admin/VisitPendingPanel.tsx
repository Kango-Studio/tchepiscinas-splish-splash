import { useState } from "react";
import { Button } from "@heroui/react";
import type { FinanceAlert } from "@/lib/finance/alerts";
import { buildChargeMessage } from "@/lib/finance/alerts";
import { whatsappChatLink } from "@/lib/leads/phone";
import { useLeads, describeDbError } from "./leads-api";
import { useSales, useSaleAction, reminderDate, type LinkTask } from "./first-visit-api";
import { todayISO } from "./filters";
import { FirstVisitDialog } from "./FirstVisit";
import { formatDate } from "./ui";
import type { Lead } from "@/lib/leads/schema";

export function VisitPendingPanel({
  legacy,
  onLegacySend,
}: {
  legacy: FinanceAlert[];
  onLegacySend: (a: FinanceAlert) => void;
}) {
  const data = useSales();
  const leads = useLeads();
  const [editing, setEditing] = useState<{ lead: Lead; confirm: boolean } | null>(null);
  const today = todayISO();
  const tasks = (data.data?.tasks ?? [])
    .filter((t) => !t.sent_date)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const visits = (data.data?.sales ?? []).filter(
    (s) =>
      !s.confirmed_at &&
      reminderDate(s) <= today &&
      leads.data?.some((l) => l.id === s.lead_id && l.stage === "aguardando_primeira_visita"),
  );
  const late =
    tasks.filter((t) => t.due_date < today).length + legacy.filter((a) => a.days > 0).length;
  const error = data.error || leads.error;
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <a
        className={`font-semibold ${late ? "text-danger" : "text-pool-deep"}`}
        href="#links-pendentes"
      >
        Links pendentes ({tasks.length + legacy.length}){late > 0 && ` · ${late} atrasados`}
      </a>
      {error && (
        <p role="alert" className="text-danger">
          Não foi possível carregar os lembretes. {describeDbError(error)}
        </p>
      )}
      {(data.isPending || leads.isPending) && <p>Carregando lembretes…</p>}
      {visits.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">Primeiras visitas</h2>
          {visits.map((s) => {
            const lead = leads.data!.find((l) => l.id === s.lead_id)!;
            return (
              <div
                key={s.lead_id}
                className={`rounded-lg border p-3 ${reminderDate(s) < today ? "border-danger text-danger" : "border-border"}`}
              >
                <p>
                  Confirmar primeira visita · {lead.name} · {formatDate(reminderDate(s))}
                  {reminderDate(s) < today && " · Atrasada"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onPress={() => setEditing({ lead, confirm: true })}>
                    Visita realizada
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setEditing({ lead, confirm: false })}
                  >
                    Reagendar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div id="links-pendentes" className="flex flex-col gap-2">
        {tasks.map((task) => {
          const lead = leads.data?.find((l) => l.id === task.lead_id);
          return (
            <SendTask
              key={`${task.lead_id}-${task.kind}`}
              task={task}
              name={lead?.name ?? "Cliente"}
              phone={lead?.whatsapp}
            />
          );
        })}
        {legacy.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-lg border p-3 ${alert.days > 0 ? "border-danger text-danger" : "border-border"}`}
          >
            <p>
              Enviar link de pagamento · {alert.client.name}
              {alert.days > 0 && " · Atrasado"}
            </p>
            <p className="text-sm">{alert.title}</p>
            <div className="mt-2 flex gap-2">
              {alert.client.whatsapp && (
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={whatsappChatLink(alert.client.whatsapp, buildChargeMessage(alert))}
                >
                  Abrir WhatsApp
                </a>
              )}
              <Button size="sm" variant="secondary" onPress={() => onLegacySend(alert)}>
                Marcar como enviado
              </Button>
            </div>
          </div>
        ))}
        {!tasks.length && !legacy.length && !data.isPending && !error && (
          <p className="text-sm text-muted">Nenhum link pendente.</p>
        )}
      </div>
      {editing && (
        <FirstVisitDialog
          lead={editing.lead}
          sale={data.data?.sales.find((s) => s.lead_id === editing.lead.id)}
          confirm={editing.confirm}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function SendTask({ task, name, phone }: { task: LinkTask; name: string; phone?: string }) {
  const save = useSaleAction();
  const [date, setDate] = useState(todayISO());
  const late = task.due_date < todayISO();
  return (
    <div
      className={`rounded-lg border p-3 ${late ? "border-danger bg-danger-soft" : "border-border"}`}
    >
      <p className="font-medium">
        Enviar link {task.kind === "pagamento" ? "de pagamento" : "dos produtos"} · {name}
      </p>
      <p className={late ? "text-danger" : "text-muted"}>
        Prazo: {formatDate(task.due_date)}
        {late && " · Atrasado"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {phone && (
          <a
            className="text-pool-deep underline"
            target="_blank"
            rel="noopener noreferrer"
            href={whatsappChatLink(phone)}
          >
            Abrir WhatsApp
          </a>
        )}
        <label className="text-sm">
          Data do envio{" "}
          <input
            aria-label={`Data de envio de ${task.kind} para ${name}`}
            type="date"
            max={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <Button
          size="sm"
          variant="secondary"
          isPending={save.isPending}
          isDisabled={!date || date > todayISO()}
          onPress={() =>
            save.mutate({
              action: "mark_sale_link_sent",
              args: { p_lead_id: task.lead_id, p_kind: task.kind, p_date: date },
            })
          }
        >
          Marcar como enviado
        </Button>
      </div>
      {save.error && (
        <p role="alert" className="text-danger">
          {describeDbError(save.error)}
        </p>
      )}
    </div>
  );
}
