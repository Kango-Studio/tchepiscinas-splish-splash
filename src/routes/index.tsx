import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SITE_URL } from "./__root";
import {
  Droplets,
  Waves,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Star,
  MapPin,
  Instagram,
  Mail,
  Phone,
  Sun,
  Users,
  Award,
  Calendar,
  ArrowRight,
  Heart,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { PoolStoreSection } from "@/components/PoolStoreSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import heroPool from "@/assets/hero-pool.jpg";
import logo from "@/assets/logo.png";
import suallLogo from "@/assets/suall.png";
import syllentLogo from "@/assets/syllent.png";
import teamGroup from "@/assets/team-group.jpg";
import teamAction from "@/assets/team-action.jpg";
import condoPoolArena from "@/assets/condo-pool-arena.jpg";
import condoPool1 from "@/assets/condo-pool-1.jpg";
import condoPool2 from "@/assets/condo-pool-2.jpg";
import condoPool3 from "@/assets/condo-pool-3.jpg";
import condoPool4 from "@/assets/condo-pool-4.jpg";
import residentialPool1 from "@/assets/residential-pool-1.jpg";
import residentialPool2 from "@/assets/residential-pool-2.jpg";
import residentialPool3 from "@/assets/residential-pool-3.jpg";

const LOCAL_BUSINESS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: "Tchê Piscinas",
  image: `${SITE_URL}/og-image.jpg`,
  url: `${SITE_URL}/`,
  telephone: "+55-51-99175-7029",
  email: "contato@tchepiscinas.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Porto Alegre",
    addressRegion: "RS",
    addressCountry: "BR",
  },
  areaServed: [
    "Porto Alegre",
    "Viamão",
    "Gravataí",
    "Região Metropolitana de Porto Alegre",
  ],
  sameAs: ["https://instagram.com/tchepiscina"],
  description:
    "Manutenção, limpeza e tratamento de piscinas residenciais e de condomínios em Porto Alegre e região metropolitana.",
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "Tchê Piscinas | Manutenção e Limpeza de Piscinas em Porto Alegre",
      },
      {
        name: "description",
        content:
          "Manutenção, limpeza e tratamento de piscinas residenciais e de condomínios em Porto Alegre e região metropolitana. Equipe própria, produtos profissionais e avaliação gratuita de maquinário. Peça um orçamento pelo WhatsApp.",
      },
      {
        property: "og:title",
        content: "Tchê Piscinas | Piscina cristalina o verão inteiro",
      },
      {
        property: "og:description",
        content:
          "Planos residenciais, condomínios e produtos para piscina. Atendimento em Porto Alegre e região.",
      },
      {
        name: "twitter:title",
        content: "Tchê Piscinas | Piscina cristalina o verão inteiro",
      },
      {
        name: "twitter:description",
        content:
          "Manutenção, limpeza e tratamento de piscinas residenciais e de condomínios em Porto Alegre e região.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(LOCAL_BUSINESS_JSON_LD),
      },
    ],
  }),
  component: LandingPage,
});

const WHATSAPP = "https://wa.me/5551991757029";
const waLink = (msg: string) =>
  `${WHATSAPP}?text=${encodeURIComponent(msg)}`;

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function LandingPage() {
  useReveal();
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Header />
      <Hero />
      <ComparisonSection />
      <Plans />
      <HowItWorks />
      <div className="h-6 md:h-10 bg-gradient-to-b from-white to-[#eef9ff]" aria-hidden />
      <SocialProof />
      <PoolStoreSection />
      <div className="h-6 md:h-8 bg-gradient-to-b from-[#eef9ff] to-white" aria-hidden />
      <Sponsors />
      <Team />
      <Differentials />
      <FinalCTA />
      <FAQ />
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}

