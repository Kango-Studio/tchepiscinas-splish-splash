import { useState } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  Button,
  Drawer,
  FieldError,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { TrashBin } from "@gravity-ui/icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBrazilPhone, maskBrazilPhoneInput } from "@/lib/leads/phone";
import {
  BILLING_LABELS,
  BILLING_TYPES,
  clientFormSchema,
  formatMoney,
  type Client,
  type ClientFormInput,
  type ClientFormValues,
  type Plan,
  type PoolTech,
} from "@/lib/visits/schema";
import { describeDbError } from "./leads-api";
import { useDeleteClient, useSaveClient } from "./visits-api";
import { ActiveSwitch, NumberInput, OptionSelect } from "./visits-ui";
import { PendingLabel, StatusAlert } from "./ui";

const NO_TECH = "__none";

function toFormInput(client?: Client): ClientFormInput {
  return {
    name: client?.name ?? "",
    whatsapp: client?.whatsapp ? formatBrazilPhone(client.whatsapp) : "",
    active: client?.active ?? true,
    neighborhood: client?.neighborhood ?? "",
    pool_tech_id: client?.pool_tech_id ?? "",
    plan_id: client?.plan_id ?? "",
    custom_price: client?.custom_price ?? undefined,
    billing_type: client?.billing_type ?? "pago",
    partnership_terms: client?.partnership_terms ?? "",
    notes: client?.notes ?? "",
  };
}

