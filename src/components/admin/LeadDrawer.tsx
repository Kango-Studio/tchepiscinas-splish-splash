import { useEffect, useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  AlertDialog,
  Button,
  Checkbox,
  CloseButton,
  Drawer,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { TrashBin } from "@gravity-ui/icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBrazilPhone, maskBrazilPhoneInput, normalizeBrazilPhone } from "@/lib/leads/phone";
import {
  CLIENT_TYPES,
  CLIENT_TYPE_LABELS,
  INTEREST_LABELS,
  LEAD_INTERESTS,
  LEAD_SOURCES,
  LEAD_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  leadFormSchema,
  type Lead,
  type LeadFormInput,
  type LeadFormValues,
  type LeadStage,
} from "@/lib/leads/schema";
import {
  describeDbError,
  findLeadsByPhone,
  useCreateLead,
  useDeleteLead,
  useUpdateLead,
} from "./leads-api";
import {
  LeadWhatsAppButton,
  PendingLabel,
  StageChip,
  StatusAlert,
  formatDate,
  formatDateTime,
} from "./ui";
import { isOverdue } from "./filters";
import { PRINT_INSTRUCTIONS, type PrintPrefill } from "./PrintImportModal";
import { FollowupTracker } from "./FollowupCheckpoints";

export type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; fromPrint?: PrintPrefill }
  | { mode: "edit"; leadId: string };

type Duplicate = Awaited<ReturnType<typeof findLeadsByPhone>>[number];

function toFormInput(lead?: Lead, fromPrint?: PrintPrefill): LeadFormInput {
  return {
    name: lead?.name ?? fromPrint?.name ?? "",
    whatsapp: lead
      ? formatBrazilPhone(lead.whatsapp)
      : fromPrint?.whatsapp
        ? formatBrazilPhone(fromPrint.whatsapp)
        : "",
    email: lead?.email ?? "",
    city: lead?.city ?? "",
    neighborhood: lead?.neighborhood ?? "",
    client_type: lead?.client_type ?? "residencial",
    interest: lead?.interest ?? "manutencao_recorrente",
    source: lead?.source ?? (fromPrint ? "whatsapp" : "manual"),
    stage: lead?.stage ?? "novo",
    initial_message: lead?.initial_message ?? "",
    internal_notes: lead?.internal_notes ?? "",
    next_contact_date: lead?.next_contact_date ?? "",
  };
}

