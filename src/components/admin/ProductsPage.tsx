import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Accordion,
  AlertDialog,
  Button,
  Card,
  Chip,
  ComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Skeleton,
  Table,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  type Key,
} from "@heroui/react";
import { Check, Flask, Pencil, Persons, Plus, TrashBin } from "@gravity-ui/icons";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import {
  formatMoney,
  productFormSchema,
  usageFormSchema,
  type Product,
  type ProductFormInput,
  type ProductFormValues,
  type ProductUsage,
  type UsageFormInput,
  type UsageFormValues,
} from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import {
  useDeleteUsage,
  usePoolTechs,
  useProductUsages,
  useProducts,
  useSaveProduct,
  useSaveUsage,
} from "./visits-api";
import { ActiveSwitch, NumberInput, OptionSelect } from "./visits-ui";
import { PendingLabel, StatusAlert, formatDate } from "./ui";

const stagger = (i: number) => ({ "--i": i }) as React.CSSProperties;

const PERIODS = { mes: "Este mês", anterior: "Mês anterior", tudo: "Tudo" } as const;
type Period = keyof typeof PERIODS;

function periodRange(period: Period): [string, string] {
  const today = parseISO(todayISO());
  if (period === "mes") return [format(startOfMonth(today), "yyyy-MM-dd"), todayISO()];
  if (period === "anterior") {
    const prev = subMonths(today, 1);
    return [format(startOfMonth(prev), "yyyy-MM-dd"), format(endOfMonth(prev), "yyyy-MM-dd")];
  }
  return ["", "9999"];
}

const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type UsageModalState = { usage?: ProductUsage } | null;
type ProductModalState = { product?: Product } | null;

