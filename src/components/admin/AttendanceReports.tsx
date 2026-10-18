import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
  Card,
  Label,
  ListBox,
  ProgressBar,
  Select,
  Skeleton,
  Spinner,
  buttonVariants,
  toast,
} from "@heroui/react";
import {
  ArrowDownToLine,
  ArrowShapeTurnUpRight,
  Check,
  CircleCheck,
  CircleExclamation,
  Comment,
  Droplet,
  Eye,
  FileText,
  FolderArrowDown,
  Heart,
  Person,
} from "@gravity-ui/icons";
import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import JSZip from "jszip";
import logo from "@/assets/logo.webp";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { whatsappChatLink } from "@/lib/leads/phone";
import { currentMonth, monthLabel } from "@/lib/visits/frequency";
import {
  canShareFiles,
  downloadFile,
  nodeToPngFile,
  shareFile,
  slugify,
} from "@/lib/visits/report-image";
import { SERVICE_LABELS } from "@/lib/visits/services";
import type { ReportSend, Visit } from "@/lib/visits/schema";
import { todayISO } from "./filters";
import { describeDbError } from "./leads-api";
import {
  useMarkReportSent,
  useReportSends,
  useUnmarkReportSent,
  useVisitsInRange,
} from "./visits-api";
import { useClientRows, type ClientRow } from "./visits-ui";
import { PendingLabel, formatDateTime } from "./ui";

const ALL = "__all";
const MONTHS_BACK = 12;

type ClientReport = { client: ClientRow; visits: Visit[] };

// ---------------------------------------------------------------------------
// Geração das imagens: um cartão por vez, fora da tela, em fila.
// ---------------------------------------------------------------------------

