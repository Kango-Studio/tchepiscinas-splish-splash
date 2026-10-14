import { Fragment, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from "@heroui/react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Plus, Trash2 } from "lucide-react";
import type { LeadFollowup } from "@/lib/leads/schema";
import { useAddFollowup, useLeadFollowups, useRemoveFollowup } from "./followups-api";
import { todayISO } from "./filters";
import { formatDateTime } from "./ui";

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
    <span className="inline-flex items-center gap-1.5 text-xs text-default-500" title={label}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
          <span key={i} className="size-2 rounded-full bg-pool-deep" />
        ))}
        {count === 0 && <span className="size-2 rounded-full border border-default-300" />}
        {count > MAX_DOTS && (
          <span className="ml-0.5 font-semibold text-pool-deep">+{count - MAX_DOTS}</span>
        )}
      </span>
      <span className={count === 0 ? "text-default-400" : ""}>{label}</span>
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
      className="rounded-2xl border border-default-200 bg-pool-mist/30 p-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="followups-title" className="text-sm font-bold text-pool-deep">
          Follow-ups
        </h3>
        {!isLoading && !isError && (
          <span className="text-xs text-default-500">
            {count === 0
              ? "Nenhum follow-up registrado"
              : `${count} feito${count > 1 ? "s" : ""} · último ${sinceLabel(last.done_at)}`}
          </span>
        )}
      </div>

      {isError ? (
        <Alert
          color="warning"
          title="Não foi possível carregar os follow-ups"
          description="Verifique a conexão ou se a migração lead_followups foi aplicada no Supabase."
        />
      ) : (
        <ol className="flex flex-wrap items-start gap-y-3" aria-label="Checkpoints de follow-up">
          {followups.map((f, i) => (
            <Fragment key={f.id}>
              <li>
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
    <li aria-hidden className="mt-4 h-0.5 w-4 shrink-0 rounded-full bg-pool-light/60 sm:w-6" />
  );
}

function CheckpointLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 block text-center text-[11px] leading-tight text-default-500">
      {children}
    </span>
  );
}

function DoneCheckpoint({ followup, number }: { followup: LeadFollowup; number: number }) {
  const [open, setOpen] = useState(false);
  const remove = useRemoveFollowup();

  return (
    <Popover isOpen={open} onOpenChange={setOpen} placement="bottom" showArrow>
      <PopoverTrigger>
        <button
          type="button"
          className="flex w-12 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-pool"
          aria-label={`Follow-up ${number}, feito em ${formatDateTime(followup.done_at)}`}
        >
          <span className="relative flex size-9 items-center justify-center rounded-full bg-pool-deep text-sm font-bold text-white shadow-sm">
            {number}
            <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          </span>
          <CheckpointLabel>
            {format(parseISO(followup.done_at), "dd/MM", { locale: ptBR })}
          </CheckpointLabel>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 items-stretch p-3">
        <p className="text-sm font-bold text-pool-deep">Follow-up {number}</p>
        <p className="text-xs text-default-500">{formatDateTime(followup.done_at)}</p>
        <p className="mt-2 text-sm whitespace-pre-wrap text-default-700">
          {followup.note || <span className="text-default-400">Sem anotação</span>}
        </p>
        <Button
          size="sm"
          color="danger"
          variant="light"
          className="mt-2 self-end"
          startContent={<Trash2 className="size-3.5" />}
          isLoading={remove.isPending}
          onPress={() => remove.mutate(followup, { onSuccess: () => setOpen(false) })}
        >
          Remover
        </Button>
      </PopoverContent>
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
    <Popover isOpen={open} onOpenChange={onOpenChange} placement="bottom" showArrow>
      <PopoverTrigger>
        <button
          type="button"
          disabled={disabled}
          title="Registrar follow-up"
          className="flex w-12 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-pool disabled:opacity-50"
          aria-label={`Registrar follow-up ${number}`}
        >
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-pool/60 bg-white text-pool-deep transition-colors hover:border-pool hover:bg-pool-mist">
            <Plus className="size-4" />
          </span>
          <CheckpointLabel>{number}º</CheckpointLabel>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 items-stretch gap-3 p-3">
        <p className="text-sm font-bold text-pool-deep">Registrar follow-up {number}</p>
        <Input
          type="date"
          label="Data"
          labelPlacement="outside"
          variant="bordered"
          size="sm"
          max={today}
          value={date}
          onValueChange={setDate}
          isInvalid={!validDate}
          errorMessage="Escolha uma data até hoje"
        />
        <Textarea
          label="Anotação"
          labelPlacement="outside"
          variant="bordered"
          size="sm"
          placeholder="Opcional. Ex.: mandei orçamento, pediu retorno sexta"
          minRows={2}
          maxLength={500}
          value={note}
          onValueChange={setNote}
        />
        <Button
          color="primary"
          size="sm"
          startContent={!add.isPending && <Check className="size-4" />}
          isLoading={add.isPending}
          isDisabled={!validDate}
          onPress={submit}
        >
          Marcar como feito
        </Button>
      </PopoverContent>
    </Popover>
  );
}
