import { motion } from "framer-motion";
import { Fragment } from "react";
import {
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

function ItemRow({ variant, item }: { variant: "solo" | "tche"; item: ComparisonItem }) {
  const isSolo = variant === "solo";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      className={`flex items-center gap-2 md:gap-2.5 min-h-10 md:min-h-13.5 rounded-lg px-2.5 md:px-3 py-1 md:py-1.5 transition-shadow duration-300 ${
        isSolo
          ? "bg-red-50/60 hover:shadow-[0_4px_14px_-8px_rgba(220,38,38,0.25)]"
          : "bg-sky-50/70 hover:shadow-[0_4px_14px_-8px_rgba(0,90,148,0.25)]"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center size-5 md:size-6 rounded-md shrink-0 ${
          isSolo ? "bg-[#FFECEC] text-red-500" : "bg-[#EAF6FF] text-pool-deep"
        }`}
      >
        <item.icon className="size-3" strokeWidth={2.25} />
      </span>
      <span className="text-[13px] md:text-sm leading-snug font-semibold text-foreground">{item.text}</span>
    </motion.div>
  );
}

export function ComparisonSection() {
  return (
    <section className="py-10 md:py-16 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto mb-5 md:mb-8"
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

        {/* Comparison container — single white card, two plain columns, VS floating between the images */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative mx-auto max-w-6xl overflow-visible rounded-[20px] md:rounded-[28px] border border-sky-100 bg-white shadow-sm"
        >
          <div className="grid lg:grid-cols-2">
            {/* Left header + image */}
            <div className="p-4 md:p-6">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="size-4 text-red-500 shrink-0" strokeWidth={2.25} />
                <h3 className="text-sm md:text-base font-extrabold text-foreground">Cuidando sozinho</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2 md:mb-3">
                Mais preocupação, mais gastos e menos tempo para aproveitar.
              </p>
              <img
                src={problemGreenWater}
                alt="Piscina com água verde e turva por falta de manutenção"
                loading="lazy"
                width={800}
                height={320}
                className="w-full h-[110px] md:h-[150px] object-cover rounded-2xl md:rounded-[20px]"
              />
            </div>

            {/* VS badge — mobile only, inline between the two stacked blocks */}
            <div className="flex lg:hidden justify-center py-1">
              <div className="size-8 rounded-full bg-white border border-sky-100 shadow-md flex items-center justify-center font-bold text-pool-deep text-[10px] tracking-widest">
                VS
              </div>
            </div>

            {/* Right header + image */}
            <div className="border-t border-sky-100 p-4 lg:border-l lg:border-t-0 lg:p-6">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="size-4 text-pool-deep shrink-0" strokeWidth={2.25} />
                <h3 className="text-sm md:text-base font-extrabold text-foreground">Cliente Tchê Piscinas</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2 md:mb-3">
                Mais tranquilidade, economia e uma piscina pronta para aproveitar.
              </p>
              <img
                src={heroPool}
                alt="Piscina cristalina, azul e perfeitamente tratada"
                loading="lazy"
                width={800}
                height={320}
                className="w-full h-[110px] md:h-[150px] object-cover rounded-2xl md:rounded-[20px]"
              />
            </div>
          </div>

          {/* VS badge — desktop only, floating between the two images */}
          <div className="hidden lg:flex absolute left-1/2 top-[160px] z-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center size-13 rounded-full bg-white border border-sky-100 shadow-md">
            <span className="text-[11px] font-bold text-pool-deep tracking-widest">VS</span>
          </div>

          {/* Comparison items — plain 2-col grid, each row pairs the left and right item */}
          <div className="grid gap-x-4 md:gap-x-8 gap-y-1.5 md:gap-y-2 px-4 pb-4 md:px-6 md:pb-6 lg:grid-cols-2">
            {soloItems.map((item, i) => (
              <Fragment key={i}>
                <ItemRow variant="solo" item={item} />
                <ItemRow variant="tche" item={tcheItems[i]} />
              </Fragment>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
          className="mt-4 md:mt-5 flex justify-center"
        >
          <a
            href={waLink("Olá! Quero deixar a Tchê Piscinas cuidar da minha piscina.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-pool-deep hover:bg-pool text-white font-bold text-[15px] md:text-base px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-pool transition-colors"
          >
            <WhatsappIcon className="size-4" />
            Quero deixar a Tchê cuidar da minha piscina
          </a>
        </motion.div>
      </div>
    </section>
  );
}
