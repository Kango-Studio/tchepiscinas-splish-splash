import { motion } from "framer-motion";
import { Check, CheckCircle2, ShieldCheck, X, XCircle } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import problemGreenWater from "@/assets/problem-green-water.jpg";
import heroPool from "@/assets/hero-pool.jpg";

const WHATSAPP = "https://wa.me/5551991757029";
const waLink = (msg: string) => `${WHATSAPP}?text=${encodeURIComponent(msg)}`;

type ComparisonItem = {
  title: string;
  desc: string;
};

const soloItems: ComparisonItem[] = [
  { title: "Água verde e turva", desc: "Alga aparece rápido, principalmente no calor." },
  {
    title: "Produto errado e desperdício",
    desc: "Sem saber a dosagem certa, o produto vai pro ralo.",
  },
  {
    title: "Equipamentos quebram sem aviso",
    desc: "Bomba e filtro cobram caro quando menos se espera.",
  },
  { title: "Fim de semana perdido", desc: "Escovar, aspirar e testar água toma o teu sábado." },
  { title: "Gastos inesperados", desc: "Conserto de última hora sempre sai mais caro." },
  { title: "Tentativa e erro", desc: "Sem know-how, cada ajuste é um chute." },
  { title: "Sem suporte", desc: "Na dúvida, ninguém pra te ajudar na hora." },
];