export function LeadDrawer({
  state,
  leads,
  onClose,
  onOpenLead,
}: {
  state: DrawerState;
  leads: Lead[];
  onClose: () => void;
  onOpenLead: (id: string) => void;
}) {
  const isMobile = useIsMobile();
  const lead = state.mode === "edit" ? leads.find((l) => l.id === state.leadId) : undefined;
  const isOpen = state.mode === "create" || (state.mode === "edit" && !!lead);
  const fromPrint = state.mode === "create" ? state.fromPrint : undefined;
  const formKey =
    state.mode === "edit"
      ? `edit-${state.leadId}`
      : `${state.mode}-${fromPrint?.previewUrl ?? "manual"}`;
  const placement = isMobile ? "bottom" : "right";

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Drawer.Content placement={placement}>
        <Drawer.Dialog
          aria-label={lead ? `Lead ${lead.name}` : "Novo lead"}
          className={isMobile ? "max-h-[92dvh]" : "sm:w-xl"}
        >
          {isMobile && <Drawer.Handle />}
          <Drawer.CloseTrigger aria-label="Fechar" />
          {isOpen && (
            <LeadFormPanel
              key={formKey}
              lead={lead}
              fromPrint={fromPrint}
              onClose={onClose}
              onOpenLead={onOpenLead}
            />
          )}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

type TextName = "name" | "email" | "city" | "neighborhood";
type SelectName = "client_type" | "interest" | "source" | "stage";

function FormTextField({
  control,
  name,
  label,
  isRequired,
  type,
  placeholder,
}: {
  control: Control<LeadFormInput, unknown, LeadFormValues>;
  name: TextName;
  label: string;
  isRequired?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          fullWidth
          isRequired={isRequired}
          type={type}
          autoComplete="off"
          name={field.name}
          value={field.value ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isInvalid={!!fieldState.error}
        >
          <Label>{label}</Label>
          <Input variant="secondary" placeholder={placeholder} />
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}

function FormSelect({
  control,
  name,
  label,
  options,
  labels,
}: {
  control: Control<LeadFormInput, unknown, LeadFormValues>;
  name: SelectName;
  label: string;
  options: readonly string[];
  labels: Record<string, string>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          fullWidth
          variant="secondary"
          name={field.name}
          value={field.value as string}
          onChange={(key) => key && field.onChange(key)}
          onBlur={field.onBlur}
          isInvalid={!!fieldState.error}
        >
          <Label>{label}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {options.map((o) => (
                <ListBox.Item key={o} id={o} textValue={labels[o]}>
                  {labels[o]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <FieldError>{fieldState.error?.message}</FieldError>
        </Select>
      )}
    />
  );
}

function LeadFormPanel({
  lead,
  fromPrint,
  onClose,
  onOpenLead,
}: {
  lead?: Lead;
  fromPrint?: PrintPrefill;
  onClose: () => void;
  onOpenLead: (id: string) => void;
}) {
  const isEdit = !!lead;
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Cadastro por print exige confirmação explícita dos dados extraídos.
  const [printChecked, setPrintChecked] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: toFormInput(lead, fromPrint),
  });

  // Etapa alterada por fora (arrastando no Kanban) com o drawer aberto.
  useEffect(() => {
    if (lead && !isDirty) reset(toFormInput(lead));
  }, [lead, isDirty, reset]);

  const checkDuplicates = async (raw: string) => {
    const phone = normalizeBrazilPhone(raw);
    if (!phone || (lead && phone === lead.whatsapp)) {
      setDuplicates([]);
      return [];
    }
    try {
      const found = await findLeadsByPhone(phone, lead?.id);
      setDuplicates(found);
      setDuplicateConfirmed(false);
      return found;
    } catch {
      return [];
    }
  };

  // Número vindo do print: já avisa se existe lead com ele.
  useEffect(() => {
    if (fromPrint?.whatsapp) void checkDuplicates(fromPrint.whatsapp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: LeadFormValues) => {
    setSubmitError(null);
    if (fromPrint && !printChecked) return;
    const phoneChanged = !lead || values.whatsapp !== lead.whatsapp;
    if (phoneChanged && !duplicateConfirmed) {
      const found = await checkDuplicates(values.whatsapp);
      if (found.length > 0) return; // mostra o aviso e espera confirmação
    }
    try {
      if (lead) {
        const saved = await updateLead.mutateAsync({ id: lead.id, values });
        reset(toFormInput(saved));
      } else {
        await createLead.mutateAsync(values);
        onClose();
      }
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  const onDelete = async () => {
    if (!lead) return;
    try {
      await deleteLead.mutateAsync(lead);
      setConfirmDelete(false);
      onClose();
    } catch (error) {
      setConfirmDelete(false);
      setSubmitError(describeDbError(error));
    }
  };

  const busy = isSubmitting || createLead.isPending || updateLead.isPending;

  return (
    <>
      <Drawer.Header className="border-b border-separator pb-4">
        {lead ? (
          <>
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <Drawer.Heading className="text-xl font-semibold text-pool-deep">
                {lead.name}
              </Drawer.Heading>
              <StageChip stage={lead.stage} />
              {isOverdue(lead) && (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-soft-foreground">
                  Contato atrasado
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>Origem: {SOURCE_LABELS[lead.source]}</span>
              <span>Criado em {formatDateTime(lead.created_at)}</span>
              <span>Atualizado em {formatDateTime(lead.updated_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <LeadWhatsAppButton lead={lead} withLabel />
              <span className="text-sm text-muted">{formatBrazilPhone(lead.whatsapp)}</span>
            </div>
          </>
        ) : fromPrint ? (
          <>
            <Drawer.Heading className="pr-8 text-xl font-semibold text-pool-deep">
              Novo lead a partir do print
            </Drawer.Heading>
            <div className="flex gap-3">
              <a
                href={fromPrint.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 transition-transform duration-200 hover:scale-105"
                aria-label="Abrir print em tamanho real"
              >
                <img
                  src={fromPrint.previewUrl}
                  alt="Prévia do print"
                  className="h-28 w-20 rounded-lg border border-border bg-surface-secondary object-cover object-top"
                />
              </a>
              <p className="text-sm text-muted">
                {PRINT_INSTRUCTIONS}
                <span className="mt-1 block text-xs">
                  Campos não identificados ficaram em branco.
                </span>
              </p>
            </div>
          </>
        ) : (
          <Drawer.Heading className="pr-8 text-xl font-semibold text-pool-deep">
            Novo lead
          </Drawer.Heading>
        )}
      </Drawer.Header>

      <Drawer.Body className="flex flex-col gap-5 py-5 text-foreground">
        {/* Salva na hora, independente do botão "Salvar alterações". */}
        {lead && <FollowupTracker leadId={lead.id} />}
        <form
          id="lead-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <section className="grid gap-4 sm:grid-cols-2">
            <FormTextField control={control} name="name" label="Nome" isRequired />
            <Controller
              control={control}
              name="whatsapp"
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  isRequired
                  type="tel"
                  inputMode="tel"
                  name={field.name}
                  value={field.value}
                  onChange={(v) => field.onChange(maskBrazilPhoneInput(v))}
                  onBlur={() => {
                    field.onBlur();
                    void checkDuplicates(getValues("whatsapp"));
                  }}
                  isInvalid={!!fieldState.error}
                >
                  <Label>WhatsApp</Label>
                  <Input variant="secondary" placeholder="(51) 99999-9999" />
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
          </section>

          {duplicates.length > 0 && (
            <Alert status="warning" className="animate-admin-rise">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Já existe lead com este WhatsApp</Alert.Title>
                <Alert.Description>
                  <ul className="mt-1 flex flex-col gap-1 text-sm">
                    {duplicates.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2">
                        <strong>{d.name}</strong>
                        <span>
                          · {STAGE_LABELS[d.stage as LeadStage]} · criado em{" "}
                          {formatDate(d.created_at)}
                        </span>
                        <Button size="sm" variant="ghost" onPress={() => onOpenLead(d.id)}>
                          Abrir
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {!duplicateConfirmed ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onPress={() => setDuplicateConfirmed(true)}
                    >
                      Entendi, salvar mesmo assim
                    </Button>
                  ) : (
                    <span className="mt-2 block text-xs">
                      Confirmado. Clique em salvar para continuar.
                    </span>
                  )}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <section className="grid gap-4 sm:grid-cols-2">
            <FormTextField
              control={control}
              name="email"
              label="E-mail"
              type="email"
              placeholder="opcional"
            />
            <Controller
              control={control}
              name="next_contact_date"
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  type="date"
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                >
                  <Label>Próximo contato</Label>
                  <InputGroup variant="secondary">
                    <InputGroup.Input />
                    {field.value && (
                      <InputGroup.Suffix>
                        <CloseButton
                          aria-label="Limpar data"
                          onPress={() => setValue("next_contact_date", "", { shouldDirty: true })}
                        />
                      </InputGroup.Suffix>
                    )}
                  </InputGroup>
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
            <FormTextField
              control={control}
              name="city"
              label="Cidade"
              placeholder="Ex.: Porto Alegre"
            />
            <FormTextField control={control} name="neighborhood" label="Bairro" />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              control={control}
              name="stage"
              label="Etapa"
              options={LEAD_STAGES}
              labels={STAGE_LABELS}
            />
            <FormSelect
              control={control}
              name="interest"
              label="Interesse"
              options={LEAD_INTERESTS}
              labels={INTEREST_LABELS}
            />
            <FormSelect
              control={control}
              name="client_type"
              label="Tipo de cliente"
              options={CLIENT_TYPES}
              labels={CLIENT_TYPE_LABELS}
            />
            <FormSelect
              control={control}
              name="source"
              label="Origem"
              options={LEAD_SOURCES}
              labels={SOURCE_LABELS}
            />
          </section>

          {(
            [
              { name: "initial_message", label: "Mensagem inicial", rows: 2 },
              {
                name: "internal_notes",
                label: "Observações internas",
                rows: 3,
                placeholder: "Visível apenas para a equipe",
              },
            ] as const
          ).map((t) => (
            <Controller
              key={t.name}
              control={control}
              name={t.name}
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                >
                  <Label>{t.label}</Label>
                  <TextArea
                    variant="secondary"
                    rows={t.rows}
                    placeholder={"placeholder" in t ? t.placeholder : undefined}
                  />
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
          ))}

          {submitError && (
            <StatusAlert
              status="danger"
              title="Não foi possível salvar"
              description={submitError}
            />
          )}
        </form>
      </Drawer.Body>

      <Drawer.Footer className="flex-wrap border-t border-separator pt-4">
        {fromPrint && (
          <Checkbox isSelected={printChecked} onChange={setPrintChecked} className="mr-auto">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Conferi os dados com o print
            </Checkbox.Content>
          </Checkbox>
        )}
        {isEdit && (
          <Button variant="danger-soft" onPress={() => setConfirmDelete(true)} className="mr-auto">
            <TrashBin className="size-4" />
            Excluir
          </Button>
        )}
        <Button variant="tertiary" onPress={onClose}>
          {isEdit ? "Fechar" : "Cancelar"}
        </Button>
        <Button
          type="submit"
          form="lead-form"
          isPending={busy}
          isDisabled={(isEdit && !isDirty && !duplicateConfirmed) || (!!fromPrint && !printChecked)}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {isEdit ? "Salvar alterações" : "Cadastrar lead"}
            </PendingLabel>
          )}
        </Button>
      </Drawer.Footer>

      <AlertDialog.Backdrop isOpen={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-100">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Excluir lead?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                O lead <strong>{lead?.name}</strong> será removido permanentemente. Esta ação não
                pode ser desfeita.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancelar
              </Button>
              <Button variant="danger" onPress={onDelete} isPending={deleteLead.isPending}>
                {({ isPending }) => <PendingLabel isPending={isPending}>Excluir</PendingLabel>}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
