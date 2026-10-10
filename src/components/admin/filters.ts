import { addDays, format } from "date-fns";
import type { Lead, LeadInterest, LeadSource, LeadStage } from "@/lib/leads/schema";

export type NextContactFilter = "all" | "overdue" | "today" | "next7" | "scheduled" | "none";

export type LeadFilters = {
  search: string;
  city: string; // "" = todas
  interest: LeadInterest | "";
  source: LeadSource | "";
  nextContact: NextContactFilter;
  stage: LeadStage | ""; // usado só na lista
};

export const EMPTY_FILTERS: LeadFilters = {
  search: "",
  city: "",
  interest: "",
  source: "",
  nextContact: "all",
  stage: "",
};

export const NEXT_CONTACT_LABELS: Record<NextContactFilter, string> = {
  all: "Qualquer data",
  overdue: "Atrasados",
  today: "Hoje",
  next7: "Próximos 7 dias",
  scheduled: "Com data marcada",
  none: "Sem data",
};

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export function isOverdue(lead: Pick<Lead, "next_contact_date" | "stage">, today = todayISO()) {
  return (
    !!lead.next_contact_date &&
    lead.next_contact_date < today &&
    lead.stage !== "fechado" &&
    lead.stage !== "perdido"
  );
}

const normalizeText = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function normalizeCity(city: string | null) {
  return city ? normalizeText(city) : "";
}

export function applyLeadFilters(
  leads: Lead[],
  f: LeadFilters,
  { includeStage }: { includeStage: boolean },
): Lead[] {
  const today = todayISO();
  const in7 = format(addDays(new Date(), 7), "yyyy-MM-dd");
  const term = normalizeText(f.search);
  const termDigits = f.search.replace(/\D/g, "");
  const city = normalizeText(f.city);

  return leads.filter((l) => {
    if (term) {
      const byName = normalizeText(l.name).includes(term);
      const byPhone = termDigits.length >= 3 && l.whatsapp.includes(termDigits);
      if (!byName && !byPhone) return false;
    }
    if (city && normalizeCity(l.city) !== city) return false;
    if (f.interest && l.interest !== f.interest) return false;
    if (f.source && l.source !== f.source) return false;
    if (includeStage && f.stage && l.stage !== f.stage) return false;

    const d = l.next_contact_date;
    switch (f.nextContact) {
      case "overdue":
        return isOverdue(l, today);
      case "today":
        return d === today;
      case "next7":
        return !!d && d >= today && d <= in7;
      case "scheduled":
        return !!d;
      case "none":
        return !d;
      default:
        return true;
    }
  });
}

// Lista de cidades (sem repetir variações de acento/caixa)
export function distinctCities(leads: Lead[]): string[] {
  const map = new Map<string, string>();
  for (const l of leads) {
    if (!l.city) continue;
    const key = normalizeCity(l.city);
    if (!map.has(key)) map.set(key, l.city.trim());
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function hasActiveFilters(f: LeadFilters) {
  return (
    !!f.search || !!f.city || !!f.interest || !!f.source || f.nextContact !== "all" || !!f.stage
  );
}
