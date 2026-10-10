import type { SyntheticEvent } from "react";
import { Button, Chip, Tooltip } from "@heroui/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { formatBrazilPhone, whatsappChatLink } from "@/lib/leads/phone";
import { STAGE_LABELS, type Lead, type LeadStage } from "@/lib/leads/schema";

export const STAGE_STYLES: Record<LeadStage, { dot: string; chip: string; column: string }> = {
  novo: { dot: "bg-pool-light", chip: "bg-pool-mist text-pool-deep", column: "bg-pool-mist/50" },
  em_atendimento: { dot: "bg-pool", chip: "bg-pool/15 text-pool-deep", column: "bg-sky-50" },
  orcamento_enviado: {
    dot: "bg-sun",
    chip: "bg-sun/25 text-amber-900",
    column: "bg-amber-50/70",
  },
  fechado: {
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800",
    column: "bg-emerald-50/70",
  },
  perdido: { dot: "bg-slate-400", chip: "bg-slate-200 text-slate-700", column: "bg-slate-100/80" },
};

export function StageChip({ stage, size = "sm" }: { stage: LeadStage; size?: "sm" | "md" }) {
  return (
    <Chip
      size={size}
      variant="flat"
      classNames={{ base: STAGE_STYLES[stage].chip, content: "font-semibold" }}
      startContent={<span className={`ml-1 size-2 rounded-full ${STAGE_STYLES[stage].dot}`} />}
    >
      {STAGE_LABELS[stage]}
    </Chip>
  );
}

export const formatDate = (iso: string | null) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR }) : "—";

export const formatDateTime = (iso: string) =>
  format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

const stop = (e: SyntheticEvent) => e.stopPropagation();

// Evita que o clique/toque inicie o arraste ou abra os detalhes do card.
export const stopCardEvents = {
  onPointerDown: stop,
  onMouseDown: stop,
  onTouchStart: stop,
  onClick: stop,
  onKeyDown: stop,
};

export function LeadWhatsAppButton({
  lead,
  size = "sm",
  withLabel = false,
}: {
  lead: Pick<Lead, "name" | "whatsapp">;
  size?: "sm" | "md";
  withLabel?: boolean;
}) {
  const firstName = lead.name.split(" ")[0];
  const href = whatsappChatLink(lead.whatsapp, `Olá, ${firstName}! Aqui é da Tchê Piscinas.`);
  const label = `Abrir WhatsApp de ${lead.name} (${formatBrazilPhone(lead.whatsapp)})`;

  if (withLabel) {
    return (
      <Button
        as="a"
        role="link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        size={size}
        className="bg-whatsapp font-semibold text-white"
        startContent={<WhatsappIcon className="size-4" />}
        aria-label={label}
      >
        WhatsApp
      </Button>
    );
  }
  return (
    <Tooltip content="Abrir WhatsApp" closeDelay={0}>
      <Button
        as="a"
        role="link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        isIconOnly
        size={size}
        radius="full"
        className="bg-whatsapp text-white"
        aria-label={label}
      >
        <WhatsappIcon className="size-4" />
      </Button>
    </Tooltip>
  );
}
