import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ClientType, LeadInterest } from "@/lib/leads/schema";

export type OpenOptions = { interest?: LeadInterest; clientType?: ClientType; cta?: string };
type QuoteFormContextValue = { openQuoteForm: (options?: OpenOptions) => void };

// O formulário (zod, react-hook-form, Dialog) só é baixado depois do carregamento
// da página, para não pesar no primeiro paint.
const loadQuoteFormDialog = () => import("./QuoteFormDialog");
const QuoteFormDialog = lazy(loadQuoteFormDialog);

const QuoteFormContext = createContext<QuoteFormContextValue | null>(null);

export function useQuoteForm() {
  const ctx = useContext(QuoteFormContext);
  if (!ctx) throw new Error("useQuoteForm deve ser usado dentro de <QuoteFormProvider>");
  return ctx;
}

export function QuoteFormProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [options, setOptions] = useState<OpenOptions>({});
  const [session, setSession] = useState(0);

  // Pré-carrega o chunk na primeira interação do visitante, para o modal abrir sem atraso.
  useEffect(() => {
    const events = ["pointerdown", "touchstart", "scroll", "keydown"] as const;
    const prefetch = () => {
      void loadQuoteFormDialog();
      events.forEach((e) => window.removeEventListener(e, prefetch));
    };
    events.forEach((e) => window.addEventListener(e, prefetch, { once: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, prefetch));
  }, []);

  const openQuoteForm = useCallback((opts: OpenOptions = {}) => {
    setOptions(opts);
    setSession((s) => s + 1);
    setMounted(true);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openQuoteForm }), [openQuoteForm]);

  return (
    <QuoteFormContext.Provider value={value}>
      {children}
      {mounted && (
        <Suspense fallback={null}>
          <QuoteFormDialog open={open} onOpenChange={setOpen} options={options} session={session} />
        </Suspense>
      )}
    </QuoteFormContext.Provider>
  );
}
