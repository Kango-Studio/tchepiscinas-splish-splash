import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Chip,
  FieldError,
  Input,
  Label,
  Modal,
  Skeleton,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  type Key,
} from "@heroui/react";
import { ArrowUpRightFromSquare, Check, CircleXmark, Pencil, Plus } from "@gravity-ui/icons";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { PAYMENT_METHODS, clientPrice, formatMoney } from "@/lib/visits/schema";
import {
  CHARGE_STATUS_LABELS,
  CHARGE_TYPE_LABELS,
  EDITABLE_STATUSES,
  PAYMENT_METHOD_LABELS,
  chargeFormSchema,
  installmentDueDates,
  isOpenCharge,
  kitFormSchema,
  formatMonth,
  nextDueDate,
  paymentFormSchema,
  splitInstallments,
  type Charge,
  type ChargeFormInput,
  type ChargeFormValues,
  type ChargeStatus,
  type KitFormInput,
  type KitFormValues,
  type KitPurchase,
  type PaymentFormInput,
  type PaymentFormValues,
} from "@/lib/finance/schema";
import { todayISO } from "./filters";
import {
  describeFinanceError,
  useClientCharges,
  useClientKits,
  useRegisterKit,
  useSaveCharge,
  useSavePayment,
  useUpdateChargeStatus,
} from "./finance-api";
import { NumberInput, OptionSelect, type ClientRow } from "./visits-ui";
import { PendingLabel, StatusAlert, formatDate } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

// Pop-ups do financeiro. Ficam fora do <Tabs> (dentro dele o React Aria os
// duplica e fecha sozinho), então a aba só pede para abrir.
export type FinanceDialog =
  | { kind: "payment" }
  | { kind: "kit" }
  | { kind: "charge"; charge?: Charge }
  | { kind: "pay"; charge: Charge }
  | { kind: "cancel"; charge: Charge }
  | null;

const STATUS_STYLES: Record<ChargeStatus, string> = {
  pendente: "bg-slate-100 text-slate-700",
  link_enviado: "bg-sky-100 text-sky-800",
  pago: "bg-emerald-100 text-emerald-800",
  atrasado: "bg-red-100 text-red-800",
  cancelado: "bg-slate-100 text-slate-500 line-through",
};

