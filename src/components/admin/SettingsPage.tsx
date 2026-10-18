import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  FieldError,
  Input,
  Label,
  Modal,
  Skeleton,
  TextField,
} from "@heroui/react";
import { CircleExclamation, Pencil, Persons, Plus, TrashBin } from "@gravity-ui/icons";
import { formatBrazilPhone, maskBrazilPhoneInput } from "@/lib/leads/phone";
import {
  formatMoney,
  planFormSchema,
  poolTechFormSchema,
  type Plan,
  type PlanFormValues,
  type PoolTech,
  type PoolTechFormInput,
  type PoolTechFormValues,
} from "@/lib/visits/schema";
import { describeDbError } from "./leads-api";
import {
  useAppSettings,
  useClients,
  useDeletePlan,
  usePlans,
  usePoolTechs,
  useSavePlan,
  useSavePoolTech,
  useUpdateVisitRate,
} from "./visits-api";
import { ActiveSwitch, FREQUENCY_STYLES, NumberInput } from "./visits-ui";
import { PendingLabel, StatusAlert } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function LoadError({ error }: { error: unknown }) {
  return (
    <p className="flex items-center gap-2 text-sm text-danger">
      <CircleExclamation className="size-4" />
      {describeDbError(error)}
    </p>
  );
}

