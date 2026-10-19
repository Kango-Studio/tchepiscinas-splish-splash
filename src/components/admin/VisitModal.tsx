import { useEffect, useId, useMemo, useState } from "react";
import {
  differenceInCalendarDays,
  differenceInHours,
  differenceInMinutes,
  format,
  parseISO,
} from "date-fns";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  AlertDialog,
  Button,
  ComboBox,
  FieldError,
  Header,
  Input,
  Label,
  ListBox,
  Modal,
  Spinner,
  TextArea,
  TextField,
  ToggleButton,
  toast,
} from "@heroui/react";
import { Check } from "@gravity-ui/icons";
import { SERVICE_GROUPS } from "@/lib/visits/services";
import {
  visitFormSchema,
  type Visit,
  type VisitFormInput,
  type VisitFormValues,
} from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import {
  findSameDayVisits,
  useDeleteVisit,
  useRecentVisits,
  useSaveVisit,
  useVisit,
} from "./visits-api";
import {
  FREQUENCY_STYLES,
  FrequencyChip,
  OptionSelect,
  daysLabel,
  useClientRows,
} from "./visits-ui";
import { PendingLabel, StatusAlert, formatDate, formatDateTime } from "./ui";

// Registro de visita nova: vazio (topo da tela Visitas) ou com cliente e
// piscineiro preenchidos (botão no cliente). Fica só na tela.
export type VisitModalState = { clientId?: string; techId?: string } | null;

