import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// Média de dias entre visitas consecutivas nos últimos `months` meses.
// Precisa de pelo menos duas datas diferentes no período.
export function averageDaysBetweenVisits(
  visitDates: string[],
  today: string,
  months = 3,
): number | null {
  const since = format(subMonths(parseISO(today), months), "yyyy-MM-dd");
  const dates = [...new Set(visitDates.filter((d) => d >= since && d <= today))].sort();
  if (dates.length < 2) return null;
  const span = differenceInCalendarDays(parseISO(dates.at(-1)!), parseISO(dates[0]));
  return span / (dates.length - 1);
}

// Semana do relatório de pendentes: segunda a domingo.
export function reportWeek(today: string) {
  const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  return {
    start: format(monday, "yyyy-MM-dd"),
    end: format(addDays(monday, 6), "yyyy-MM-dd"),
  };
}

// "2026-10" -> "Outubro de 2026"
export function monthLabel(month: string) {
  const label = format(parseISO(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Mês atual (AAAA-MM) pelo relógio do navegador.
export const currentMonth = () => format(new Date(), "yyyy-MM");
