import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import type { Lead } from "@/lib/leads/schema";
import { describeFirstVisitError } from "@/lib/leads/first-visit-error";
import { formatMoney } from "@/lib/visits/schema";
import { useClients, usePlans, usePoolTechs } from "./visits-api";
import {
  useSaleAction,
  useSales,
  SALE_ITEMS,
  reminderDate,
  saleSummary,
  type Sale,
  type SaleItem,
} from "./first-visit-api";
import { todayISO } from "./filters";
import { formatDate, stopCardEvents } from "./ui";
import { describeDbError, useUpdateStage } from "./leads-api";

const fieldClass = "w-full rounded-lg border border-border bg-surface p-2 text-foreground";

export function FirstVisitDialog({
  lead,
  sale,
  confirm = false,
  onClose,
}: {
  lead: Lead;
  sale?: Sale;
  confirm?: boolean;
  onClose: () => void;
}) {
  const clients = useClients();
  const sales = useSales();
  const reopen = useUpdateStage();
  const [reopenedLead, setReopenedLead] = useState<Lead | null>(null);
  const currentLead = reopenedLead ?? lead;
  const existing = sale ?? sales.data?.sales.find((s) => s.lead_id === lead.id);
  const error = clients.error || sales.error;
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-xl">
          <Modal.CloseTrigger aria-label="Fechar" />
          {error ? (
            <div className="p-5" role="alert">
              Não foi possível carregar o agendamento. {describeDbError(error)}
            </div>
          ) : clients.isPending || sales.isPending ? (
            <p className="p-5">Carregando agendamento…</p>
          ) : existing?.confirmed_at ? (
            <div className="flex flex-col gap-4 p-5">
              <Modal.Heading>Primeira visita já confirmada</Modal.Heading>
              <p>
                A primeira visita de {currentLead.name} foi confirmada em{" "}
                {formatDate(existing.confirmed_date)}. A contratação e os lembretes existentes foram
                preservados.
              </p>
              <Button variant="secondary" onPress={onClose}>
                Fechar
              </Button>
            </div>
          ) : currentLead.stage === "fechado" ? (
            <div className="flex flex-col gap-4 p-5">
              <Modal.Heading>Reabrir para agendar primeira visita</Modal.Heading>
              <p>
                {currentLead.name} já está em Fechado e ainda não tem uma primeira visita agendada.
                Reabra a venda em Valor enviado para preencher o agendamento.
              </p>
              <p className="text-sm text-muted">
                O lead só irá para Aguardando primeira visita depois de salvar o formulário.
              </p>
              {reopen.error && (
                <p role="alert" className="text-danger">
                  {describeFirstVisitError(reopen.error)}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onPress={onClose} isDisabled={reopen.isPending}>
                  Cancelar
                </Button>
                <Button
                  isPending={reopen.isPending}
                  onPress={() =>
                    reopen.mutate(
                      {
                        id: currentLead.id,
                        stage: "orcamento_enviado",
                        previous: currentLead.stage,
                      },
                      { onSuccess: setReopenedLead },
                    )
                  }
                >
                  Reabrir e agendar
                </Button>
              </div>
            </div>
          ) : confirm && !existing ? (
            <p className="p-5" role="alert">
              Agende a primeira visita antes de confirmar.
            </p>
          ) : (
            <VisitForm
              key={currentLead.id + currentLead.stage}
              lead={currentLead}
              sale={existing}
              confirm={confirm}
              onClose={onClose}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function VisitForm({
  lead,
  sale,
  confirm,
  onClose,
}: {
  lead: Lead;
  sale?: Sale;
  confirm: boolean;
  onClose: () => void;
}) {
  const clients = useClients();
  const plans = usePlans();
  const techs = usePoolTechs();
  const save = useSaleAction();
  const matched = clients.data?.find((c) => c.whatsapp === lead.whatsapp);
  const [clientId, setClientId] = useState(sale?.client_id ?? matched?.id ?? "");
  const [address, setAddress] = useState(
    sale?.address ?? [lead.neighborhood, lead.city].filter(Boolean).join(", "),
  );
  const [tech, setTech] = useState(sale?.pool_tech_id ?? matched?.pool_tech_id ?? "");
  const [estimated, setEstimated] = useState(!!sale && !sale.expected_date);
  const [date, setDate] = useState(sale?.expected_date ?? "");
  const [estimate, setEstimate] = useState(sale?.estimate ?? "");
  const [review, setReview] = useState(sale?.review_date ?? "");
  const [items, setItems] = useState<SaleItem[]>(
    sale?.items ??
      (lead.interest === "manutencao_recorrente"
        ? ["plano"]
        : lead.interest === "produtos"
          ? ["produtos"]
          : ["servico"]),
  );
  const [plan, setPlan] = useState(sale?.plan_id ?? matched?.plan_id ?? "");
  const [value, setValue] = useState(String(sale?.agreed_value ?? matched?.custom_price ?? ""));
  const [chargeable, setChargeable] = useState(
    sale?.service_chargeable ?? matched?.billing_type !== "parceria",
  );
  const [actual, setActual] = useState(todayISO());
  const [error, setError] = useState("");
  const loading = clients.isPending || plans.isPending || techs.isPending;
  const loadError = clients.error || plans.error || techs.error;
  const chooseClient = (id: string) => {
    setClientId(id);
    const client = clients.data?.find((c) => c.id === id);
    if (client) {
      setChargeable(client.billing_type !== "parceria");
      setTech(client.pool_tech_id ?? "");
      setPlan(client.plan_id);
      setAddress(
        (client as typeof client & { service_address?: string }).service_address ??
          client.neighborhood ??
          address,
      );
      setValue(
        String(
          client.custom_price ??
            plans.data?.find((p) => p.id === client.plan_id)?.default_price ??
            "",
        ),
      );
    }
  };
  return (
    <form
      className="flex flex-col gap-4 p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (!confirm && (!items.length || value.trim() === "" || Number(value) < 0)) {
          setError("Selecione os itens e informe o valor acordado.");
          return;
        }
        try {
          if (confirm)
            await save.mutateAsync({
              action: "confirm_first_visit",
              args: { p_lead_id: lead.id, p_date: actual },
            });
          else
            await save.mutateAsync({
              action: "schedule_first_visit",
              args: {
                p_lead_id: lead.id,
                p_values: {
                  client_id: clientId,
                  address,
                  pool_tech_id: tech,
                  expected_date: estimated ? null : date,
                  estimate: estimated ? estimate : null,
                  review_date: estimated ? review : null,
                  items,
                  plan_id: items.includes("plano") ? plan : null,
                  agreed_value: Number(value),
                  service_chargeable: chargeable,
                },
              },
            });
          onClose();
        } catch (e) {
          setError(describeFirstVisitError(e));
        }
      }}
    >
      <Modal.Heading>
        {confirm
          ? "Visita realizada"
          : sale
            ? "Editar / reagendar primeira visita"
            : "Agendar primeira visita"}
      </Modal.Heading>
      <p>
        {lead.name} · {lead.whatsapp}
      </p>
      {confirm && sale ? (
        <>
          <p>
            {saleSummary(sale)} · {formatMoney(Number(sale.agreed_value))}
          </p>
          {sale.items.includes("plano") && (
            <p>Plano: {plans.data?.find((p) => p.id === sale.plan_id)?.name}</p>
          )}
          <p className="text-sm">
            {sale.service_chargeable &&
            Number(sale.agreed_value) > 0 &&
            sale.items.some((i) => i === "plano" || i === "servico")
              ? "Lembrete: enviar link de pagamento."
              : "Sem lembrete de pagamento."}{" "}
            {sale.items.some((i) => i === "kit" || i === "produtos") &&
              "Lembrete: enviar link dos produtos."}
          </p>
          <p>
            {sale.address} · {techs.data?.find((t) => t.id === sale.pool_tech_id)?.name}
          </p>
          <p className="text-sm text-muted">
            Confira a contratação antes de confirmar. Os lembretes serão criados com prazo para
            hoje; os links devem ser enviados manualmente.
          </p>
          <label>
            Data efetiva da visita
            <input
              className={fieldClass}
              required
              type="date"
              max={todayISO()}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label>
            Cadastro de cliente
            <select
              className={fieldClass}
              value={clientId}
              onChange={(e) => chooseClient(e.target.value)}
            >
              <option value="">Usar os dados deste lead</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.whatsapp}
                </option>
              ))}
            </select>
          </label>
          <label>
            Endereço do atendimento
            <input
              className={fieldClass}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label>
            Piscineiro responsável
            <select
              className={fieldClass}
              required
              value={tech}
              onChange={(e) => setTech(e.target.value)}
            >
              <option value="">Selecione</option>
              {techs.data
                ?.filter((t) => t.active || t.id === tech)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={estimated}
              onChange={(e) => setEstimated(e.target.checked)}
            />
            Ainda é uma estimativa
          </label>
          {estimated ? (
            <>
              <label>
                Previsão da visita
                <input
                  className={fieldClass}
                  required
                  value={estimate}
                  placeholder="Ex.: na próxima semana"
                  onChange={(e) => setEstimate(e.target.value)}
                />
              </label>
              <label>
                Data para revisar
                <input
                  className={fieldClass}
                  required
                  type="date"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              Data prevista da visita
              <input
                className={fieldClass}
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          )}
          <fieldset className="flex flex-wrap gap-3">
            <legend>O que o cliente comprou</legend>
            {(Object.keys(SALE_ITEMS) as SaleItem[]).map((item) => (
              <label key={item} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={items.includes(item)}
                  onChange={(e) =>
                    setItems((old) =>
                      e.target.checked ? [...old, item] : old.filter((v) => v !== item),
                    )
                  }
                />
                {SALE_ITEMS[item]}
              </label>
            ))}
          </fieldset>
          {items.some((item) => item === "plano" || item === "servico") && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={chargeable}
                onChange={(e) => setChargeable(e.target.checked)}
              />
              Plano / serviço com cobrança
            </label>
          )}
          {items.includes("plano") && (
            <label>
              Plano
              <select
                className={fieldClass}
                required
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  if (!value)
                    setValue(
                      String(plans.data?.find((p) => p.id === e.target.value)?.default_price ?? ""),
                    );
                }}
              >
                <option value="">Selecione</option>
                {plans.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Valor total acordado (R$)
            <input
              className={fieldClass}
              required
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </>
      )}
      {(error || loadError) && (
        <p role="alert" className="text-danger">
          {error || describeDbError(loadError)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onPress={onClose}>
          Cancelar
        </Button>
        <Button type="submit" isDisabled={loading || !!loadError} isPending={save.isPending}>
          {confirm ? "Confirmar visita e fechar" : "Salvar agendamento"}
        </Button>
      </div>
    </form>
  );
}

export function FirstVisitCard({ lead }: { lead: Lead }) {
  const data = useSales();
  const techs = usePoolTechs();
  const plans = usePlans();
  const [mode, setMode] = useState<"edit" | "confirm" | null>(null);
  const sale = data.data?.sales.find((s) => s.lead_id === lead.id);
  if (!sale) return null;
  const tasks = data.data?.tasks.filter((t) => t.lead_id === lead.id) ?? [];
  const due = reminderDate(sale);
  const today = todayISO();
  const late =
    (!sale.confirmed_at && due < today) || tasks.some((t) => !t.sent_date && t.due_date < today);
  return (
    <div
      {...stopCardEvents}
      className={`mt-2 rounded-lg p-2 text-xs ${late ? "bg-danger-soft text-danger" : "bg-surface-secondary"}`}
    >
      <p>{techs.data?.find((t) => t.id === sale.pool_tech_id)?.name ?? "Piscineiro"}</p>
      <p>
        {saleSummary(sale)} · {formatMoney(Number(sale.agreed_value))}
      </p>
      {sale.items.includes("plano") && (
        <p>Plano: {plans.data?.find((p) => p.id === sale.plan_id)?.name}</p>
      )}
      {!sale.confirmed_at ? (
        <>
          <p>
            {sale.expected_date
              ? `Visita: ${formatDate(sale.expected_date)}`
              : `${sale.estimate} · Revisar ${formatDate(sale.review_date)}`}
          </p>
          {due <= today && (
            <p className="font-semibold">
              Confirmar primeira visita{late ? " · Atrasada" : " · Hoje"}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onPress={() => setMode("confirm")}>
              Visita realizada
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => setMode("edit")}>
              Editar / Reagendar
            </Button>
          </div>
        </>
      ) : (
        <p>
          {tasks
            .map(
              (t) =>
                `${t.kind === "pagamento" ? "Pagamento" : "Produtos"} ${t.sent_date ? `enviado em ${formatDate(t.sent_date)}` : `pendente${t.due_date < today ? " (atrasado)" : ""}`}`,
            )
            .join(" · ") || "Sem links a enviar"}
        </p>
      )}
      {mode && (
        <FirstVisitDialog
          lead={lead}
          sale={sale}
          confirm={mode === "confirm"}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
