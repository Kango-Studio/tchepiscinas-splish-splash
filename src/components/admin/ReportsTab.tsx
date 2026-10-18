import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Label,
  ListBox,
  Select,
  Skeleton,
  Spinner,
  toast,
  buttonVariants,
} from "@heroui/react";
import {
  ArrowDownToLine,
  ArrowShapeTurnUpRight,
  CircleCheck,
  CircleExclamation,
  FileText,
} from "@gravity-ui/icons";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { whatsappChatLink } from "@/lib/leads/phone";
import { reportWeek } from "@/lib/visits/frequency";
import {
  canShareFiles,
  downloadFile,
  nodeToPngFile,
  shareFile,
  slugify,
} from "@/lib/visits/report-image";
import type { PoolTech, ReportSend } from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { AttendanceReportsSection } from "./AttendanceReports";
import { describeDbError } from "./leads-api";
import { useMarkReportSent, useReportSends, useUnmarkReportSent } from "./visits-api";
import { daysLabel, useClientRows, type ClientRow } from "./visits-ui";
import { PendingLabel, formatDateTime } from "./ui";

const ALL = "__all";

export function ReportsTab() {
  return (
    <div className="flex flex-col gap-5">
      <PendingReportsSection />
      <AttendanceReportsSection />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visitas pendentes (semanal, para os piscineiros)
// ---------------------------------------------------------------------------

function PendingReportsSection() {
  const data = useClientRows();
  const today = todayISO();
  const week = reportWeek(today);
  const sendsQuery = useReportSends("pendentes", week.start);
  const [techChoice, setTechChoice] = useState<string>(ALL);
  // Piscineiros dos relatórios gerados (o conteúdo acompanha os dados ao vivo).
  const [generated, setGenerated] = useState<string[] | null>(null);

  const activeTechs = data.techs.filter((t) => t.active);
  const pendingByTech = useMemo(() => {
    const map = new Map<string, ClientRow[]>();
    for (const r of data.rows) {
      const f = r.frequency;
      if (!r.active || !r.pool_tech_id || !f || f.status === "ok") continue;
      map.set(r.pool_tech_id, [...(map.get(r.pool_tech_id) ?? []), r]);
    }
    for (const list of map.values())
      list.sort(
        (a, b) =>
          b.frequency!.days_without_visit - a.frequency!.days_without_visit ||
          a.name.localeCompare(b.name, "pt-BR"),
      );
    return map;
  }, [data.rows]);

  const generate = () =>
    setGenerated(techChoice === ALL ? activeTechs.map((t) => t.id) : [techChoice]);

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Visitas pendentes
          </h2>
          <p className="text-xs text-muted">
            Semanal, para os piscineiros. Só clientes em Atenção e Atrasados · semana de{" "}
            {format(parseISO(week.start), "dd/MM")} a {format(parseISO(week.end), "dd/MM")}.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <div className="w-full sm:w-56">
          <Select
            fullWidth
            value={techChoice}
            onChange={(key) => setTechChoice(String(key ?? ALL))}
            isDisabled={data.isPending}
          >
            <Label>Piscineiro</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {[
                  { id: ALL, label: "Todos (um por piscineiro)" },
                  ...activeTechs.map((t) => ({ id: t.id, label: t.name })),
                ].map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    {o.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <Button onPress={generate} isDisabled={data.isPending} className="max-sm:w-full">
          <FileText className="size-4" />
          Gerar relatório
        </Button>
      </div>

      {data.error && (
        <p className="flex items-center gap-2 text-sm text-danger">
          <CircleExclamation className="size-4" />
          {describeDbError(data.error)}
        </p>
      )}

      {generated && (
        <ul className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {generated.map((techId, i) => {
            const tech = data.techs.find((t) => t.id === techId);
            if (!tech) return null;
            return (
              <PendingReportItem
                key={techId}
                index={i}
                tech={tech}
                rows={pendingByTech.get(techId) ?? []}
                date={today}
                week={week}
                sent={(sendsQuery.data ?? []).find((s) => s.pool_tech_id === techId)}
                sendsLoading={sendsQuery.isPending}
              />
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PendingReportItem({
  index,
  tech,
  rows,
  date,
  week,
  sent,
  sendsLoading,
}: {
  index: number;
  tech: PoolTech;
  rows: ClientRow[];
  date: string;
  week: { start: string; end: string };
  sent?: ReportSend;
  sendsLoading: boolean;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const markSent = useMarkReportSent();
  const unmarkSent = useUnmarkReportSent();

  // A imagem é gerada já ao montar (e ao mudar a lista), para o "Compartilhar"
  // abrir na hora: o navegador exige que ele rode direto no clique.
  const contentKey = rows.map((r) => `${r.id}:${r.frequency!.days_without_visit}`).join("|");
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setImageError(false);
    const node = captureRef.current;
    if (!node) return;
    nodeToPngFile(node, `pendentes-${slugify(tech.name)}-${date}.png`)
      .then((f) => {
        if (cancelled) return;
        url = URL.createObjectURL(f);
        setFile(f);
        setPreview(url);
      })
      .catch(() => !cancelled && setImageError(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [contentKey, tech.name, date]);

  const firstName = tech.name.split(" ")[0];
  const message = `Buenas, ${firstName}! 🧉 Segue a lista de visitas pendentes da semana. Os em vermelho estão atrasados, prioriza esses. Valeu!`;
  const target = {
    kind: "pendentes" as const,
    pool_tech_id: tech.id,
    period_start: week.start,
    period_end: week.end,
  };

  const markAsSent = async (silent = false) => {
    if (sent) return;
    try {
      await markSent.mutateAsync(target);
      if (!silent) toast.success("Envio registrado", { description: tech.name });
    } catch (error) {
      toast.danger("Não foi possível registrar o envio", { description: describeDbError(error) });
    }
  };

  const onShare = async () => {
    if (!file) return;
    try {
      if ((await shareFile(file, message)) === "shared") await markAsSent();
    } catch {
      toast.danger("Não foi possível compartilhar", {
        description: "Baixe a imagem e envie pelo WhatsApp.",
      });
    }
  };

  const late = rows.filter((r) => r.frequency!.status === "atrasado").length;
  const shareSupported = !!file && canShareFiles(file);

  return (
    <li
      className="animate-admin-rise flex flex-col gap-3 rounded-2xl border border-separator p-3"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="font-semibold text-foreground">{tech.name}</p>
        <p className="text-xs text-muted">
          {rows.length === 0
            ? "Nenhuma pendente"
            : `${late} ${late === 1 ? "atrasado" : "atrasados"} · ${rows.length - late} em atenção`}
        </p>
      </div>

      {/* Prévia: é a própria imagem que será enviada. */}
      <div className="overflow-hidden rounded-xl bg-surface-secondary">
        {imageError ? (
          <p className="p-6 text-center text-sm text-danger">Não foi possível gerar a imagem.</p>
        ) : preview ? (
          <img src={preview} alt={`Visitas pendentes de ${tech.name}`} className="w-full" />
        ) : (
          <div className="grid h-64 place-items-center">
            <Spinner />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          className="w-full"
          isDisabled={!file}
          onPress={() => file && downloadFile(file)}
        >
          <ArrowDownToLine className="size-4" />
          Baixar imagem
        </Button>
        {tech.whatsapp ? (
          <a
            href={whatsappChatLink(tech.whatsapp, message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void markAsSent(true)}
            className={buttonVariants({
              className: "w-full bg-whatsapp font-semibold text-white hover:bg-whatsapp/90",
            })}
          >
            <WhatsappIcon className="size-4" />
            Abrir WhatsApp
          </a>
        ) : (
          <Button
            isDisabled
            variant="secondary"
            className="w-full"
            aria-describedby={`no-phone-${tech.id}`}
          >
            <WhatsappIcon className="size-4" />
            Sem WhatsApp
          </Button>
        )}
        {shareSupported && (
          <Button variant="secondary" className="col-span-2 w-full" onPress={() => void onShare()}>
            <ArrowShapeTurnUpRight className="size-4" />
            Compartilhar imagem
          </Button>
        )}
      </div>
      {!tech.whatsapp && (
        <p id={`no-phone-${tech.id}`} className="-mt-1 px-1 text-xs text-muted">
          Cadastre o WhatsApp do {firstName} em Configurações.
        </p>
      )}
      {tech.whatsapp && (
        <p className="-mt-1 px-1 text-xs text-muted">
          O WhatsApp abre com a mensagem pronta. Anexe a imagem baixada
          {shareSupported ? ", ou use Compartilhar para mandar a imagem direto." : "."}
        </p>
      )}

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-secondary px-3 py-1.5 text-sm">
        {sendsLoading ? (
          <Skeleton className="h-5 w-40 rounded-md" />
        ) : sent ? (
          <>
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <CircleCheck className="size-4" />
              Enviado em {formatDateTime(sent.sent_at)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              isPending={unmarkSent.isPending}
              onPress={() =>
                unmarkSent.mutate(sent, {
                  onError: (error) =>
                    toast.danger("Não foi possível desfazer", {
                      description: describeDbError(error),
                    }),
                })
              }
            >
              {({ isPending }) => <PendingLabel isPending={isPending}>Desfazer</PendingLabel>}
            </Button>
          </>
        ) : (
          <>
            <span className="text-muted">Ainda não enviado nesta semana</span>
            <Button
              size="sm"
              variant="tertiary"
              isPending={markSent.isPending}
              onPress={() => void markAsSent()}
            >
              {({ isPending }) => (
                <PendingLabel isPending={isPending}>Marcar como enviado</PendingLabel>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Versão em tamanho fixo, fora da tela, usada para gerar o PNG. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        <PendingReportCard ref={captureRef} techName={tech.name} date={date} rows={rows} />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Cartão no formato do relatório da planilha
// ---------------------------------------------------------------------------

const CARD_COLORS = {
  header: "linear-gradient(180deg, #23439a 0%, #1b3784 100%)",
  tableHead: "#e0e8f2",
  border: "rgba(15, 40, 90, 0.08)",
  atrasado: { bg: "#ffcccc", text: "#8a1c1c" },
  atencao: { bg: "#fdf08c", text: "#7a4a0c" },
  ok: { bg: "#dcfce7", text: "#166534" },
};

export const PendingReportCard = forwardRef<
  HTMLDivElement,
  { techName: string; date: string; rows: ClientRow[] }
>(function PendingReportCard({ techName, date, rows }, ref) {
  const fullDate = format(parseISO(date), "EEEE, dd/MM/yyyy", { locale: ptBR });
  return (
    <div
      ref={ref}
      className="w-[540px] overflow-hidden rounded-2xl bg-white font-display"
      style={{ boxShadow: `0 0 0 1px ${CARD_COLORS.border}` }}
    >
      <div className="px-6 py-5 text-center text-white" style={{ background: CARD_COLORS.header }}>
        <p className="text-[26px] leading-tight font-bold">Visitas Pendentes</p>
        <p className="mt-1.5 text-[15px] font-normal opacity-90">
          Piscineiro: {techName} &nbsp;|&nbsp; {fullDate}
        </p>
      </div>
      <div
        className="flex items-center justify-between px-6 py-3.5 text-[17px] font-semibold text-slate-800"
        style={{ background: CARD_COLORS.tableHead }}
      >
        <span>Cliente</span>
        <span className="w-32 text-center">Última Visita</span>
      </div>
      {rows.length === 0 ? (
        <div
          className="px-6 py-6 text-center text-[17px] font-medium"
          style={{ background: CARD_COLORS.ok.bg, color: CARD_COLORS.ok.text }}
        >
          Nenhuma visita pendente nesta semana. Bom trabalho!
        </div>
      ) : (
        rows.map((r) => {
          const colors = CARD_COLORS[r.frequency!.status === "atrasado" ? "atrasado" : "atencao"];
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 px-6 py-3.5 text-[17px]"
              style={{
                background: colors.bg,
                color: colors.text,
                borderTop: `1px solid ${CARD_COLORS.border}`,
              }}
            >
              <span className="min-w-0">{r.name}</span>
              <span className="w-32 shrink-0 text-center font-bold">
                {daysLabel(r.frequency!.days_without_visit)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
});