const tcheItems: ComparisonItem[] = [
  { title: "Piscina sempre cristalina", desc: "Água tratada e balanceada em cada visita." },
  { title: "Produtos na dosagem correta", desc: "Química calculada por quem entende do assunto." },
  { title: "Revisão preventiva", desc: "Problema é identificado antes de virar prejuízo." },
  { title: "Equipamentos protegidos", desc: "Bomba e filtro com vida útil mais longa." },
  {
    title: "Tempo livre para aproveitar",
    desc: "Teu fim de semana é pra curtir, não pra trabalhar.",
  },
  { title: "Custos previsíveis", desc: "Sem susto na conta, tudo dentro do plano." },
  { title: "Equipe especializada", desc: "Técnicos treinados cuidando de cada detalhe." },
  { title: "Atendimento rápido pelo WhatsApp", desc: "Resposta rápida, sem enrolação." },
];

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export function ComparisonSection() {
  return (
    <section className="py-14 sm:py-20 bg-white overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto mb-12 sm:mb-16"
        >
          <span className="text-sm font-bold uppercase tracking-wider text-pool">
            Qual é a melhor escolha?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4 leading-tight">
            A diferença entre se preocupar com a piscina e{" "}
            <span className="text-gradient-pool">simplesmente aproveitar</span>.
          </h2>
          <p className="text-muted-foreground">
            Cuidar da piscina parece simples, mas pequenos erros custam tempo, dinheiro e
            tranquilidade. Veja a diferença entre fazer tudo sozinho e deixar a Tchê Piscinas cuidar
            de tudo.
          </p>
        </motion.div>

        {/* Comparison card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative rounded-[32px] bg-white border border-pool-mist/50 shadow-[0_40px_80px_-40px_rgba(0,90,148,0.18)]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* LEFT: Cuidando sozinho */}
            <div className="relative rounded-t-[32px] lg:rounded-l-[32px] lg:rounded-tr-none bg-gradient-to-b from-[#FFF4F4] to-white p-6 sm:p-8 lg:p-10">
              <h3 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-foreground mb-3">
                <XCircle className="size-6 text-red-500 shrink-0" strokeWidth={2.25} />
                Cuidando sozinho
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Mais preocupação,
                <br />
                mais gastos
                <br />e menos tempo livre.
              </p>

              <img
                src={problemGreenWater}
                alt="Piscina com água verde e turva por falta de manutenção"
                loading="lazy"
                width={800}
                height={400}
                className="w-full h-[170px] sm:h-[180px] object-cover rounded-[20px] mb-6"
              />

              <motion.ul
                variants={listVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
              >
                {soloItems.map((item, i) => (
                  <motion.li
                    key={i}
                    variants={itemVariants}
                    whileHover={{ y: -2, boxShadow: "0 12px 24px -14px rgba(220,38,38,0.25)" }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-xl border-b border-slate-100 last:border-0"
                  >
                    <span className="mt-0.5 inline-flex items-center justify-center size-6 rounded-full bg-[#FFECEC] text-red-500 shrink-0">
                      <X className="size-3.5" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            {/* VS badge — mobile: inline between columns */}
            <div className="flex lg:hidden justify-center -my-4 relative z-10">
              <div className="size-14 rounded-full bg-white shadow-[0_10px_24px_-8px_rgba(0,90,148,0.3)] ring-1 ring-pool-mist/70 flex items-center justify-center font-extrabold text-pool-deep text-xs tracking-wide">
                VS
              </div>
            </div>

            {/* RIGHT: Com a Tchê Piscinas */}
            <div className="relative rounded-b-[32px] lg:rounded-r-[32px] lg:rounded-bl-none bg-gradient-to-b from-[#EAF6FF] to-white p-6 sm:p-8 lg:p-10 lg:border-l lg:border-pool-mist/40">
              <h3 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-pool-deep mb-3">
                <CheckCircle2 className="size-6 text-pool-deep shrink-0" strokeWidth={2.25} />
                Com a Tchê Piscinas
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Mais tranquilidade,
                <br />
                mais economia
                <br />e piscina pronta sempre.
              </p>

              <img
                src={heroPool}
                alt="Piscina cristalina, azul e perfeitamente tratada"
                loading="lazy"
                width={800}
                height={400}
                className="w-full h-[170px] sm:h-[180px] object-cover rounded-[20px] mb-6"
              />

              <motion.ul
                variants={listVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
              >
                {tcheItems.map((item, i) => (
                  <motion.li
                    key={i}
                    variants={itemVariants}
                    whileHover={{ y: -2, boxShadow: "0 12px 24px -14px rgba(0,90,148,0.25)" }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3 py-3 px-2 -mx-2 rounded-xl border-b border-pool-mist/40 last:border-0"
                  >
                    <span className="mt-0.5 inline-flex items-center justify-center size-6 rounded-full bg-[#EAF6FF] text-pool-deep shrink-0">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            </div>
          </div>

          {/* VS badge — desktop: centered at the intersection */}
          <div className="pointer-events-none absolute inset-0 hidden lg:flex items-center justify-center">
            <div className="size-16 rounded-full bg-white shadow-[0_15px_35px_-10px_rgba(0,90,148,0.35)] ring-1 ring-pool-mist/70 flex items-center justify-center font-extrabold text-pool-deep text-sm tracking-wide">
              VS
            </div>
          </div>
        </motion.div>

        {/* CTA bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-between gap-5 bg-white rounded-full shadow-[0_20px_45px_-25px_rgba(0,90,148,0.3)] border border-pool-mist/40 px-6 py-4 sm:px-8 sm:py-4"
        >
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="inline-flex items-center justify-center size-11 rounded-full bg-pool-mist text-pool-deep shrink-0">
              <ShieldCheck className="size-5" />
            </span>
            <p className="text-sm sm:text-base font-bold text-foreground leading-snug">
              Menos preocupação.
              <br />
              Mais qualidade de vida.
            </p>
          </div>
          <a
            href={waLink("Olá! Quero cuidar da minha piscina com a Tchê Piscinas.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-gradient-sun text-foreground font-bold px-6 py-3 rounded-full shadow-sun hover:scale-[1.03] transition-transform shrink-0 w-full sm:w-auto"
          >
            <WhatsappIcon className="size-4" />
            Quero cuidar da minha piscina
          </a>
        </motion.div>
      </div>
    </section>
  );
}
