import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button, Modal } from "@heroui/react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { formatBrazilPhone, normalizeBrazilPhone, whatsappChatLink } from "@/lib/leads/phone";
import { formatMoney } from "@/lib/visits/schema";
import type { Charge, KitPurchase } from "@/lib/finance/schema";
import {
  LINK_STATES,
  clientLinkMessage,
  linkItems,
  managerMessage,
  validPaymentUrl,
  type LinkItem,
  type LinkState,
} from "@/lib/finance/payment-links";
import { useClientCharges, useClientKits } from "./finance-api";
import {
  paymentLinkError,
  useManagerWhatsApp,
  usePaymentLinkAction,
  usePaymentLinkEvents,
  useSaveManagerWhatsApp,
  type LinkAction,
  type LinkEvent,
} from "./payment-links-api";
import type { ClientRow } from "./visits-ui";

export type PaymentLinkDialog = {
  kind: "payment-links";
  mode: "request" | "receive" | "send";
  ids?: string[];
  resumeMessage?: string;
};

const inputClass = "w-full rounded-lg border border-border bg-surface p-2 text-foreground";
const whatsappClass = "bg-whatsapp text-white hover:bg-whatsapp/90";
const stamp = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const historyLabels: Record<LinkAction, string> = {
  abriu_gerente: "WhatsApp do gerente aberto",
  confirmou_solicitacao: "Solicitação confirmada",
  recebeu_link: "Link recebido",
  abriu_cliente: "WhatsApp do cliente aberto",
  confirmou_envio: "Envio confirmado",
};

function managerSettingsLink() {
  return (
    <Link
      className="font-medium text-accent underline"
      to="/admin/configuracoes"
      hash="whatsapp-gerente"
    >
      Configurar WhatsApp do gerente
    </Link>
  );
}

export function ManagerWhatsAppSetting() {
  const manager = useManagerWhatsApp();
  if (manager.isPending)
    return <p className="text-sm text-muted">Carregando WhatsApp do gerente…</p>;
  if (manager.isError)
    return (
      <p role="alert" className="text-sm text-danger">
        {paymentLinkError(manager.error)}
      </p>
    );
  return <ManagerWhatsAppForm key={manager.data ?? ""} initial={manager.data} />;
}

function ManagerWhatsAppForm({ initial }: { initial: string | null }) {
  const save = useSaveManagerWhatsApp();
  const [phone, setPhone] = useState(initial ? `+55 ${formatBrazilPhone(initial)}` : "");
  const [error, setError] = useState("");
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (save.isPending) return;
        setError("");
        const normalized = normalizeBrazilPhone(phone);
        if (phone.trim() && !normalized) {
          setError("Informe o WhatsApp com código do país e DDD. Ex.: +55 (51) 99999-9999.");
          return;
        }
        try {
          await save.mutateAsync(normalized);
        } catch (failure) {
          setError(paymentLinkError(failure));
        }
      }}
    >
      <label className="flex w-full max-w-xs flex-col gap-1 text-sm font-medium">
        WhatsApp do gerente
        <input
          className={inputClass}
          value={phone}
          type="tel"
          placeholder="+55 (51) 99999-9999"
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        isPending={save.isPending}
        isDisabled={phone.trim() === (initial ? `+55 ${formatBrazilPhone(initial)}` : "")}
      >
        Salvar
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function latestLinkEvents(events: LinkEvent[]) {
  const latest = new Map<string, LinkEvent>();
  for (const event of events) {
    if (!latest.has(event.cobranca_id)) latest.set(event.cobranca_id, event);
  }
  return latest;
}

function linkState(charge: Charge, event?: LinkEvent): LinkState {
  if (
    charge.status === "link_enviado" &&
    (!event ||
      event.acao === "confirmou_envio" ||
      Date.parse(charge.updated_at) > Date.parse(event.registrado_em))
  )
    return "sent";
  if (
    charge.link_pagamento &&
    validPaymentUrl(charge.link_pagamento) &&
    (charge.link_pagamento !== event?.link ||
      (event.acao !== "abriu_gerente" && event.acao !== "confirmou_solicitacao"))
  )
    return "ready";
  if (event?.acao === "abriu_gerente") return "opened";
  if (event?.acao === "confirmou_solicitacao") return "waiting";
  return "request";
}

