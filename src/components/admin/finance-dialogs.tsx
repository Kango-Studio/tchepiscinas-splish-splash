import { useState } from "react";
import { AlertDialog, Button, Input, Label, Modal, TextField } from "@heroui/react";
import { Check, PaperPlane } from "@gravity-ui/icons";
import {
  ONBOARDING_STAGES,
  formatMoney,
  type Client,
  type OnboardingStage,
} from "@/lib/visits/schema";
import type { Charge, KitPurchase } from "@/lib/finance/schema";
import {
  STAGE_DATE_FIELD,
  STAGE_LABELS,
  STAGE_STATUS,
  stageIndex,
  type StageDateField,
} from "@/lib/finance/onboarding";
import { chargeLabel } from "@/lib/finance/alerts";
import { todayISO } from "./filters";
import {
  describeFinanceError,
  useMarkRefillOffered,
  useSaveOnboarding,
  useUpdateChargeStatus,
  type OnboardingPatch,
} from "./finance-api";
import { OptionSelect } from "./visits-ui";
import { PendingLabel, StatusAlert, formatDate } from "./ui";

type ClientRef = Pick<Client, "id" | "name">;

function DateField({
  label,
  value,
  onChange,
  isRequired,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isRequired?: boolean;
}) {
  return (
    <TextField fullWidth isRequired={isRequired} type="date" value={value} onChange={onChange}>
      <Label>{label}</Label>
      <Input variant="secondary" max={todayISO()} />
    </TextField>
  );
}

// ---------------------------------------------------------------------------
// Marcar link enviado (data retroativa e o link, para usar na mensagem)
// ---------------------------------------------------------------------------

export type LinkSentTarget = { client: ClientRef; charge?: Charge } | null;