/* ----------------------------- HEADER ----------------------------- */
const NAV_LINKS = [
  { href: "#planos", label: "Planos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#produtos", label: "Produtos" },
  { href: "#avaliacoes", label: "Avaliações" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 animate-nav-enter transition-all duration-300 ${
        scrolled
          ? "bg-white/85 backdrop-blur-md shadow-[0_10px_30px_-18px_rgba(0,90,148,0.35)] border-b border-border/50"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div
        className={`mx-auto max-w-[1200px] px-6 md:px-8 grid grid-cols-[auto_1fr_auto] items-center gap-6 transition-[padding] duration-300 ${
          scrolled ? "py-2 md:py-2.5" : "py-3 md:py-4"
        }`}
      >
        <a href="#top" className="flex items-center gap-2 min-w-0">
          <img
            src={logo}
            alt="Tchê Piscinas"
            className={`h-14 md:h-16 w-auto shrink-0 transition-all duration-300 ${
              scrolled ? "" : "[filter:drop-shadow(0_0_3px_rgba(255,255,255,0.9))_drop-shadow(0_0_8px_rgba(255,255,255,0.55))]"
            }`}
          />
        </a>

        <nav className="hidden md:flex items-center justify-center gap-8 text-sm font-medium">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`relative pb-1 transition-colors duration-300 after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-0 after:transition-all after:duration-300 hover:after:w-full ${
                scrolled
                  ? "text-slate-600 hover:text-pool-deep after:bg-pool-deep"
                  : "text-white/90 hover:text-white after:bg-white"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href={waLink("Olá! Quero solicitar um orçamento com a Tchê Piscinas.")}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex justify-self-end items-center gap-2 bg-gradient-sun text-foreground font-bold px-6 py-3 rounded-full shadow-sun hover:shadow-[0_16px_32px_-10px_rgba(255,193,7,0.55)] hover:-translate-y-0.5 transition-all duration-300 text-sm whitespace-nowrap"
        >
          <WhatsappIcon className="size-4" />
          Solicitar orçamento
        </a>
      </div>
    </header>
  );
}

/* ------------------------------ HERO ------------------------------ */
function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-pool" />
      <div className="absolute inset-0 opacity-30 mix-blend-overlay">
        <img
          src={heroPool}
          alt=""
          className="w-full h-full object-cover"
          width={1600}
          height={1200}
        />
      </div>
      {/* Decorative wave bottom */}
      <svg
        className="absolute bottom-0 left-0 w-full text-background"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M0,64L80,58.7C160,53,320,43,480,48C640,53,800,75,960,74.7C1120,75,1280,53,1360,42.7L1440,32L1440,100L0,100Z"
        />
      </svg>

      <div className="relative mx-auto max-w-310 px-4 sm:px-6 pt-24 pb-14 md:pt-25 md:pb-35 grid lg:grid-cols-[1.1fr_0.9fr] gap-6 md:gap-10 items-center">
        <div className="text-white animate-rise">
          <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-4 md:mb-5 ring-1 ring-white/20">
            <Sun className="size-3.5 text-sun" />
            Porto Alegre e região metropolitana
          </span>
          <h1 className="text-[28px] leading-[1.15] md:text-5xl md:leading-[1.05] lg:text-6xl font-extrabold mb-4 md:mb-5">
            Sua piscina sempre <span className="text-sun">limpa, tratada e pronta pra usar.</span>
          </h1>
          <p className="text-base md:text-xl text-white/90 mb-6 md:mb-8 max-w-xl">
            Enquanto tu descansa, a gente cuida da tua piscina com
            limpeza, manutenção e produtos, tudo incluso.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={waLink("Olá! Quero falar com um especialista da Tchê Piscinas.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-gradient-sun text-foreground font-bold px-[22px] py-3 text-[15px] md:px-6 md:py-4 md:text-base rounded-full shadow-sun hover:scale-[1.03] transition-transform"
            >
              <WhatsappIcon className="size-4 md:size-5" />
              Fale com um especialista agora
            </a>
          </div>

          <div className="mt-4 md:mt-5 flex items-center gap-2 text-sm text-white/80">
            <CheckCircle2 className="size-4 text-sun" /> Resposta rápida no WhatsApp
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="relative rounded-[2rem] overflow-hidden shadow-pool ring-4 ring-white/40 animate-float">
            <img
              src={heroPool}
              alt="Piscina cristalina com água azul"
              className="w-full h-[440px] object-cover"
              width={1600}
              height={1200}
            />
          </div>
          <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-pool p-4 flex items-center gap-3 ring-1 ring-border">
            <div className="bg-pool-mist rounded-xl p-2">
              <Droplets className="size-6 text-pool-deep" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cloro & pH</div>
              <div className="font-bold text-pool-deep inline-flex items-center gap-1">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
          </div>
          <div className="absolute -top-4 -right-4 bg-sun rounded-2xl shadow-sun p-3 rotate-6">
            <Sun className="size-8 text-foreground" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------- HOW IT WORKS ------------------------- */
function HowItWorks() {
  const steps = [
    {
      icon: Calendar,
      title: "Escolha o plano ideal",
      text: "Conte para a gente o tamanho da sua piscina e a frequência que precisa. Nossa equipe indica a melhor opção.",
      tags: ["Agendamento rápido"],
      img: heroPool,
      alt: "Atendimento e agendamento da visita técnica",
    },
    {
      icon: Droplets,
      title: "Nós cuidamos de tudo",
      text: "Realizamos limpeza, aspiração, tratamento químico e revisão dos equipamentos em visitas programadas.",
      tags: ["Produtos profissionais", "Técnicos especializados", "Relatório mensal"],
      img: condoPoolArena,
      alt: "Piscina de condomínio com vista para a arena, água cristalina ao entardecer",
    },
    {
      icon: Waves,
      title: "Aproveite sem preocupação",
      text: "Sua piscina fica cristalina e pronta para você curtir com a família durante toda a semana.",
      tags: ["Piscina sempre pronta"],
      img: heroPool,
      alt: "Piscina cristalina pronta para a família aproveitar",
    },
  ];

  return (
    <section id="como-funciona" className="pt-10 pb-12 md:pt-12 md:pb-17 bg-white">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-8 md:mb-10 reveal">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-pool">Processo simples</span>
          <h2 className="text-2xl md:text-4xl font-extrabold mt-2 md:mt-3 mb-3 md:mb-4">
            Da contratação ao <span className="text-gradient-pool">primeiro mergulho</span>.
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Em três etapas, você deixa toda a manutenção com a nossa equipe e aproveita uma piscina sempre
            limpa, segura e pronta para uso.
          </p>
        </div>

        {/* Desktop horizontal connector */}
        <div className="timeline-wrap reveal hidden lg:grid grid-cols-3 relative mb-6" aria-hidden>
          <div className="absolute top-7 left-[16.6%] right-[16.6%] h-[3px] rounded-full bg-pool-mist overflow-visible">
            <div className="timeline-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pool-deep via-pool to-pool-light" />
            <span className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 size-1.5 rounded-full bg-white shadow-[0_0_8px_3px_rgba(79,195,247,0.7)]" />
            <span className="absolute top-1/2 left-3/4 -translate-x-1/2 -translate-y-1/2 size-1.5 rounded-full bg-white shadow-[0_0_8px_3px_rgba(79,195,247,0.7)]" />
          </div>
          {steps.map((_, i) => (
            <div key={i} className="relative z-10 flex justify-center">
              <div className="size-14 rounded-full bg-gradient-pool text-white font-extrabold flex items-center justify-center shadow-pool ring-[6px] ring-pool-light/20 ring-offset-4 ring-offset-background">
                0{i + 1}
              </div>
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {/* Mobile vertical connector */}
          <div
            className="absolute sm:hidden left-1/2 -translate-x-1/2 top-6 bottom-6 w-[3px] rounded-full bg-gradient-to-b from-pool-deep via-pool to-pool-light/50 opacity-60"
            aria-hidden
          />
          {steps.map((s, i) => (
            <div
              key={i}
              className={`reveal relative ${i === 2 ? "sm:col-span-2 sm:max-w-md sm:mx-auto lg:max-w-none lg:col-span-1" : ""}`}
              style={{ transitionDelay: `${i * 130}ms` }}
            >
              <div className="absolute -top-5 md:-top-6 left-1/2 -translate-x-1/2 z-20 lg:hidden">
                <div className="size-9 md:size-12 rounded-full bg-gradient-pool text-white font-extrabold flex items-center justify-center shadow-pool ring-[3px] md:ring-[5px] ring-pool-light/20 ring-offset-4 ring-offset-background text-sm md:text-base">
                  0{i + 1}
                </div>
              </div>

              <div className="group relative flex flex-col min-h-0 md:min-h-[450px] rounded-[20px] md:rounded-[28px] bg-white border border-pool-light/25 shadow-[0_25px_50px_-25px_rgba(0,90,148,0.28)] hover:-translate-y-1.5 transition-all duration-300 overflow-hidden pt-7 md:pt-10">
                <div className="flex-1 flex flex-col px-5 md:px-7 pb-4 md:pb-5">
                  <div className="inline-flex items-center justify-center size-9 md:size-11 rounded-xl md:rounded-2xl bg-pool-mist text-pool-deep mb-3 md:mb-4">
                    <s.icon className="size-4 md:size-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-bold text-base md:text-xl mb-1.5 md:mb-2 text-pool-deep">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3 md:mt-4">
                    {s.tags.map((tag, ti) => (
                      <span
                        key={ti}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold bg-pool-mist text-pool-deep rounded-full px-2.5 py-1"
                      >
                        <CheckCircle2 className="size-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className={`relative mt-auto overflow-hidden rounded-b-[20px] md:rounded-b-[28px] ${
                    i === 1 ? "h-32 md:h-44" : "h-28 md:h-[150px] lg:h-[165px]"
                  }`}
                >
                  <svg
                    className="absolute -top-px left-0 w-full h-8 z-10 text-white"
                    viewBox="0 0 400 32"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M0,16 C50,32 150,0 200,12 C250,24 350,0 400,14 L400,0 L0,0 Z"
                    />
                  </svg>
                  <img
                    src={s.img}
                    alt={s.alt}
                    loading="lazy"
                    width={800}
                    height={500}
                    className={
                      i === 1
                        ? "absolute inset-0 h-full w-full object-cover object-center"
                        : "w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
                    }
                  />
                  <div
                    className={`absolute inset-0 ${
                      i === 1
                        ? "bg-gradient-to-t from-sky-900/10 to-transparent"
                        : "bg-gradient-to-t from-pool-deep/50 via-pool-deep/10 to-transparent"
                    }`}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ PLANS ---------------------------- */
function Plans() {
  const plans = [
    {
      name: "Residencial",
      audience: "Pra quem quer só aproveitar a piscina",
      features: [
        "Água sempre segura para banho, sem tu precisar entender de química",
        "Piscina limpa toda semana, sem esforço nenhum teu",
        "Equipamentos revisados a cada visita pelo nosso técnico",
        "Tu sabe exatamente o que foi feito em cada visita, sem precisar perguntar",
      ],
      cta: "Quero esse plano",
      highlight: true,
    },
    {
      name: "Condomínios",
      audience: "Área comum sem virar dor de cabeça pro síndico",
      features: [
        "Equipe fixa, sempre a mesma, cuidando do espaço do prédio",
        "Laudo e relatório prontos pra qualquer reunião de condomínio",
        "Atendimento de emergência sem depender de \"ver se alguém pode ir\"",
        "Normas em dia, sem o síndico ter que correr atrás",
      ],
      cta: "Quero atender meu condomínio",
      highlight: false,
    },
    {
      name: "Manutenções",
      audience: "Reparo pontual, sem contrato mensal",
      features: [
        "Diagnóstico técnico direto na causa do problema",
        "Orçamento gratuito, fechado antes de começar qualquer serviço",
        "Reparo do equipamento diretamente com o nosso técnico",
      ],
      cta: "Quero um orçamento",
      highlight: false,
    },
  ];
  return (
    <section id="planos" className="pt-10 pb-12 md:pt-12 md:pb-17 bg-white">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-6 md:mb-8 reveal">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-pool">Modalidades de Atendimento</span>
          <h2 className="text-2xl md:text-4xl font-extrabold mt-2 md:mt-3 mb-3 md:mb-4">
            Modalidades pensadas para piscinas <span className="text-gradient-pool">residenciais e condomínios</span>!
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6 items-stretch">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`reveal relative rounded-2xl md:rounded-3xl p-5 md:p-7 flex flex-col border transition-all ${
                p.highlight
                  ? "bg-gradient-pool text-white border-transparent shadow-pool scale-[1.02] md:-translate-y-3"
                  : "bg-card border-border hover:shadow-pool"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-2.5 md:-top-3 left-1/2 -translate-x-1/2 bg-gradient-sun text-foreground text-[11px] md:text-xs font-bold px-3 md:px-4 py-1 rounded-full shadow-sun uppercase tracking-wider">
                  Mais popular
                </span>
              )}
              <h3 className={`text-xl md:text-2xl font-extrabold ${p.highlight ? "text-white" : "text-pool-deep"}`}>
                {p.name}
              </h3>
              <p className={`text-sm mt-1 mb-4 md:mb-6 ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>
                {p.audience}
              </p>
              <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6 flex-1">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={`size-4 md:size-5 shrink-0 mt-0.5 ${p.highlight ? "text-sun" : "text-pool"}`} />
                    <span className={p.highlight ? "text-white/95" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={waLink(`Olá! Quero saber mais sobre o plano ${p.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-full py-2.5 md:py-3 text-[15px] md:text-base font-bold transition-transform hover:scale-[1.02] ${
                  p.highlight
                    ? "bg-gradient-sun text-foreground shadow-sun"
                    : "bg-pool-deep text-white hover:bg-pool"
                }`}
              >
                <WhatsappIcon className="size-4" />
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- SOCIAL PROOF ------------------------- */
function SocialProof() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const stats = [
    { n: "4+", t: "anos de experiência" },
    { n: "500+", t: "piscinas atendidas" },
    { n: "2h", t: "resposta no WhatsApp" },
    { n: "4.7", t: "satisfação dos clientes", icon: Star },
  ];
  const poolPhotos = [
    { img: residentialPool1, alt: "Banheira de hidromassagem residencial com água tratada e cristalina" },
    { img: condoPool1, alt: "Piscina de condomínio com vista para a arena, água cristalina ao entardecer" },
    { img: residentialPool2, alt: "Piscina residencial de fibra azul com deck de madeira" },
    { img: condoPool2, alt: "Piscina infantil de condomínio com escorregador em formato de sapo" },
    { img: residentialPool3, alt: "Piscina residencial com parede de pedra e jardim ao redor" },
    { img: condoPool3, alt: "Piscinas de fibra em área comum de condomínio residencial" },
    { img: condoPool4, alt: "Piscina coberta de condomínio com raia e vista para a cidade" },
  ];
  return (
    <section id="avaliacoes" className="pt-8 pb-10 md:pt-10 md:pb-15 bg-[#eef9ff]">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        <div className="text-center mb-5 md:mb-6 reveal">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-pool">Quem confia na Tchê Piscinas não larga</span>
        </div>
        <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-14">
          {stats.map((s, i) => (
            <div key={i} className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 text-center border border-border">
              <div className="text-2xl md:text-4xl font-extrabold text-gradient-pool inline-flex items-center justify-center gap-1">
                {s.n}
                {s.icon && <s.icon className="size-5 md:size-7 fill-current" />}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{s.t}</div>
            </div>
          ))}
        </div>

        <div className="text-center mb-5 md:mb-6 reveal">
          <h2 className="text-2xl md:text-4xl font-extrabold">
            Piscinas que a <span className="text-gradient-pool">Tchê cuida</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">Fotos reais de trabalhos residenciais e em condomínios de Porto Alegre e região.</p>
        </div>
        <div className="reveal">
          <Carousel
            setApi={setApi}
            opts={{ align: "start", loop: true }}
            className="px-1"
          >
            <CarouselContent className="-ml-3 md:-ml-5">
              {poolPhotos.map((p, i) => (
                <CarouselItem key={i} className="pl-3 md:pl-5 basis-[68%] sm:basis-1/2 lg:basis-1/3">
                  <div className="overflow-hidden rounded-xl md:rounded-2xl border border-border shadow-sm aspect-[3/4]">
                    <img
                      src={p.img}
                      alt={p.alt}
                      loading="lazy"
                      width={720}
                      height={960}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <div className="flex items-center justify-center gap-4 mt-6 md:mt-8">
              <CarouselPrevious className="static size-9 translate-y-0 border-border bg-card text-pool-deep hover:bg-pool-mist hover:text-pool-deep" />
              <div className="flex items-center gap-1.5">
                {Array.from({ length: count }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ir para depoimento ${i + 1}`}
                    onClick={() => api?.scrollTo(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === current ? "w-5 bg-pool-deep" : "w-1.5 bg-pool-light/40"
                    }`}
                  />
                ))}
              </div>
              <CarouselNext className="static size-9 translate-y-0 border-border bg-card text-pool-deep hover:bg-pool-mist hover:text-pool-deep" />
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ TEAM ------------------------------- */
function Team() {
  return (
    <section id="equipe" className="pt-8 pb-8 md:pt-9 md:pb-14 bg-white">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-6 md:gap-12 lg:gap-16 items-center">
          <div className="reveal text-center lg:text-left">
            <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-pool">Quem cuida da tua piscina</span>
            <h2 className="text-2xl md:text-4xl font-extrabold mt-2 md:mt-3 mb-3 md:mb-4">
              Equipe <span className="text-gradient-pool">altamente especializada</span>
            </h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Trabalhamos com equipe própria, treinada e comprometida prontos para te atender do melhor jeito!
            </p>
          </div>
          <div className="reveal relative mx-auto max-w-md lg:max-w-none">
            <div className="relative rounded-[1.25rem] md:rounded-[2rem] overflow-hidden shadow-pool ring-2 md:ring-4 ring-pool-mist">
              <img
                src={teamGroup}
                alt="Equipe da Tchê Piscinas reunida em atendimento a um condomínio"
                loading="lazy"
                className="w-full h-[220px] md:h-[440px] object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -left-3 md:-bottom-8 md:-left-10 w-24 md:w-44 rounded-xl md:rounded-2xl overflow-hidden shadow-pool ring-2 md:ring-4 ring-white">
              <img
                src={teamAction}
                alt="Técnico da Tchê Piscinas avaliando piscina com água esverdeada antes do tratamento"
                loading="lazy"
                className="w-full h-20 md:h-48 object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------- DIFFERENTIALS ------------------------ */
function Differentials() {
  const items = [
    { icon: Users, t: "Equipe própria e treinada", d: "Nada de terceirizados, treinamos a nossa própria equipe." },
    { icon: WhatsappIcon, t: "Atendimento rápido no WhatsApp", d: "Tu fala com gente de verdade, não com robô." },
    { icon: ShieldCheck, t: "Transparência total", d: "Relatório em cada visita, sem surpresa na conta." },
    { icon: Award, t: "Produtos de qualidade", d: "Somos patrocinados pela Syllent e Suall as melhores marcas do mercado." },
    { icon: MapPin, t: "Múltiplas cidades atendidas", d: "Porto Alegre, Viamão, Gravataí e demais regiões metropolitanas." },
    { icon: Waves, t: "Anos de experiência", d: "Cuidando de piscinas de todos os tipos, tamanhos e formas." },
  ];
  return (
    <section className="pt-8 pb-8 md:pt-9 md:pb-14 bg-white">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-6 md:mb-8 reveal">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-pool">Por que a Tchê</span>
          <h2 className="text-2xl md:text-4xl font-extrabold mt-2 md:mt-3">
            A Tchê vai além de <span className="text-gradient-pool"> só passar a rede na tua piscina</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {items.map((it, i) => (
            <div key={i} className="reveal flex flex-col md:flex-row gap-2 md:gap-4 bg-card rounded-xl md:rounded-2xl p-4 md:p-6 border border-border hover:shadow-pool transition-shadow">
              <div className="shrink-0 size-9 md:size-12 rounded-lg md:rounded-xl bg-pool-mist text-pool-deep flex items-center justify-center">
                <it.icon className="size-4 md:size-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm md:text-base mb-0.5 md:mb-1">{it.t}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">{it.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- FAQ ----------------------------- */
function FAQ() {
  const qs = [
    { q: "Como funciona o plano de manutenção?", a: "Tanto os planos residenciais quanto os de condomínio são planos de atendimento mensal, com visitas recorrentes pra manter a piscina sempre limpa — incluindo os produtos que usamos, fornecidos pela Tchê." },
    { q: "Preciso ficar em casa durante o atendimento?", a: "Não! Mas se tu quiser acompanhar, não tem problema nenhum." },
    { q: "Vocês atendem minha cidade?", a: "Atendemos Porto Alegre e região metropolitana." },
    { q: "Não quero plano fixo, dá pra chamar só uma vez?", a: "Depende do serviço. Limpeza da piscina só fazemos dentro dos planos. Já reparo e conserto de equipamento (manutenção) tu pode chamar a qualquer momento, sem precisar de plano." },
  ];
  return (
    <section id="faq" className="pt-8 pb-7 md:pt-9 md:pb-13 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-6 md:mb-8 reveal">
          <span className="text-xs md:text-sm font-bold uppercase tracking-wider text-pool">Dúvidas frequentes</span>
          <h2 className="text-2xl md:text-4xl font-extrabold mt-2 md:mt-3">
            Tudo o que tu quer saber antes de decidir
          </h2>
        </div>
        <Accordion type="single" collapsible className="reveal space-y-2 md:space-y-3">
          {qs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="bg-card rounded-xl md:rounded-2xl border border-border px-4 md:px-5"
            >
              <AccordionTrigger className="text-left text-sm md:text-base font-semibold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ---------------------------- SPONSORS ---------------------------- */
function Sponsors() {
  const sponsors = [
    { name: "SUALL PISCINAS", role: "Parceira técnica", img: suallLogo },
    { name: "SYLLENT BRASIL", role: "Patrocinadora oficial", img: syllentLogo },
  ];
  const track = [...sponsors, ...sponsors, ...sponsors, ...sponsors];
  return (
    <section id="patrocinadores" className="pt-7 pb-8 md:pt-8 md:pb-14 bg-white">
      <div className="mx-auto max-w-310 px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-5 md:mb-6 reveal">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-2 md:mb-3">
            Nossos <span className="text-gradient-pool">parceiros</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Contamos com o apoio de empresas sérias que fortalecem nossa qualidade e confiança.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden group [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max gap-4 md:gap-6 animate-marquee group-hover:[animation-play-state:paused]">
          {track.map((s, i) => (
            <div
              key={i}
              className="w-48 md:w-64 shrink-0 bg-card rounded-xl md:rounded-2xl px-5 md:px-8 py-5 md:py-8 border border-border flex flex-col items-center justify-center text-center hover:border-pool-light hover:shadow-pool transition-all"
            >
              <img
                src={s.img}
                alt={`Logo ${s.name}`}
                loading="lazy"
                className="h-14 md:h-20 w-auto object-contain mb-2 md:mb-4"
              />
              <h3 className="text-sm md:text-base font-extrabold text-pool-deep tracking-tight">{s.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{s.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


/* ----------------------------- FINAL CTA -------------------------- */
function FinalCTA() {
  return (
    <section className="relative py-10 md:py-14 overflow-hidden bg-gradient-pool text-white">
      <svg
        className="absolute top-0 left-0 w-full text-pool-deep rotate-180"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path fill="currentColor" d="M0,64L80,58.7C160,53,320,43,480,48C640,53,800,75,960,74.7C1120,75,1280,53,1360,42.7L1440,32L1440,100L0,100Z" />
      </svg>
      <svg
        className="absolute bottom-0 left-0 w-full text-white"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path fill="currentColor" d="M0,64L80,58.7C160,53,320,43,480,48C640,53,800,75,960,74.7C1120,75,1280,53,1360,42.7L1440,32L1440,100L0,100Z" />
      </svg>
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center reveal">
        <span className="inline-flex items-center gap-2 bg-sun text-foreground px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider mb-4 md:mb-5 shadow-sun">
          <Sun className="size-3.5" /> O verão está chegando · Vagas limitadas na agenda
        </span>
        <h2 className="text-[26px] md:text-5xl font-extrabold mb-3 md:mb-5 leading-tight">
          Para de perder fim de semana com a piscina.
        </h2>
        <p className="text-sm md:text-lg text-white/90 mb-5 md:mb-8 max-w-xl mx-auto">
          Fala agora com um especialista da Tchê Piscinas e garante tua
          vaga na agenda antes que o calor aperte.
        </p>
        <a
          href={waLink("Olá! Quero garantir minha vaga na agenda da Tchê Piscinas.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-gradient-sun text-foreground font-extrabold text-[15px] md:text-lg px-6 py-3.5 md:px-8 md:py-5 rounded-full shadow-sun hover:scale-[1.03] transition-transform"
        >
          <WhatsappIcon className="size-5 md:size-6" />
          Quero minha piscina cristalina
          <ArrowRight className="size-4 md:size-5" />
        </a>
      </div>
    </section>
  );
}

/* ------------------------------ FOOTER ---------------------------- */
function Footer() {
  return (
    <footer className="bg-white text-foreground py-8 md:py-10 border-t border-border">
      <div className="mx-auto max-w-310 px-4 sm:px-6 grid md:grid-cols-3 gap-6 md:gap-8">
        <div>
          <img src={logo} alt="Tchê Piscinas" className="h-12 md:h-16 w-auto mb-3 md:mb-4" />
          <p className="text-sm max-w-xs text-muted-foreground">
            Manutenção, limpeza e produtos para piscinas. Água cristalina o ano
            todo, com quem entende de verdade.
          </p>
        </div>
        <div>
          <h4 className="text-pool-deep font-bold mb-3 md:mb-4">Contato</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <a href="https://wa.me/5551991757029" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-pool-deep transition-colors">
                <Phone className="size-4" /> (51) 99175-7029
              </a>
            </li>
            <li>
              <a href="mailto:contato@tchepiscinas.com" className="inline-flex items-center gap-2 text-muted-foreground hover:text-pool-deep transition-colors">
                <Mail className="size-4" /> contato@tchepiscinas.com
              </a>
            </li>
            <li>
              <a href="https://instagram.com/tchepiscina" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-pool-deep transition-colors">
                <Instagram className="size-4" /> @tchepiscina
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-pool-deep font-bold mb-4">Área de atendimento</h4>
          <p className="text-sm inline-flex items-start gap-2 text-muted-foreground">
            <MapPin className="size-4 mt-0.5 shrink-0 text-pool" />
            Porto Alegre/RS e cidades da região metropolitana.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-310 px-4 sm:px-6 mt-10 pt-6 border-t border-border text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
        <span>© {new Date().getFullYear()} Tchê Piscinas — Todos os direitos reservados.</span>
        <span className="inline-flex items-center gap-1.5">
          Feito com <Heart className="size-3.5 text-sun fill-current" /> em Porto Alegre
        </span>
      </div>
    </footer>
  );
}

/* ------------------------ FLOATING WHATSAPP ---------------------- */
function FloatingWhatsApp() {
  return (
    <a
      href={waLink("Olá! Vim pelo site da Tchê Piscinas.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-50 size-12 md:size-14 rounded-full bg-whatsapp text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
    >
      <span className="absolute inset-0 rounded-full bg-whatsapp animate-ripple" />
      <WhatsappIcon className="size-6 md:size-7 relative" />
    </a>
  );
}