export function ClientDrawer({
  isOpen,
  client,
  plans,
  techs,
  hasVisits,
  onClose,
  onSaved,
  onDeleted,
}: {
  isOpen: boolean;
  client?: Client;
  plans: Plan[];
  techs: PoolTech[];
  // Cliente com visitas só pode ser inativado, não excluído.
  hasVisits?: boolean;
  onClose: () => void;
  onSaved?: (client: Client) => void;
  onDeleted?: () => void;
}) {
  const isMobile = useIsMobile();
  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Drawer.Content placement={isMobile ? "bottom" : "right"}>
        <Drawer.Dialog
          aria-label={client ? `Editar ${client.name}` : "Novo cliente"}
          className={isMobile ? "max-h-[92dvh]" : "sm:w-xl"}
        >
          {isMobile && <Drawer.Handle />}
          <Drawer.CloseTrigger aria-label="Fechar" />
          {isOpen && (
            <ClientForm
              key={client?.id ?? "new"}
              client={client}
              plans={plans}
              techs={techs}
              hasVisits={hasVisits ?? false}
              onClose={onClose}
              onSaved={onSaved}
              onDeleted={onDeleted}
            />
          )}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

type TextName = "name" | "neighborhood";

function FormText({
  control,
  name,
  label,
  isRequired,
}: {
  control: Control<ClientFormInput, unknown, ClientFormValues>;
  name: TextName;
  label: string;
  isRequired?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          fullWidth
          isRequired={isRequired}
          autoComplete="off"
          name={field.name}
          value={field.value ?? ""}
          onChange={field.onChange}
          onBlur={field.onBlur}
          isInvalid={!!fieldState.error}
        >
          <Label>{label}</Label>
          <Input variant="secondary" />
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}

function ClientForm({
  client,
  plans,
  techs,
  hasVisits,
  onClose,
  onSaved,
  onDeleted,
}: {
  client?: Client;
  plans: Plan[];
  techs: PoolTech[];
  hasVisits: boolean;
  onClose: () => void;
  onSaved?: (client: Client) => void;
  onDeleted?: () => void;
}) {
  const saveClient = useSaveClient();
  const deleteClient = useDeleteClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: toFormInput(client),
  });

  const billingType = useWatch({ control, name: "billing_type" });
  const planId = useWatch({ control, name: "plan_id" });
  const plan = plans.find((p) => p.id === planId);

  // Piscineiros inativos só aparecem se já forem o responsável deste cliente.
  const techOptions = [
    { id: NO_TECH, label: "Sem piscineiro" },
    ...techs
      .filter((t) => t.active || t.id === client?.pool_tech_id)
      .map((t) => ({ id: t.id, label: t.active ? t.name : `${t.name} (inativo)` })),
  ];

  const onSubmit = async (values: ClientFormValues) => {
    setSubmitError(null);
    try {
      const saved = await saveClient.mutateAsync({ id: client?.id, values });
      onSaved?.(saved);
      onClose();
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  const onDelete = async () => {
    if (!client) return;
    try {
      await deleteClient.mutateAsync(client);
      setConfirmDelete(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      setConfirmDelete(false);
      setSubmitError(describeDbError(error));
    }
  };

  return (
    <>
      <Drawer.Header className="border-b border-separator pb-4">
        <Drawer.Heading className="pr-8 text-xl font-semibold text-pool-deep">
          {client ? `Editar ${client.name}` : "Novo cliente"}
        </Drawer.Heading>
      </Drawer.Header>

      <Drawer.Body className="flex flex-col gap-5 py-5 text-foreground">
        <form
          id="client-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-5"
        >
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormText control={control} name="name" label="Nome" isRequired />
            </div>
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
            <FormText control={control} name="neighborhood" label="Bairro" />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="plan_id"
              render={({ field, fieldState }) => (
                <OptionSelect
                  label="Plano"
                  isRequired
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  options={plans.map((p) => ({ id: p.id, label: p.name }))}
                />
              )}
            />
            <Controller
              control={control}
              name="pool_tech_id"
              render={({ field }) => (
                <OptionSelect
                  label="Piscineiro responsável"
                  value={field.value || NO_TECH}
                  onChange={(v) => field.onChange(v === NO_TECH ? "" : v)}
                  onBlur={field.onBlur}
                  options={techOptions}
                />
              )}
            />
            <Controller
              control={control}
              name="custom_price"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Valor personalizado"
                  currency
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  placeholder={plan ? formatMoney(plan.default_price) : undefined}
                  description={
                    plan
                      ? `Vazio = valor do plano (${formatMoney(plan.default_price)})`
                      : "Vazio = valor do plano"
                  }
                />
              )}
            />
            <Controller
              control={control}
              name="billing_type"
              render={({ field }) => (
                <OptionSelect
                  label="Tipo de cobrança"
                  value={field.value}
                  onChange={(v) => v && field.onChange(v)}
                  onBlur={field.onBlur}
                  options={BILLING_TYPES.map((b) => ({ id: b, label: BILLING_LABELS[b] }))}
                />
              )}
            />
          </section>

          {billingType === "parceria" && (
            <Controller
              control={control}
              name="partnership_terms"
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  className="animate-admin-rise"
                  name={field.name}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                >
                  <Label>Contrapartida combinada</Label>
                  <Input variant="secondary" placeholder='Ex.: "2 posts/mês"' />
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
              >
                <Label>Observações</Label>
                <TextArea variant="secondary" rows={3} />
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
                  label="Cliente ativo"
                  isSelected={field.value}
                  onChange={field.onChange}
                />
                <p className="text-xs text-muted">
                  Clientes inativos ficam fora dos alertas de frequência, mas o histórico continua
                  guardado.
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
      </Drawer.Body>

      <Drawer.Footer className="flex-wrap border-t border-separator pt-4">
        {client && !hasVisits && (
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
          form="client-form"
          isPending={isSubmitting || saveClient.isPending}
          isDisabled={!!client && !isDirty}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {client ? "Salvar alterações" : "Cadastrar cliente"}
            </PendingLabel>
          )}
        </Button>
      </Drawer.Footer>

      <AlertDialog.Backdrop isOpen={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-100">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Excluir cliente?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                O cliente <strong>{client?.name}</strong> não tem visitas e será removido
                permanentemente.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancelar
              </Button>
              <Button variant="danger" onPress={onDelete} isPending={deleteClient.isPending}>
                {({ isPending }) => <PendingLabel isPending={isPending}>Excluir</PendingLabel>}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