function ChargeStatusChip({ charge }: { charge: Charge }) {
  const label =
    charge.situacao === "atrasado"
      ? `Atrasado · ${charge.dias_atraso} ${charge.dias_atraso === 1 ? "dia" : "dias"}`
      : CHARGE_STATUS_LABELS[charge.situacao];
  return (
    <Chip
      size="sm"
      variant="soft"
      className={`font-semibold whitespace-nowrap ${STATUS_STYLES[charge.situacao]}`}
    >
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

const chargeTitle = (c: Pick<Charge, "tipo" | "parcela_atual" | "total_parcelas">) =>
  c.total_parcelas > 1
    ? `${CHARGE_TYPE_LABELS[c.tipo]} · parcela ${c.parcela_atual}/${c.total_parcelas}`
    : CHARGE_TYPE_LABELS[c.tipo];

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba
// ---------------------------------------------------------------------------

export function ClientFinanceTab({
  client,
  onOpen,
}: {
  client: ClientRow;
  onOpen: (dialog: FinanceDialog) => void;
}) {
  const chargesQuery = useClientCharges(client.id);
  const kitsQuery = useClientKits(client.id);
  const charges = useMemo(() => chargesQuery.data ?? [], [chargesQuery.data]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4">
        <PaymentCard client={client} onEdit={() => onOpen({ kind: "payment" })} />
        <KitsCard
          kits={kitsQuery.data}
          charges={charges}
          error={kitsQuery.error}
          onRegister={() => onOpen({ kind: "kit" })}
        />
      </div>
      <div className="lg:col-span-2">
        <ChargesCard
          charges={charges}
          isPending={chargesQuery.isPending}
          error={chargesQuery.error}
          onOpen={onOpen}
        />
      </div>
    </div>
  );
}

function PaymentCard({ client, onEdit }: { client: ClientRow; onEdit: () => void }) {
  const price = clientPrice(client, client.plan);
  const recurring = !!client.dia_vencimento && !!client.mensalidade_desde;
  return (
    <Card className="animate-admin-rise gap-2 p-4 sm:p-5" style={stagger(1)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-foreground">Pagamento</h2>
        <Button size="sm" variant="ghost" onPress={onEdit}>
          <Pencil className="size-4" />
          Editar
        </Button>
      </div>
      <dl className="divide-y divide-separator">
        <InfoRow label="Forma de pagamento">
          {client.forma_pagamento ? (
            PAYMENT_METHOD_LABELS[client.forma_pagamento]
          ) : (
            <span className="text-muted">Não informada</span>
          )}
        </InfoRow>
        <InfoRow label="Mensalidade">
          {client.billing_type === "parceria" ? (
            <span className="text-muted">Parceria (não paga)</span>
          ) : (
            <>
              {formatMoney(price)}
              <span className="block text-xs font-normal text-muted">
                {client.custom_price !== null ? "valor do cliente" : "padrão do plano"}
              </span>
            </>
          )}
        </InfoRow>
        <InfoRow label="Dia de vencimento">
          {client.dia_vencimento ? (
            <>
              Dia {client.dia_vencimento}
              <span className="block text-xs font-normal text-muted">
                próximo: {formatDate(nextDueDate(client.dia_vencimento, todayISO()))}
              </span>
            </>
          ) : (
            <span className="text-muted">Não informado</span>
          )}
        </InfoRow>
        <InfoRow label="Cobrança recorrente">
          {client.billing_type === "parceria" ? (
            <span className="text-muted">Não se aplica</span>
          ) : !client.active ? (
            <span className="text-muted">Parada (cliente inativo)</span>
          ) : recurring ? (
            <>
              <span className="text-emerald-700">Todo mês</span>
              <span className="block text-xs font-normal text-muted">
                desde {formatMonth(client.mensalidade_desde!)}
              </span>
            </>
          ) : (
            <>
              <span className="text-muted">Desligada</span>
              <span className="block text-xs font-normal text-muted">
                {client.dia_vencimento ? "falta o mês de início" : "falta o dia e o mês de início"}
              </span>
            </>
          )}
        </InfoRow>
      </dl>
    </Card>
  );
}

function KitsCard({
  kits,
  charges,
  error,
  onRegister,
}: {
  kits: KitPurchase[] | undefined;
  charges: Charge[];
  error: Error | null;
  onRegister: () => void;
}) {
  const today = todayISO();
  return (
    <Card className="animate-admin-rise gap-3 p-4 sm:p-5" style={stagger(2)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold whitespace-nowrap text-foreground">
          Kit de produtos
        </h2>
        <Button size="sm" variant="ghost" onPress={onRegister}>
          <Plus className="size-4" />
          Nova compra
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-danger">{describeFinanceError(error)}</p>
      ) : !kits ? (
        <Skeleton className="h-14 rounded-xl" />
      ) : kits.length === 0 ? (
        <p className="py-2 text-sm text-muted">Nenhuma compra de kit registrada.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-separator">
          {kits.map((k) => {
            const parcels = charges.filter((c) => c.kit_compra_id === k.id);
            const paid = parcels.filter((c) => c.situacao === "pago").length;
            const cancelled = parcels.filter((c) => c.situacao === "cancelado").length;
            const late = parcels.some((c) => c.situacao === "atrasado");
            const days = differenceInCalendarDays(parseISO(today), parseISO(k.data_compra));
            return (
              <li key={k.id} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{formatMoney(k.valor_total)}</span>
                  <span className="text-xs text-muted">
                    comprado em {formatDate(k.data_compra)}
                  </span>
                </div>
                <p className={`text-sm ${late ? "text-danger" : "text-muted"}`}>
                  {k.parcelas === 1
                    ? paid
                      ? "À vista · pago"
                      : "À vista · não pago"
                    : `${k.parcelas}x · ${paid} de ${k.parcelas} pagas`}
                  {cancelled > 0 && ` · ${cancelled} cancelada${cancelled > 1 ? "s" : ""}`}
                  {late && " · parcela vencida"}
                </p>
                <p className="text-xs text-muted">
                  {days <= 0 ? "Comprado hoje" : `Há ${days} ${days === 1 ? "dia" : "dias"}`}
                  {days >= 80 && " · perto da hora da reposição"}
                </p>
                {k.observacao && <p className="text-xs text-muted">{k.observacao}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

type ChargeFilter = "abertas" | "todas";

function ChargesCard({
  charges,
  isPending,
  error,
  onOpen,
}: {
  charges: Charge[];
  isPending: boolean;
  error: Error | null;
  onOpen: (dialog: FinanceDialog) => void;
}) {
  const [filter, setFilter] = useState<ChargeFilter>("todas");
  const open = charges.filter(isOpenCharge);
  const late = open.filter((c) => c.situacao === "atrasado");
  const sum = (list: Charge[]) => list.reduce((s, c) => s + c.valor, 0);
  const shown = filter === "abertas" ? open : charges;

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(3)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-foreground">Cobranças</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleButtonGroup
            aria-label="Filtrar cobranças"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>([filter])}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next) setFilter(next as ChargeFilter);
            }}
          >
            <ToggleButton id="todas" size="sm">
              Todas
            </ToggleButton>
            <ToggleButton id="abertas" size="sm">
              <ToggleButtonGroup.Separator />
              Em aberto
            </ToggleButton>
          </ToggleButtonGroup>
          <Button size="sm" onPress={() => onOpen({ kind: "charge" })}>
            <Plus className="size-4" />
            Nova cobrança
          </Button>
        </div>
      </div>

      {!isPending && !error && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-secondary p-3">
            <p className="text-xs text-muted">Em aberto</p>
            <p className="font-display text-xl font-semibold tabular-nums">
              {formatMoney(sum(open))}
            </p>
            <p className="text-xs text-muted">
              {open.length} {open.length === 1 ? "cobrança" : "cobranças"}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${late.length ? "bg-red-50" : "bg-surface-secondary"}`}>
            <p className="text-xs text-muted">Atrasado</p>
            <p
              className={`font-display text-xl font-semibold tabular-nums ${late.length ? "text-red-700" : ""}`}
            >
              {formatMoney(sum(late))}
            </p>
            <p className="text-xs text-muted">
              {late.length} {late.length === 1 ? "cobrança" : "cobranças"}
            </p>
          </div>
        </div>
      )}

      {error ? (
        <p className="text-sm text-danger">{describeFinanceError(error)}</p>
      ) : isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {filter === "abertas" ? "Nenhuma cobrança em aberto." : "Nenhuma cobrança lançada."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-separator">
          {shown.map((c) => (
            <ChargeItem key={c.id} charge={c} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChargeItem({
  charge: c,
  onOpen,
}: {
  charge: Charge;
  onOpen: (dialog: FinanceDialog) => void;
}) {
  const isOpen = isOpenCharge(c);
  const details = [
    c.data_envio_link && `link enviado em ${formatDate(c.data_envio_link)}`,
    c.data_pagamento && `pago em ${formatDate(c.data_pagamento)}`,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`font-semibold ${c.situacao === "cancelado" ? "text-muted line-through" : ""}`}
          >
            {chargeTitle(c)}
          </span>
          <ChargeStatusChip charge={c} />
        </div>
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground tabular-nums">{formatMoney(c.valor)}</span>
          {" · vence "}
          {formatDate(c.vencimento)}
          {details.length > 0 && ` · ${details.join(" · ")}`}
        </p>
        {c.observacao && <p className="text-xs text-muted">{c.observacao}</p>}
      </div>
      <div className="flex items-center gap-1 self-end sm:self-auto">
        {c.link_pagamento && (
          <Tooltip delay={300} closeDelay={0}>
            <Tooltip.Trigger>
              <a
                href={c.link_pagamento}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir link de pagamento"
                className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:text-accent"
              >
                <ArrowUpRightFromSquare className="size-4" />
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content>Abrir link de pagamento</Tooltip.Content>
          </Tooltip>
        )}
        {isOpen && (
          <Button size="sm" variant="secondary" onPress={() => onOpen({ kind: "pay", charge: c })}>
            <Check className="size-4" />
            Marcar paga
          </Button>
        )}
        <Tooltip delay={300} closeDelay={0}>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="rounded-full text-muted hover:text-accent"
              aria-label="Editar cobrança"
              onPress={() => onOpen({ kind: "charge", charge: c })}
            >
              <Pencil className="size-4" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>Editar</Tooltip.Content>
        </Tooltip>
        {isOpen && (
          <Tooltip delay={300} closeDelay={0}>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                className="rounded-full text-muted hover:text-danger"
                aria-label="Cancelar cobrança"
                onPress={() => onOpen({ kind: "cancel", charge: c })}
              >
                <CircleXmark className="size-4" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>Cancelar cobrança</Tooltip.Content>
          </Tooltip>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Pop-ups
// ---------------------------------------------------------------------------

export function FinanceDialogs({
  client,
  dialog,
  onClose,
}: {
  client: ClientRow;
  dialog: FinanceDialog;
  onClose: () => void;
}) {
  const formKind =
    dialog?.kind === "payment" || dialog?.kind === "kit" || dialog?.kind === "charge";
  return (
    <>
      <Modal.Backdrop isOpen={formKind} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Modal.Container scroll="inside">
          <Modal.Dialog className="sm:max-w-lg">
            <Modal.CloseTrigger aria-label="Fechar" />
            {dialog?.kind === "payment" && <PaymentForm client={client} onClose={onClose} />}
            {dialog?.kind === "kit" && <KitForm client={client} onClose={onClose} />}
            {dialog?.kind === "charge" && (
              <ChargeForm
                key={dialog.charge?.id ?? "new"}
                client={client}
                charge={dialog.charge}
                onClose={onClose}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <PayDialog charge={dialog?.kind === "pay" ? dialog.charge : null} onClose={onClose} />
      <CancelDialog charge={dialog?.kind === "cancel" ? dialog.charge : null} onClose={onClose} />
    </>
  );
}

function DateInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  isRequired,
  max,
  description,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  isRequired?: boolean;
  max?: string;
  description?: string;
}) {
  return (
    <TextField
      fullWidth
      isRequired={isRequired}
      type="date"
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      isInvalid={!!error}
    >
      <Label>{label}</Label>
      <Input variant="secondary" max={max} />
      {description && !error && <p className="text-xs text-muted">{description}</p>}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}

function NotesField({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string | undefined | null;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
}) {
  return (
    <TextField
      fullWidth
      value={value ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      isInvalid={!!error}
      maxLength={2000}
    >
      <Label>Observação</Label>
      <TextArea variant="secondary" rows={2} placeholder="Opcional" />
      <FieldError>{error}</FieldError>
    </TextField>
  );
}

function FormFooter({
  formId,
  busy,
  disabled,
  label,
  onClose,
}: {
  formId: string;
  busy: boolean;
  disabled?: boolean;
  label: string;
  onClose: () => void;
}) {
  return (
    <Modal.Footer>
      <Button variant="tertiary" onPress={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form={formId} isPending={busy} isDisabled={disabled}>
        {({ isPending }) => <PendingLabel isPending={isPending}>{label}</PendingLabel>}
      </Button>
    </Modal.Footer>
  );
}

// --- Forma de pagamento, mensalidade e vencimento --------------------------

function PaymentForm({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const savePayment = useSavePayment();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      forma_pagamento: client.forma_pagamento ?? "",
      custom_price: client.custom_price ?? undefined,
      dia_vencimento: client.dia_vencimento ?? undefined,
      mensalidade_desde: client.mensalidade_desde?.slice(0, 7) ?? "",
    },
  });
  const startMonth = watch("mensalidade_desde");
  const currentMonthInput = todayISO().slice(0, 7);
  // Só avisa quando o mês de início muda para trás (o resto já foi gerado).
  const startChanged = startMonth !== (client.mensalidade_desde?.slice(0, 7) ?? "");

  const method = watch("forma_pagamento");
  const options = PAYMENT_METHODS.map((m) => ({
    id: m,
    label: m === "boleto" ? "Boleto (só clientes antigos)" : PAYMENT_METHOD_LABELS[m],
  }));

  const onSubmit = async (values: PaymentFormValues) => {
    setSubmitError(null);
    try {
      await savePayment.mutateAsync({ client, values });
      onClose();
    } catch (error) {
      setSubmitError(describeFinanceError(error));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Pagamento de {client.name}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="payment-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Controller
            control={control}
            name="forma_pagamento"
            render={({ field, fieldState }) => (
              <OptionSelect
                label="Forma de pagamento"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                options={options}
              />
            )}
          />
          {method === "boleto" && client.forma_pagamento !== "boleto" && (
            <StatusAlert
              status="warning"
              title="Boleto é só para clientes antigos"
              description="Clientes do plano novo pagam por Pix ou cartão de crédito."
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="custom_price"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Valor da mensalidade"
                  currency
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  placeholder={
                    client.plan ? formatMoney(client.plan.default_price) : "Valor do plano"
                  }
                  description={
                    client.plan
                      ? `Vazio = padrão do plano (${formatMoney(client.plan.default_price)})`
                      : undefined
                  }
                />
              )}
            />
            <Controller
              control={control}
              name="dia_vencimento"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Dia de vencimento"
                  minValue={1}
                  maxValue={31}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  description="Dia 29 a 31 vira o último dia em meses curtos"
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="mensalidade_desde"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                type="month"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              >
                <Label>Cobrar a partir de</Label>
                <Input variant="secondary" />
                {!fieldState.error && (
                  <p className="text-xs text-muted">
                    A mensalidade é lançada sozinha todo mês, no dia de vencimento, enquanto o
                    cliente estiver ativo. A do mês que vem já fica na lista para dar baixa. Mês
                    passado lança as mensalidades desde lá. Vazio = não lança.
                  </p>
                )}
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          {startChanged && startMonth && startMonth < currentMonthInput && (
            <StatusAlert
              status="warning"
              title={`Vai gerar as mensalidades desde ${formatMonth(`${startMonth}-01`)}`}
              description="Os meses que já tiverem mensalidade lançada (inclusive cancelada) não são gerados de novo."
            />
          )}
          {submitError && (
            <StatusAlert
              status="danger"
              title="Não foi possível salvar"
              description={submitError}
            />
          )}
        </form>
      </Modal.Body>
      <FormFooter
        formId="payment-form"
        busy={isSubmitting || savePayment.isPending}
        disabled={!isDirty}
        label="Salvar"
        onClose={onClose}
      />
    </>
  );
}

// --- Compra de kit -----------------------------------------------------------

function KitForm({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const registerKit = useRegisterKit();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const today = todayISO();
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<KitFormInput, unknown, KitFormValues>({
    resolver: zodResolver(kitFormSchema),
    defaultValues: {
      valor_total: undefined,
      parcelas: 1,
      data_compra: today,
      primeiro_vencimento: today,
      primeira_paga: false,
      observacao: "",
    },
  });

  const [total, count, first, firstPaid] = watch([
    "valor_total",
    "parcelas",
    "primeiro_vencimento",
    "primeira_paga",
  ]);
  const preview =
    total && total > 0 && /^\d{4}-\d{2}-\d{2}$/.test(first ?? "")
      ? splitInstallments(total, count).map((value, i) => ({
          value,
          due: installmentDueDates(first, count)[i],
        }))
      : [];

  const onSubmit = async (values: KitFormValues) => {
    setSubmitError(null);
    try {
      await registerKit.mutateAsync({ clientId: client.id, values });
      onClose();
    } catch (error) {
      setSubmitError(describeFinanceError(error));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>Compra de kit · {client.name}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="kit-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="valor_total"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Valor total do kit"
                  currency
                  isRequired
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="parcelas"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Parcelas</span>
                  <ToggleButtonGroup
                    aria-label="Parcelas"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set<Key>([String(field.value)])}
                    onSelectionChange={(keys) => {
                      const next = [...keys][0];
                      if (next) field.onChange(Number(next));
                    }}
                  >
                    {[1, 2, 3].map((n, i) => (
                      <ToggleButton key={n} id={String(n)}>
                        {i > 0 && <ToggleButtonGroup.Separator />}
                        {n === 1 ? "À vista" : `${n}x`}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="data_compra"
              render={({ field, fieldState }) => (
                <DateInput
                  label="Data da compra"
                  isRequired
                  max={today}
                  value={field.value}
                  onChange={(v) => {
                    // 1º vencimento acompanha a compra enquanto não for mudado à mão.
                    if (getValues("primeiro_vencimento") === field.value)
                      setValue("primeiro_vencimento", v);
                    field.onChange(v);
                  }}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="primeiro_vencimento"
              render={({ field, fieldState }) => (
                <DateInput
                  label="1º vencimento"
                  isRequired
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  description="As outras vencem no mesmo dia dos meses seguintes"
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="primeira_paga"
            render={({ field }) => (
              <Checkbox isSelected={field.value} onChange={field.onChange}>
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {count === 1 ? "Já foi pago" : "1ª parcela já foi paga"} (na data da compra)
                </Checkbox.Content>
              </Checkbox>
            )}
          />
          {preview.length > 0 && (
            <div className="rounded-xl bg-surface-secondary p-3">
              <p className="mb-1 text-xs font-medium text-muted">Parcelas que serão geradas</p>
              <ul className="flex flex-col gap-0.5 text-sm">
                {preview.map((p, i) => (
                  <li key={i} className="flex justify-between gap-2 tabular-nums">
                    <span>
                      {count === 1 ? "Parcela única" : `${i + 1}/${count}`} · vence{" "}
                      {formatDate(p.due)}
                    </span>
                    <span className="font-medium">
                      {formatMoney(p.value)}
                      {i === 0 && firstPaid && (
                        <span className="ml-1 text-emerald-700">· paga</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Controller
            control={control}
            name="observacao"
            render={({ field, fieldState }) => (
              <NotesField
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          {submitError && (
            <StatusAlert
              status="danger"
              title="Não foi possível salvar"
              description={submitError}
            />
          )}
        </form>
      </Modal.Body>
      <FormFooter
        formId="kit-form"
        busy={isSubmitting || registerKit.isPending}
        label={count === 1 ? "Registrar kit" : `Registrar e gerar ${count} parcelas`}
        onClose={onClose}
      />
    </>
  );
}

// --- Cobrança (nova ou editar) ----------------------------------------------

function ChargeForm({
  client,
  charge,
  onClose,
}: {
  client: ClientRow;
  charge?: Charge;
  onClose: () => void;
}) {
  const saveCharge = useSaveCharge();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const today = todayISO();
  const price = clientPrice(client, client.plan);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { isDirty, isSubmitting },
  } = useForm<ChargeFormInput, unknown, ChargeFormValues>({
    resolver: zodResolver(chargeFormSchema),
    defaultValues: charge
      ? {
          tipo: charge.tipo,
          valor: charge.valor,
          vencimento: charge.vencimento,
          // "atrasado" gravado vira pendente: o atraso é calculado pela data.
          status: charge.status === "atrasado" ? "pendente" : charge.status,
          link_pagamento: charge.link_pagamento ?? "",
          data_envio_link: charge.data_envio_link ?? "",
          data_pagamento: charge.data_pagamento ?? "",
          observacao: charge.observacao ?? "",
        }
      : {
          // Mensalidades são geradas sozinhas; lançamento manual costuma ser avulso.
          tipo: "avulso",
          valor: undefined,
          vencimento: today,
          status: "pendente",
          link_pagamento: "",
          data_envio_link: "",
          data_pagamento: "",
          observacao: "",
        },
  });

  const status = watch("status");
  const isKit = charge?.tipo === "kit";

  const onSubmit = async (values: ChargeFormValues) => {
    setSubmitError(null);
    try {
      await saveCharge.mutateAsync({ clientId: client.id, id: charge?.id, values });
      onClose();
    } catch (error) {
      setSubmitError(describeFinanceError(error));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>
          {charge ? `Editar ${chargeTitle(charge).toLowerCase()}` : "Nova cobrança"}
        </Modal.Heading>
        <p className="text-sm text-muted">{client.name}</p>
      </Modal.Header>
      <Modal.Body>
        <form
          id="charge-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {isKit ? (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Tipo</span>
                <p className="py-2 text-sm">{chargeTitle(charge)}</p>
              </div>
            ) : (
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <OptionSelect
                    label="Tipo"
                    isRequired
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v || "mensalidade");
                      if (v === "mensalidade" && !getValues("valor") && price)
                        setValue("valor", price);
                    }}
                    options={(["mensalidade", "avulso"] as const).map((t) => ({
                      id: t,
                      label: CHARGE_TYPE_LABELS[t],
                    }))}
                  />
                )}
              />
            )}
            <Controller
              control={control}
              name="valor"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Valor"
                  currency
                  isRequired
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="vencimento"
              render={({ field, fieldState }) => (
                <DateInput
                  label="Vencimento"
                  isRequired
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <OptionSelect
                  label="Status"
                  isRequired
                  value={field.value}
                  onChange={(v) => {
                    if (!v) return;
                    field.onChange(v);
                    // Preenche a data de hoje; dá para trocar por uma retroativa.
                    if (v === "link_enviado" && !getValues("data_envio_link"))
                      setValue("data_envio_link", today);
                    if (v === "pago" && !getValues("data_pagamento"))
                      setValue("data_pagamento", today);
                  }}
                  options={EDITABLE_STATUSES.map((s) => ({
                    id: s,
                    label: CHARGE_STATUS_LABELS[s],
                  }))}
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="link_pagamento"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                type="url"
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              >
                <Label>Link de pagamento</Label>
                <Input variant="secondary" placeholder="Opcional" />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="data_envio_link"
              render={({ field, fieldState }) => (
                <DateInput
                  label="Link enviado em"
                  isRequired={status === "link_enviado"}
                  max={today}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            {status === "pago" && (
              <Controller
                control={control}
                name="data_pagamento"
                render={({ field, fieldState }) => (
                  <DateInput
                    label="Pago em"
                    isRequired
                    max={today}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            )}
          </div>
          <Controller
            control={control}
            name="observacao"
            render={({ field, fieldState }) => (
              <NotesField
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
          {submitError && (
            <StatusAlert
              status="danger"
              title="Não foi possível salvar"
              description={submitError}
            />
          )}
        </form>
      </Modal.Body>
      <FormFooter
        formId="charge-form"
        busy={isSubmitting || saveCharge.isPending}
        disabled={!!charge && !isDirty}
        label={charge ? "Salvar alterações" : "Lançar cobrança"}
        onClose={onClose}
      />
    </>
  );
}

// --- Marcar paga -------------------------------------------------------------

function PayDialog({ charge, onClose }: { charge: Charge | null; onClose: () => void }) {
  const update = useUpdateChargeStatus();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!charge) return;
    if (!date || date > today) {
      setError("Informe uma data até hoje.");
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        charge,
        patch: { status: "pago", data_pagamento: date },
        message: "Cobrança marcada como paga",
      });
      onClose();
    } catch (e) {
      setError(describeFinanceError(e));
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={!!charge}
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
            <AlertDialog.Icon status="success" />
            <AlertDialog.Heading>Marcar como paga</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            {charge && (
              <p className="text-sm">
                {chargeTitle(charge)} de {formatMoney(charge.valor)}, vencimento{" "}
                {formatDate(charge.vencimento)}.
              </p>
            )}
            <DateInput label="Pago em" isRequired max={today} value={date} onChange={setDate} />
            {error && (
              <StatusAlert status="danger" title="Não foi possível salvar" description={error} />
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Voltar
            </Button>
            <Button onPress={onConfirm} isPending={update.isPending}>
              {({ isPending }) => (
                <PendingLabel isPending={isPending} icon={<Check className="size-4" />}>
                  Marcar paga
                </PendingLabel>
              )}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

// --- Cancelar (não apaga: fica no histórico como cancelada) ------------------

function CancelDialog({ charge, onClose }: { charge: Charge | null; onClose: () => void }) {
  const update = useUpdateChargeStatus();
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!charge) return;
    setError(null);
    try {
      await update.mutateAsync({
        charge,
        patch: { status: "cancelado" },
        message: "Cobrança cancelada",
      });
      onClose();
    } catch (e) {
      setError(describeFinanceError(e));
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={!!charge}
      onOpenChange={(open) => {
        if (open) return;
        setError(null);
        onClose();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-100">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Cancelar cobrança?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            {charge && (
              <p className="text-sm">
                {chargeTitle(charge)} de {formatMoney(charge.valor)}, vencimento{" "}
                {formatDate(charge.vencimento)}. Ela continua no histórico como cancelada e pode ser
                reaberta pelo Editar.
              </p>
            )}
            {error && (
              <StatusAlert status="danger" title="Não foi possível cancelar" description={error} />
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Voltar
            </Button>
            <Button variant="danger" onPress={onConfirm} isPending={update.isPending}>
              {({ isPending }) => (
                <PendingLabel isPending={isPending}>Cancelar cobrança</PendingLabel>
              )}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
