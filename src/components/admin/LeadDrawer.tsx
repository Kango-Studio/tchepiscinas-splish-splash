import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Trash2 } from "lucide-react";
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
import { LeadWhatsAppButton, StageChip, formatDate, formatDateTime } from "./ui";
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

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      placement={isMobile ? "bottom" : "right"}
      size={isMobile ? "full" : "xl"}
      scrollBehavior="inside"
    >
      <DrawerContent>
        {() =>
          isOpen ? (
            <LeadFormPanel
              key={formKey}
              lead={lead}
              fromPrint={fromPrint}
              onClose={onClose}
              onOpenLead={onOpenLead}
            />
          ) : null
        }
      </DrawerContent>
    </Drawer>
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
    formState: { errors, isDirty, isSubmitting },
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

  const textField = (
    name: "name" | "email" | "city" | "neighborhood",
    label: string,
    extra: Partial<React.ComponentProps<typeof Input>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          placeholder=" "
          {...extra}
          label={label}
          labelPlacement="outside"
          variant="bordered"
          value={field.value ?? ""}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          name={field.name}
          isInvalid={!!errors[name]}
          errorMessage={errors[name]?.message}
        />
      )}
    />
  );

  const selectField = <K extends "client_type" | "interest" | "source" | "stage">(
    name: K,
    label: string,
    options: readonly string[],
    labels: Record<string, string>,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          label={label}
          labelPlacement="outside"
          variant="bordered"
          disallowEmptySelection
          selectedKeys={[field.value as string]}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0];
            if (v) field.onChange(v);
          }}
          onBlur={field.onBlur}
          isInvalid={!!errors[name]}
          errorMessage={errors[name]?.message as string | undefined}
        >
          {options.map((o) => (
            <SelectItem key={o}>{labels[o]}</SelectItem>
          ))}
        </Select>
      )}
    />
  );

  const busy = isSubmitting || createLead.isPending || updateLead.isPending;

  return (
    <>
      <DrawerHeader className="flex flex-col gap-2 border-b border-default-100">
        {lead ? (
          <>
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <h2 className="text-xl font-bold text-pool-deep">{lead.name}</h2>
              <StageChip stage={lead.stage} />
              {isOverdue(lead) && (
                <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-semibold text-danger">
                  Contato atrasado
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-normal text-default-500">
              <span>Origem: {SOURCE_LABELS[lead.source]}</span>
              <span>Criado em {formatDateTime(lead.created_at)}</span>
              <span>Atualizado em {formatDateTime(lead.updated_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <LeadWhatsAppButton lead={lead} withLabel />
              <span className="text-sm text-default-600">{formatBrazilPhone(lead.whatsapp)}</span>
            </div>
          </>
        ) : fromPrint ? (
          <>
            <h2 className="text-xl font-bold text-pool-deep">Novo lead a partir do print</h2>
            <div className="flex gap-3">
              <a
                href={fromPrint.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
                aria-label="Abrir print em tamanho real"
              >
                <img
                  src={fromPrint.previewUrl}
                  alt="Prévia do print"
                  className="h-28 w-20 rounded-lg border border-default-200 bg-default-50 object-cover object-top"
                />
              </a>
              <p className="text-sm font-normal text-default-600">
                {PRINT_INSTRUCTIONS}
                <span className="mt-1 block text-xs text-default-400">
                  Campos não identificados ficaram em branco.
                </span>
              </p>
            </div>
          </>
        ) : (
          <h2 className="text-xl font-bold text-pool-deep">Novo lead</h2>
        )}
      </DrawerHeader>

      <DrawerBody className="py-5">
        {/* Salva na hora, independente do botão "Salvar alterações". */}
        {lead && <FollowupTracker leadId={lead.id} />}
        <form
          id="lead-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <section className="grid gap-5 sm:grid-cols-2">
            {textField("name", "Nome", { isRequired: true, autoComplete: "off" })}
            <Controller
              control={control}
              name="whatsapp"
              render={({ field }) => (
                <Input
                  label="WhatsApp"
                  labelPlacement="outside"
                  variant="bordered"
                  type="tel"
                  inputMode="tel"
                  placeholder="(51) 99999-9999"
                  isRequired
                  value={field.value}
                  onValueChange={(v) => field.onChange(maskBrazilPhoneInput(v))}
                  onBlur={() => {
                    field.onBlur();
                    void checkDuplicates(getValues("whatsapp"));
                  }}
                  isInvalid={!!errors.whatsapp}
                  errorMessage={errors.whatsapp?.message}
                />
              )}
            />
          </section>

          {duplicates.length > 0 && (
            <Alert
              color="warning"
              title="Já existe lead com este WhatsApp"
              description={
                <div className="mt-1 flex flex-col gap-2">
                  <ul className="text-sm">
                    {duplicates.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center gap-2">
                        <strong>{d.name}</strong>
                        <span>
                          · {STAGE_LABELS[d.stage as LeadStage]} · criado em{" "}
                          {formatDate(d.created_at)}
                        </span>
                        <Button
                          size="sm"
                          variant="light"
                          color="primary"
                          onPress={() => onOpenLead(d.id)}
                        >
                          Abrir
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {!duplicateConfirmed ? (
                    <div>
                      <Button
                        size="sm"
                        color="warning"
                        variant="flat"
                        onPress={() => setDuplicateConfirmed(true)}
                      >
                        Entendi, salvar mesmo assim
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs">Confirmado. Clique em salvar para continuar.</span>
                  )}
                </div>
              }
            />
          )}

          <section className="grid gap-5 sm:grid-cols-2">
            {textField("email", "E-mail", { type: "email", placeholder: "opcional" })}
            <Controller
              control={control}
              name="next_contact_date"
              render={({ field }) => (
                <Input
                  label="Próximo contato"
                  labelPlacement="outside"
                  variant="bordered"
                  type="date"
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  isClearable
                  onClear={() => setValue("next_contact_date", "", { shouldDirty: true })}
                  isInvalid={!!errors.next_contact_date}
                  errorMessage={errors.next_contact_date?.message}
                />
              )}
            />
            {textField("city", "Cidade", { placeholder: "Ex.: Porto Alegre" })}
            {textField("neighborhood", "Bairro")}
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            {selectField("stage", "Etapa", LEAD_STAGES, STAGE_LABELS)}
            {selectField("interest", "Interesse", LEAD_INTERESTS, INTEREST_LABELS)}
            {selectField("client_type", "Tipo de cliente", CLIENT_TYPES, CLIENT_TYPE_LABELS)}
            {selectField("source", "Origem", LEAD_SOURCES, SOURCE_LABELS)}
          </section>

          <Controller
            control={control}
            name="initial_message"
            render={({ field }) => (
              <Textarea
                label="Mensagem inicial"
                labelPlacement="outside"
                variant="bordered"
                minRows={2}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!errors.initial_message}
                errorMessage={errors.initial_message?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="internal_notes"
            render={({ field }) => (
              <Textarea
                label="Observações internas"
                labelPlacement="outside"
                variant="bordered"
                placeholder="Visível apenas para a equipe"
                minRows={3}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!errors.internal_notes}
                errorMessage={errors.internal_notes?.message}
              />
            )}
          />

          {submitError && (
            <Alert color="danger" title="Não foi possível salvar" description={submitError} />
          )}
        </form>
      </DrawerBody>

      <DrawerFooter className="flex-wrap border-t border-default-100">
        {fromPrint && (
          <Checkbox
            isSelected={printChecked}
            onValueChange={setPrintChecked}
            size="sm"
            className="mr-auto"
          >
            Conferi os dados com o print
          </Checkbox>
        )}
        {isEdit && (
          <Button
            color="danger"
            variant="light"
            startContent={<Trash2 className="size-4" />}
            onPress={() => setConfirmDelete(true)}
            className="mr-auto"
          >
            Excluir
          </Button>
        )}
        <Button variant="flat" onPress={onClose}>
          {isEdit ? "Fechar" : "Cancelar"}
        </Button>
        <Button
          color="primary"
          type="submit"
          form="lead-form"
          isLoading={busy}
          isDisabled={(isEdit && !isDirty && !duplicateConfirmed) || (!!fromPrint && !printChecked)}
        >
          {isEdit ? "Salvar alterações" : "Cadastrar lead"}
        </Button>
      </DrawerFooter>

      <Modal isOpen={confirmDelete} onOpenChange={setConfirmDelete} placement="center" size="sm">
        <ModalContent>
          <ModalHeader>Excluir lead?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              O lead <strong>{lead?.name}</strong> será removido permanentemente. Esta ação não pode
              ser desfeita.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button color="danger" onPress={onDelete} isLoading={deleteLead.isPending}>
              Excluir
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