export function ProductsPage() {
  const products = useProducts();
  const usages = useProductUsages();
  const techs = usePoolTechs();
  const [period, setPeriod] = useState<Period>("mes");
  const [usageModal, setUsageModal] = useState<UsageModalState>(null);
  const [productModal, setProductModal] = useState<ProductModalState>(null);
  const [toDelete, setToDelete] = useState<ProductUsage | null>(null);

  const productById = useMemo(
    () => new Map((products.data ?? []).map((p) => [p.id, p])),
    [products.data],
  );
  const techName = (id: string) => techs.data?.find((t) => t.id === id)?.name ?? "—";

  const inPeriod = useMemo(() => {
    const [from, to] = periodRange(period);
    return (usages.data ?? []).filter((u) => u.used_on >= from && u.used_on <= to);
  }, [usages.data, period]);

  const error = products.error ?? usages.error ?? techs.error;
  const isPending = products.isPending || usages.isPending || techs.isPending;

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="animate-admin-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-pool-deep md:text-3xl">
              Produtos
            </h1>
            <p className="text-sm text-muted">Quanto de produto cada piscineiro gasta.</p>
          </div>
          <Button size="lg" onPress={() => setUsageModal({})} isDisabled={isPending}>
            <Plus className="size-4" />
            Lançar gasto
          </Button>
        </div>

        {error && (
          <StatusAlert
            status="danger"
            title="Não foi possível carregar os produtos"
            description={describeDbError(error)}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <ToggleButtonGroup
            aria-label="Período"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set<Key>([period])}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next) setPeriod(next as Period);
            }}
          >
            {(Object.keys(PERIODS) as Period[]).map((k, i) => (
              <ToggleButton key={k} id={k} size="sm">
                {i > 0 && <ToggleButtonGroup.Separator />}
                {PERIODS[k]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <SummaryCard
          usages={inPeriod}
          productById={productById}
          techs={techs.data ?? []}
          isPending={isPending}
        />

        <UsagesCard
          usages={inPeriod}
          productById={productById}
          techName={techName}
          isPending={isPending}
          onEdit={(usage) => setUsageModal({ usage })}
          onDelete={setToDelete}
        />

        <ProductsCard
          products={products.data ?? []}
          usages={usages.data ?? []}
          isPending={products.isPending}
          onEdit={(product) => setProductModal({ product })}
          onCreate={() => setProductModal({})}
        />
      </div>

      <UsageModal
        state={usageModal}
        products={products.data ?? []}
        techs={techs.data ?? []}
        onClose={() => setUsageModal(null)}
      />
      <ProductModal state={productModal} onClose={() => setProductModal(null)} />
      <DeleteUsageDialog
        usage={toDelete}
        label={
          toDelete
            ? `${productById.get(toDelete.product_id)?.name ?? "Produto"} · ${techName(toDelete.pool_tech_id)} · ${formatDate(toDelete.used_on)}`
            : ""
        }
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Resumo: um piscineiro por linha; ao abrir, o detalhe por produto
// ---------------------------------------------------------------------------

function SummaryCard({
  usages,
  productById,
  techs,
  isPending,
}: {
  usages: ProductUsage[];
  productById: Map<string, Product>;
  techs: { id: string; name: string; active: boolean }[];
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<Key>>(new Set());

  const rows = useMemo(() => {
    const byTech = new Map<string, Map<string, number>>();
    for (const u of usages) {
      const products = byTech.get(u.pool_tech_id) ?? new Map<string, number>();
      products.set(u.product_id, (products.get(u.product_id) ?? 0) + u.quantity);
      byTech.set(u.pool_tech_id, products);
    }
    return techs
      .filter((t) => byTech.has(t.id))
      .map((t) => {
        const items = [...byTech.get(t.id)!.entries()]
          .map(([productId, quantity]) => {
            const product = productById.get(productId);
            const price = product?.unit_price ?? null;
            return {
              productId,
              name: product?.name ?? "Produto removido",
              quantity,
              total: price === null ? null : price * quantity,
            };
          })
          .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR"));
        const priced = items.filter((i) => i.total !== null);
        return {
          tech: t,
          items,
          quantity: items.reduce((s, i) => s + i.quantity, 0),
          // Total em R$ só considera produtos com preço cadastrado.
          total: priced.length ? priced.reduce((s, i) => s + (i.total ?? 0), 0) : null,
          missingPrice: priced.length < items.length,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);
  }, [usages, productById, techs]);

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(1)}>
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">
          Resumo por piscineiro
        </h2>
        <p className="text-xs text-muted">Total de itens e, quando há preço, o valor em R$.</p>
      </div>
      {isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum gasto lançado neste período.</p>
      ) : (
        <Accordion
          allowsMultipleExpanded
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
          className="rounded-2xl border border-separator"
        >
          {rows.map((r) => (
            <Accordion.Item key={r.tech.id} id={r.tech.id}>
              <Accordion.Heading>
                <Accordion.Trigger className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pool-mist text-pool-deep">
                    <Persons className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{r.tech.name}</span>
                    <span className="block text-xs text-muted tabular-nums">
                      {qty(r.quantity)} {r.quantity === 1 ? "item" : "itens"} · {r.items.length}{" "}
                      {r.items.length === 1 ? "produto" : "produtos"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-lg font-medium tabular-nums">
                      {r.total === null ? "—" : formatMoney(r.total)}
                    </span>
                    {r.total !== null && r.missingPrice && (
                      <span className="block text-[11px] text-muted">sem preço em alguns</span>
                    )}
                  </span>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="px-4 pb-4">
                  <ul className="flex flex-col divide-y divide-separator rounded-xl bg-surface-secondary/60 px-3">
                    {r.items.map((i) => (
                      <li key={i.productId} className="flex items-center gap-3 py-2 text-sm">
                        <span className="min-w-0 flex-1">{i.name}</span>
                        <span className="tabular-nums">{qty(i.quantity)}×</span>
                        <span className="w-24 text-right text-muted tabular-nums">
                          {i.total === null ? "sem preço" : formatMoney(i.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lançamentos do período
// ---------------------------------------------------------------------------

function UsagesCard({
  usages,
  productById,
  techName,
  isPending,
  onEdit,
  onDelete,
}: {
  usages: ProductUsage[];
  productById: Map<string, Product>;
  techName: (id: string) => string;
  isPending: boolean;
  onEdit: (usage: ProductUsage) => void;
  onDelete: (usage: ProductUsage) => void;
}) {
  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(2)}>
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">Lançamentos</h2>
        <p className="text-xs text-muted">
          {usages.length} {usages.length === 1 ? "lançamento" : "lançamentos"} no período.
        </p>
      </div>
      {isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : usages.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum lançamento neste período.</p>
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Lançamentos de produtos">
              <Table.Header>
                <Table.Column id="date" isRowHeader>
                  Data
                </Table.Column>
                <Table.Column id="product">Produto</Table.Column>
                <Table.Column id="qty" className="hidden text-end sm:table-cell">
                  Qtd.
                </Table.Column>
                <Table.Column id="tech" className="hidden sm:table-cell">
                  Piscineiro
                </Table.Column>
                <Table.Column id="actions" className="text-end">
                  Ações
                </Table.Column>
              </Table.Header>
              <Table.Body items={usages}>
                {(u) => (
                  <Table.Row id={u.id}>
                    <Table.Cell className="whitespace-nowrap tabular-nums">
                      <span className="sm:hidden">{format(parseISO(u.used_on), "dd/MM")}</span>
                      <span className="hidden sm:inline">
                        {format(parseISO(u.used_on), "dd/MM/yy")}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="block">
                        {productById.get(u.product_id)?.name ?? "Produto removido"}
                      </span>
                      <span className="block text-xs text-muted sm:hidden">
                        {qty(u.quantity)}× · {techName(u.pool_tech_id)}
                      </span>
                      {u.notes && (
                        <span className="block text-xs text-muted md:max-w-72">{u.notes}</span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="hidden text-end tabular-nums sm:table-cell">
                      {qty(u.quantity)}
                    </Table.Cell>
                    <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
                      {techName(u.pool_tech_id)}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        <Tooltip delay={300} closeDelay={0}>
                          <Tooltip.Trigger>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="tertiary"
                              className="rounded-full"
                              aria-label="Editar lançamento"
                              onPress={() => onEdit(u)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Editar</Tooltip.Content>
                        </Tooltip>
                        <Tooltip delay={300} closeDelay={0}>
                          <Tooltip.Trigger>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              className="rounded-full text-muted hover:text-danger"
                              aria-label="Excluir lançamento"
                              onPress={() => onDelete(u)}
                            >
                              <TrashBin className="size-4" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>Excluir</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lista de produtos
// ---------------------------------------------------------------------------

function ProductsCard({
  products,
  usages,
  isPending,
  onEdit,
  onCreate,
}: {
  products: Product[];
  usages: ProductUsage[];
  isPending: boolean;
  onEdit: (product: Product) => void;
  onCreate: () => void;
}) {
  const used = new Set(usages.map((u) => u.product_id));
  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5" style={stagger(3)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Lista de produtos
          </h2>
          <p className="text-xs text-muted">Nomes padronizados e preço unitário (opcional).</p>
        </div>
        <Button size="sm" onPress={onCreate}>
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>
      {isPending ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : products.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhum produto cadastrado.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-separator px-3 py-2.5"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg ${
                  p.active ? "bg-pool-mist text-pool-deep" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Flask className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {p.name}
                  {!p.active && (
                    <Chip size="sm" variant="soft" className="ml-2 bg-slate-200 text-slate-700">
                      <Chip.Label>Inativo</Chip.Label>
                    </Chip>
                  )}
                </span>
                <span className="block text-xs text-muted">
                  {p.unit_price === null ? "Sem preço" : formatMoney(p.unit_price)}
                  {!used.has(p.id) && " · sem lançamentos"}
                </span>
              </span>
              <Button
                isIconOnly
                size="sm"
                variant="tertiary"
                className="shrink-0 rounded-full"
                aria-label={`Editar ${p.name}`}
                onPress={() => onEdit(p)}
              >
                <Pencil className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pop-up: lançar gasto
// ---------------------------------------------------------------------------

function UsageModal({
  state,
  products,
  techs,
  onClose,
}: {
  state: UsageModalState;
  products: Product[];
  techs: { id: string; name: string; active: boolean }[];
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={!!state} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-lg">
          <Modal.CloseTrigger aria-label="Fechar" />
          {state && (
            <UsageForm
              key={state.usage?.id ?? "new"}
              usage={state.usage}
              products={products}
              techs={techs}
              onClose={onClose}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function UsageForm({
  usage,
  products,
  techs,
  onClose,
}: {
  usage?: ProductUsage;
  products: Product[];
  techs: { id: string; name: string; active: boolean }[];
  onClose: () => void;
}) {
  const saveUsage = useSaveUsage();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [productFieldKey, setProductFieldKey] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<UsageFormInput, unknown, UsageFormValues>({
    resolver: zodResolver(usageFormSchema),
    defaultValues: {
      used_on: usage?.used_on ?? todayISO(),
      pool_tech_id: usage?.pool_tech_id ?? "",
      product_id: usage?.product_id ?? "",
      quantity: usage?.quantity ?? 1,
      notes: usage?.notes ?? "",
    },
  });

  const techOptions = techs
    .filter((t) => t.active || t.id === usage?.pool_tech_id)
    .map((t) => ({ id: t.id, label: t.name }));
  const productOptions = products.filter((p) => p.active || p.id === usage?.product_id);

  const save = async (values: UsageFormValues, another: boolean) => {
    setSubmitError(null);
    try {
      await saveUsage.mutateAsync({ id: usage?.id, values });
      if (!another) {
        onClose();
        return;
      }
      // Mantém piscineiro e data; limpa o resto.
      setLastSaved(
        `${products.find((p) => p.id === values.product_id)?.name ?? "Produto"} · ${qty(values.quantity)}`,
      );
      reset({
        used_on: values.used_on,
        pool_tech_id: values.pool_tech_id,
        product_id: "",
        quantity: 1,
        notes: "",
      });
      setProductFieldKey((k) => k + 1);
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  const busy = isSubmitting || saveUsage.isPending;

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{usage ? "Editar lançamento" : "Lançar gasto de produto"}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="usage-form"
          onSubmit={handleSubmit((v) => save(v, false))}
          noValidate
          className="flex flex-col gap-4"
        >
          {lastSaved && (
            <p className="animate-admin-rise flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <Check className="size-4 shrink-0" />
              Lançado: {lastSaved}. Pode lançar o próximo.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
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
              name="used_on"
              render={({ field, fieldState }) => (
                <TextField
                  fullWidth
                  isRequired
                  type="date"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                >
                  <Label>Data</Label>
                  <Input variant="secondary" max={todayISO()} />
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Controller
              control={control}
              name="product_id"
              render={({ field, fieldState }) => (
                <ComboBox
                  key={productFieldKey}
                  fullWidth
                  variant="secondary"
                  isRequired
                  menuTrigger="input"
                  selectedKey={field.value || null}
                  onSelectionChange={(key) => field.onChange(key ? String(key) : "")}
                  onBlur={field.onBlur}
                  isInvalid={!!fieldState.error}
                >
                  <Label>Produto</Label>
                  <ComboBox.InputGroup>
                    <Input placeholder="Digite o nome" autoFocus={productFieldKey > 0} />
                    <ComboBox.Trigger />
                  </ComboBox.InputGroup>
                  <ComboBox.Popover>
                    <ListBox
                      renderEmptyState={() => (
                        <p className="p-3 text-sm text-muted">
                          Nenhum produto. Cadastre na lista de produtos.
                        </p>
                      )}
                    >
                      {productOptions.map((p) => (
                        <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                          {p.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </ComboBox.Popover>
                  <FieldError>{fieldState.error?.message}</FieldError>
                </ComboBox>
              )}
            />
            <Controller
              control={control}
              name="quantity"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Quantidade"
                  isRequired
                  minValue={1}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
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
                maxLength={500}
              >
                <Label>Observação</Label>
                <Input variant="secondary" placeholder="Opcional" />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
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
        <Button variant="tertiary" onPress={onClose} className="mr-auto hidden sm:inline-flex">
          {lastSaved ? "Fechar" : "Cancelar"}
        </Button>
        {!usage && (
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            isPending={busy}
            onPress={() => void handleSubmit((v) => save(v, true))()}
          >
            {({ isPending }) => (
              <PendingLabel isPending={isPending}>Salvar e lançar outro</PendingLabel>
            )}
          </Button>
        )}
        <Button
          type="submit"
          form="usage-form"
          className="flex-1 sm:flex-none"
          isPending={busy}
          isDisabled={!!usage && !isDirty}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {usage ? "Salvar alterações" : "Salvar"}
            </PendingLabel>
          )}
        </Button>
      </Modal.Footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pop-up: produto
// ---------------------------------------------------------------------------

function ProductModal({ state, onClose }: { state: ProductModalState; onClose: () => void }) {
  return (
    <Modal.Backdrop isOpen={!!state} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Modal.Container scroll="inside">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger aria-label="Fechar" />
          {state && (
            <ProductForm
              key={state.product?.id ?? "new"}
              product={state.product}
              onClose={onClose}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const saveProduct = useSaveProduct();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? "",
      unit_price: product?.unit_price ?? undefined,
      active: product?.active ?? true,
    },
  });

  const onSubmit = async (values: ProductFormValues) => {
    setSubmitError(null);
    try {
      await saveProduct.mutateAsync({ id: product?.id, values });
      onClose();
    } catch (error) {
      setSubmitError(describeDbError(error));
    }
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{product ? `Editar ${product.name}` : "Novo produto"}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <form
          id="product-form"
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
                <Label>Nome padronizado</Label>
                <Input variant="secondary" placeholder='Ex.: "Cloro 3kg"' />
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="unit_price"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Preço unitário"
                currency
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                description="Opcional. Com preço, o resumo mostra o total em R$."
              />
            )}
          />
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <ActiveSwitch
                  label="Produto ativo"
                  isSelected={field.value}
                  onChange={field.onChange}
                />
                <p className="text-xs text-muted">
                  Inativos não aparecem para novos lançamentos, mas o histórico continua.
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
          form="product-form"
          isPending={isSubmitting || saveProduct.isPending}
          isDisabled={!!product && !isDirty}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending}>
              {product ? "Salvar" : "Cadastrar produto"}
            </PendingLabel>
          )}
        </Button>
      </Modal.Footer>
    </>
  );
}

function DeleteUsageDialog({
  usage,
  label,
  onClose,
}: {
  usage: ProductUsage | null;
  label: string;
  onClose: () => void;
}) {
  const deleteUsage = useDeleteUsage();
  const [error, setError] = useState<string | null>(null);
  const onDelete = async () => {
    if (!usage) return;
    setError(null);
    try {
      await deleteUsage.mutateAsync(usage);
      onClose();
    } catch (e) {
      setError(describeDbError(e));
    }
  };
  return (
    <AlertDialog.Backdrop isOpen={!!usage} onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-100">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Excluir lançamento?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-3">
            <p>{label}</p>
            {error && (
              <StatusAlert status="danger" title="Não foi possível excluir" description={error} />
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Cancelar
            </Button>
            <Button variant="danger" onPress={onDelete} isPending={deleteUsage.isPending}>
              {({ isPending }) => <PendingLabel isPending={isPending}>Excluir</PendingLabel>}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
