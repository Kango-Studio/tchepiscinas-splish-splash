import { Button, Input, Select, SelectItem } from "@heroui/react";
import { Search, X } from "lucide-react";
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
  options: { key: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      label={label}
      size="sm"
      variant="bordered"
      disallowEmptySelection
      selectedKeys={[value || ALL]}
      onSelectionChange={(keys) => {
        const v = String(Array.from(keys)[0] ?? ALL);
        onChange(v === ALL ? "" : v);
      }}
      classNames={{ trigger: "bg-white" }}
    >
      {[{ key: ALL, label: "Todos" }, ...options].map((o) => (
        <SelectItem key={o.key}>{o.label}</SelectItem>
      ))}
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
      <Input
        aria-label="Buscar por nome ou telefone"
        placeholder="Buscar por nome ou telefone"
        size="md"
        variant="bordered"
        isClearable
        value={filters.search}
        onValueChange={(v) => set("search", v)}
        onClear={() => set("search", "")}
        startContent={<Search className="size-4 text-default-400" />}
        classNames={{
          base: "col-span-2 sm:col-span-3 lg:w-72 lg:flex-none",
          inputWrapper: "bg-white",
        }}
      />
      <div className="lg:w-44">
        <FilterSelect
          label="Cidade"
          value={filters.city}
          options={cities.map((c) => ({ key: c, label: c }))}
          onChange={(v) => set("city", v)}
        />
      </div>
      <div className="lg:w-48">
        <FilterSelect
          label="Interesse"
          value={filters.interest}
          options={LEAD_INTERESTS.map((i) => ({ key: i, label: INTEREST_LABELS[i] }))}
          onChange={(v) => set("interest", v as LeadFilters["interest"])}
        />
      </div>
      <div className="lg:w-40">
        <FilterSelect
          label="Origem"
          value={filters.source}
          options={LEAD_SOURCES.map((s) => ({ key: s, label: SOURCE_LABELS[s] }))}
          onChange={(v) => set("source", v as LeadFilters["source"])}
        />
      </div>
      <div className="lg:w-44">
        <FilterSelect
          label="Próximo contato"
          value={filters.nextContact === "all" ? "" : filters.nextContact}
          options={(["overdue", "today", "next7", "scheduled", "none"] as const).map((k) => ({
            key: k,
            label: NEXT_CONTACT_LABELS[k],
          }))}
          onChange={(v) => set("nextContact", (v || "all") as LeadFilters["nextContact"])}
        />
      </div>
      {showStage && (
        <div className="lg:w-44">
          <FilterSelect
            label="Etapa"
            value={filters.stage}
            options={LEAD_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] }))}
            onChange={(v) => set("stage", v as LeadFilters["stage"])}
          />
        </div>
      )}
      {hasActiveFilters(filters) && (
        <Button
          variant="light"
          color="primary"
          startContent={<X className="size-4" />}
          onPress={() => onChange(EMPTY_FILTERS)}
          className="self-center"
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