// Faixas do plano: "OK até 10 · Atenção 11–15 · Atrasado 16+"
function PlanRanges({ plan }: { plan: Pick<Plan, "ok_max_days" | "attention_max_days"> }) {
  const ranges = [
    { status: "ok", label: "OK", value: `até ${plan.ok_max_days} dias` },
    {
      status: "atencao",
      label: "Atenção",
      value:
        plan.ok_max_days + 1 === plan.attention_max_days
          ? `${plan.attention_max_days} dias`
          : `${plan.ok_max_days + 1}–${plan.attention_max_days} dias`,
    },
    { status: "atrasado", label: "Atrasado", value: `${plan.attention_max_days + 1}+ dias` },
  ] as const;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ranges.map((r) => (
        <li
          key={r.status}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${FREQUENCY_STYLES[r.status].chip}`}
        >
          <span className={`size-1.5 rounded-full ${FREQUENCY_STYLES[r.status].dot}`} aria-hidden />
          {r.label}: {r.value}
        </li>
      ))}
    </ul>
  );
}

export function SettingsPage() {
  const plans = usePlans();
  const techs = usePoolTechs();
  const clients = useClients();
  const [planModal, setPlanModal] = useState<{ plan?: Plan } | null>(null);
  const [techModal, setTechModal] = useState<{ tech?: PoolTech } | null>(null);

  const clientsOfPlan = (id: string) => (clients.data ?? []).filter((c) => c.plan_id === id);
  const activeClientsOfTech = (id: string) =>
    (clients.data ?? []).filter((c) => c.pool_tech_id === id && c.active).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="animate-admin-rise">
        <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
          Configurações
        </h1>
        <p className="text-sm text-muted">Planos, piscineiros e valor pago por visita.</p>
      </div>

      {/* Planos */}
      <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(1)}>
        <SectionHeader
          title="Planos"
          description="Valor padrão, visitas por mês e faixas de dias sem visita de cada plano."
          action={
            <Button size="sm" onPress={() => setPlanModal({})}>
              <Plus className="size-4" />
              Novo plano
            </Button>
          }
        />
        {plans.isError ? (
          <LoadError error={plans.error} />
        ) : plans.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {plans.data.map((plan, i) => {
              const count = clientsOfPlan(plan.id).filter((c) => c.active).length;
              return (
                <li
                  key={plan.id}
                  className="animate-admin-rise flex flex-col gap-3 rounded-2xl border border-separator p-4"
                  style={stagger(i)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{plan.name}</p>
                      <p className="text-sm text-muted">
                        <span className="font-medium text-foreground">
                          {formatMoney(plan.default_price)}
                        </span>{" "}
                        · {plan.visits_per_month}{" "}
                        {plan.visits_per_month === 1 ? "visita" : "visitas"}/mês · {count}{" "}
                        {count === 1 ? "cliente ativo" : "clientes ativos"}
                      </p>
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      className="shrink-0 rounded-full"
                      aria-label={`Editar ${plan.name}`}
                      onPress={() => setPlanModal({ plan })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                  <PlanRanges plan={plan} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Piscineiros */}
      <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(2)}>
        <SectionHeader
          title="Piscineiros"
          description="Não acessam o painel. O WhatsApp é usado para enviar o relatório semanal."
          action={
            <Button size="sm" onPress={() => setTechModal({})}>
              <Plus className="size-4" />
              Novo piscineiro
            </Button>
          }
        />
        {techs.isError ? (
          <LoadError error={techs.error} />
        ) : techs.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-separator">
            {techs.data.map((tech) => {
              const count = activeClientsOfTech(tech.id);
              return (
                <li key={tech.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      tech.active ? "bg-pool-mist text-pool-deep" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Persons className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      {tech.name}
                      {!tech.active && (
                        <Chip size="sm" variant="soft" className="bg-slate-200 text-slate-700">
                          <Chip.Label>Inativo</Chip.Label>
                        </Chip>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {tech.whatsapp ? (
                        formatBrazilPhone(tech.whatsapp)
                      ) : (
                        <span className="font-medium text-amber-700">Sem WhatsApp</span>
                      )}{" "}
                      · {count} {count === 1 ? "cliente ativo" : "clientes ativos"}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    className="shrink-0 rounded-full"
                    aria-label={`Editar ${tech.name}`}
                    onPress={() => setTechModal({ tech })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Valor por visita */}
      <VisitRateCard />

      <PlanModal
        state={planModal}
        clientCount={planModal?.plan ? clientsOfPlan(planModal.plan.id).length : 0}
        onClose={() => setPlanModal(null)}
      />
      <TechModal state={techModal} onClose={() => setTechModal(null)} />
    </div>
  );
}

function VisitRateCard() {
  const settings = useAppSettings();
  const updateRate = useUpdateVisitRate();
  const [value, setValue] = useState<number>(Number.NaN);
  const [error, setError] = useState<string | null>(null);
  const current = settings.data?.visit_rate;

  useEffect(() => {
    if (current !== undefined) setValue(current);
  }, [current]);

  const invalid = Number.isNaN(value) || value < 0;
  const save = async () => {
    setError(null);
    try {
      await updateRate.mutateAsync(value);
    } catch (e) {
      setError(describeDbError(e));
    }
  };

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(3)}>
      <SectionHeader
        title="Valor por visita"
        description="Usado no fechamento: visitas do mês × valor = pagamento do piscineiro. Vale para todos."
      />
      {settings.isError ? (
        <LoadError error={settings.error} />
      ) : settings.isPending ? (
        <Skeleton className="h-16 w-64 rounded-xl" />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <NumberInput
              label="Valor por visita"
              currency
              value={value}
              onChange={setValue}
              error={invalid ? "Informe o valor" : undefined}
            />
          </div>
          <Button
            onPress={save}
            isPending={updateRate.isPending}
            isDisabled={invalid || value === current}
          >
            {({ isPending }) => <PendingLabel isPending={isPending}>Salvar</PendingLabel>}
          </Button>
        </div>
      )}
      {error && <StatusAlert status="danger" title="Não foi possível salvar" description={error} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

function PlanModal({
  state,
  clientCount,
  onClose,
}: {
  state: { plan?: Plan } | null;
  clientCount: number;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={!!state} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Fechar" />
          {state && (
            <PlanForm
              key={state.plan?.id ?? "new"}
              plan={state.plan}
              clientCount={clientCount}
              onClose={onClose}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function PlanForm({
  plan,
  clientCount,
  onClose,
}: {
  plan?: Plan;
  clientCount: number;
  onClose: () => void;
}) {
  const savePlan = useSavePlan();
  const deletePlan = useDeletePlan();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    formState: { isDirty, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          default_price: plan.default_price,
          visits_per_month: plan.visits_per_month,
          ok_max_days: plan.ok_max_days,
          attention_max_days: plan.attention_max_days,
        }
      : { name: "" },
  });

  const ok = watch("ok_max_days");
  const attention = watch("attention_max_days");
  const preview =
    Number.isInteger(ok) && Number.isInteger(attention) && attention > ok
      ? { ok_max_days: ok, attention_max_days: attention }
      : null;

  const onSubmit = async (values: PlanFormValues) => {
    setSubmitError(null);
    try {
      await savePlan.mutateAsync({ id: plan?.id, values });
      onClose();
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  const onDelete = async () => {
    if (!plan) return;
    try {
      await deletePlan.mutateAsync(plan);
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      setConfirmDelete(false);
      setSubmitError(describeDbError(error));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{plan ? `Editar ${plan.name}` : "Novo plano"}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="plan-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isRequired
                autoComplete="off"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              >
                <Label>Nome</Label>
                <Input variant="secondary" />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="default_price"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Valor padrão"
                  isRequired
                  currency
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="visits_per_month"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Visitas por mês"
                  isRequired
                  minValue={1}
                  maxValue={31}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="ok_max_days"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="OK até (dias)"
                  isRequired
                  maxValue={365}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="attention_max_days"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Atenção até (dias)"
                  isRequired
                  maxValue={365}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
          {preview && (
            <div className="animate-admin-rise flex flex-col gap-1.5">
              <p className="text-xs text-muted">Como fica o status:</p>
              <PlanRanges plan={preview} />
            </div>
          )}
          {plan && clientCount > 0 && isDirty && (
            <p className="text-xs text-muted">
              A mudança vale na hora para {clientCount} {clientCount === 1 ? "cliente" : "clientes"}{" "}
              deste plano.
            </p>
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
      <Modal.Footer className="flex-wrap">
        {plan && clientCount === 0 && (
          <Button variant="danger-soft" onPress={() => setConfirmDelete(true)} className="mr-auto">
            <TrashBin className="size-4" />
            Excluir
          </Button>
        )}
        <Button variant="tertiary" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="plan-form"
          isPending={isSubmitting || savePlan.isPending}
          isDisabled={!!plan && !isDirty}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>{plan ? "Salvar" : "Cadastrar plano"}</PendingLabel>
          )}
        </Button>
      </Modal.Footer>

      <AlertDialog.Backdrop isOpen={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-100">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Excluir plano?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                O plano <strong>{plan?.name}</strong> não tem clientes e será removido.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancelar
              </Button>
              <Button variant="danger" onPress={onDelete} isPending={deletePlan.isPending}>
                {({ isPending }) => <PendingLabel isPending={isPending}>Excluir</PendingLabel>}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}

// ---------------------------------------------------------------------------
// Piscineiro
// ---------------------------------------------------------------------------

function TechModal({ state, onClose }: { state: { tech?: PoolTech } | null; onClose: () => void }) {
  return (
    <Modal.Backdrop isOpen={!!state} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger aria-label="Fechar" />
          {state && <TechForm key={state.tech?.id ?? "new"} tech={state.tech} onClose={onClose} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function TechForm({ tech, onClose }: { tech?: PoolTech; onClose: () => void }) {
  const saveTech = useSavePoolTech();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<PoolTechFormInput, unknown, PoolTechFormValues>({
    resolver: zodResolver(poolTechFormSchema),
    defaultValues: {
      name: tech?.name ?? "",
      whatsapp: tech?.whatsapp ? formatBrazilPhone(tech.whatsapp) : "",
      active: tech?.active ?? true,
    },
  });

  const onSubmit = async (values: PoolTechFormValues) => {
    setSubmitError(null);
    try {
      await saveTech.mutateAsync({ id: tech?.id, values });
      onClose();
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{tech ? `Editar ${tech.name}` : "Novo piscineiro"}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="tech-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                isRequired
                autoComplete="off"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              >
                <Label>Nome</Label>
                <Input variant="secondary" />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="whatsapp"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                type="tel"
                inputMode="tel"
                name={field.name}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(maskBrazilPhoneInput(v))}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
              >
                <Label>WhatsApp</Label>
                <Input variant="secondary" placeholder="(51) 99999-9999" />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <ActiveSwitch
                  label="Piscineiro ativo"
                  isSelected={field.value}
                  onChange={field.onChange}
                />
                <p className="text-xs text-muted">
                  Inativos não aparecem para novas visitas, mas o histórico continua guardado.
                </p>
              </div>
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
      <Modal.Footer>
        <Button variant="tertiary" onPress={onClose}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="tech-form"
          isPending={isSubmitting || saveTech.isPending}
          isDisabled={!!tech && !isDirty}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {tech ? "Salvar" : "Cadastrar piscineiro"}
            </PendingLabel>
          )}
        </Button>
      </Modal.Footer>
    </>
  );
}
