import { motion } from "framer-motion";
import { Fragment } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Droplets,
  FlaskConical,
  UserCog,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import problemGreenWater from "@/assets/problem-green-water.jpg";
import heroPool from "@/assets/hero-pool.jpg";

const WHATSAPP = "https://wa.me/5551991757029";
const waLink = (msg: string) => `${WHATSAPP}?text=${encodeURIComponent(msg)}`;

type ComparisonItem = {
  icon: LucideIcon;
  text: string;
};

const soloItems: ComparisonItem[] = [
  { icon: XCircle, text: "Água pode ficar verde de um dia para o outro" },
  { icon: XCircle, text: "Equipamentos desgastam sem manutenção preventiva" },
  { icon: XCircle, text: "Gastos frequentes com produtos e dosagens erradas" },
  { icon: XCircle, text: "Você perde tempo limpando a piscina" },
  { icon: XCircle, text: "Consertos inesperados pesam no bolso" },
];

const tcheItems: ComparisonItem[] = [
  { icon: Droplets, text: "Água sempre cristalina e saudável" },
  { icon: Wrench, text: "Manutenção preventiva em todas as visitas" },
  { icon: Zap, text: "Tratamento de choque a preço de custo" },
  { icon: FlaskConical, text: "Produtos profissionais inclusos no serviço" },
  { icon: UserCog, text: "Técnicos especializados e treinados" },
];

