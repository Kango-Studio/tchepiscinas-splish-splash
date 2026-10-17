import { Button, Label, ListBox, SearchField, Select } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
import {
  INTEREST_LABELS,
  LEAD_INTERESTS,
  LEAD_SOURCES,
  LEAD_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
} from "@/lib/leads/schema";
import { EMPTY_FILTERS, NEXT_CONTACT_LABELS, hasActiveFilters, type LeadFilters } from "./filters";

const ALL = "__all";

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      fullWidth
      value={value || ALL}
      onChange={(key) => {
        const v = String(key ?? ALL);
        onChange(v === ALL ? "" : v);
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {[{ id: ALL, label: "Todos" }, ...options].map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function LeadFiltersBar({
  filters,
  onChange,
  cities,
  showStage,
}: {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  cities: string[];
  showStage: boolean;
}) {
  const set = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
      <SearchField
        aria-label="Buscar por nome ou telefone"
        className="col-span-2 sm:col-span-3 lg:w-72 lg:flex-none"
        fullWidth
        value={filters.search}
        onChange={(v) => set("search", v)}
        onClear={() => set("search", "")}
      >
        <Label className="sr-only lg:not-sr-only">Buscar</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Buscar por nome ou telefone" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <div className="lg:w-44">
        <FilterSelect
          label="Cidade"
          value={filters.city}
          options={cities.map((c) => ({ id: c, label: c }))}
          onChange={(v) => set("city", v)}
        />
      </div>
      <div className="lg:w-48">
        <FilterSelect
          label="Interesse"
          value={filters.interest}
          options={LEAD_INTERESTS.map((i) => ({ id: i, label: INTEREST_LABELS[i] }))}
          onChange={(v) => set("interest", v as LeadFilters["interest"])}
        />
      </div>
      <div className="lg:w-40">
        <FilterSelect
          label="Origem"
          value={filters.source}
          options={LEAD_SOURCES.map((s) => ({ id: s, label: SOURCE_LABELS[s] }))}
          onChange={(v) => set("source", v as LeadFilters["source"])}
        />
      </div>
      <div className="lg:w-44">
        <FilterSelect
          label="Próximo contato"
          value={filters.nextContact === "all" ? "" : filters.nextContact}
          options={(["overdue", "today", "next7", "scheduled", "none"] as const).map((k) => ({
            id: k,
            label: NEXT_CONTACT_LABELS[k],
          }))}
          onChange={(v) => set("nextContact", (v || "all") as LeadFilters["nextContact"])}
        />
      </div>
      {showStage && (
        <div className="animate-admin-rise lg:w-44">
          <FilterSelect
            label="Etapa"
            value={filters.stage}
            options={LEAD_STAGES.map((s) => ({ id: s, label: STAGE_LABELS[s] }))}
            onChange={(v) => set("stage", v as LeadFilters["stage"])}
          />
        </div>
      )}
      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          className="animate-admin-rise self-end"
          onPress={() => onChange(EMPTY_FILTERS)}
        >
          <Xmark className="size-4" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