function useCardCapture() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [job, setJob] = useState<{ id: number; node: ReactNode } | null>(null);
  const pending = useRef<{
    filename: string;
    resolve: (f: File) => void;
    reject: (e: unknown) => void;
  } | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // Depois que o cartão do trabalho atual aparece no DOM, gera o PNG.
  useEffect(() => {
    const p = pending.current;
    const node = hostRef.current?.firstElementChild as HTMLElement | null;
    if (!job || !p || !node) return;
    requestAnimationFrame(() => {
      // 720 px × 3 = 2160 px, a largura da referência.
      nodeToPngFile(node, p.filename, 3).then(p.resolve, p.reject);
    });
  }, [job]);

  const capture = useCallback((node: ReactNode, filename: string) => {
    const run = () =>
      new Promise<File>((resolve, reject) => {
        pending.current = { filename, resolve, reject };
        setJob({ id: Math.random(), node });
      });
    const result = queue.current.then(run, run);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  const host = (
    <div ref={hostRef} aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
      {job?.node}
    </div>
  );
  return { host, capture };
}

// ---------------------------------------------------------------------------
// Seção na aba Relatórios
// ---------------------------------------------------------------------------

export function AttendanceReportsSection() {
  const data = useClientRows();
  const [month, setMonth] = useState(() => {
    // Padrão: mês anterior (o relatório é enviado depois que o mês fecha).
    return format(subMonths(parseISO(`${currentMonth()}-01`), 1), "yyyy-MM");
  });
  const [choice, setChoice] = useState<string>(ALL);
  const [generated, setGenerated] = useState<{ month: string; choice: string } | null>(null);

  const from = `${month}-01`;
  const to = format(endOfMonth(parseISO(from)), "yyyy-MM-dd");
  const visitsQuery = useVisitsInRange({ from, to });
  const genFrom = generated ? `${generated.month}-01` : from;
  const genTo = format(endOfMonth(parseISO(genFrom)), "yyyy-MM-dd");
  const genVisitsQuery = useVisitsInRange({ from: genFrom, to: genTo });
  const sendsQuery = useReportSends("atendimentos", genFrom);
  const { host, capture } = useCardCapture();

  const monthOptions = useMemo(() => {
    const now = startOfMonth(parseISO(todayISO()));
    return Array.from({ length: MONTHS_BACK + 1 }, (_, i) => {
      const id = format(subMonths(now, i), "yyyy-MM");
      return { id, label: monthLabel(id) };
    });
  }, []);

  // Clientes com visita no mês escolhido (para o seletor).
  const clientsWithVisits = useMemo(() => {
    const ids = new Set((visitsQuery.data ?? []).map((v) => v.client_id));
    return data.rows
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [visitsQuery.data, data.rows]);

  const reports = useMemo<ClientReport[]>(() => {
    if (!generated) return [];
    const byClient = new Map<string, Visit[]>();
    for (const v of genVisitsQuery.data ?? [])
      byClient.set(v.client_id, [...(byClient.get(v.client_id) ?? []), v]);
    return data.rows
      .filter((c) =>
        generated.choice === ALL ? c.active && byClient.has(c.id) : c.id === generated.choice,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((client) => ({
        client,
        visits: [...(byClient.get(client.id) ?? [])].sort(
          (a, b) =>
            a.visit_date.localeCompare(b.visit_date) || a.created_at.localeCompare(b.created_at),
        ),
      }));
  }, [generated, genVisitsQuery.data, data.rows]);

  const sentByClient = useMemo(
    () => new Map((sendsQuery.data ?? []).map((s) => [s.client_id, s])),
    [sendsQuery.data],
  );

  const choiceValid = choice === ALL || clientsWithVisits.some((c) => c.id === choice);
  const period = generated
    ? { month: generated.month, start: genFrom, end: genTo }
    : { month, start: from, end: to };

  return (
    <Card className="animate-admin-rise gap-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-base font-semibold text-foreground">
          Relatório de atendimentos
        </h2>
        <p className="text-xs text-muted">
          Mensal, para os clientes: resumo dos serviços feitos no mês. Não é cobrança.
        </p>
      </div>

      <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:items-end">
        <div className="sm:w-52">
          <Select
            fullWidth
            value={month}
            onChange={(key) => {
              if (!key) return;
              setMonth(String(key));
              setChoice(ALL);
            }}
          >
            <Label>Mês</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {monthOptions.map((o) => (
                  <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                    {o.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="sm:w-72">
          <Select
            fullWidth
            value={choiceValid ? choice : ALL}
            onChange={(key) => setChoice(String(key ?? ALL))}
            isDisabled={visitsQuery.isPending || data.isPending}
          >
            <Label>Cliente</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {[
                  { id: ALL, label: "Todos (ativos com visita no mês)" },
                  ...clientsWithVisits.map((c) => ({ id: c.id, label: c.name })),
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
        <Button
          onPress={() => setGenerated({ month, choice: choiceValid ? choice : ALL })}
          isDisabled={visitsQuery.isPending || data.isPending}
          className="max-sm:w-full"
        >
          <FileText className="size-4" />
          Gerar
        </Button>
      </div>

      {(visitsQuery.error ?? data.error) && (
        <p className="flex items-center gap-2 text-sm text-danger">
          <CircleExclamation className="size-4" />
          {describeDbError(visitsQuery.error ?? data.error)}
        </p>
      )}

      {generated &&
        (genVisitsQuery.isPending ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : reports.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            Nenhum cliente com visita em {monthLabel(generated.month).toLowerCase()}.
          </p>
        ) : reports.length === 1 ? (
          <AttendanceReportItem
            report={reports[0]}
            period={period}
            sent={sentByClient.get(reports[0].client.id)}
            sendsLoading={sendsQuery.isPending}
            capture={capture}
            expanded
          />
        ) : (
          <AllReports
            reports={reports}
            period={period}
            sentByClient={sentByClient}
            sendsLoading={sendsQuery.isPending}
            capture={capture}
          />
        ))}

      {host}
    </Card>
  );
}

type Period = { month: string; start: string; end: string };
type Capture = ReturnType<typeof useCardCapture>["capture"];

const fileName = (client: ClientRow, month: string) =>
  `atendimentos-${month}-${slugify(client.name)}.png`;

function AllReports({
  reports,
  period,
  sentByClient,
  sendsLoading,
  capture,
}: {
  reports: ClientReport[];
  period: Period;
  sentByClient: Map<string | null, ReportSend>;
  sendsLoading: boolean;
  capture: Capture;
}) {
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const sentCount = reports.filter((r) => sentByClient.has(r.client.id)).length;

  const downloadZip = async () => {
    setZipProgress(0);
    try {
      const zip = new JSZip();
      for (const [i, r] of reports.entries()) {
        const file = await capture(
          <AttendanceCard report={r} month={period.month} />,
          fileName(r.client, period.month),
        );
        zip.file(file.name, file);
        setZipProgress(Math.round(((i + 1) / reports.length) * 100));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadFile(
        new File([blob], `atendimentos-${period.month}.zip`, { type: "application/zip" }),
      );
    } catch {
      toast.danger("Não foi possível gerar o ZIP", { description: "Tente de novo." });
    } finally {
      setZipProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-secondary px-3 py-2.5">
        <p className="text-sm text-muted">
          <strong className="font-medium text-foreground">{reports.length}</strong> clientes ·{" "}
          <strong className="font-medium text-foreground">{sentCount}</strong> já receberam
        </p>
        {zipProgress === null ? (
          <Button size="sm" variant="secondary" onPress={() => void downloadZip()}>
            <FolderArrowDown className="size-4" />
            Baixar todas (ZIP)
          </Button>
        ) : (
          <ProgressBar
            aria-label="Gerando imagens"
            value={zipProgress}
            className="w-full sm:w-56"
            size="sm"
          >
            <Label className="text-xs">Gerando imagens…</Label>
            <ProgressBar.Output className="text-xs" />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {reports.map((r) => (
          <AttendanceReportItem
            key={r.client.id}
            report={r}
            period={period}
            sent={sentByClient.get(r.client.id)}
            sendsLoading={sendsLoading}
            capture={capture}
          />
        ))}
      </ul>
    </div>
  );
}

function AttendanceReportItem({
  report,
  period,
  sent,
  sendsLoading,
  capture,
  expanded = false,
}: {
  report: ClientReport;
  period: Period;
  sent?: ReportSend;
  sendsLoading: boolean;
  capture: Capture;
  expanded?: boolean;
}) {
  const { client, visits } = report;
  const [showPreview, setShowPreview] = useState(expanded);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const markSent = useMarkReportSent();
  const unmarkSent = useUnmarkReportSent();

  // Muda a lista de visitas (edição em outra aba): a imagem antiga não vale mais.
  const contentKey = visits.map((v) => `${v.id}:${v.updated_at}`).join("|");
  useEffect(() => {
    setFile(null);
  }, [contentKey]);

  const getFile = useCallback(async () => {
    if (file) return file;
    const f = await capture(
      <AttendanceCard report={report} month={period.month} />,
      fileName(client, period.month),
    );
    setFile(f);
    return f;
  }, [file, capture, report, period.month, client]);

  // Prévia (e arquivo pronto para o Compartilhar) quando o item está aberto.
  useEffect(() => {
    if (!showPreview) return;
    let url: string | null = null;
    let cancelled = false;
    getFile()
      .then((f) => {
        if (cancelled) return;
        url = URL.createObjectURL(f);
        setPreview(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [showPreview, getFile]);

  const monthName = monthLabel(period.month).split(" ")[0].toLowerCase();
  const firstName = client.name.split(" ")[0];
  const message = `Buenas, ${firstName}! 🧉 Segue o resumo dos atendimentos da tua piscina em ${monthName}. Qualquer dúvida, estamos por aqui! 🌊`;
  const target = {
    kind: "atendimentos" as const,
    client_id: client.id,
    period_start: period.start,
    period_end: period.end,
  };

  const markAsSent = async (silent = false) => {
    if (sent) return;
    try {
      await markSent.mutateAsync(target);
      if (!silent) toast.success("Envio registrado", { description: client.name });
    } catch (error) {
      toast.danger("Não foi possível registrar o envio", { description: describeDbError(error) });
    }
  };

  const onDownload = async () => {
    setBusy("download");
    try {
      downloadFile(await getFile());
    } catch {
      toast.danger("Não foi possível gerar a imagem");
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    const ready = file;
    setBusy("share");
    try {
      const f = ready ?? (await getFile());
      if ((await shareFile(f, message)) === "shared") await markAsSent();
    } catch (error) {
      // Gerar a imagem pode levar mais que o tempo que o navegador dá ao clique:
      // na segunda vez o arquivo já está pronto.
      if (!ready && error instanceof DOMException && error.name === "NotAllowedError")
        toast("Imagem pronta", { description: "Toque de novo em Compartilhar." });
      else
        toast.danger("Não foi possível compartilhar", {
          description: "Baixe a imagem e envie pelo WhatsApp.",
        });
    } finally {
      setBusy(null);
    }
  };

  const shareSupported = canShareFiles();

  return (
    <li className="flex list-none flex-col gap-3 rounded-2xl border border-separator p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{client.name}</p>
          <p className="text-xs text-muted">
            {visits.length} {visits.length === 1 ? "visita" : "visitas"} em {monthName}
            {sendsLoading ? null : sent ? (
              <span className="text-emerald-700"> · enviado em {formatDateTime(sent.sent_at)}</span>
            ) : (
              <> · não enviado</>
            )}
          </p>
        </div>
        {!expanded && (
          <Button size="sm" variant="ghost" onPress={() => setShowPreview((v) => !v)}>
            <Eye className="size-4" />
            {showPreview ? "Ocultar" : "Ver"}
          </Button>
        )}
      </div>

      {showPreview && (
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-surface-secondary">
          {preview ? (
            <img
              src={preview}
              alt={`Relatório de atendimentos de ${client.name}`}
              className="w-full"
            />
          ) : (
            <div className="grid h-72 place-items-center">
              <Spinner />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Button
          size="sm"
          variant="secondary"
          className="max-sm:w-full"
          isPending={busy === "download"}
          onPress={() => void onDownload()}
        >
          {({ isPending }) => (
            <PendingLabel isPending={isPending} icon={<ArrowDownToLine className="size-4" />}>
              Baixar imagem
            </PendingLabel>
          )}
        </Button>
        {client.whatsapp ? (
          <a
            href={whatsappChatLink(client.whatsapp, message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void markAsSent(true)}
            className={buttonVariants({
              size: "sm",
              className: "bg-whatsapp font-semibold text-white hover:bg-whatsapp/90 max-sm:w-full",
            })}
          >
            <WhatsappIcon className="size-4" />
            Abrir WhatsApp
          </a>
        ) : (
          <Button size="sm" isDisabled variant="secondary" className="max-sm:w-full">
            <WhatsappIcon className="size-4" />
            Sem WhatsApp
          </Button>
        )}
        {shareSupported && (
          <Button
            size="sm"
            variant="secondary"
            className="max-sm:col-span-2 max-sm:w-full"
            isPending={busy === "share"}
            onPress={() => void onShare()}
          >
            {({ isPending }) => (
              <PendingLabel
                isPending={isPending}
                icon={<ArrowShapeTurnUpRight className="size-4" />}
              >
                Compartilhar
              </PendingLabel>
            )}
          </Button>
        )}
        <div className="col-span-2 flex items-center sm:ml-auto">
          {sent ? (
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
              {({ isPending }) => (
                <PendingLabel isPending={isPending} icon={<CircleCheck className="size-4" />}>
                  Desfazer envio
                </PendingLabel>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="tertiary"
              isPending={markSent.isPending}
              isDisabled={sendsLoading}
              onPress={() => void markAsSent()}
            >
              {({ isPending }) => (
                <PendingLabel isPending={isPending}>Marcar como enviado</PendingLabel>
              )}
            </Button>
          )}
        </div>
      </div>
      {!client.whatsapp && (
        <p className="-mt-1 text-xs text-muted">
          Cadastre o WhatsApp do cliente na página dele para abrir a conversa daqui.
        </p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Cartão no layout da referência (25-joao-paulo.jpg)
// ---------------------------------------------------------------------------

const C = {
  bg: "linear-gradient(180deg, #f2f7fc 0%, #f5f9fd 60%, #eef5fb 100%)",
  glow: "radial-gradient(circle at 0% 0%, rgba(176, 214, 245, 0.55) 0%, rgba(176, 214, 245, 0) 45%)",
  deep: "#0b5a99",
  title: "#0d5b98",
  accent: "#1474c4",
  text: "#33404d",
  muted: "#6b7785",
  soft: "#e8f2fb",
  card: "#ffffff",
  border: "rgba(13, 70, 120, 0.08)",
};

const AttendanceCard = forwardRef<HTMLDivElement, { report: ClientReport; month: string }>(
  function AttendanceCard({ report, month }, ref) {
    const { client, visits } = report;
    const [monthName, year] = [monthLabel(month).split(" ")[0].toLowerCase(), month.slice(0, 4)];
    // Duas colunas, preenchidas de cima para baixo (como na referência).
    const half = Math.ceil(visits.length / 2);
    const columns = visits.length > 1 ? [visits.slice(0, half), visits.slice(half)] : [visits];

    return (
      <div
        ref={ref}
        className="relative w-[720px] overflow-hidden font-display"
        style={{ background: C.bg, color: C.text }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: C.glow }} />

        <div className="relative flex flex-col items-center px-12 pt-8 text-center">
          <span
            className="rounded-full px-6 py-2 text-[13px] font-bold tracking-[0.18em] text-white uppercase"
            style={{ background: C.deep }}
          >
            Visitas de {monthName}
          </span>
          <img src={logo} alt="" className="mt-8 h-[78px] w-auto" />
          <span className="mt-9 h-[3px] w-12 rounded-full" style={{ background: C.accent }} />
          <h1
            className="mt-6 text-[33px] leading-tight font-extrabold tracking-tight uppercase"
            style={{ color: C.title }}
          >
            Relatório de atendimentos
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed" style={{ color: C.muted }}>
            Resumo dos serviços realizados para você
            <br />
            no mês de {monthName}/{year}.
          </p>
        </div>

        <div className="relative flex flex-col gap-5 px-12 pt-8 pb-10">
          {/* Cliente */}
          <div
            className="flex items-center gap-6 rounded-2xl px-6 py-6"
            style={{ background: C.card, boxShadow: `0 0 0 1px ${C.border}` }}
          >
            <span
              className="grid size-[54px] shrink-0 place-items-center rounded-full text-white"
              style={{ background: C.deep }}
            >
              <Person className="size-6" />
            </span>
            <div className="min-w-0 text-left">
              <p
                className="text-[11px] font-semibold tracking-[0.18em] uppercase"
                style={{ color: C.muted }}
              >
                Cliente
              </p>
              <p
                className="text-[23px] leading-tight font-extrabold uppercase"
                style={{ color: C.title }}
              >
                {client.name}
              </p>
              <p className="text-[14px]" style={{ color: C.muted }}>
                {visits.length} {visits.length === 1 ? "visita" : "visitas"} em {monthName}
              </p>
            </div>
          </div>

          {/* Serviços realizados */}
          <div
            className="rounded-2xl px-6 pt-6 pb-4 text-left"
            style={{ background: C.card, boxShadow: `0 0 0 1px ${C.border}` }}
          >
            <div className="flex items-center gap-4">
              <span
                className="grid size-9 place-items-center rounded-full"
                style={{ background: C.soft, color: C.accent }}
              >
                <CircleCheck className="size-4" />
              </span>
              <p className="text-[19px] font-extrabold uppercase" style={{ color: C.title }}>
                Serviços realizados
              </p>
            </div>
            <span
              className="mt-2 ml-[52px] block h-[3px] w-8 rounded-full"
              style={{ background: C.accent }}
            />
            <div className="mt-4 grid grid-cols-2 gap-x-8">
              {columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-4">
                  {col.map((v) => (
                    <div key={v.id}>
                      <p className="text-[13px] font-bold" style={{ color: C.accent }}>
                        Visita — {format(parseISO(v.visit_date), "dd/MM")}
                      </p>
                      <ul className="mt-2 flex flex-col gap-2">
                        {v.services.map((s) => (
                          <li key={s} className="flex items-start gap-3 text-[15px] leading-snug">
                            <Check className="mt-0.5 size-4 shrink-0" style={{ color: C.accent }} />
                            {s === "outro" && v.service_other ? v.service_other : SERVICE_LABELS[s]}
                          </li>
                        ))}
                      </ul>
                      {v.notes && (
                        <p
                          className="mt-2.5 rounded-lg px-3 py-2 text-[13px] leading-snug"
                          style={{ background: C.soft }}
                        >
                          <strong className="font-bold" style={{ color: C.title }}>
                            Obs.:
                          </strong>{" "}
                          {v.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Frase de fechamento */}
          <div
            className="flex items-center gap-4 rounded-2xl px-6 py-5 text-left text-[14.5px] leading-relaxed"
            style={{ background: C.soft }}
          >
            <Droplet className="size-6 shrink-0" style={{ color: C.accent }} />
            Manutenção realizada com cuidado e dedicação para garantir água mais limpa, saudável e
            segura para você e sua família.
          </div>
        </div>

        {/* Rodapé azul com onda */}
        <div className="relative text-white">
          <svg
            viewBox="0 0 720 28"
            preserveAspectRatio="none"
            className="block h-7 w-full"
            aria-hidden
          >
            <path d="M0 18 C 180 2, 420 0, 720 10 L 720 28 L 0 28 Z" fill={C.deep} />
          </svg>
          <div className="flex items-center gap-6 px-12 pt-4 pb-9" style={{ background: C.deep }}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
              <Comment className="size-5" />
            </span>
            <div className="flex-1 text-left">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">
                Dúvidas ou agendamentos
              </p>
              <p className="text-[25px] leading-tight font-extrabold">51 9175-7029</p>
              <p className="text-[13px] opacity-85">Fale com a Tchê Piscinas!</p>
            </div>
            <span className="h-14 w-px bg-white/20" />
            <div className="relative flex items-center gap-2.5 pr-2 text-left text-[13px] leading-snug">
              <span
                className="absolute -top-6 -right-10 size-[84px] rounded-full border border-white/20"
                aria-hidden
              />
              <Heart className="size-4 shrink-0" />
              Contamos
              <br />
              sempre com
              <br />
              você!
            </div>
          </div>
        </div>
      </div>
    );
  },
);
