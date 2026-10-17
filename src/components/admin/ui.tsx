import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Alert, Chip, Spinner, Tooltip, buttonVariants } from "@heroui/react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { formatBrazilPhone, whatsappChatLink } from "@/lib/leads/phone";
import { STAGE_LABELS, type Lead, type LeadStage } from "@/lib/leads/schema";

export const STAGE_STYLES: Record<LeadStage, { dot: string; chip: string; column: string }> = {
  novo: { dot: "bg-pool-light", chip: "bg-pool-mist text-pool-deep", column: "bg-pool-mist/50" },
  em_atendimento: { dot: "bg-pool", chip: "bg-pool/15 text-pool-deep", column: "bg-sky-50" },
  proposta_enviada: {
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-800",
    column: "bg-violet-50/70",
  },
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
      variant="soft"
      className={`font-semibold whitespace-nowrap ${STAGE_STYLES[stage].chip}`}
    >
      <span className={`size-2 shrink-0 rounded-full ${STAGE_STYLES[stage].dot}`} aria-hidden />
      <Chip.Label>{STAGE_LABELS[stage]}</Chip.Label>
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

// Alert composto do v3 (Indicator + Content) com título e descrição opcionais.
export function StatusAlert({
  status,
  title,
  description,
  className,
}: {
  status: "default" | "accent" | "success" | "warning" | "danger";
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <Alert status={status} className={`animate-admin-rise ${className ?? ""}`}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description && <Alert.Description>{description}</Alert.Description>}
      </Alert.Content>
    </Alert>
  );
}

// Ícone + texto de carregamento dentro de um Button (padrão de render props do v3).
export function PendingLabel({
  isPending,
  icon,
  children,
}: {
  isPending: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {isPending ? <Spinner color="current" size="sm" /> : icon}
      {children}
    </>
  );
}

// Número que conta de 0 até o valor ao aparecer (respeita prefers-reduced-motion).
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    from.current = value;
    if (reduce || start === value) {
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{shown}</span>;
}

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
  // Link com aparência de botão: variant function do HeroUI aplicada ao <a>.
  const className = buttonVariants({
    size,
    isIconOnly: !withLabel,
    className:
      "bg-whatsapp font-semibold text-white hover:bg-whatsapp/90" +
      (withLabel ? "" : " rounded-full"),
  });

  if (withLabel) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={label}
      >
        <WhatsappIcon className="size-4" />
        WhatsApp
      </a>
    );
  }
  return (
    <Tooltip delay={300} closeDelay={0}>
      <Tooltip.Trigger>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          aria-label={label}
        >
          <WhatsappIcon className="size-4" />
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content>Abrir WhatsApp</Tooltip.Content>
    </Tooltip>
  );
}