export function LinkSentDialog({
  target,
  onClose,
}: {
  target: LinkSentTarget;
  onClose: () => void;
}) {
  return (
    <AlertDialog.Backdrop isOpen={!!target} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-110">
          {target && (
            <LinkSentBody
              key={target.charge?.id ?? target.client.id}
              target={target}
              onClose={onClose}
            />
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

function LinkSentBody({
  target,
  onClose,
}: {
  target: NonNullable<LinkSentTarget>;
  onClose: () => void;
}) {
  const { client, charge } = target;
  const updateCharge = useUpdateChargeStatus();
  const saveOnboarding = useSaveOnboarding();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [link, setLink] = useState(charge?.link_pagamento ?? "");
  const [error, setError] = useState<string | null>(null);
  const busy = updateCharge.isPending || saveOnboarding.isPending;

  const onConfirm = async () => {
    if (!date || date > today) {
      setError("Informe uma data até hoje.");
      return;
    }
    setError(null);
    try {
      if (charge) {
        // A esteira anda sozinha (gatilho) quando é mensalidade.
        await updateCharge.mutateAsync({
          charge,
          patch: {
            status: charge.status === "pago" ? "pago" : "link_enviado",
            data_envio_link: date,
            link_pagamento: link.trim() || null,
          },
          message: "Link marcado como enviado",
        });
      } else {
        await saveOnboarding.mutateAsync({
          clientId: client.id,
          patch: { etapa_onboarding: "link_enviado", link_enviado_em: date },
          message: "Link marcado como enviado",
        });
      }
      onClose();
    } catch (e) {
      setError(describeFinanceError(e));
    }
  };

  return (
    <>
      <AlertDialog.Header>
        <AlertDialog.Icon status="accent">
          <PaperPlane className="size-5" />
        </AlertDialog.Icon>
        <AlertDialog.Heading>Marcar link enviado</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body className="flex flex-col gap-3">
        <p className="text-sm">
          {client.name}
          {charge && (
            <>
              {" · "}
              {chargeLabel(charge)} de {formatMoney(charge.valor)}, vence{" "}
              {formatDate(charge.vencimento)}
            </>
          )}
        </p>
        {!charge && (
          <p className="text-xs text-muted">
            Este cliente ainda não tem mensalidade lançada. Para ela aparecer, preencha o dia de
            vencimento e o "Cobrar a partir de" no cadastro.
          </p>
        )}
        <DateField label="Enviado em" isRequired value={date} onChange={setDate} />
        {charge && (
          <TextField fullWidth type="url" value={link} onChange={setLink}>
            <Label>Link de pagamento</Label>
            <Input variant="secondary" placeholder="Opcional: cole o link para usar na mensagem" />
          </TextField>
        )}
        {error && (
          <StatusAlert status="danger" title="Não foi possível salvar" description={error} />
        )}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button slot="close" variant="tertiary">
          Voltar
        </Button>
        <Button onPress={onConfirm} isPending={busy}>
          {({ isPending }) => (
            <PendingLabel isPending={isPending} icon={<Check className="size-4" />}>
              Marcar enviado
            </PendingLabel>
          )}
        </Button>
      </AlertDialog.Footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Reposição do kit oferecida (tira o aviso azul)
// ---------------------------------------------------------------------------

export type RefillTarget = { client: ClientRef; kit: KitPurchase } | null;

export function RefillDialog({ target, onClose }: { target: RefillTarget; onClose: () => void }) {
  const mark = useMarkRefillOffered();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!target) return;
    if (!date || date > today) {
      setError("Informe uma data até hoje.");
      return;
    }
    try {
      await mark.mutateAsync({ kit: target.kit, date });
      onClose();
    } catch (e) {
      setError(describeFinanceError(e));
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={!!target}
      onOpenChange={(open) => {
        if (open) return;
        setDate(today);
        setError(null);
        onClose();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-100">
          <AlertDialog.Header>
            <AlertDialog.Icon status="accent" />
            <AlertDialog.Heading>Reposição oferecida</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            {target && (
              <p className="text-sm">
                {target.client.name} · kit de {formatMoney(target.kit.valor_total)} comprado em{" "}
                {formatDate(target.kit.data_compra)}. O aviso sai da lista; quando ela comprar de
                novo, registre a compra na aba Financeiro do cliente.
              </p>
            )}
            <DateField label="Oferecida em" isRequired value={date} onChange={setDate} />
            {error && (
              <StatusAlert status="danger" title="Não foi possível salvar" description={error} />
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Voltar
            </Button>
            <Button onPress={onConfirm} isPending={mark.isPending}>
              {({ isPending }) => <PendingLabel isPending={isPending}>Já ofereci</PendingLabel>}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Editar a esteira (etapa atual e datas, inclusive retroativas)
// ---------------------------------------------------------------------------

export function OnboardingDialog({
  client,
  isOpen,
  onClose,
}: {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Fechar" />
          {isOpen && <OnboardingForm client={client} onClose={onClose} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function OnboardingForm({ client, onClose }: { client: Client; onClose: () => void }) {
  const save = useSaveOnboarding();
  const today = todayISO();
  const [stage, setStage] = useState<OnboardingStage>(client.etapa_onboarding);
  const [dates, setDates] = useState<Record<StageDateField, string>>(() => {
    const d = {} as Record<StageDateField, string>;
    for (const s of ONBOARDING_STAGES) d[STAGE_DATE_FIELD[s]] = client[STAGE_DATE_FIELD[s]] ?? "";
    return d;
  });
  const [error, setError] = useState<string | null>(null);

  const setDate = (field: StageDateField, v: string) => setDates((d) => ({ ...d, [field]: v }));

  const onSubmit = async () => {
    if (Object.values(dates).some((d) => d && d > today)) {
      setError("As datas não podem ser no futuro.");
      return;
    }
    setError(null);
    const patch: OnboardingPatch = { etapa_onboarding: stage };
    for (const s of ONBOARDING_STAGES) {
      const f = STAGE_DATE_FIELD[s];
      patch[f] = dates[f] || null;
    }
    try {
      await save.mutateAsync({ clientId: client.id, patch });
      onClose();
    } catch (e) {
      setError(describeFinanceError(e));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Esteira de {client.name}</Modal.Heading>
        <p className="text-sm text-muted">
          A esteira anda sozinha com a 1ª visita, o link enviado e o pagamento. Aqui dá para
          corrigir a etapa e as datas.
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4">
        <OptionSelect
          label="Etapa atual"
          isRequired
          value={stage}
          onChange={(v) => {
            if (!v) return;
            const next = v as OnboardingStage;
            setStage(next);
            // Preenche hoje na etapa escolhida, se ainda não tiver data.
            const f = STAGE_DATE_FIELD[next];
            if (!dates[f]) setDate(f, today);
          }}
          options={ONBOARDING_STAGES.map((s) => ({
            id: s,
            label: `${stageIndex(s) + 1}. ${STAGE_LABELS[s]}${s === "ativo" ? "" : ` · ${STAGE_STATUS[s].toLowerCase()}`}`,
          }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {ONBOARDING_STAGES.map((s) => (
            <DateField
              key={s}
              label={`${stageIndex(s) + 1}. ${STAGE_LABELS[s]}`}
              value={dates[STAGE_DATE_FIELD[s]]}
              onChange={(v) => setDate(STAGE_DATE_FIELD[s], v)}
            />
          ))}
        </div>
        {error && (
          <StatusAlert status="danger" title="Não foi possível salvar" description={error} />
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancelar
        </Button>
        <Button onPress={onSubmit} isPending={save.isPending}>
          {({ isPending }) => <PendingLabel isPending={isPending}>Salvar</PendingLabel>}
        </Button>
      </Modal.Footer>
    </>
  );
}
