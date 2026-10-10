import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Radio,
  RadioGroup,
} from "@heroui/react";
import { ClipboardPaste, ImageUp, RotateCcw, ScanText } from "lucide-react";
import { formatBrazilPhone } from "@/lib/leads/phone";
import { extractFromPrintText, type PrintExtraction } from "@/lib/leads/print-extract";
import {
  PRINT_ACCEPTED_TYPES,
  recognizePrint,
  validatePrintFile,
  type OcrProgress,
} from "@/lib/leads/print-ocr";

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
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-pool-deep">
          <ScanText className="size-5" /> Cadastrar por print
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">{PRINT_INSTRUCTIONS}</p>

          {state.kind === "idle" && (
            <>
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
                className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                  dragOver ? "border-pool bg-pool-mist/60" : "border-default-300 bg-default-50"
                }`}
              >
                <ImageUp className="size-9 text-pool" aria-hidden />
                <div className="flex flex-wrap justify-center gap-2">
                  <Button color="primary" onPress={() => inputRef.current?.click()}>
                    Selecionar imagem
                  </Button>
                  {canReadClipboard() && (
                    <Button
                      variant="flat"
                      color="primary"
                      startContent={<ClipboardPaste className="size-4" />}
                      onPress={pasteFromClipboard}
                    >
                      Colar print
                    </Button>
                  )}
                </div>
                <p className="text-xs text-default-500">
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
              {state.error && <Alert color="danger" title={state.error} />}
              <p className="text-xs text-default-400">
                A imagem é lida apenas neste navegador e não é armazenada.
              </p>
            </>
          )}

          {state.kind !== "idle" && (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <img
                src={state.previewUrl}
                alt="Prévia do print enviado"
                className="max-h-72 w-full rounded-xl border border-default-200 bg-default-50 object-contain"
              />
              <div className="flex flex-col gap-3">
                {state.kind === "processing" && (
                  <Progress
                    aria-label={progressLabel}
                    label={progressLabel}
                    color="primary"
                    showValueLabel
                    value={Math.round(state.progress.progress * 100)}
                    isIndeterminate={state.progress.stage === "loading"}
                  />
                )}

                {state.kind === "error" && (
                  <>
                    <Alert color="danger" title="Erro ao processar" description={state.message} />
                    <div className="flex gap-2">
                      <Button
                        color="primary"
                        variant="flat"
                        startContent={<RotateCcw className="size-4" />}
                        onPress={() => processFile(state.file)}
                      >
                        Tentar novamente
                      </Button>
                      <Button variant="light" onPress={reset}>
                        Escolher outra imagem
                      </Button>
                    </div>
                  </>
                )}

                {state.kind === "empty" && (
                  <Alert
                    color="warning"
                    title="Nenhum texto identificado"
                    description="Não conseguimos ler texto nesta imagem. Tente um print mais nítido ou cadastre manualmente."
                  />
                )}

                {state.kind === "result" && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-default-500">Nome do contato</p>
                      <p className="font-semibold">
                        {state.extraction.name ?? (
                          <span className="font-normal text-default-500">
                            Não identificado — preencha no formulário
                          </span>
                        )}
                      </p>
                    </div>

                    {state.extraction.phones.length === 0 ? (
                      <Alert
                        color="warning"
                        title="Nenhum telefone identificado"
                        description="Preencha o WhatsApp manualmente no formulário."
                      />
                    ) : state.extraction.phones.length === 1 ? (
                      <div>
                        <p className="text-xs font-medium text-default-500">WhatsApp</p>
                        <p className="font-semibold">
                          {formatBrazilPhone(state.extraction.phones[0].normalized)}
                        </p>
                      </div>
                    ) : (
                      <RadioGroup
                        label={`Encontramos ${state.extraction.phones.length} números. Qual é o do contato?`}
                        value={selectedPhone}
                        onValueChange={setSelectedPhone}
                        classNames={{ label: "text-sm text-default-700" }}
                      >
                        {state.extraction.phones.map((p) => (
                          <Radio
                            key={p.normalized}
                            value={p.normalized}
                            description={`Lido como "${p.raw}"`}
                          >
                            {formatBrazilPhone(p.normalized)}
                          </Radio>
                        ))}
                        <Radio value={NONE}>Nenhum destes (preencher manualmente)</Radio>
                      </RadioGroup>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {state.kind !== "idle" && state.kind !== "processing" && (
            <Button variant="light" onPress={reset} className="mr-auto">
              Outro print
            </Button>
          )}
          <Button variant="flat" onPress={handleClose}>
            Cancelar
          </Button>
          {(state.kind === "result" || state.kind === "empty") && (
            <Button color="primary" onPress={continueToForm} isDisabled={needsChoice}>
              Continuar para o cadastro
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
