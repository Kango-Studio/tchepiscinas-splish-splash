import * as React from "react";
import {
  ArrowRight,
  FlaskConical,
  LifeBuoy,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { createWhatsAppLink } from "@/lib/whatsapp";
import productSuallKit from "@/assets/product-suall-kit.jpg";
import productPraticPool from "@/assets/product-pratic-pool.jpg";
import equipmentSyllent from "@/assets/equipment-syllent.jpg";
import problemCleaning from "@/assets/problem-cleaning.jpg";

type ProductCard = {
  title: string;
  description: string;
  image: string;
  icon: React.ElementType;
};

const productCards: ProductCard[] = [
  {
    title: "Produtos químicos",
    description: "Cloro, algicida, clarificante, corretor de pH.",
    image: productPraticPool,
    icon: FlaskConical,
  },
  {
    title: "Equipamentos",
    description: "Bombas, filtros, aquecedores, trocadores.",
    image: equipmentSyllent,
    icon: Settings,
  },
  {
    title: "Acessórios",
    description: "Aspiradores, escovas, mangueiras, peneiras, boias.",
    image: problemCleaning,
    icon: LifeBuoy,
  },
];

export function PoolStoreSection() {
  return (
    <section id="produtos" className="bg-[#eef9ff] px-4 pt-8 pb-10 sm:px-6 md:px-6 md:pt-10 md:pb-15 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        {/* Cabeçalho */}
        <header className="mx-auto max-w-3xl text-center">
          <div className="mb-3 md:mb-4 inline-flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-[0.18em] text-pool">
            <span className="h-px w-8 bg-pool-light" />
            Loja Tchê
            <span className="h-px w-8 bg-pool-light" />
          </div>

          <h2 className="text-balance text-2xl font-extrabold leading-[1.1] tracking-[-0.04em] text-slate-950 md:text-4xl md:leading-[1.05] lg:text-5xl">
            Os melhores produtos e{" "}
            <span className="text-gradient-pool">equipamentos do mercado</span>
          </h2>

          <p className="mx-auto mt-3 md:mt-5 max-w-2xl text-sm leading-6 text-slate-600 md:text-lg md:leading-7">
            Precisa de algum equipamento especial ou produto de qualidade? A
            gente também fornece, com orientação de quem entende do assunto.
          </p>
        </header>

        {/* Composição principal */}
        <div className="mt-6 md:mt-8 grid gap-4 md:gap-6 lg:grid-cols-[1.45fr_1fr]">
          {/* Destaque institucional */}
          <article className="group relative min-h-110 md:min-h-[520px] overflow-hidden rounded-[22px] md:rounded-[32px] border border-white/80 bg-slate-950 shadow-[0_30px_80px_-35px_rgba(2,132,199,0.5)]">
            <img
              src={productSuallKit}
              alt="Profissional apresentando produtos e kits para piscina"
              className="absolute inset-0 h-full w-full object-cover object-top transition duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-5 md:p-9">
              <div className="mb-3 md:mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                <ShieldCheck className="h-4 w-4" />
                Produtos selecionados
              </div>

              <h3 className="max-w-xl text-xl font-extrabold leading-tight tracking-[-0.03em] text-white md:text-4xl">
                Tudo o que você precisa para cuidar melhor da sua piscina.
              </h3>

              <p className="mt-2 md:mt-4 max-w-xl text-sm leading-6 text-white/80 md:text-lg md:leading-7">
                Trabalhamos com produtos, equipamentos e kits completos para
                facilitar a manutenção e garantir mais segurança no tratamento.
              </p>

              <a
                href={createWhatsAppLink(
                  "Olá! 👋 Vim pelo site da Tchê Piscinas e gostaria de conhecer os produtos e equipamentos disponíveis. Podem me ajudar?",
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-4 md:mt-6 inline-flex h-11 md:h-13 items-center justify-center gap-2 rounded-full bg-white px-5 md:px-6 text-sm md:text-base font-bold text-pool-deep shadow-lg transition hover:-translate-y-1 hover:bg-pool-mist"
              >
                Consultar produtos
                <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
              </a>
            </div>
          </article>

          {/* Cards laterais */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-5">
            {productCards.map((product, i) => {
              const Icon = product.icon;
              const isLast = i === productCards.length - 1 && productCards.length % 2 === 1;

              return (
                <article
                  key={product.title}
                  className={`group grid content-start lg:content-stretch overflow-hidden rounded-3xl lg:rounded-[26px] border border-white/90 bg-white/90 shadow-[0_22px_60px_-35px_rgba(2,132,199,0.5)] backdrop-blur-sm transition duration-500 hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_rgba(2,132,199,0.6)] lg:grid-cols-[180px_1fr] ${
                    isLast ? "col-span-2 grid-cols-[110px_1fr]" : ""
                  }`}
                >
                  <div className="relative h-24 overflow-hidden lg:h-auto lg:min-h-full">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5" />
                  </div>

                  <div className={`flex flex-col p-3 lg:justify-center lg:p-6 ${isLast ? "justify-center" : ""}`}>
                    <div className="mb-2 lg:mb-4 grid h-8 w-8 lg:h-11 lg:w-11 place-items-center rounded-xl lg:rounded-2xl bg-gradient-pool text-white shadow-pool transition duration-500 group-hover:rotate-3 group-hover:scale-105">
                      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                    </div>

                    <h3 className="text-sm lg:text-xl font-extrabold tracking-[-0.025em] text-slate-950">
                      {product.title}
                    </h3>

                    <p className="mt-1 lg:mt-2 text-xs lg:text-sm leading-5 lg:leading-6 text-slate-600">
                      {product.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* CTA mobile/apoio */}
        <div className="mt-6 md:mt-8 flex justify-center lg:hidden">
          <a
            href={createWhatsAppLink(
              "Olá! 👋 Vim pelo site da Tchê Piscinas e gostaria de conhecer os produtos e equipamentos disponíveis. Podem me ajudar?",
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 md:h-13 items-center justify-center gap-2 rounded-full bg-pool-deep px-6 md:px-7 text-sm md:text-base font-bold text-white shadow-lg shadow-pool-deep/20 transition hover:-translate-y-1 hover:bg-pool"
          >
            Consultar produtos
            <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
          </a>
        </div>
      </div>
    </section>
  );
}
