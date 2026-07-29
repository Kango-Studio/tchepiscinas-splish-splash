import * as React from "react";
import {
  BadgeDollarSign,
  Clock3,
  ShieldCheck,
  Smile,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";

const WHATSAPP = "https://wa.me/5551991757029";
const waLink = (msg: string) => `${WHATSAPP}?text=${encodeURIComponent(msg)}`;

type Benefit = {
  icon: React.ElementType;
  title: string;
  description: string;
};

const benefits: Benefit[] = [
  {
    icon: Zap,
    title: "Choque incluso",
    description:
      "Tratamento de choque a preço de custo sem cobrar a mais quando a água precisar de um respiro.",
  },
  {
    icon: ShieldCheck,
    title: "Diagnóstico grátis",
    description:
      "Avaliação do maquinário sem custo: bomba, filtro e motor revisados por nossa conta, pra tu saber o estado real do equipamento.",
  },
  {
    icon: Wrench,
    title: "Reparo com desconto",
    description:
      "Precisou de conserto? Cliente de plano paga valor especial na mão de obra do nosso próprio piscineiro sem chamar terceiro.",
  },
  {
    icon: Users,
    title: "Equipe treinada",
    description:
      "Toda a nossa equipe é especializada e treinada, oferecendo o melhor serviço e suporte pra quem já confia na Tchê.",
  },
];

const highlights = [
  {
    icon: BadgeDollarSign,
    label: "Mais economia",
  },
  {
    icon: Clock3,
    label: "Mais prevenção",
  },
  {
    icon: Smile,
    label: "Mais tranquilidade",
  },
];

export function PlanBenefitsSection() {
  return (
    <section className="bg-[#eef9ff] px-[15px] py-10 sm:px-[18px] lg:px-6 lg:py-14">
      <div className="mx-auto w-full max-w-[864px]">
        {/* Cabeçalho */}
        <header className="mx-auto max-w-xl text-center">
          <h2 className="text-balance text-2xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">
            Vantagem de <span className="text-gradient-pool">quem fecha com a gente</span>
          </h2>

          <p className="mx-auto mt-3 max-w-lg text-pretty text-sm leading-6 text-slate-600">
            Não é só manutenção em dia. Cliente Tchê tem regalias que a gente
            guarda só pra quem já confia no nosso trabalho.
          </p>
        </header>

        {/* Cards */}
        <div className="mt-8 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:mt-9 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <div key={benefit.title} className="group relative flex flex-col pt-6">
                {/* Ícone flutuante, sobreposto ao topo do card */}
                <div className="absolute top-0 left-1/2 z-20 flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center">
                  <span className="absolute inset-0 rounded-full border-2 border-dashed border-pool-light/70" />
                  <div className="relative grid h-[51px] w-[51px] place-items-center rounded-full bg-gradient-pool text-white shadow-pool ring-1 ring-pool-light/60 transition duration-500 group-hover:scale-110 group-hover:rotate-3">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </div>
                </div>

                <article className="relative flex min-h-[330px] flex-1 flex-col overflow-hidden rounded-[21px] border border-white/90 bg-white/80 shadow-[0_15px_41px_-30px_rgba(14,116,144,0.45)] backdrop-blur-xl transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_21px_49px_-28px_rgba(14,116,144,0.55)]">
                  {/* Brilho superior */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[72px] bg-gradient-to-b from-pool-mist/70 to-transparent" />

                  <div className="relative z-10 flex flex-1 flex-col px-[18px] pb-[11px] pt-[42px] text-center">
                    <h3 className="text-balance text-sm font-extrabold leading-snug tracking-tight text-[#005290] sm:text-base">
                      {benefit.title}
                    </h3>

                    <div className="mx-auto my-[7px] h-1 w-6 rounded-full bg-gradient-pool transition-all duration-500 group-hover:w-12" />

                    <p className="text-pretty text-xs leading-5 text-slate-600">
                      {benefit.description}
                    </p>
                  </div>

                  {/* Base decorativa (aguardando foto definitiva) — ~35% da altura */}
                  <div className="relative h-[35%] min-h-[105px] overflow-hidden">
                    <div className="absolute -top-px left-0 z-10 h-[30px] w-full">
                      <svg
                        className="h-full w-full"
                        viewBox="0 0 500 80"
                        preserveAspectRatio="none"
                        fill="none"
                      >
                        <path
                          d="M0 0H500V25C401 72 319 34 225 51C126 69 74 70 0 37V0Z"
                          fill="white"
                          fillOpacity="0.96"
                        />
                      </svg>
                    </div>

                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pool-mist to-pool-light/50">
                      <Icon className="h-[30px] w-[30px] text-pool/40" strokeWidth={1.5} />
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-pool-deep/25 via-transparent to-transparent" />
                  </div>
                </article>
              </div>
            );
          })}
        </div>

        {/* Faixa inferior */}
        <div className="mx-auto mt-6 grid max-w-xl overflow-hidden rounded-[18px] border border-white/80 bg-white/80 shadow-[0_12px_34px_-30px_rgba(15,118,170,0.55)] backdrop-blur-xl sm:grid-cols-3 sm:rounded-full">
          {highlights.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className={[
                  "flex items-center justify-center gap-2 px-[15px] py-3",
                  index !== highlights.length - 1
                    ? "border-b border-pool-mist sm:border-b-0 sm:border-r"
                    : "",
                ].join(" ")}
              >
                <span className="grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full bg-gradient-pool text-white shadow-lg shadow-pool-deep/20">
                  <Icon className="h-3 w-3" />
                </span>

                <span className="font-bold text-xs text-slate-800">{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <a
            href={waLink("Bora fechar meu plano com a Tchê Piscinas!")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-pool-deep px-6 py-3 font-bold text-white shadow-pool transition-colors hover:bg-pool"
          >
            <WhatsappIcon className="size-4" />
            Bora fechar teu plano?
          </a>
        </div>
      </div>
    </section>
  );
}
