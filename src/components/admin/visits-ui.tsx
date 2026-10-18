import { useMemo } from "react";
import {
  Chip,
  Description,
  FieldError,
  Label,
  ListBox,
  NumberField,
  Select,
  Switch,
} from "@heroui/react";
import {
  FREQUENCY_LABELS,
  LATE_CASE_STATUS_LABELS,
  type Client,
  type ClientFrequency,
  type FrequencyStatus,
  type LateCaseStatus,
  type Plan,
  type PoolTech,
} from "@/lib/visits/schema";
import { useClientFrequency, useClients, usePlans, usePoolTechs } from "./visits-api";

export const FREQUENCY_STYLES: Record<
  FrequencyStatus,
  { dot: string; chip: string; text: string }
> = {
  ok: { dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800", text: "text-emerald-700" },
  atencao: { dot: "bg-amber-400", chip: "bg-amber-100 text-amber-900", text: "text-amber-700" },
  atrasado: { dot: "bg-red-500", chip: "bg-red-100 text-red-800", text: "text-red-700" },
};

// Inativos não entram nos alertas: mostram "Inativo" no lugar do status.
export function FrequencyChip({
  status,
  active = true,
  size = "sm",
}: {
  status: FrequencyStatus;
  active?: boolean;
  size?: "sm" | "md";
}) {
  const style = active
    ? FREQUENCY_STYLES[status]
    : { dot: "bg-slate-400", chip: "bg-slate-200 text-slate-700" };
  return (
    <Chip size={size} variant="soft" className={`font-semibold whitespace-nowrap ${style.chip}`}>
      <span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      <Chip.Label>{active ? FREQUENCY_LABELS[status] : "Inativo"}</Chip.Label>
    </Chip>
  );
}

const LATE_CASE_STYLES: Record<LateCaseStatus, string> = {
  pendente: "bg-red-100 text-red-800",
  acionado: "bg-amber-100 text-amber-900",
  resolvido: "bg-emerald-100 text-emerald-800",
  lancamento_atrasado: "bg-slate-200 text-slate-700",
};

export function LateCaseChip({ status }: { status: LateCaseStatus }) {
  return (
    <Chip
      size="sm"
      variant="soft"
      className={`font-semibold whitespace-nowrap ${LATE_CASE_STYLES[status]}`}
    >
      <Chip.Label>{LATE_CASE_STATUS_LABELS[status]}</Chip.Label>
    </Chip>
  );
}

export const daysLabel = (days: number) => (days === 1 ? "1 dia" : `${days} dias`);

// ---------------------------------------------------------------------------
// Cliente com plano, piscineiro e frequência juntos (as listas são pequenas).
// ---------------------------------------------------------------------------

export type ClientRow = Client & {
  plan?: Plan;
  tech?: PoolTech;
  frequency?: ClientFrequency;
};

export function useClientRows() {
  const clients = useClients();
  const plans = usePlans();
  const techs = usePoolTechs();
  const frequency = useClientFrequency();
  const queries = [clients, plans, techs, frequency];

  const rows = useMemo<ClientRow[]>(() => {
    const planById = new Map((plans.data ?? []).map((p) => [p.id, p]));
    const techById = new Map((techs.data ?? []).map((t) => [t.id, t]));
    const freqById = new Map((frequency.data ?? []).map((f) => [f.client_id, f]));
    return (clients.data ?? []).map((c) => ({
      ...c,
      plan: planById.get(c.plan_id),
      tech: c.pool_tech_id ? techById.get(c.pool_tech_id) : undefined,
      frequency: freqById.get(c.id),
    }));
  }, [clients.data, plans.data, techs.data, frequency.data]);

  return {
    rows,
    plans: plans.data ?? [],
    techs: techs.data ?? [],
    isPending: queries.some((q) => q.isPending),
    isFetching: queries.some((q) => q.isFetching),
    error: queries.find((q) => q.isError)?.error ?? null,
    refetch: () => queries.forEach((q) => q.isError && void q.refetch()),
  };
}

// ---------------------------------------------------------------------------
// Campos de formulário (controlados, para usar com o Controller do RHF)
// ---------------------------------------------------------------------------

export function OptionSelect({
  label,
  value,
  options,
  onChange,
  onBlur,
  error,
  isRequired,
  placeholder = "Selecione",
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  isRequired?: boolean;
  placeholder?: string;
}) {
  return (
    <Select
      fullWidth
      variant="secondary"
      isRequired={isRequired}
      placeholder={placeholder}
      value={value || null}
      onChange={(key) => onChange(key ? String(key) : "")}
      onBlur={onBlur}
      isInvalid={!!error}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      <FieldError>{error}</FieldError>
    </Select>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  description,
  isRequired,
  currency,
  minValue = 0,
  maxValue,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur?: () => void;
  error?: string;
  description?: string;
  isRequired?: boolean;
  currency?: boolean;
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
}) {
  return (
    <NumberField
      fullWidth
      variant="secondary"
      isRequired={isRequired}
      value={value ?? Number.NaN}
      onChange={onChange}
      onBlur={onBlur}
      minValue={minValue}
      maxValue={maxValue}
      isInvalid={!!error}
      formatOptions={
        currency
          ? { style: "currency", currency: "BRL" }
          : { maximumFractionDigits: 0, useGrouping: false }
      }
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input placeholder={placeholder} />
        <NumberField.IncrementButton />
      </NumberField.Group>
      {description && !error && <Description>{description}</Description>}
      <FieldError>{error}</FieldError>
    </NumberField>
  );
}

export function ActiveSwitch({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch isSelected={isSelected} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{label}</Label>
      </Switch.Content>
    </Switch>
  );
}
