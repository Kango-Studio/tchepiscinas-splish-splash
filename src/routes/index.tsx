import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Droplets,
  Waves,
  AlertTriangle,
  Wrench,
  Clock,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Star,
  MapPin,
  Instagram,
  Mail,
  Phone,
  FlaskConical,
  Cog,
  LifeBuoy,
  Sun,
  Users,
  Award,
  Percent,
  Zap,
  Calendar,
  ArrowRight,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroPool from "@/assets/hero-pool.jpg";
import logo from "@/assets/logo.png";

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
          "Planos de manutenção, produtos e avaliação gratuita de maquinário. Piscina cristalina o verão inteiro em Porto Alegre e região.",
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
      <Problems />
      <HowItWorks />
      <Plans />
      <FreeEvaluation />
      <Products />
      <LoyaltyBenefit />
      <SocialProof />
      <Team />
      <Differentials />
      <FAQ />
      <Sponsors />
      <FinalCTA />
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}

/* ----------------------------- HEADER ----------------------------- */
function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2 min-w-0">
          <img
            src={logo}
            alt="Tchê Piscinas"
            className="h-10 w-auto shrink-0"
          />
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a href="#planos" className="hover:text-pool-deep transition-colors">Planos</a>
          <a href="#avaliacao" className="hover:text-pool-deep transition-colors">Avaliação Grátis</a>
          <a href="#produtos" className="hover:text-pool-deep transition-colors">Produtos</a>
          <a href="#faq" className="hover:text-pool-deep transition-colors">FAQ</a>
        </nav>
        <a
          href={waLink("Olá! Vim pelo site e quero falar com um especialista.")}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-2 bg-gradient-sun text-foreground font-semibold px-4 py-2 rounded-full shadow-sun hover:scale-105 transition-transform text-sm"
        >
          <MessageCircle className="size-4" />
          Fale conosco
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

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-32 sm:pt-24 sm:pb-40 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="text-white animate-rise">
          <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-5 ring-1 ring-white/20">
            <Sun className="size-3.5 text-sun" />
            Porto Alegre e Região
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-5">
            Sua piscina{" "}
            <span className="text-sun">verde ou suja</span> está roubando o seu verão.
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-xl">
            A gente cuida de tudo — química, limpeza, equipamentos e produtos —
            para você só chegar em casa e mergulhar em água{" "}
            <strong className="text-white">cristalina</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={waLink("Olá! Quero falar com um especialista da Tchê Piscinas.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-gradient-sun text-foreground font-bold px-6 py-4 rounded-full shadow-sun hover:scale-[1.03] transition-transform"
            >
              <MessageCircle className="size-5" />
              Fale com um especialista agora
            </a>
            <a
              href="#planos"
              className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur text-white font-semibold px-6 py-4 rounded-full ring-1 ring-white/30 hover:bg-white/20 transition-colors"
            >
              Ver planos de atendimento
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-white/80">
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-sun" /> Equipe própria</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-sun" /> Atendimento rápido</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-sun" /> Sem letras miúdas</span>
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
              <div className="font-bold text-pool-deep">Ideais ✓</div>
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

/* --------------------------- PROBLEMS --------------------------- */
function Problems() {
  const items = [
    { icon: Droplets, title: "Água verde do nada", text: "Você limpa hoje e amanhã a piscina já está esverdeada — cansa e dá vergonha das visitas." },
    { icon: FlaskConical, title: "Produtos errados", text: "Cloro demais, algicida de menos… um erro na dosagem gasta seu dinheiro e piora a água." },
    { icon: Wrench, title: "Equipamento quebra sem aviso", text: "Bomba e filtro estragam justo no auge do verão, quando o conserto sai mais caro." },
    { icon: Clock, title: "Perda de tempo todo fim de semana", text: "Em vez de aproveitar, você passa horas escovando, aspirando e pesquisando o que fazer." },
  ];
  return (
    <section className="py-20 sm:py-28 bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Cansado disso?</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">
            Cuidar da piscina sozinho vira uma <span className="text-gradient-pool">dor de cabeça</span>
          </h2>
          <p className="text-muted-foreground">Os problemas mais comuns de quem tenta fazer tudo sozinho:</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((it, i) => (
            <div key={i} className="reveal bg-card rounded-2xl p-6 border border-border hover:border-pool-light hover:shadow-pool transition-all">
              <div className="inline-flex items-center justify-center size-12 rounded-xl bg-pool-mist text-pool-deep mb-4">
                <it.icon className="size-6" />
              </div>
              <h3 className="font-bold text-lg mb-2">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- HOW IT WORKS ------------------------- */
function HowItWorks() {
  const steps = [
    { icon: Calendar, title: "Você contrata o plano", text: "Escolhe a modalidade ideal e a gente já agenda a primeira visita." },
    { icon: Cog, title: "Nossa equipe cuida de tudo", text: "Química, limpeza, filtro, bomba, produtos — visitas periódicas sem você lembrar." },
    { icon: Sun, title: "Você só aproveita", text: "Piscina cristalina, pronta pra mergulhar sempre que bater vontade." },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Como funciona</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">
            Simples assim. <span className="text-gradient-pool">Em 3 passos.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 relative">
          {steps.map((s, i) => (
            <div key={i} className="reveal relative bg-card rounded-2xl p-8 border border-border shadow-sm">
              <div className="absolute -top-4 -left-4 size-12 rounded-full bg-gradient-pool text-white font-bold flex items-center justify-center shadow-pool">
                {i + 1}
              </div>
              <s.icon className="size-10 text-pool mb-4" />
              <h3 className="font-bold text-xl mb-2">{s.title}</h3>
              <p className="text-muted-foreground">{s.text}</p>
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
      name: "Manutenções",
      audience: "Reparos e conserto de maquinários",
      freq: "Sob demanda, com orçamento antes",
      features: [
        "Diagnóstico técnico de bombas e motores",
        "Conserto de filtros, quadros e tubulações",
        "Troca de peças e reparo de vazamentos",
        "Instalação e troca de equipamentos",
      ],
      diff: "Seu maquinário funcionando como novo",
      highlight: false,
    },

    {
      name: "Residencial",
      audience: "Casas e piscinas particulares",
      freq: "Visita semanal",
      features: [
        "Análise química completa (cloro, pH, alcalinidade)",
        "Aspiração e limpeza de bordas",
        "Retrolavagem do filtro",
        "Relatório em cada visita",
      ],
      diff: "O mais popular entre nossos clientes",
      highlight: true,
    },
    {
      name: "Condomínios",
      audience: "Prédios, clubes e áreas comuns",
      freq: "Visitas programadas + plantão",
      features: [
        "Adequação às normas sanitárias",
        "Laudos e relatórios pra síndico",
        "Equipe uniformizada e identificada",
        "Atendimento de emergência",
      ],
      diff: "Tranquilidade pro síndico e pros condôminos",
      highlight: false,
    },
  ];
  return (
    <section id="planos" className="py-20 sm:py-28 bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Planos de atendimento</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">
            Escolha o plano <span className="text-gradient-pool">certo pra você</span>
          </h2>
          <p className="text-muted-foreground">Modalidades pensadas para cada tipo de piscina e rotina.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`reveal relative rounded-3xl p-7 flex flex-col border transition-all ${
                p.highlight
                  ? "bg-gradient-pool text-white border-transparent shadow-pool scale-[1.02] md:-translate-y-3"
                  : "bg-card border-border hover:shadow-pool"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-sun text-foreground text-xs font-bold px-4 py-1 rounded-full shadow-sun uppercase tracking-wider">
                  Mais popular
                </span>
              )}
              <h3 className={`text-2xl font-extrabold ${p.highlight ? "text-white" : "text-pool-deep"}`}>
                {p.name}
              </h3>
              <p className={`text-sm mt-1 ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>
                {p.audience}
              </p>
              <div className={`mt-5 mb-5 inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-xs font-semibold ${
                p.highlight ? "bg-white/15 text-white" : "bg-pool-mist text-pool-deep"
              }`}>
                <Calendar className="size-3.5" />
                {p.freq}
              </div>
              <ul className="space-y-3 mb-6 flex-1">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={`size-5 shrink-0 mt-0.5 ${p.highlight ? "text-sun" : "text-pool"}`} />
                    <span className={p.highlight ? "text-white/95" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
              <p className={`text-xs italic mb-5 ${p.highlight ? "text-white/80" : "text-muted-foreground"}`}>
                ⭐ {p.diff}
              </p>
              <a
                href={waLink(`Olá! Quero saber mais sobre o plano ${p.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-2 rounded-full py-3 font-bold transition-transform hover:scale-[1.02] ${
                  p.highlight
                    ? "bg-gradient-sun text-foreground shadow-sun"
                    : "bg-pool-deep text-white hover:bg-pool"
                }`}
              >
                <MessageCircle className="size-4" />
                Quero esse plano
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------- FREE EVALUATION ------------------------- */
function FreeEvaluation() {
  return (
    <section id="avaliacao" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-sun p-8 sm:p-14 shadow-sun">
          <div className="absolute -right-16 -top-16 opacity-20">
            <Wrench className="size-64" />
          </div>
          <div className="relative grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-foreground/10 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                <Zap className="size-3.5" /> Oferta por tempo limitado
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4">
                Avaliação gratuita do seu maquinário
              </h2>
              <p className="text-lg mb-6 max-w-xl">
                Bomba fazendo barulho? Filtro puxando pouco? Antes de gastar
                com o conserto errado, nossa equipe faz um{" "}
                <strong>diagnóstico completo do seu equipamento sem custo e sem compromisso</strong> —
                você fica sabendo o estado real da instalação e evita prejuízos maiores.
              </p>
              <a
                href={waLink("Quero agendar a avaliação gratuita do meu maquinário.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-foreground text-background font-bold px-6 py-4 rounded-full hover:scale-[1.03] transition-transform"
              >
                <Calendar className="size-5" />
                Quero agendar minha avaliação grátis
                <ArrowRight className="size-4" />
              </a>
            </div>
            <div className="hidden lg:grid grid-cols-2 gap-3 text-sm">
              {[
                { icon: ShieldCheck, t: "Sem custo" },
                { icon: CheckCircle2, t: "Sem compromisso" },
                { icon: Clock, t: "Agenda rápida" },
                { icon: Wrench, t: "Diagnóstico completo" },
              ].map((b, i) => (
                <div key={i} className="bg-background/50 backdrop-blur rounded-2xl p-4 flex items-center gap-3">
                  <b.icon className="size-6 text-foreground" />
                  <span className="font-semibold">{b.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- PRODUCTS --------------------------- */
function Products() {
  const cats = [
    { icon: FlaskConical, t: "Produtos químicos", d: "Cloro, algicida, clarificante, corretor de pH" },
    { icon: Cog, t: "Equipamentos", d: "Bombas, filtros, aquecedores e trocadores" },
    { icon: LifeBuoy, t: "Acessórios", d: "Aspiradores, escovas, mangueiras e boias" },
    { icon: Sparkles, t: "Kits de tratamento", d: "Combos completos para cada tipo de piscina" },
  ];
  return (
    <section id="produtos" className="py-20 sm:py-28 bg-pool-mist/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Loja Tchê</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">
            Também vendemos <span className="text-gradient-pool">tudo pra sua piscina</span>
          </h2>
          <p className="text-muted-foreground">Produtos selecionados, com orientação de quem entende de verdade.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cats.map((c, i) => (
            <div key={i} className="reveal group bg-card rounded-2xl p-6 border border-border hover:border-pool transition-all hover:-translate-y-1">
              <div className="size-14 rounded-2xl bg-gradient-pool text-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <c.icon className="size-7" />
              </div>
              <h3 className="font-bold text-lg mb-1">{c.t}</h3>
              <p className="text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10 reveal">
          <a
            href={waLink("Olá! Gostaria de consultar produtos para minha piscina.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-pool-deep text-white font-bold px-6 py-3 rounded-full hover:bg-pool transition-colors"
          >
            <MessageCircle className="size-4" />
            Consultar produtos
          </a>
        </div>
      </div>
    </section>
  );
}

/* ----------------------- LOYALTY BENEFIT ------------------------- */
function LoyaltyBenefit() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="reveal grid md:grid-cols-[auto_1fr] gap-8 items-center bg-gradient-pool text-white rounded-3xl p-8 sm:p-12 shadow-pool">
          <div className="size-24 sm:size-32 rounded-full bg-sun text-foreground flex items-center justify-center shrink-0 shadow-sun">
            <Percent className="size-12 sm:size-16" />
          </div>
          <div>
            <span className="inline-block bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              Exclusivo para clientes de plano
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
              Desconto especial em manutenções extras
            </h2>
            <p className="text-white/90 text-lg max-w-2xl">
              Já é cliente de um dos nossos planos? Toda manutenção extra —
              troca de peça, reparo emergencial, tratamento de choque — sai
              com <strong className="text-sun">desconto de fidelidade</strong>.
              A gente cuida da sua piscina e do seu bolso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------- SOCIAL PROOF ------------------------- */
function SocialProof() {
  const stats = [
    { n: "8+", t: "anos de experiência" },
    { n: "500+", t: "piscinas atendidas" },
    { n: "100%", t: "equipe treinada" },
    { n: "4.9★", t: "satisfação dos clientes" },
  ];
  const testimonials = [
    { name: "Marcos R.", bairro: "Cliente há 3 anos, Petrópolis", text: "Minha piscina nunca ficou tão limpa. Chego em casa no sábado e é só mergulhar. Vale cada centavo." },
    { name: "Juliana S.", bairro: "Cliente há 2 anos, Bela Vista", text: "Atendimento no WhatsApp é rápido e sempre respondem. Já salvaram meu aniversário quando a bomba pifou." },
    { name: "Condomínio Sol", bairro: "Cliente há 4 anos, Zona Sul", text: "Como síndico, ter os laudos em dia e uma equipe séria mudou totalmente a rotina do prédio." },
  ];
  return (
    <section className="py-20 sm:py-28 bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="reveal grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {stats.map((s, i) => (
            <div key={i} className="bg-card rounded-2xl p-6 text-center border border-border">
              <div className="text-3xl sm:text-4xl font-extrabold text-gradient-pool">{s.n}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.t}</div>
            </div>
          ))}
        </div>

        <div className="text-center mb-10 reveal">
          <h2 className="text-3xl sm:text-4xl font-extrabold">
            Quem confia na <span className="text-gradient-pool">Tchê Piscinas</span> não larga
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <div key={i} className="reveal bg-card rounded-2xl p-6 border border-border">
              <div className="flex gap-0.5 text-sun mb-3">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="size-4 fill-current" />)}
              </div>
              <p className="text-sm mb-5 leading-relaxed">"{t.text}"</p>
              <div>
                <div className="font-bold text-pool-deep">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.bairro}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ TEAM ------------------------------- */
function Team() {
  const members = [
    { name: "Rafael", role: "Técnico líder", desc: "Especialista em química e equipamentos, cuida dos casos mais complexos." },
    { name: "Bruna", role: "Atendimento", desc: "Tira dúvidas, agenda visitas e acompanha cada cliente de perto." },
    { name: "Lucas", role: "Operacional", desc: "Garante limpeza, aspiração e manutenção no padrão Tchê." },
    { name: "Fernanda", role: "Gestão", desc: "Responsável pela qualidade, treinamentos e relacionamento com condomínios." },
  ];
  return (
    <section id="equipe" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Quem cuida da sua piscina</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3 mb-4">
            Conheça a <span className="text-gradient-pool">nossa equipe</span>
          </h2>
          <p className="text-muted-foreground">
            Gente de verdade, treinada e comprometida em deixar sua piscina impecável.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {members.map((m, i) => (
            <div key={i} className="reveal bg-card rounded-2xl p-6 border border-border text-center hover:shadow-pool transition-shadow">
              <div className="mx-auto size-20 rounded-full bg-gradient-pool text-white flex items-center justify-center text-2xl font-extrabold mb-4">
                {m.name.charAt(0)}
              </div>
              <h3 className="font-bold text-lg text-pool-deep">{m.name}</h3>
              <div className="text-sm font-semibold text-pool mb-2">{m.role}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- DIFFERENTIALS ------------------------ */
function Differentials() {
  const items = [
    { icon: Users, t: "Equipe própria e treinada", d: "Nada de terceirizado. Sempre o mesmo padrão." },
    { icon: MessageCircle, t: "Atendimento rápido no WhatsApp", d: "Você fala com gente de verdade, não com robô." },
    { icon: ShieldCheck, t: "Transparência total", d: "Relatório em cada visita, sem surpresas na conta." },
    { icon: Award, t: "Produtos de qualidade", d: "Trabalhamos só com marcas testadas e aprovadas." },
    { icon: MapPin, t: "Múltiplas cidades", d: "Porto Alegre e cidades da região metropolitana." },
    { icon: Waves, t: "Especialistas de verdade", d: "Anos cuidando de piscinas de todos os tipos." },
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Por que a Tchê?</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3">
            Diferenciais que <span className="text-gradient-pool">fazem diferença</span>
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <div key={i} className="reveal flex gap-4 bg-card rounded-2xl p-6 border border-border hover:shadow-pool transition-shadow">
              <div className="shrink-0 size-12 rounded-xl bg-pool-mist text-pool-deep flex items-center justify-center">
                <it.icon className="size-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold mb-1">{it.t}</h3>
                <p className="text-sm text-muted-foreground">{it.d}</p>
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
    { q: "Como funciona o plano de manutenção?", a: "Você escolhe a modalidade (Residencial, Manutenções ou Condomínios), a gente agenda as visitas na frequência combinada e cuida de tudo: química da água, limpeza, filtro e diagnóstico do equipamento. Você recebe relatório a cada visita." },
    { q: "Preciso ficar em casa durante o atendimento?", a: "Não. Basta liberar o acesso à área da piscina. Nossa equipe é uniformizada, identificada e envia foto/relatório do serviço executado." },
    { q: "Posso cancelar o plano a qualquer momento?", a: "Sim. A gente trabalha com transparência e sem letras miúdas. O plano 'Manutenções' inclusive é sob demanda, sem fidelidade obrigatória." },
    { q: "Vocês atendem minha cidade?", a: "Atendemos Porto Alegre e diversas cidades da região metropolitana. Manda uma mensagem no WhatsApp com seu bairro que a gente confirma na hora." },
    { q: "Quanto custa um plano?", a: "O valor depende do tamanho da piscina, tipo de tratamento e frequência das visitas. Chama a gente no WhatsApp com uma foto da piscina que enviamos o orçamento sem compromisso." },
    { q: "A avaliação do maquinário é mesmo gratuita?", a: "É sim. Sem custo e sem compromisso. Fazemos o diagnóstico, apontamos o que está bom e o que precisa de reparo, e você decide se quer contratar." },
  ];
  return (
    <section id="faq" className="py-20 sm:py-28 bg-muted/50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-12 reveal">
          <span className="text-sm font-bold uppercase tracking-wider text-pool">Dúvidas frequentes</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-3">
            Tudo o que você quer saber
          </h2>
        </div>
        <Accordion type="single" collapsible className="reveal space-y-3">
          {qs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="bg-card rounded-2xl border border-border px-5"
            >
              <AccordionTrigger className="text-left font-semibold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
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
    { name: "SUALL PISCINAS", role: "Parceira técnica" },
    { name: "SILLENTY BRASIL", role: "Patrocinadora oficial" },
  ];
  return (
    <section id="patrocinadores" className="py-16 sm:py-20 bg-muted/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10 reveal">
          <span className="inline-flex items-center gap-2 bg-pool-mist text-pool-deep px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Award className="size-3.5" /> Apoio e credibilidade
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
            Nossos <span className="text-gradient-pool">patrocinadores</span>
          </h2>
          <p className="text-muted-foreground">
            Contamos com o apoio de empresas sérias que fortalecem nossa qualidade e confiança.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {sponsors.map((s, i) => (
            <div key={i} className="reveal bg-card rounded-2xl px-8 py-10 border border-border flex flex-col items-center justify-center text-center hover:border-pool-light hover:shadow-pool transition-all">
              <div className="size-16 rounded-2xl bg-gradient-pool text-white flex items-center justify-center mb-4 shadow-pool">
                <Award className="size-8" />
              </div>
              <h3 className="text-xl font-extrabold text-pool-deep tracking-tight">{s.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.role}</p>
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
    <section className="relative py-24 overflow-hidden bg-gradient-pool text-white">
      <svg
        className="absolute top-0 left-0 w-full text-muted/50 rotate-180"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path fill="currentColor" d="M0,64L80,58.7C160,53,320,43,480,48C640,53,800,75,960,74.7C1120,75,1280,53,1360,42.7L1440,32L1440,100L0,100Z" />
      </svg>
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center reveal">
        <span className="inline-flex items-center gap-2 bg-sun text-foreground px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-5 shadow-sun">
          <Sun className="size-3.5" /> O verão está chegando · Vagas limitadas na agenda
        </span>
        <h2 className="text-4xl sm:text-5xl font-extrabold mb-5 leading-tight">
          Pare de perder fim de semana com a piscina.
        </h2>
        <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">
          Fale agora com um especialista da Tchê Piscinas e garanta sua
          vaga na nossa agenda antes que o calor aperte.
        </p>
        <a
          href={waLink("Olá! Quero garantir minha vaga na agenda da Tchê Piscinas.")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 bg-gradient-sun text-foreground font-extrabold text-lg px-8 py-5 rounded-full shadow-sun hover:scale-[1.03] transition-transform"
        >
          <MessageCircle className="size-6" />
          Quero minha piscina cristalina
          <ArrowRight className="size-5" />
        </a>
      </div>
    </section>
  );
}

/* ------------------------------ FOOTER ---------------------------- */
function Footer() {
  return (
    <footer className="bg-foreground text-white/80 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid md:grid-cols-3 gap-8">
        <div>
          <img src={logo} alt="Tchê Piscinas" className="h-12 w-auto bg-white rounded-xl p-2 mb-4" />
          <p className="text-sm max-w-xs">
            Manutenção, limpeza e produtos para piscinas. Água cristalina o ano
            todo, com quem entende de verdade.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Contato</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <a href="https://wa.me/5551991757029" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-sun transition-colors">
                <Phone className="size-4" /> (51) 99175-7029
              </a>
            </li>
            <li>
              <a href="mailto:contato@tchepiscinas.com" className="inline-flex items-center gap-2 hover:text-sun transition-colors">
                <Mail className="size-4" /> contato@tchepiscinas.com
              </a>
            </li>
            <li>
              <a href="https://instagram.com/tchepiscina" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-sun transition-colors">
                <Instagram className="size-4" /> @tchepiscina
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Área de atendimento</h4>
          <p className="text-sm inline-flex items-start gap-2">
            <MapPin className="size-4 mt-0.5 shrink-0 text-sun" />
            Porto Alegre/RS e cidades da região metropolitana.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 mt-10 pt-6 border-t border-white/10 text-xs text-white/50 flex flex-col sm:flex-row gap-2 justify-between">
        <span>© {new Date().getFullYear()} Tchê Piscinas — Todos os direitos reservados.</span>
        <span>Feito com 💙 em Porto Alegre</span>
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
      className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-whatsapp text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
    >
      <span className="absolute inset-0 rounded-full bg-whatsapp animate-ripple" />
      <MessageCircle className="size-7 relative" />
    </a>
  );
}
