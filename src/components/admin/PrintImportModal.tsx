import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Description, Label, Modal, ProgressBar, Radio, RadioGroup } from "@heroui/react";
import {
  ArrowRotateLeft,
  ArrowUpFromSquare,
  CopyPicture,
  SquareDashedText,
} from "@gravity-ui/icons";
import { formatBrazilPhone } from "@/lib/leads/phone";
import { extractFromPrintText, type PrintExtraction } from "@/lib/leads/print-extract";
import {
  PRINT_ACCEPTED_TYPES,
  recognizePrint,
  validatePrintFile,
  type OcrProgress,
} from "@/lib/leads/print-ocr";
import { StatusAlert } from "./ui";

export const PRINT_INSTRUCTIONS =
  "Envie um print em que o telefone esteja visível. Confira os dados antes de cadastrar.";

export type PrintPrefill = { name: string; whatsapp: string; previewUrl: string };

type State =
  | { kind: "idle"; error?: string }
  | { kind: "processing"; previewUrl: string; progress: OcrProgress }
  | { kind: "error"; previewUrl: string; message: string; file: File }
  | { kind: "empty"; previewUrl: string }
  | { kind: "result"; previewUrl: string; extraction: PrintExtraction };

const NONE = "__none";
const canReadClipboard = () =>
  typeof navigator !== "undefined" && typeof navigator.clipboard?.read === "function";

