import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { createWhatsAppLink } from "@/lib/whatsapp";
import { maskBrazilPhoneInput, normalizeBrazilPhone } from "@/lib/leads/phone";
import {
  CLIENT_TYPE_LABELS,
  INTEREST_LABELS,
  LEAD_INTERESTS,
  publicLeadSchema,
  type ClientType,
  type LeadInterest,
} from "@/lib/leads/schema";
import { submitSiteLead } from "@/lib/leads/submit-lead";

type OpenOptions = { interest?: LeadInterest; clientType?: ClientType; cta?: string };
type QuoteFormContextValue = { openQuoteForm: (options?: OpenOptions) => void };

const QuoteFormContext = createContext<QuoteFormContextValue | null>(null);

export function useQuoteForm() {
  const ctx = useContext(QuoteFormContext);
  if (!ctx) throw new Error("useQuoteForm deve ser usado dentro de <QuoteFormProvider>");
  return ctx;
}

export function QuoteFormProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OpenOptions>({});
  const [session, setSession] = useState(0);

  const openQuoteForm = useCallback((opts: OpenOptions = {}) => {
    setOptions(opts);
    setSession((s) => s + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openQuoteForm }), [openQuoteForm]);

  return (
    <QuoteFormContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl border-pool-light/30 p-5 sm:p-7">
          {open && <QuoteFormBody key={session} options={options} onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </QuoteFormContext.Provider>
  );
}

// Campos do formulário (antes da normalização do telefone)
const formSchema = z.object({
  name: publicLeadSchema.shape.name,
  whatsapp: z
    .string()
    .trim()
    .min(1, "Informe o WhatsApp")
    .refine((v) => normalizeBrazilPhone(v) !== null, "WhatsApp inválido. Use DDD + número."),
  city: publicLeadSchema.shape.city,
  interest: z.enum(LEAD_INTERESTS, { errorMap: () => ({ message: "Escolha um interesse" }) }),
  client_type: z.enum(["residencial", "condominio", "outro"]),
  website: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

type Status =
  | { kind: "idle" }
  | { kind: "success"; name: string; city: string; interest: LeadInterest }
  | { kind: "error"; message: string };

const inputClass =
  "w-full h-11 rounded-xl border border-border bg-white px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none transition focus:border-pool focus:ring-2 focus:ring-pool-light/40 aria-[invalid=true]:border-destructive";

function QuoteFormBody({ options, onClose }: { options: OpenOptions; onClose: () => void }) {
  const startedAt = useRef(Date.now());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      whatsapp: "",
      city: "",
      // "" mantém a opção "Selecione" até o visitante escolher
      interest: options.interest ?? ("" as LeadInterest),
      client_type: options.clientType ?? "residencial",
      website: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setStatus({ kind: "idle" });
    try {
      const result = await submitSiteLead({
        data: { ...values, cta: options.cta, elapsed_ms: Date.now() - startedAt.current },
      });
      if (result.ok) {
        setStatus({
          kind: "success",
          name: values.name,
          city: values.city,
          interest: values.interest,
        });
      } else {
        setStatus({ kind: "error", message: result.message });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Não conseguimos enviar agora. Verifique tua conexão ou chame no WhatsApp.",
      });
    }
  };

  if (status.kind === "success") {
    const firstName = status.name.split(" ")[0];
    const message = `Olá! Sou ${status.name}, de ${status.city}. Acabei de pedir um orçamento pelo site da Tchê Piscinas (${INTEREST_LABELS[status.interest]}).`;
    return (
      <div className="text-center py-2" role="status" aria-live="polite">
        <div className="mx-auto mb-4 size-14 rounded-full bg-pool-mist flex items-center justify-center">
          <CheckCircle2 className="size-8 text-pool-deep" />
        </div>
        <DialogTitle className="text-xl md:text-2xl font-extrabold text-pool-deep">
          Pedido recebido, {firstName}!
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Nossa equipe vai entrar em contato pelo WhatsApp. Se preferir, já pode continuar a
          conversa agora.
        </DialogDescription>
        <div className="mt-6 flex flex-col gap-2.5">
          <a
            href={createWhatsAppLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-whatsapp px-6 font-bold text-white shadow-lg transition hover:brightness-105"
          >
            <WhatsappIcon className="size-5" />
            Continuar no WhatsApp
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full text-sm font-semibold text-pool-deep hover:bg-pool-mist transition"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="text-xl md:text-2xl font-extrabold text-pool-deep">
          Solicitar orçamento
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Preencha os dados e a nossa equipe retorna pelo WhatsApp. Sem compromisso.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-2 space-y-4">
        <Field id="quote-name" label="Nome" error={errors.name?.message}>
          <input
            id="quote-name"
            autoComplete="name"
            className={inputClass}
            placeholder="Teu nome"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "quote-name-error" : undefined}
            {...register("name")}
          />
        </Field>

        <Field id="quote-whatsapp" label="WhatsApp" error={errors.whatsapp?.message}>
          <input
            id="quote-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            className={inputClass}
            placeholder="(51) 99999-9999"
            aria-invalid={!!errors.whatsapp}
            aria-describedby={errors.whatsapp ? "quote-whatsapp-error" : undefined}
            {...register("whatsapp", {
              onChange: (e) => setValue("whatsapp", maskBrazilPhoneInput(e.target.value)),
            })}
          />
        </Field>

        <Field id="quote-city" label="Cidade" error={errors.city?.message}>
          <input
            id="quote-city"
            autoComplete="address-level2"
            className={inputClass}
            placeholder="Ex.: Porto Alegre"
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? "quote-city-error" : undefined}
            {...register("city")}
          />
        </Field>

        <Field id="quote-interest" label="Interesse" error={errors.interest?.message}>
          <select
            id="quote-interest"
            className={inputClass}
            aria-invalid={!!errors.interest}
            aria-describedby={errors.interest ? "quote-interest-error" : undefined}
            {...register("interest")}
          >
            <option value="" disabled>
              Selecione
            </option>
            {LEAD_INTERESTS.map((i) => (
              <option key={i} value={i}>
                {INTEREST_LABELS[i]}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold text-foreground mb-1.5">Tipo de piscina</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["residencial", "condominio"] as const).map((t) => (
              <label
                key={t}
                className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground transition has-[:checked]:border-pool has-[:checked]:bg-pool-mist has-[:checked]:text-pool-deep has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pool-light/50"
              >
                <input type="radio" value={t} className="sr-only" {...register("client_type")} />
                {CLIENT_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Campo isca para bots: escondido de pessoas e leitores de tela */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="quote-website">Website</label>
          <input id="quote-website" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>

        {status.kind === "error" && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p>{status.message}</p>
              <a
                href={createWhatsAppLink(
                  "Olá! Vim pelo site da Tchê Piscinas e quero solicitar um orçamento.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex font-semibold underline underline-offset-2"
              >
                Falar direto no WhatsApp
              </a>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-sun font-bold text-foreground shadow-sun transition hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : null}
          {isSubmitting ? "Enviando..." : "Enviar pedido de orçamento"}
        </button>
        <p className="text-[11px] text-center text-muted-foreground">
          Usamos teus dados apenas para responder a este pedido.
        </p>
      </form>
    </>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
