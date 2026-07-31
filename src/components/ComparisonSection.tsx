import { motion } from "framer-motion";
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
  { icon: Wrench, text: "Manutenção preventiva dos equipamentos em todas as visitas" },
  { icon: Zap, text: "Tratamento de choque a preço de custo" },
  { icon: FlaskConical, text: "Produtos profissionais inclusos no serviço" },
  { icon: UserCog, text: "Técnicos especializados e treinados" },
];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

function ComparisonColumn({
  variant,
  badgeLabel,
  subtitle,
  image,
  imageAlt,
  items,
}: {
  variant: "solo" | "tche";
  badgeLabel: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  items: ComparisonItem[];
}) {
  const isSolo = variant === "solo";
  const TitleIcon = isSolo ? XCircle : CheckCircle2;

  return (
    <div className={`p-5 ${isSolo ? "bg-white" : "bg-[#F6FBFF]"}`}>
      <div className="flex items-center gap-2 mb-1">
        <TitleIcon
          className={isSolo ? "size-5 text-red-500" : "size-5 text-pool-deep"}
          strokeWidth={2.25}
        />
        <h3 className="text-lg font-extrabold text-foreground">{badgeLabel}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{subtitle}</p>

      <img
        src={image}
        alt={imageAlt}
        loading="lazy"
        width={800}
        height={320}
        className="w-full h-[140px] lg:h-[150px] object-cover rounded-[20px] mb-3"
      />

      <motion.ul
        variants={listVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="space-y-1.5"
      >
        {items.map((item, i) => (
          <motion.li
            key={i}
            variants={itemVariants}
            whileHover={{
              y: -2,
              boxShadow: isSolo
                ? "0 10px 20px -12px rgba(220,38,38,0.2)"
                : "0 10px 20px -12px rgba(0,90,148,0.22)",
            }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-3 min-h-[54px] rounded-xl px-3.5 py-1.5 ${
              isSolo ? "bg-[#FFF7F7]" : "bg-white shadow-[0_2px_10px_-6px_rgba(15,23,42,0.08)]"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center size-7 rounded-lg shrink-0 ${
                isSolo ? "bg-[#FFECEC] text-red-500" : "bg-[#EAF6FF] text-pool-deep"
              }`}
            >
              <item.icon className="size-3.5" strokeWidth={2.25} />
            </span>
            <span className="text-sm leading-snug font-semibold text-foreground">{item.text}</span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section className="py-12 lg:py-20 bg-white">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-5 lg:mb-6"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-pool">
            Qual é a melhor escolha?
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[52px] font-extrabold mt-1.5 mb-1.5 leading-[1.05]">
            Com a Tchê Piscinas,{" "}
            <span className="text-gradient-pool">tu só aproveita.</span>
          </h2>
          <p className="text-base lg:text-lg text-muted-foreground">
            Cuidar da piscina parece simples, mas pequenos erros custam tempo e dinheiro.
          </p>
        </motion.div>

        {/* Comparison card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative rounded-[28px] bg-white border border-slate-100 shadow-[0_30px_70px_-40px_rgba(0,90,148,0.16)] overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-10">
            <ComparisonColumn
              variant="solo"
              badgeLabel="Cuidando sozinho"
              subtitle="Mais preocupação, mais gastos e menos tempo para aproveitar."
              image={problemGreenWater}
              imageAlt="Piscina com água verde e turva por falta de manutenção"
              items={soloItems}
            />

            {/* VS badge — mobile: inline between columns */}
            <div className="flex lg:hidden justify-center -my-3 relative z-10">
              <div className="size-9 rounded-full bg-white shadow-[0_6px_16px_-6px_rgba(0,90,148,0.3)] ring-4 ring-white outline outline-1 outline-slate-100 flex items-center justify-center font-bold text-pool-deep text-[10px] tracking-widest">
                VS
              </div>
            </div>

            <ComparisonColumn
              variant="tche"
              badgeLabel="Cliente Tchê Piscinas"
              subtitle="Mais tranquilidade, economia e uma piscina pronta para aproveitar."
              image={heroPool}
              imageAlt="Piscina cristalina, azul e perfeitamente tratada"
              items={tcheItems}
            />
          </div>

          {/* VS badge — desktop: discreet, floating over the center */}
          <div className="pointer-events-none absolute inset-0 hidden lg:flex items-center justify-center">
            <div className="size-10 rounded-full bg-white shadow-[0_8px_20px_-8px_rgba(0,90,148,0.35)] ring-4 ring-white outline outline-1 outline-slate-100 flex items-center justify-center font-bold text-pool-deep text-[10px] tracking-widest">
              VS
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="mt-6 flex justify-center"
        >
          <a
            href={waLink("Olá! Quero deixar a Tchê Piscinas cuidar da minha piscina.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-pool-deep hover:bg-pool text-white font-bold px-7 py-3.5 rounded-full shadow-pool transition-colors"
          >
            <WhatsappIcon className="size-4" />
            Quero deixar a Tchê cuidar da minha piscina
          </a>
        </motion.div>
      </div>
    </section>
  );
}