// Editar uma visita abre pela URL (?visita=<id>): editId vem dela e
// onEditChange(undefined) tira o parâmetro.
export function VisitModal({
  state,
  editId,
  onClose,
  onEditChange,
}: {
  state: VisitModalState;
  editId?: string;
  onClose: () => void;
  onEditChange: (id: string | undefined) => void;
}) {
  // Fecha tudo (X, Esc, clique fora).
  const closeAll = () => {
    if (editId) onEditChange(undefined);
    if (state) onClose();
  };
  return (
    <Modal.Backdrop
      isOpen={!!state || !!editId}
      onOpenChange={(open) => !open && closeAll()}
      variant="blur"
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="sm:max-w-2xl">
          <Modal.CloseTrigger aria-label="Fechar" />
          {/* Visita aberta em "Últimas registradas": edita por cima do registro,
              que fica escondido (sem perder o que já foi preenchido) e volta ao salvar. */}
          {state && (
            <div className={editId ? "hidden" : "contents"}>
              <VisitForm
                key={`new-${state.clientId ?? ""}`}
                state={state}
                onClose={onClose}
                onEditRecent={(v) => onEditChange(v.id)}
              />
            </div>
          )}
          {editId && (
            <VisitEditForm
              key={editId}
              id={editId}
              onClose={() => onEditChange(undefined)}
              cancelLabel={state ? "Voltar" : undefined}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// Busca a visita no banco pelo ID antes de montar o formulário.
function VisitEditForm({
  id,
  onClose,
  cancelLabel,
}: {
  id: string;
  onClose: () => void;
  cancelLabel?: string;
}) {
  const query = useVisit(id);
  const notFound = query.isSuccess && !query.data;

  useEffect(() => {
    if (!notFound) return;
    toast.danger("Visita não encontrada", {
      description: "Pode ter sido excluída. Confira o link.",
    });
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  if (query.isError)
    return (
      <Modal.Body className="py-6">
        <StatusAlert
          status="danger"
          title="Não foi possível carregar a visita"
          description={describeDbError(query.error)}
        />
      </Modal.Body>
    );
  if (!query.data)
    return (
      <Modal.Body className="flex justify-center py-16">
        <Spinner aria-label="Carregando visita" />
      </Modal.Body>
    );
  return <VisitForm state={{ visit: query.data }} onClose={onClose} cancelLabel={cancelLabel} />;
}

type SubmitMode = "close" | "another";
type SameDay = Awaited<ReturnType<typeof findSameDayVisits>>;

// Os valores iniciais dependem dos clientes (piscineiro responsável), então
// o formulário só monta com a lista carregada.
type VisitFormProps = {
  state: { visit?: Visit; clientId?: string; techId?: string };
  onClose: () => void;
  // Só no registro: abre uma das últimas visitas para editar.
  onEditRecent?: (visit: Visit) => void;
  // Botão de sair do formulário (padrão: Cancelar/Fechar, oculto no celular).
  cancelLabel?: string;
};

function VisitForm({ state, ...props }: VisitFormProps) {
  const data = useClientRows();
  if (data.error)
    return (
      <Modal.Body>
        <StatusAlert
          status="danger"
          title="Não foi possível carregar clientes e piscineiros"
          description={describeDbError(data.error)}
        />
      </Modal.Body>
    );
  if (data.isPending)
    return (
      <Modal.Body className="flex justify-center py-16">
        <Spinner />
      </Modal.Body>
    );
  return <VisitFormBody state={state} data={data} {...props} />;
}

function VisitFormBody({
  state,
  data,
  onClose,
  onEditRecent,
  cancelLabel,
}: VisitFormProps & { data: ReturnType<typeof useClientRows> }) {
  const { visit } = state;
  // Dois formulários podem estar montados (registro escondido + edição).
  const formId = useId();
  const saveVisit = useSaveVisit();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sameDay, setSameDay] = useState<{ visits: SameDay; mode: SubmitMode } | null>(null);
  // Remonta o campo de cliente para limpar o texto digitado após "registrar outra".
  const [clientFieldKey, setClientFieldKey] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const initialClient = data.rows.find((c) => c.id === (visit?.client_id ?? state.clientId));
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isDirty, isSubmitting },
  } = useForm<VisitFormInput, unknown, VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      pool_tech_id: visit?.pool_tech_id ?? state.techId ?? initialClient?.pool_tech_id ?? "",
      client_id: visit?.client_id ?? state.clientId ?? "",
      visit_date: visit?.visit_date ?? todayISO(),
      services: visit?.services ?? [],
      service_other: visit?.service_other ?? "",
      notes: visit?.notes ?? "",
    },
  });

  const techId = useWatch({ control, name: "pool_tech_id" });
  const clientId = useWatch({ control, name: "client_id" });
  const services = useWatch({ control, name: "services" }) ?? [];
  const selectedClient = data.rows.find((c) => c.id === clientId);
  const techName = (id: string | null) => data.techs.find((t) => t.id === id)?.name;

  // Só ativos, mais o que já estiver na visita sendo editada.
  const techOptions = data.techs
    .filter((t) => t.active || t.id === visit?.pool_tech_id)
    .map((t) => ({ id: t.id, label: t.active ? t.name : `${t.name} (inativo)` }));

  const clientSections = useMemo(() => {
    const options = data.rows
      .filter((c) => c.active || c.id === visit?.client_id)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (!techId) return [{ title: null, items: options }];
    const mine = options.filter((c) => c.pool_tech_id === techId);
    const others = options.filter((c) => c.pool_tech_id !== techId);
    return [
      { title: `Clientes de ${techName(techId) ?? "piscineiro"}`, items: mine },
      { title: "Outros clientes", items: others },
    ].filter((s) => s.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows, data.techs, techId, visit?.client_id]);

  // sameDayConfirmed: a gestora já viu o aviso de visita repetida e confirmou.
  const save = async (values: VisitFormValues, mode: SubmitMode, sameDayConfirmed = false) => {
    setSubmitError(null);
    if (!sameDayConfirmed) {
      try {
        const found = await findSameDayVisits(values.client_id, values.visit_date, visit?.id);
        if (found.length > 0) {
          setSameDay({ visits: found, mode });
          return; // mostra o aviso e espera confirmação
        }
      } catch {
        // Sem a checagem, segue: o aviso é só uma ajuda.
      }
    }
    try {
      await saveVisit.mutateAsync({ id: visit?.id, values });
      setSameDay(null);
      if (mode === "close") {
        onClose();
        return;
      }
      // Mantém piscineiro e data; limpa o resto para a próxima visita.
      setLastSaved(
        `${data.rows.find((c) => c.id === values.client_id)?.name ?? "Cliente"} · ${formatDate(values.visit_date)}`,
      );
      reset({
        pool_tech_id: values.pool_tech_id,
        visit_date: values.visit_date,
        client_id: "",
        services: [],
        service_other: "",
        notes: "",
      });
      setClientFieldKey((k) => k + 1);
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  const submit = (mode: SubmitMode) => handleSubmit((values) => save(values, mode));

  const toggleService = (key: (typeof services)[number], on: boolean) =>
    setValue("services", on ? [...services, key] : services.filter((s) => s !== key), {
      shouldDirty: true,
      shouldValidate: true,
    });

  // Mudou cliente ou data: o aviso de visita repetida não vale mais.
  const clearSameDay = () => setSameDay(null);

  const busy = isSubmitting || saveVisit.isPending;
  const f = selectedClient?.frequency;

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{visit ? "Editar visita" : "Registrar visita"}</Modal.Heading>
        {visit && (
          <p className="text-xs text-muted">Registrada em {formatDateTime(visit.created_at)}</p>
        )}
      </Modal.Header>
      <Modal.Body>
        <form id={formId} onSubmit={submit("close")} noValidate className="flex flex-col gap-5">
          {lastSaved && (
            <p className="animate-admin-rise flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Check className="size-4 shrink-0" />
              Registrada: {lastSaved}. Pode lançar a próxima.
            </p>
          )}

          <section className="grid gap-4 sm:grid-cols-[1fr_1fr_11rem]">
            <Controller
              control={control}
              name="pool_tech_id"
              render={({ field, fieldState }) => (
                <OptionSelect
                  label="Piscineiro"
                  isRequired
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  options={techOptions}
                />
              )}
            />
            <Controller
              control={control}
              name="client_id"
              render={({ field, fieldState }) => (
                <ComboBox
                  key={clientFieldKey}
                  fullWidth
                  variant="secondary"
                  isRequired
                  menuTrigger="input"
                  selectedKey={field.value || null}
                  onSelectionChange={(key) => {
                    const id = key ? String(key) : "";
                    field.onChange(id);
                    clearSameDay();
                    // Sem piscineiro escolhido: usa o responsável pelo cliente.
                    const client = data.rows.find((c) => c.id === id);
                    if (client?.pool_tech_id && !getValues("pool_tech_id"))
                      setValue("pool_tech_id", client.pool_tech_id, { shouldValidate: true });
                  }}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                  className="sm:col-span-1"
                >
                  <Label>Cliente</Label>
                  <ComboBox.InputGroup>
                    <Input placeholder="Digite o nome" autoFocus={clientFieldKey > 0} />
                    <ComboBox.Trigger />
                  </ComboBox.InputGroup>
                  <ComboBox.Popover>
                    <ListBox
                      renderEmptyState={() => (
                        <p className="p-3 text-sm text-muted">Nenhum cliente encontrado.</p>
                      )}
                    >
                      {clientSections.map((section) => (
                        <ListBox.Section key={section.title ?? "all"}>
                          {section.title && <Header>{section.title}</Header>}
                          {section.items.map((c) => (
                            <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                              <span className="flex min-w-0 flex-1 items-center gap-2">
                                {c.frequency && c.active && (
                                  <span
                                    aria-hidden
                                    className={`size-2 shrink-0 rounded-full ${FREQUENCY_STYLES[c.frequency.status].dot}`}
                                  />
                                )}
                                <span className="truncate">{c.name}</span>
                              </span>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox.Section>
                      ))}
                    </ListBox>
                  </ComboBox.Popover>
                  <FieldError>{fieldState.error?.message}</FieldError>
                </ComboBox>
              )}
            />
            <Controller
              control={control}
              name="visit_date"
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  isRequired
                  type="date"
                  name={field.name}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    clearSameDay();
                  }}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                >
                  <Label>Data da visita</Label>
                  <Input variant="secondary" max={todayISO()} />
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
          </section>

          {selectedClient && f && (
            <div className="animate-admin-rise -mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <FrequencyChip status={f.status} active={selectedClient.active} />
              <span>{selectedClient.plan?.name}</span>
              <span>
                {daysLabel(f.days_without_visit)} sem visita
                {f.last_visit_date && ` (última em ${formatDate(f.last_visit_date)})`}
              </span>
              <span>
                {f.visits_this_month} de {f.expected_visits} no mês
              </span>
            </div>
          )}

          <Controller
            control={control}
            name="services"
            render={({ fieldState }) => (
              <fieldset className="flex flex-col gap-4">
                <legend className="mb-2 text-sm font-medium text-foreground">
                  Serviços <span className="text-danger">*</span>
                </legend>
                {SERVICE_GROUPS.map((group) => (
                  <div key={group.id} className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.services.map((s) => {
                        const selected = services.includes(s.key);
                        return (
                          <ToggleButton
                            key={s.key}
                            size="sm"
                            isSelected={selected}
                            onChange={(on) => toggleService(s.key, on)}
                            className={`rounded-full transition-[background-color,color,scale] duration-200 ${
                              selected
                                ? "bg-pool-deep text-white hover:bg-pool-deep/90"
                                : "bg-pool-mist/60 text-pool-deep hover:bg-pool-mist"
                            }`}
                          >
                            {selected && <Check className="animate-admin-pop size-3.5" />}
                            {s.label}
                          </ToggleButton>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {fieldState.error && (
                  <p className="text-xs text-danger">{fieldState.error.message}</p>
                )}
              </fieldset>
            )}
          />

          {services.includes("outro") && (
            <Controller
              control={control}
              name="service_other"
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  isRequired
                  autoFocus
                  className="animate-admin-rise"
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                  maxLength={200}
                >
                  <Label>Qual serviço?</Label>
                  <Input variant="secondary" placeholder="Ex.: Entrega do kit Acqua Tchê" />
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
          )}

          <Controller
            control={control}
            name="notes"
            render={({ field, fieldState }) => (
              <TextField
                fullWidth
                name={field.name}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!fieldState.error}
                maxLength={2000}
              >
                <Label>Observações</Label>
                <TextArea variant="secondary" rows={2} placeholder="Opcional" />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />

          {!visit && onEditRecent && <RecentVisits data={data} onOpen={onEditRecent} />}

          {sameDay && (
            <Alert status="warning" className="animate-admin-rise">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  Já existe visita de {selectedClient?.name ?? "este cliente"} em{" "}
                  {formatDate(getValues("visit_date"))}
                </Alert.Title>
                <Alert.Description>
                  <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                    {sameDay.visits.map((v) => (
                      <li key={v.id}>
                        {techName(v.pool_tech_id) ?? "Piscineiro"} · registrada em{" "}
                        {formatDateTime(v.created_at)}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-1 block text-xs">
                    Cada visita conta no fechamento do piscineiro.
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    isPending={busy}
                    onPress={() => {
                      void handleSubmit((values) => save(values, sameDay.mode, true))();
                    }}
                  >
                    {({ isPending }) => (
                      <PendingLabel isPending={isPending}>
                        É outra visita, salvar mesmo assim
                      </PendingLabel>
                    )}
                  </Button>
                </Alert.Description>
              </Alert.Content>
            </Alert>
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
      {/* No celular os dois botões de salvar dividem a linha; fechar fica no X. */}
      <Modal.Footer>
        <Button
          variant="tertiary"
          onPress={onClose}
          className={cancelLabel ? "mr-auto" : "mr-auto hidden sm:inline-flex"}
        >
          {cancelLabel ?? (lastSaved ? "Fechar" : "Cancelar")}
        </Button>
        {!visit && (
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            isPending={busy}
            onPress={() => void submit("another")()}
          >
            {({ isPending }) => (
              <PendingLabel isPending={isPending}>Salvar e registrar outra</PendingLabel>
            )}
          </Button>
        )}
        <Button
          type="submit"
          form={formId}
          className="flex-1 sm:flex-none"
          isPending={busy}
          isDisabled={!!visit && !isDirty}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {visit ? "Salvar alterações" : "Salvar"}
            </PendingLabel>
          )}
        </Button>
      </Modal.Footer>
    </>
  );
}

// "há 2 min", "há 3 h", "ontem", "há 4 dias".
function registeredAgo(iso: string, now: Date) {
  const at = parseISO(iso);
  const minutes = differenceInMinutes(now, at);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const days = differenceInCalendarDays(now, at);
  if (days === 0) return `há ${differenceInHours(now, at)} h`;
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}

// Hora atual que avança sozinha, para o "há N min" não ficar parado.
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// As 3 últimas visitas lançadas (qualquer piscineiro), para conferir o que já
// entrou. Some enquanto carrega ou se der erro: é só uma ajuda.
function RecentVisits({
  data,
  onOpen,
}: {
  data: ReturnType<typeof useClientRows>;
  onOpen: (visit: Visit) => void;
}) {
  const recent = useRecentVisits();
  const now = useNow();
  if (!recent.data?.length) return null;

  const techName = (id: string) => data.techs.find((t) => t.id === id)?.name ?? "Piscineiro";
  const clientName = (id: string) => data.rows.find((c) => c.id === id)?.name ?? "Cliente";

  return (
    <section aria-label="Últimas registradas" className="-mb-2 flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
        Últimas registradas
      </p>
      <ul className="flex flex-col">
        {recent.data.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onOpen(v)}
              title="Abrir para editar"
              className="-mx-2 flex w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left text-xs text-muted transition-colors duration-200 hover:bg-pool-mist/50 hover:text-pool-deep focus-visible:outline-2 focus-visible:outline-accent"
            >
              {/* No celular os nomes encurtam; data e "há quanto tempo" ficam. */}
              <span className="min-w-0 truncate">
                {techName(v.pool_tech_id)} · {clientName(v.client_id)}
              </span>
              <span className="shrink-0 whitespace-pre">
                {" · "}
                {format(parseISO(v.visit_date), "dd/MM")} · {registeredAgo(v.created_at, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Confirmação de exclusão, usada na página do cliente e na tela Visitas.
export function DeleteVisitDialog({
  visit,
  clientName,
  onClose,
}: {
  visit: Visit | null;
  clientName?: string;
  onClose: () => void;
}) {
  const deleteVisit = useDeleteVisit();
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!visit) return;
    setError(null);
    try {
      await deleteVisit.mutateAsync(visit);
      onClose();
    } catch (e) {
      setError(describeDbError(e));
    }
  };

  return (
    <AlertDialog.Backdrop isOpen={!!visit} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-100">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Excluir visita?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p>
              A visita{" "}
              {clientName && (
                <>
                  de <strong>{clientName}</strong>{" "}
                </>
              )}
              em <strong>{formatDate(visit?.visit_date ?? null)}</strong> será removida. Os dias sem
              visita e o fechamento do mês são recalculados.
            </p>
            {error && (
              <StatusAlert status="danger" title="Não foi possível excluir" description={error} />
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancelar
            </Button>
            <Button variant="danger" onPress={onDelete} isPending={deleteVisit.isPending}>
              {({ isPending }) => <PendingLabel isPending={isPending}>Excluir</PendingLabel>}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