export function PrintImportModal({
  isOpen,
  onClose,
  onContinue,
}: {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (prefill: PrintPrefill) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handedOff = useRef<string | null>(null);

  const previewUrl = "previewUrl" in state ? state.previewUrl : null;

  // Libera a prévia quando ela não foi repassada ao formulário.
  useEffect(() => {
    return () => {
      if (previewUrl && handedOff.current !== previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ kind: "idle" });
    setSelectedPhone("");
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback(async (file: File) => {
    const invalid = validatePrintFile(file);
    if (invalid) {
      setState({ kind: "idle", error: invalid });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const url = URL.createObjectURL(file);
    setState({ kind: "processing", previewUrl: url, progress: { stage: "loading", progress: 0 } });
    try {
      const text = await recognizePrint(
        file,
        (progress) =>
          !controller.signal.aborted &&
          setState((s) => (s.kind === "processing" ? { ...s, progress } : s)),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const extraction = extractFromPrintText(text);
      // Sem letras/dígitos suficientes = OCR não encontrou texto (só ruído).
      if ((text.match(/[\p{L}\d]/gu) ?? []).length < 3) {
        setState({ kind: "empty", previewUrl: url });
        return;
      }
      setSelectedPhone(extraction.phones.length === 1 ? extraction.phones[0].normalized : "");
      setState({ kind: "result", previewUrl: url, extraction });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error("[print] OCR falhou", error);
      const message =
        error instanceof Error && error.message.startsWith("Não foi possível abrir")
          ? error.message
          : "Não foi possível ler o print. Verifique sua conexão (o leitor é baixado na primeira vez) e tente novamente.";
      setState({ kind: "error", previewUrl: url, message, file });
    }
  }, []);

  // Ctrl+V / colar com o modal aberto
  useEffect(() => {
    if (!isOpen || state.kind !== "idle") return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void processFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [isOpen, state.kind, processFile]);

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          await processFile(new File([blob], "print", { type: blob.type || type }));
          return;
        }
      }
      setState({ kind: "idle", error: "Não há imagem na área de transferência." });
    } catch {
      setState({
        kind: "idle",
        error:
          "O navegador não permitiu ler a área de transferência. Use Ctrl+V ou selecione o arquivo.",
      });
    }
  };

  const continueToForm = () => {
    if (state.kind !== "result" && state.kind !== "empty") return;
    const extraction = state.kind === "result" ? state.extraction : null;
    handedOff.current = state.previewUrl;
    onContinue({
      name: extraction?.name ?? "",
      whatsapp: selectedPhone && selectedPhone !== NONE ? selectedPhone : "",
      previewUrl: state.previewUrl,
    });
    setState({ kind: "idle" });
    setSelectedPhone("");
  };

  const progressLabel =
    state.kind === "processing"
      ? state.progress.stage === "loading"
        ? "Preparando o leitor de texto..."
        : "Lendo o texto do print..."
      : "";

  const needsChoice =
    state.kind === "result" && state.extraction.phones.length > 1 && !selectedPhone;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && handleClose()} variant="blur">
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog className="sm:max-w-2xl">
          <Modal.CloseTrigger aria-label="Fechar" />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <SquareDashedText className="size-5" />
            </Modal.Icon>
            <Modal.Heading>Cadastrar por print</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{PRINT_INSTRUCTIONS}</p>

            {state.kind === "idle" && (
              <div className="animate-admin-rise flex flex-col gap-3">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void processFile(file);
                  }}
                  className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-[background-color,border-color,scale] duration-200 ${
                    dragOver
                      ? "scale-[1.01] border-pool bg-pool-mist/60"
                      : "border-border bg-surface-secondary"
                  }`}
                >
                  <span
                    className={`grid size-14 place-items-center rounded-2xl bg-surface text-pool shadow-surface transition-transform duration-300 ${
                      dragOver ? "-translate-y-1 scale-110" : ""
                    }`}
                  >
                    <ArrowUpFromSquare className="size-7" aria-hidden />
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onPress={() => inputRef.current?.click()}>Selecionar imagem</Button>
                    {canReadClipboard() && (
                      <Button variant="secondary" onPress={pasteFromClipboard}>
                        <CopyPicture className="size-4" />
                        Colar print
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    Arraste a imagem aqui ou pressione Ctrl+V. PNG, JPG ou WEBP, até 8 MB.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={PRINT_ACCEPTED_TYPES.join(",")}
                    className="sr-only"
                    aria-label="Selecionar imagem do print"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void processFile(file);
                    }}
                  />
                </div>
                {state.error && <StatusAlert status="danger" title={state.error} />}
                <p className="text-xs text-muted">
                  A imagem é lida apenas neste navegador e não é armazenada.
                </p>
              </div>
            )}

            {state.kind !== "idle" && (
              <div className="animate-admin-rise grid gap-4 sm:grid-cols-[180px_1fr]">
                <img
                  src={state.previewUrl}
                  alt="Prévia do print enviado"
                  className="max-h-72 w-full rounded-xl border border-border bg-surface-secondary object-contain"
                />
                <div className="flex flex-col gap-3 text-foreground">
                  {state.kind === "processing" && (
                    <ProgressBar
                      aria-label={progressLabel}
                      value={Math.round(state.progress.progress * 100)}
                      isIndeterminate={state.progress.stage === "loading"}
                    >
                      <Label>{progressLabel}</Label>
                      <ProgressBar.Output />
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  )}

                  {state.kind === "error" && (
                    <>
                      <StatusAlert
                        status="danger"
                        title="Erro ao processar"
                        description={state.message}
                      />
                      <div className="flex gap-2">
                        <Button variant="secondary" onPress={() => processFile(state.file)}>
                          <ArrowRotateLeft className="size-4" />
                          Tentar novamente
                        </Button>
                        <Button variant="ghost" onPress={reset}>
                          Escolher outra imagem
                        </Button>
                      </div>
                    </>
                  )}

                  {state.kind === "empty" && (
                    <StatusAlert
                      status="warning"
                      title="Nenhum texto identificado"
                      description="Não conseguimos ler texto nesta imagem. Tente um print mais nítido ou cadastre manualmente."
                    />
                  )}

                  {state.kind === "result" && (
                    <>
                      <div>
                        <p className="text-xs font-medium text-muted">Nome do contato</p>
                        <p className="font-semibold">
                          {state.extraction.name ?? (
                            <span className="font-normal text-muted">
                              Não identificado — preencha no formulário
                            </span>
                          )}
                        </p>
                      </div>

                      {state.extraction.phones.length === 0 ? (
                        <StatusAlert
                          status="warning"
                          title="Nenhum telefone identificado"
                          description="Preencha o WhatsApp manualmente no formulário."
                        />
                      ) : state.extraction.phones.length === 1 ? (
                        <div>
                          <p className="text-xs font-medium text-muted">WhatsApp</p>
                          <p className="font-semibold">
                            {formatBrazilPhone(state.extraction.phones[0].normalized)}
                          </p>
                        </div>
                      ) : (
                        <RadioGroup
                          variant="secondary"
                          value={selectedPhone}
                          onChange={setSelectedPhone}
                        >
                          <Label>
                            Encontramos {state.extraction.phones.length} números. Qual é o do
                            contato?
                          </Label>
                          {state.extraction.phones.map((p) => (
                            <Radio key={p.normalized} value={p.normalized}>
                              <Radio.Content>
                                <Radio.Control>
                                  <Radio.Indicator />
                                </Radio.Control>
                                {formatBrazilPhone(p.normalized)}
                              </Radio.Content>
                              <Description>Lido como "{p.raw}"</Description>
                            </Radio>
                          ))}
                          <Radio value={NONE}>
                            <Radio.Content>
                              <Radio.Control>
                                <Radio.Indicator />
                              </Radio.Control>
                              Nenhum destes (preencher manualmente)
                            </Radio.Content>
                          </Radio>
                        </RadioGroup>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {state.kind !== "idle" && state.kind !== "processing" && (
              <Button variant="ghost" onPress={reset} className="mr-auto">
                Outro print
              </Button>
            )}
            <Button variant="tertiary" onPress={handleClose}>
              Cancelar
            </Button>
            {(state.kind === "result" || state.kind === "empty") && (
              <Button onPress={continueToForm} isDisabled={needsChoice}>
                Continuar para o cadastro
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
