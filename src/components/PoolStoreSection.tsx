import * as React from "react";
import {
  ArrowRight,
  FlaskConical,
  LifeBuoy,
  Settings,
  ShieldCheck,
} from "lucide-react";
import productSuallKit from "@/assets/product-suall-kit.jpg";
import productPraticPool from "@/assets/product-pratic-pool.jpg";
import equipmentSyllent from "@/assets/equipment-syllent.jpg";
import problemCleaning from "@/assets/problem-cleaning.jpg";

const WHATSAPP = "https://wa.me/5551991757029";
const waLink = (msg: string) => `${WHATSAPP}?text=${encodeURIComponent(msg)}`;

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
    <section id="produtos" className="bg-[#eef9ff] px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto w-full max-w-7xl">
        {/* Cabeçalho */}
        <header className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-pool">
            <span className="h-px w-8 bg-pool-light" />
            Loja Tchê
            <span className="h-px w-8 bg-pool-light" />
          </div>

          <h2 className="text-balance text-3xl font-extrabold leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-5xl">
            Os melhores produtos e{" "}
            <span className="text-gradient-pool">equipamentos do mercado</span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Precisa de algum equipamento especial ou produto de qualidade? A
            gente também fornece, com orientação de quem entende do assunto.
          </p>
        </header>

        {/* Composição principal */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          {/* Destaque institucional */}
          <article className="group relative min-h-[520px] overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 shadow-[0_30px_80px_-35px_rgba(2,132,199,0.5)]">
            <img
              src={productSuallKit}
              alt="Profissional apresentando produtos e kits para piscina"
              className="absolute inset-0 h-full w-full object-cover object-top transition duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                <ShieldCheck className="h-4 w-4" />
                Produtos selecionados
              </div>

              <h3 className="max-w-xl text-3xl font-extrabold leading-tight tracking-[-0.03em] text-white sm:text-4xl">
                Tudo o que você precisa para cuidar melhor da sua piscina.
              </h3>

              <p className="mt-4 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
                Trabalhamos com produtos, equipamentos e kits completos para
                facilitar a manutenção e garantir mais segurança no tratamento.
              </p>

              <a
                href={waLink("Olá! Gostaria de consultar produtos para minha piscina.")}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-13 items-center justify-center gap-2 rounded-full bg-white px-6 font-bold text-pool-deep shadow-lg transition hover:-translate-y-1 hover:bg-pool-mist"
              >
                Consultar produtos
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </article>

          {/* Cards laterais */}
          <div className="grid gap-5">
            {productCards.map((product) => {
              const Icon = product.icon;

              return (
                <article
                  key={product.title}
                  className="group grid min-h-[155px] overflow-hidden rounded-[26px] border border-white/90 bg-white/90 shadow-[0_22px_60px_-35px_rgba(2,132,199,0.5)] backdrop-blur-sm transition duration-500 hover:-translate-y-1 hover:shadow-[0_28px_70px_-30px_rgba(2,132,199,0.6)] sm:grid-cols-[180px_1fr]"
                >
                  <div className="relative min-h-[190px] overflow-hidden sm:min-h-full">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5" />
                  </div>

                  <div className="flex flex-col justify-center p-6">
                    <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-pool text-white shadow-pool transition duration-500 group-hover:rotate-3 group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>

                    <h3 className="text-xl font-extrabold tracking-[-0.025em] text-slate-950">
                      {product.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {product.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* CTA mobile/apoio */}
        <div className="mt-8 flex justify-center lg:hidden">
          <a
            href={waLink("Olá! Gostaria de consultar produtos para minha piscina.")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-pool-deep px-7 font-bold text-white shadow-lg shadow-pool-deep/20 transition hover:-translate-y-1 hover:bg-pool"
          >
            Consultar produtos
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </div>
    </section>
  );
}