function waitLabel(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  const days = Math.floor(minutes / 1440);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function itemLabel(item: LinkItem) {
  return item.description ? `${item.title} · ${item.description}` : item.title;
}

export function PaymentLinkActions({
  client,
  charges,
  chargesLoaded,
  kits,
  onOpen,
  onNewCharge,
}: {
  client: ClientRow;
  charges: Charge[];
  chargesLoaded: boolean;
  kits: KitPurchase[];
  onOpen: (dialog: PaymentLinkDialog) => void;
  onNewCharge: () => void;
}) {
  const manager = useManagerWhatsApp();
  const events = usePaymentLinkEvents(client.id);
  const action = usePaymentLinkAction(client.id);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const history = events.data ?? [];
  const latest = latestLinkEvents(history);
  const items = linkItems(charges, kits);
  const states = items.flatMap((item) =>
    (Object.keys(LINK_STATES) as LinkState[]).flatMap((state) => {
      const matching = item.charges.filter(
        (charge) => linkState(charge, latest.get(charge.id)) === state,
      );
      return matching.length ? [{ item, state, charges: matching }] : [];
    }),
  );
  const ready = states.some(({ state }) => state === "ready");
  const toRequest = states.some(({ state }) => state !== "sent" && state !== "ready");
  const toReceive = states.some(({ state }) => state !== "sent");
  const canCreateMonthly =
    chargesLoaded &&
    client.etapa_onboarding === "aguardando_link" &&
    !items.some((item) => item.charges[0].tipo === "mensalidade");

  function resumeRequest(ids: string[]) {
    const event = latest.get(ids[0]);
    const batch = event
      ? history.filter((row) => row.operacao_id === event.operacao_id).map((row) => row.cobranca_id)
      : [];
    const openIds = new Set(
      states
        .filter(({ state }) => state === "opened")
        .flatMap(({ charges }) => charges.map(({ id }) => id)),
    );
    const intact =
      batch.length > 0 &&
      batch.every((id) => openIds.has(id) && latest.get(id)?.operacao_id === event?.operacao_id);
    onOpen({
      kind: "payment-links",
      mode: "request",
      ids: intact ? batch : ids,
      resumeMessage: intact ? (event?.mensagem ?? undefined) : undefined,
    });
  }

  async function confirm(actionName: "confirmou_solicitacao" | "confirmou_envio", ids: string[]) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    try {
      await action.mutateAsync({ action: actionName, ids, operation: crypto.randomUUID() });
    } catch (failure) {
      setError(paymentLinkError(failure));
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {manager.data && toRequest && (
          <Button
            size="sm"
            className={whatsappClass}
            isDisabled={events.isPending || events.isError}
            onPress={() => onOpen({ kind: "payment-links", mode: "request" })}
          >
            <WhatsappIcon className="size-4" />
            Pedir links ao gerente
          </Button>
        )}
        {toReceive && (
          <Button
            size="sm"
            variant="secondary"
            isDisabled={events.isPending || events.isError}
            onPress={() => onOpen({ kind: "payment-links", mode: "receive" })}
          >
            Salvar links recebidos
          </Button>
        )}
        {ready && (
          <Button
            size="sm"
            className={whatsappClass}
            isDisabled={events.isPending || events.isError}
            onPress={() => onOpen({ kind: "payment-links", mode: "send" })}
          >
            <WhatsappIcon className="size-4" />
            Enviar links ao cliente
          </Button>
        )}
        {canCreateMonthly && (
          <Button size="sm" variant="secondary" onPress={onNewCharge}>
            Lançar mensalidade
          </Button>
        )}
      </div>
      {manager.isSuccess && !manager.data && <p className="text-sm">{managerSettingsLink()}</p>}
      {(manager.isError || events.isError) && (
        <p role="alert" className="text-sm text-danger">
          Não foi possível carregar as solicitações de link.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {events.isSuccess && states.length > 0 && (
        <ul className="divide-y divide-separator">
          {states.map(({ item, state, charges: group }) => {
            const ids = group.map(({ id }) => id);
            const since = group
              .map((charge) => latest.get(charge.id)?.registrado_em ?? charge.created_at)
              .sort()[0];
            const openedForClient = group.filter(({ id, link_pagamento }) => {
              const event = latest.get(id);
              return event?.acao === "abriu_cliente" && event.link === link_pagamento;
            });
            return (
              <li key={`${item.key}-${state}`} className="flex flex-col gap-1 py-2">
                <p className="text-sm font-medium">
                  {itemLabel(item)}
                  {group.length < item.charges.length && ` · ${group.length} parcela(s)`}
                </p>
                <p className="text-xs text-muted">
                  {LINK_STATES[state]}
                  {state !== "sent" && ` · ${waitLabel(since)}`}
                </p>
                <div className="flex flex-wrap gap-1">
                  {state === "opened" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={action.isPending}
                      onPress={() => void confirm("confirmou_solicitacao", ids)}
                    >
                      Confirmar solicitação
                    </Button>
                  )}
                  {manager.data &&
                    (state === "opened" ||
                      state === "waiting" ||
                      state === "ready" ||
                      state === "sent") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          state === "opened"
                            ? resumeRequest(ids)
                            : onOpen({ kind: "payment-links", mode: "request", ids })
                        }
                      >
                        {state === "opened" ? "Retomar pedido" : "Pedir novamente"}
                      </Button>
                    )}
                  {state === "ready" && openedForClient.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={action.isPending}
                      onPress={() =>
                        void confirm(
                          "confirmou_envio",
                          openedForClient.map(({ id }) => id),
                        )
                      }
                    >
                      Confirmar envio ao cliente
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {history.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Histórico de links</summary>
          <ul className="mt-2 space-y-1 text-muted">
            {history.map((event) => {
              const charge = charges.find(({ id }) => id === event.cobranca_id);
              const title =
                charge?.tipo === "kit"
                  ? `Kit · parcela ${charge.parcela_atual}`
                  : charge?.tipo === "mensalidade"
                    ? "Mensalidade"
                    : "Produtos avulsos";
              return (
                <li key={event.id}>
                  {stamp.format(new Date(event.registrado_em))} · {title} ·{" "}
                  {historyLabels[event.acao]}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PaymentLinksDialog({
  client,
  dialog,
  onClose,
}: {
  client: ClientRow;
  dialog: PaymentLinkDialog;
  onClose: () => void;
}) {
  const charges = useClientCharges(client.id);
  const kits = useClientKits(client.id);
  const events = usePaymentLinkEvents(client.id);
  const manager = useManagerWhatsApp();
  const loading =
    charges.isPending ||
    kits.isPending ||
    events.isPending ||
    (dialog.mode === "request" && manager.isPending);
  const failed =
    charges.isError ||
    kits.isError ||
    events.isError ||
    (dialog.mode === "request" && manager.isError);
  const title = {
    request: "Pedir links ao gerente",
    receive: "Salvar links recebidos",
    send: "Enviar links ao cliente",
  }[dialog.mode];
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-xl">
          <Modal.CloseTrigger aria-label="Fechar" />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          {failed ? (
            <Modal.Body>
              <p role="alert">Não foi possível carregar as cobranças e as configurações.</p>
            </Modal.Body>
          ) : loading ? (
            <Modal.Body>
              <p>Carregando cobranças…</p>
            </Modal.Body>
          ) : dialog.mode === "request" && !manager.data ? (
            <Modal.Body>{managerSettingsLink()}</Modal.Body>
          ) : (
            <PaymentLinkForm
              client={client}
              dialog={dialog}
              charges={charges.data ?? []}
              kits={kits.data ?? []}
              history={events.data ?? []}
              manager={manager.data ?? null}
              onClose={onClose}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PaymentLinkForm({
  client,
  dialog,
  charges,
  kits,
  history,
  manager,
  onClose,
}: {
  client: ClientRow;
  dialog: PaymentLinkDialog;
  charges: Charge[];
  kits: KitPurchase[];
  history: LinkEvent[];
  manager: string | null;
  onClose: () => void;
}) {
  const { mode, ids } = dialog;
  const action = usePaymentLinkAction(client.id);
  const busy = useRef(false);
  const latest = latestLinkEvents(history);
  const items = linkItems(charges, kits).flatMap((item) => {
    const eligible = item.charges.filter((charge) => {
      const state = linkState(charge, latest.get(charge.id));
      return mode === "send"
        ? state === "ready"
        : mode === "receive"
          ? state !== "sent"
          : ids
            ? ids.includes(charge.id)
            : state === "request" || state === "opened" || state === "waiting";
    });
    return eligible.length > 0 ? [{ ...item, charges: eligible }] : [];
  });
  const [selected, setSelected] = useState<string[]>(() =>
    items.length === 1 || ids ? items.map((item) => item.key) : [],
  );
  const [excluded, setExcluded] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<
    Partial<Record<string, { description: string; amount: string }>>
  >({});
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.whatsapp ? formatBrazilPhone(client.whatsapp) : "");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const chosen = items
    .filter((item) => selected.includes(item.key))
    .flatMap((item) => {
      const included = item.charges.filter(({ id }) => !excluded.includes(id));
      return included.length ? [{ ...item, charges: included }] : [];
    });
  const selectedCharges = chosen.flatMap((item) => item.charges);
  const normalizedPhone = normalizeBrazilPhone(phone);
  const recipient = mode === "request" ? manager : normalizedPhone;
  const snapshot = JSON.stringify({
    recipient,
    rows: selectedCharges.map(({ id, valor, observacao, link_pagamento }) => [
      id,
      valor,
      observacao,
      link_pagamento,
    ]),
    totals: chosen.map(({ amount, installments }) => [amount, installments]),
  });

  function makePreview() {
    if (name.trim().split(/\s+/).length < 2 || !normalizedPhone) {
      setError("Revise o nome completo e informe um WhatsApp válido com DDD.");
      return;
    }
    if (mode === "request") {
      const lines = chosen.map((item) => ({
        ...item,
        description: drafts[item.key]?.description.trim() ?? item.description,
        amount: Number(drafts[item.key]?.amount ?? item.amount),
      }));
      if (
        lines.some(
          (item) =>
            !Number.isFinite(item.amount) ||
            item.amount <= 0 ||
            item.amount > 99999999.99 ||
            (item.charges[0].tipo === "produtos" && !item.description),
        )
      ) {
        setError("Informe a descrição e o valor de cada item selecionado.");
        return;
      }
      const unchanged =
        ids?.length === selectedCharges.length &&
        selectedCharges.every(({ id }) => ids.includes(id)) &&
        Object.keys(drafts).length === 0 &&
        name === client.name &&
        normalizedPhone === client.whatsapp;
      setMessage(
        unchanged && dialog.resumeMessage
          ? dialog.resumeMessage
          : managerMessage(name.trim(), normalizedPhone, lines, client.forma_pagamento),
      );
    } else {
      setMessage(
        clientLinkMessage(
          name.trim(),
          chosen.flatMap((item) =>
            item.charges.map((charge) => ({
              title:
                new Set(item.charges.map((row) => row.link_pagamento)).size > 1
                  ? `${itemLabel(item)} · parcela ${charge.parcela_atual}`
                  : itemLabel(item),
              link: charge.link_pagamento!,
            })),
          ),
        ),
      );
    }
    setPreview(snapshot);
  }

  async function submit() {
    if (busy.current || !selectedCharges.length) return;
    setError("");
    if (!preview && mode !== "receive") {
      makePreview();
      return;
    }
    if (mode === "receive" && !validPaymentUrl(link.trim())) {
      setError("Cole um link de pagamento válido, começando por https:// ou http://.");
      return;
    }
    if (mode !== "receive" && (!recipient || !message.trim())) {
      setError("Confira o destinatário e a mensagem.");
      return;
    }
    if (preview && preview !== snapshot) {
      setPreview(null);
      setError(
        "As cobranças selecionadas foram atualizadas. Revise a seleção e gere a prévia novamente.",
      );
      return;
    }

    busy.current = true;
    // Abra a aba dentro do clique. O Safari pode bloquear uma nova aba após a gravação assíncrona.
    const popup = mode === "receive" ? null : window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const itemDetails = Object.fromEntries(
        chosen.flatMap((item) =>
          item.charges.map(({ id }) => [
            id,
            {
              descricao: drafts[item.key]?.description ?? item.description,
              valor: Number(drafts[item.key]?.amount ?? item.amount),
            },
          ]),
        ),
      );
      await action.mutateAsync({
        action:
          mode === "request"
            ? "abriu_gerente"
            : mode === "receive"
              ? "recebeu_link"
              : "abriu_cliente",
        ids: selectedCharges.map(({ id }) => id),
        operation: crypto.randomUUID(),
        data:
          mode === "request"
            ? {
                nome: name.trim(),
                whatsapp: normalizedPhone,
                mensagem: message,
                itens: itemDetails,
                destinatario: recipient,
              }
            : mode === "receive"
              ? { link: link.trim() }
              : {
                  nome: name.trim(),
                  whatsapp: normalizedPhone,
                  mensagem: message,
                  destinatario: recipient,
                  links: Object.fromEntries(
                    selectedCharges.map(({ id, link_pagamento }) => [id, link_pagamento]),
                  ),
                },
      });
      if (mode !== "receive" && recipient) {
        const href = whatsappChatLink(recipient, message);
        if (popup && !popup.closed) popup.location.replace(href);
        else window.location.assign(href);
      }
      onClose();
    } catch (failure) {
      popup?.close();
      setError(paymentLinkError(failure));
    } finally {
      busy.current = false;
    }
  }

  function editItem(item: LinkItem, patch: Partial<{ description: string; amount: string }>) {
    setDrafts((previous) => ({
      ...previous,
      [item.key]: {
        description: item.description,
        amount: String(item.amount),
        ...previous[item.key],
        ...patch,
      },
    }));
  }

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Modal.Body className="space-y-3">
        {preview ? (
          <label className="block space-y-1 text-sm font-medium">
            Prévia da mensagem
            <textarea
              className={inputClass}
              rows={11}
              value={message}
              required
              maxLength={12000}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
        ) : (
          <>
            {mode !== "receive" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  Nome completo do cliente
                  <input
                    className={inputClass}
                    value={name}
                    required
                    maxLength={120}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  WhatsApp do cliente com DDD
                  <input
                    className={inputClass}
                    type="tel"
                    value={phone}
                    required
                    autoComplete="tel"
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </label>
              </div>
            )}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Cobranças</legend>
              {items.length === 0 && (
                <p className="text-sm text-muted">Nenhuma cobrança disponível para esta ação.</p>
              )}
              {items.map((item) => {
                const checked = selected.includes(item.key);
                return (
                  <div key={item.key} className="space-y-2 rounded-lg border border-border p-3">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 accent-accent"
                        checked={checked}
                        onChange={() =>
                          setSelected(
                            checked
                              ? selected.filter((key) => key !== item.key)
                              : [...selected, item.key],
                          )
                        }
                      />
                      <span>
                        {itemLabel(item)} · {formatMoney(item.amount)}
                        {item.installments.length > 0 && ` · ${item.installments.length} parcelas`}
                        {item.charges[0].tipo === "mensalidade" &&
                          ` · ${item.charges[0].vencimento.slice(0, 7).split("-").reverse().join("/")}`}
                      </span>
                    </label>
                    {checked && mode !== "request" && item.charges.length > 1 && (
                      <div className="flex flex-wrap gap-3 pl-5">
                        {item.charges.map((charge) => (
                          <label key={charge.id} className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              className="accent-accent"
                              checked={!excluded.includes(charge.id)}
                              onChange={() =>
                                setExcluded((previous) =>
                                  previous.includes(charge.id)
                                    ? previous.filter((id) => id !== charge.id)
                                    : [...previous, charge.id],
                                )
                              }
                            />
                            Parcela {charge.parcela_atual}
                          </label>
                        ))}
                      </div>
                    )}
                    {checked && mode === "request" && item.charges[0].tipo !== "kit" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {item.charges[0].tipo === "produtos" && (
                          <label className="space-y-1 text-sm">
                            Descrição dos produtos
                            <input
                              className={inputClass}
                              required
                              maxLength={2000}
                              value={drafts[item.key]?.description ?? item.description}
                              onChange={(event) =>
                                editItem(item, { description: event.target.value })
                              }
                            />
                          </label>
                        )}
                        <label className="space-y-1 text-sm">
                          Valor (R$)
                          <input
                            className={inputClass}
                            type="number"
                            min="0.01"
                            max="99999999.99"
                            step="0.01"
                            required
                            value={drafts[item.key]?.amount ?? item.amount}
                            onChange={(event) => editItem(item, { amount: event.target.value })}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
            {mode === "receive" && items.length > 0 && (
              <label className="block space-y-1 text-sm font-medium">
                Link de pagamento dos itens selecionados
                <input
                  className={inputClass}
                  type="url"
                  value={link}
                  required
                  maxLength={1000}
                  onChange={(event) => setLink(event.target.value)}
                />
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          isDisabled={action.isPending}
          onPress={
            preview
              ? () => {
                  setPreview(null);
                  setError("");
                }
              : onClose
          }
        >
          {preview ? "Voltar" : "Cancelar"}
        </Button>
        <Button
          type="submit"
          isDisabled={!selectedCharges.length}
          isPending={action.isPending}
          className={preview ? whatsappClass : undefined}
        >
          {preview && <WhatsappIcon className="size-4" />}
          {mode === "receive"
            ? "Salvar link"
            : !preview
              ? "Revisar mensagem"
              : mode === "request"
                ? "Abrir WhatsApp do gerente"
                : "Abrir WhatsApp do cliente"}
        </Button>
      </Modal.Footer>
    </form>
  );
}