function ItemRow({
  variant,
  item,
  dense,
}: {
  variant: "solo" | "tche";
  item: ComparisonItem;
  dense?: boolean;
}) {
  const isSolo = variant === "solo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      className={`flex items-center gap-2 rounded-lg transition-shadow duration-300 ${
        dense ? "min-h-13 px-4 py-3" : "min-h-13.5 px-3 py-1.5"
      } ${
        isSolo
          ? "bg-red-50/60 hover:shadow-[0_4px_14px_-8px_rgba(220,38,38,0.25)]"
          : "bg-sky-50/70 hover:shadow-[0_4px_14px_-8px_rgba(0,90,148,0.25)]"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-md shrink-0 ${dense ? "size-5" : "size-6"} ${
          isSolo ? "bg-[#FFECEC] text-red-500" : "bg-[#EAF6FF] text-pool-deep"
        }`}
      >
        <item.icon className={dense ? "size-3.5" : "size-3"} strokeWidth={2.25} />
      </span>
      <span className="text-sm leading-snug font-semibold text-foreground">{item.text}</span>
    </motion.div>
  );
}

export function ComparisonSection() {
  return (
    <section className="pt-8 pb-12 md:pt-10 md:pb-17 bg-white">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto mb-5"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-pool">
            Qual é a melhor escolha?
          </span>
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold mt-2 mb-2 leading-[1.1] md:leading-[1.05]">
            Com a Tchê Piscinas, <span className="text-gradient-pool">tu só aproveita.</span>
          </h2>
          <p className="text-sm md:text-lg text-muted-foreground">
            Cuidar da piscina parece simples, mas pequenos erros custam tempo e dinheiro.
          </p>
        </motion.div>

        {/* ============ DESKTOP — linha a linha, lado a lado ============ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="hidden lg:block relative mx-auto max-w-310 overflow-visible rounded-[28px] border border-sky-100 bg-white shadow-sm"
        >
          <div className="grid lg:grid-cols-2">
            {/* Left header + image */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="size-4 text-red-500 shrink-0" strokeWidth={2.25} />
                <h3 className="text-base font-extrabold text-foreground">Cuidando sozinho</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Mais preocupação, mais gastos e menos tempo para aproveitar.
              </p>
              <img
                src={problemGreenWater}
                alt="Piscina com água verde e turva por falta de manutenção"
                loading="lazy"
                width={800}
                height={320}
                className="w-full h-[150px] object-cover rounded-[20px]"
              />
            </div>

            {/* Right header + image */}
            <div className="border-l border-sky-100 p-6">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="size-4 text-pool-deep shrink-0" strokeWidth={2.25} />
                <h3 className="text-base font-extrabold text-foreground">Cliente Tchê Piscinas</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Mais tranquilidade, economia e uma piscina pronta para aproveitar.
              </p>
              <img
                src={heroPool}
                alt="Piscina cristalina, azul e perfeitamente tratada"
                loading="lazy"
                width={800}
                height={320}
                className="w-full h-[150px] object-cover rounded-[20px]"
              />
            </div>
          </div>

          {/* VS badge — floating between the two images */}
          <div className="flex absolute left-1/2 top-[160px] z-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center size-13 rounded-full bg-white border border-sky-100 shadow-md">
            <span className="text-[11px] font-bold text-pool-deep tracking-widest">VS</span>
          </div>

          {/* Comparison items — plain 2-col grid, each row pairs the left and right item */}
          <div className="grid gap-x-8 gap-y-2 px-6 pb-6 lg:grid-cols-2">
            {soloItems.map((item, i) => (
              <Fragment key={i}>
                <ItemRow variant="solo" item={item} />
                <ItemRow variant="tche" item={tcheItems[i]} />
              </Fragment>
            ))}
          </div>
        </motion.div>

        {/* ============ MOBILE — dois blocos completos e independentes ============ */}
        <div className="flex flex-col lg:hidden w-full rounded-[24px]">
          {/* Bloco 1 — Cuidando sozinho (completo) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-[22px] border border-sky-100 bg-white shadow-sm p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="size-4 text-red-500 shrink-0" strokeWidth={2.25} />
              <h3 className="text-lg font-extrabold leading-tight text-foreground">Cuidando sozinho</h3>
            </div>
            <p className="text-sm leading-5 text-muted-foreground mb-3">
              Mais preocupação, mais gastos e menos tempo para aproveitar.
            </p>
            <img
              src={problemGreenWater}
              alt="Piscina com água verde e turva por falta de manutenção"
              loading="lazy"
              width={800}
              height={320}
              className="w-full h-[150px] object-cover rounded-[18px] mb-3"
            />
            <div className="flex flex-col gap-2">
              {soloItems.map((item, i) => (
                <ItemRow key={i} variant="solo" item={item} dense />
              ))}
            </div>
          </motion.div>

          {/* VS — estático, sem position absolute */}
          <div className="flex justify-center my-4">
            <div className="size-11 rounded-full bg-white border border-sky-100 shadow-md flex items-center justify-center font-bold text-pool-deep text-[10px] tracking-widest">
              VS
            </div>
          </div>

          {/* Bloco 2 — Cliente Tchê Piscinas (completo) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="rounded-[22px] border border-sky-100 bg-white shadow-sm p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="size-4 text-pool-deep shrink-0" strokeWidth={2.25} />
              <h3 className="text-lg font-extrabold leading-tight text-foreground">Cliente Tchê Piscinas</h3>
            </div>
            <p className="text-sm leading-5 text-muted-foreground mb-3">
              Mais tranquilidade, economia e uma piscina pronta para aproveitar.
            </p>
            <img
              src={heroPool}
              alt="Piscina cristalina, azul e perfeitamente tratada"
              loading="lazy"
              width={800}
              height={320}
              className="w-full h-[150px] object-cover rounded-[18px] mb-3"
            />
            <div className="flex flex-col gap-2">
              {tcheItems.map((item, i) => (
                <ItemRow key={i} variant="tche" item={item} dense />
              ))}
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-5 flex justify-center"
        >
          <a
            href={waLink("Olá! Quero minha piscina sempre pronta com a Tchê Piscinas.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full max-w-sm items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-[#075F9F] px-7 text-sm font-bold text-white shadow-[0_12px_30px_-12px_rgba(7,95,159,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#064F86] hover:shadow-[0_18px_38px_-14px_rgba(7,95,159,0.65)] active:translate-y-0 sm:w-auto sm:text-base"
          >
            <WhatsappIcon className="size-[18px]" />
            <span className="max-[380px]:hidden">Quero minha piscina sempre pronta</span>
            <span className="hidden max-[380px]:inline">Quero minha piscina pronta</span>
            <ArrowRight className="size-[18px]" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
