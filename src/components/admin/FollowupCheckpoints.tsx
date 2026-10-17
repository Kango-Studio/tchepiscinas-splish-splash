import { Fragment, useState } from "react";
import { Button, FieldError, Input, Label, Popover, TextArea, TextField } from "@heroui/react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Plus, TrashBin } from "@gravity-ui/icons";
import type { LeadFollowup } from "@/lib/leads/schema";
import { useAddFollowup, useLeadFollowups, useRemoveFollowup } from "./followups-api";
import { todayISO } from "./filters";
import { PendingLabel, StatusAlert, formatDateTime } from "./ui";

const MAX_DOTS = 5;

function sinceLabel(iso: string) {
  const days = differenceInCalendarDays(new Date(), parseISO(iso));
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

// Data escolhida no formulário → instante salvo. Hoje usa a hora atual;
// datas passadas ficam ao meio-dia para não "pular" de dia pelo fuso.
function toDoneAt(date: string) {
  return date === todayISO()
    ? new Date().toISOString()
    : new Date(`${date}T12:00:00`).toISOString();
}

/* ---------------------------- Compacto (cards e tabela) ---------------------------- */

export function FollowupDots({ leadId }: { leadId: string }) {
  const { followups, isError } = useLeadFollowups(leadId);
  if (isError) return null;

  const count = followups.length;
  const last = followups[count - 1];
  const label =
    count === 0
      ? "Nenhum follow-up"
      : `${count} follow-up${count > 1 ? "s" : ""} · último ${sinceLabel(last.done_at)}`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={label}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
          <span key={i} className="animate-admin-pop size-2 rounded-full bg-pool-deep" />
        ))}
        {count === 0 && <span className="size-2 rounded-full border border-border" />}
        {count > MAX_DOTS && (
          <span className="ml-0.5 font-semibold text-pool-deep">+{count - MAX_DOTS}</span>
        )}
      </span>
      <span>{label}</span>
    </span>
  );
}

/* ------------------------------ Completo (drawer) ------------------------------ */

export function FollowupTracker({ leadId }: { leadId: string }) {
  const { followups, isLoading, isError } = useLeadFollowups(leadId);
  const count = followups.length;
  const last = followups[count - 1];

  return (
    <section
      aria-labelledby="followups-title"
      className="rounded-2xl border border-border bg-pool-mist/30 p-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="followups-title" className="text-sm font-bold text-pool-deep">
          Follow-ups
        </h3>
        {!isLoading && !isError && (
          <span className="text-xs text-muted">
            {count === 0
              ? "Nenhum follow-up registrado"
              : `${count} feito${count > 1 ? "s" : ""} · último ${sinceLabel(last.done_at)}`}
          </span>
        )}
      </div>

      {isError ? (
        <StatusAlert
          status="warning"
          title="Não foi possível carregar os follow-ups"
          description="Verifique a conexão ou se a migração lead_followups foi aplicada no Supabase."
        />
      ) : (
        <ol className="flex flex-wrap items-start gap-y-3" aria-label="Checkpoints de follow-up">
          {followups.map((f, i) => (
            <Fragment key={f.id}>
              <li className="animate-admin-pop">
                <DoneCheckpoint followup={f} number={i + 1} />
              </li>
              <Connector />
            </Fragment>
          ))}
          <li>
            <AddCheckpoint leadId={leadId} number={count + 1} disabled={isLoading} />
          </li>
        </ol>
      )}
    </section>
  );
}

function Connector() {
  return (
    <li
      aria-hidden
      className="animate-admin-grow-x mt-4 h-0.5 w-4 shrink-0 rounded-full bg-pool-light/60 sm:w-6"
    />
  );
}

function CheckpointLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 block text-center text-[11px] leading-tight text-muted">{children}</span>
  );
}

function DoneCheckpoint({ followup, number }: { followup: LeadFollowup; number: number }) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveFollowup();

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`Follow-up ${number}, feito em ${formatDateTime(followup.done_at)}`}
        className="group flex w-12 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="relative flex size-9 items-center justify-center rounded-full bg-pool-deep text-sm font-bold text-white shadow-surface transition-transform duration-200 group-hover:scale-110">
          {number}
          <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
            <Check className="size-2.5" />
          </span>
        </span>
        <CheckpointLabel>
          {format(parseISO(followup.done_at), "dd/MM", { locale: ptBR })}
        </CheckpointLabel>
      </Popover.Trigger>
      <Popover.Content placement="bottom" className="w-64">
        <Popover.Arrow />
        <Popover.Dialog className="flex flex-col p-3">
          <Popover.Heading className="text-sm font-bold text-pool-deep">
            Follow-up {number}
          </Popover.Heading>
          <p className="text-xs text-muted">{formatDateTime(followup.done_at)}</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-foreground">
            {followup.note || <span className="text-muted">Sem anotação</span>}
          </p>
          <Button
            size="sm"
            variant="danger-soft"
            className="mt-3 self-end"
            isPending={remove.isPending}
            onPress={() => remove.mutate(followup, { onSuccess: () => setOpen(false) })}
          >
            {({ isPending }) => (
              <PendingLabel isPending={isPending} icon={<TrashBin className="size-3.5" />}>
                Remover
              </PendingLabel>
            )}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function AddCheckpoint({
  leadId,
  number,
  disabled,
}: {
  leadId: string;
  number: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [note, setNote] = useState("");
  const add = useAddFollowup();
  const today = todayISO();
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDate(todayISO());
      setNote("");
    }
  };

  const submit = () => {
    if (!validDate) return;
    add.mutate(
      { lead_id: leadId, done_at: toDoneAt(date), note: note.trim() || null },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Popover isOpen={open} onOpenChange={onOpenChange}>
      <div className="flex w-12 flex-col items-center">
        <Button
          isIconOnly
          isDisabled={disabled}
          variant="outline"
          aria-label={`Registrar follow-up ${number}`}
          className="size-9 rounded-full border-2 border-dashed border-pool/60 text-pool-deep transition-[scale,background-color,border-color] duration-200 hover:scale-110 hover:border-pool hover:bg-pool-mist"
        >
          <Plus className="size-4" />
        </Button>
        <CheckpointLabel>{number}º</CheckpointLabel>
      </div>
      <Popover.Content placement="bottom" className="w-72">
        <Popover.Arrow />
        <Popover.Dialog className="flex flex-col gap-3 p-3">
          <Popover.Heading className="text-sm font-bold text-pool-deep">
            Registrar follow-up {number}
          </Popover.Heading>
          <TextField fullWidth type="date" value={date} onChange={setDate} isInvalid={!validDate}>
            <Label>Data</Label>
            <Input variant="secondary" max={today} />
            <FieldError>Escolha uma data até hoje</FieldError>
          </TextField>
          <TextField fullWidth value={note} onChange={setNote} maxLength={500}>
            <Label>Anotação</Label>
            <TextArea
              variant="secondary"
              rows={2}
              placeholder="Opcional. Ex.: mandei orçamento, pediu retorno sexta"
            />
          </TextField>
          <Button size="sm" isPending={add.isPending} isDisabled={!validDate} onPress={submit}>
            {({ isPending }) => (
              <PendingLabel isPending={isPending} icon={<Check className="size-4" />}>
                Marcar como feito
              </PendingLabel>
            )}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
