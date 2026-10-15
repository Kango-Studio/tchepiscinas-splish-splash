import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Chip, Select, SelectItem } from "@heroui/react";
import { CalendarClock, AlertTriangle, MapPin } from "lucide-react";
import { formatBrazilPhone } from "@/lib/leads/phone";
import {
  INTEREST_LABELS,
  LEAD_STAGES,
  STAGE_LABELS,
  type Lead,
  type LeadStage,
} from "@/lib/leads/schema";
import { isOverdue, todayISO } from "./filters";
import { LeadWhatsAppButton, STAGE_STYLES, formatDate, stopCardEvents } from "./ui";
import { FollowupDots } from "./FollowupCheckpoints";

type Props = {
  leads: Lead[];
  onOpen: (id: string) => void;
  onMove: (lead: Lead, stage: LeadStage) => void;
};

export function LeadKanban({ leads, onOpen, onMove }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastDragEnd = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // No toque, segurar para arrastar; deslizar continua rolando a tela.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const byStage = useMemo(() => {
    const map = Object.fromEntries(LEAD_STAGES.map((s) => [s, [] as Lead[]])) as Record<
      LeadStage,
      Lead[]
    >;
    for (const l of leads) map[l.stage].push(l); // já vem ordenado por created_at desc
    return map;
  }, [leads]);

  const { boardRef, topBarRef, scrollWidth, hasOverflow } = useTopScrollbar();
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : undefined;
  const today = todayISO();

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    lastDragEnd.current = Date.now();
    const lead = leads.find((l) => l.id === e.active.id);
    const target = e.over?.id as LeadStage | undefined;
    if (lead && target && target !== lead.stage) onMove(lead, target);
  };

  // Ignora o "click" disparado logo após soltar um card.
  const handleOpen = (id: string) => {
    if (Date.now() - lastDragEnd.current < 250) return;
    onOpen(id);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Para mudar a etapa sem arrastar, use o seletor de etapa dentro do card. Pressione Enter para abrir os detalhes.",
        },
      }}
    >
      {/* Barra de rolagem acima das colunas (a de baixo fica escondida). */}
      <div
        ref={topBarRef}
        aria-hidden
        className={`mb-2 overflow-x-auto overflow-y-hidden ${hasOverflow ? "hidden sm:block" : "hidden"}`}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div
        ref={boardRef}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:mx-0 sm:snap-none sm:px-0 lg:gap-4 [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Funil de leads"
      >
        {LEAD_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            leads={byStage[stage]}
            today={today}
            activeId={activeId}
            onOpen={handleOpen}
            onMove={onMove}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? <LeadCardView lead={activeLead} today={today} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Espelha a rolagem horizontal do quadro numa barra acima dele, para não
// precisar descer até o fim das colunas para rolar para o lado.
function useTopScrollbar() {
  const boardRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const board = boardRef.current;
    const bar = topBarRef.current;
    if (!board || !bar) return;

    const measure = () => {
      setScrollWidth(board.scrollWidth);
      setHasOverflow(board.scrollWidth > board.clientWidth + 1);
    };
    const fromBoard = () => {
      if (bar.scrollLeft !== board.scrollLeft) bar.scrollLeft = board.scrollLeft;
    };
    const fromBar = () => {
      if (board.scrollLeft !== bar.scrollLeft) board.scrollLeft = bar.scrollLeft;
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    board.addEventListener("scroll", fromBoard, { passive: true });
    bar.addEventListener("scroll", fromBar, { passive: true });
    return () => {
      observer.disconnect();
      board.removeEventListener("scroll", fromBoard);
      bar.removeEventListener("scroll", fromBar);
    };
  }, []);

  return { boardRef, topBarRef, scrollWidth, hasOverflow };
}

function KanbanColumn({
  stage,
  leads,
  today,
  activeId,
  onOpen,
  onMove,
}: {
  stage: LeadStage;
  leads: Lead[];
  today: string;
  activeId: string | null;
  onOpen: (id: string) => void;
  onMove: (lead: Lead, stage: LeadStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const style = STAGE_STYLES[stage];

  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-label={`${STAGE_LABELS[stage]}: ${leads.length} leads`}
      className={`flex w-[82vw] max-w-[320px] shrink-0 snap-center flex-col rounded-2xl border transition-colors sm:w-[290px] xl:w-auto xl:min-w-[250px] xl:max-w-none xl:flex-1 ${
        style.column
      } ${isOver ? "border-pool ring-2 ring-pool-light/50" : "border-default-200"}`}
    >
      <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className={`size-2.5 rounded-full ${style.dot}`} aria-hidden />
          {STAGE_LABELS[stage]}
        </h3>
        <Chip size="sm" variant="flat" classNames={{ base: "bg-white", content: "font-semibold" }}>
          {leads.length}
        </Chip>
      </header>
      <div className="flex min-h-32 flex-1 flex-col gap-2.5 p-2 pt-1">
        {leads.length === 0 ? (
          <p className="m-auto py-6 text-center text-xs text-default-400">
            Nenhum lead nesta etapa
          </p>
        ) : (
          leads.map((lead) => (
            <DraggableLeadCard
              key={lead.id}
              lead={lead}
              today={today}
              dimmed={activeId === lead.id}
              onOpen={onOpen}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </section>
  );
}

const DraggableLeadCard = memo(function DraggableLeadCard({
  lead,
  today,
  dimmed,
  onOpen,
  onMove,
}: {
  lead: Lead;
  today: string;
  dimmed: boolean;
  onOpen: (id: string) => void;
  onMove: (lead: Lead, stage: LeadStage) => void;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${lead.name}. Abrir detalhes`}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(lead.id);
        }
      }}
      className={`cursor-grab rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-pool active:cursor-grabbing ${
        dimmed ? "opacity-40" : ""
      }`}
    >
      <LeadCardView lead={lead} today={today} onMove={onMove} />
    </div>
  );
});

function LeadCardView({
  lead,
  today,
  overlay = false,
  onMove,
}: {
  lead: Lead;
  today: string;
  overlay?: boolean;
  onMove?: (lead: Lead, stage: LeadStage) => void;
}) {
  const overdue = isOverdue(lead, today);
  const dueToday = lead.next_contact_date === today;

  return (
    <article
      className={`rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md ${
        overdue ? "border-danger-300" : "border-default-200"
      } ${overlay ? "rotate-2 cursor-grabbing shadow-xl" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{lead.name}</p>
          <p className="text-sm text-default-500">{formatBrazilPhone(lead.whatsapp)}</p>
        </div>
        <div {...stopCardEvents}>
          <LeadWhatsAppButton lead={lead} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {lead.city && (
          <span className="inline-flex items-center gap-1 text-default-600">
            <MapPin className="size-3.5" aria-hidden />
            {lead.city}
          </span>
        )}
        <span className="rounded-full bg-pool-mist px-2 py-0.5 font-medium text-pool-deep">
          {INTEREST_LABELS[lead.interest]}
        </span>
      </div>

      {!overlay && (
        <div className="mt-2">
          <FollowupDots leadId={lead.id} />
        </div>
      )}

      {lead.next_contact_date && (
        <p
          className={`mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
            overdue
              ? "bg-danger-50 text-danger-600"
              : dueToday
                ? "bg-warning-50 text-warning-700"
                : "text-default-600"
          }`}
        >
          {overdue ? (
            <AlertTriangle className="size-3.5" aria-hidden />
          ) : (
            <CalendarClock className="size-3.5" aria-hidden />
          )}
          {overdue ? "Atrasado: " : dueToday ? "Hoje: " : "Próximo contato: "}
          {formatDate(lead.next_contact_date)}
        </p>
      )}

      {!overlay && onMove && (
        <div className="mt-2.5" {...stopCardEvents}>
          <Select
            aria-label={`Etapa de ${lead.name}`}
            size="sm"
            variant="flat"
            disallowEmptySelection
            selectedKeys={[lead.stage]}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0] as LeadStage | undefined;
              if (next && next !== lead.stage) onMove(lead, next);
            }}
            classNames={{ trigger: "min-h-8 h-8 bg-default-100", value: "text-xs" }}
          >
            {LEAD_STAGES.map((s) => (
              <SelectItem key={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </Select>
        </div>
      )}
    </article>
  );
}
