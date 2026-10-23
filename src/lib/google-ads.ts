import { useEffect } from "react";

type GoogleTagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

export function useWhatsAppConversion() {
  useEffect(() => {
    const trackClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;

      const url = new URL(link.href);
      if (
        url.protocol !== "https:" ||
        !["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname)
      ) return;

      // Each intentional click is a separate conversion; no personal data is sent.
      (window as GoogleTagWindow).gtag?.("event", "conversion", {
        send_to: "AW-16490926947/LX_RCNDQn5sZEOOmvrc9",
        value: 1.0,
        currency: "BRL",
        transaction_id: crypto.randomUUID(),
      });
    };

    // Delegation also covers links inside the lazily mounted quote dialog.
    document.addEventListener("click", trackClick, true);
    return () => document.removeEventListener("click", trackClick, true);
  }, []);
}
