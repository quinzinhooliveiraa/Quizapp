import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { apiBaseUrl } from "@/config";
import { computeLp1DistanceResult } from "@/lib/lp1-score";
import { testimonialImages } from "@/lib/testimonials";
import { Lp1PriceCard } from "@/components/Lp1PriceCard";
import { Lp1MechanismSection } from "@/components/Lp1MechanismSection";
import { Lp1ComparisonSection } from "@/components/Lp1ComparisonSection";
import { getPricingRegionQuery, type Pricing } from "@/lib/pricing";
import { themes as connectionThemes } from "@workspace/connection-content";

type SaleAnswers = Record<string, unknown>;

type OfferState = {
  discountActive: boolean;
  deadline: string;
  full: Pricing;
  offer: Pricing;
};

const API_URL = (path: string) => `${apiBaseUrl}${path}`;

const faqs = [
  [
    "É pra mim?",
    "Sim. Funciona para qualquer casal — namoro novo, muitos anos juntos ou uma relação à distância. Vocês começam pelo nível que fizer sentido hoje.",
  ],
  [
    "E se eu é que não souber responder?",
    'Tudo bem. A primeira pergunta de cada baralho é leve, e "nunca pensei nisso" já é um começo.',
  ],
  [
    "Isso substitui terapia?",
    "Não. É uma forma simples de criar espaço para vocês conversarem sozinhos, sem prometer substituir acompanhamento.",
  ],
  [
    "Precisa instalar aplicativo?",
    "Não. Funciona no navegador do celular ou do computador.",
  ],
  [
    "E se meu parceiro achar estranho?",
    "Por isso o jogo começa leve. Vocês escolhem o clima e ninguém precisa responder nada antes de querer.",
  ],
  [
    "Funciona à distância?",
    "Sim. Cada um entra no seu celular e vocês respondem à mesma pergunta, juntos.",
  ],
  [
    "É vitalício mesmo?",
    "Sim. Você paga uma vez e continua com acesso aos baralhos novos.",
  ],
  [
    "Como recebo depois de pagar?",
    "Na hora. Assim que o pagamento for confirmado, o acesso abre automaticamente.",
  ],
] as const;

const realClientQuote =
  "Bom dia! precisava vir te falar que fiz as perguntas com meu namorado e simplesmente não esperava que fosse render tanto. A gente já conversava bastante, mas teve umas perguntas que fizeram a gente parar e conversar de verdade sobre coisas que nunca tínhamos parado pra falar. No final a gente ficou muito mais tempo do que imaginava kkkkk. Muito bom mesmo, parabéns pelo trabalho.";

function getVisitorKey(): string {
  try {
    const existing =
      sessionStorage.getItem("pdc-visitor-key") ||
      localStorage.getItem("pdc-visitor-key");
    if (existing) return existing;
  } catch {
    // The request can still be retried if browser storage is unavailable.
  }

  const generated =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem("pdc-visitor-key", generated);
    localStorage.setItem("pdc-visitor-key", generated);
  } catch {
    // Keep the in-memory key for this page visit.
  }
  return generated;
}

function getDisplayName(answers: SaleAnswers): string {
  const answerName = String(
    answers.nome ?? answers.name ?? answers.buyerName ?? "",
  ).trim();
  if (answerName) return answerName.split(/\s+/)[0];

  try {
    const storedName =
      localStorage.getItem("conexao-name") ??
      sessionStorage.getItem("conexao-name") ??
      "";
    return storedName.trim().split(/\s+/)[0] ?? "";
  } catch {
    return "";
  }
}

function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getClimateName(answers: SaleAnswers): string {
  const climate = String(answers.clima ?? "");
  const blockers = String(answers.travas ?? "")
    .split(",")
    .filter(Boolean);
  const names: Record<string, string> = {
    leve: "Modo Leve",
    conexao: "Porto Seguro",
    profundo: "Livro Aberto",
    divertido: "Modo Leve",
    intimo: "Faísca",
    distancia: "Mesmo Longe",
    normal: "Porto Seguro",
    honesto: "Depois da Tempestade",
  };
  if (blockers.includes("distancia")) return "Mesmo Longe";
  return names[climate] ?? "Porto Seguro";
}

function getAnswer(answers: SaleAnswers, keys: string[]): string {
  for (const key of keys) {
    const value = String(answers[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function getPersonalizedCopy(answers: SaleAnswers) {
  const pain = getAnswer(answers, ["dor", "pain", "s02-dor"]);
  const routine = getAnswer(answers, ["rotina", "s04-rotina"]);
  const climate = getAnswer(answers, ["clima", "s05-silencio"]);
  const timing = getAnswer(answers, ["quando", "urgencia"]);
  const recommendedDeck = getClimateName(answers);
  const tonight = timing === "hoje" ? "hoje à noite" : "quando vocês abrirem";

  if (pain === "afastamento" || String(answers.travas ?? "").includes("distancia")) {
    return {
      title: "Vocês não perderam a conexão. Só deixaram algumas perguntas para depois.",
      body:
        "Foi isso que apareceu nas suas respostas: ainda existe vontade, mas o silêncio começou a ocupar espaços demais.",
      signal: "Sinal encontrado: proximidade que precisa de espaço para voltar",
      offerHeadline: `O primeiro passo de vocês pode começar ${tonight}.`,
      whyNow:
        "Porque a distância não precisa virar o novo normal de vocês.",
      epiphany:
        "A distância não precisa virar o normal de vocês.",
      gapTitle: "O que trava hoje: a distância decide o assunto.",
      gapBody: `O baralho ${recommendedDeck} destrava um jeito simples de voltar a criar proximidade, mesmo quando cada um está no seu celular.`,
    };
  }

  if (routine === "tudo" || routine === "muito") {
    return {
      title: "A rotina está falando por vocês — e a curiosidade ficou para depois.",
      body:
        "Vocês continuam conversando. O que diminuiu foi o espaço para descobrir o que ainda está acontecendo por dentro.",
      signal: "Sinal encontrado: muita logística, pouco espaço para novidade",
      offerHeadline: `Uma pergunta certa pode mudar ${tonight}.`,
      whyNow:
        "Porque a rotina já está ocupando o espaço que poderia ser de vocês.",
      epiphany:
        "Não é conversar mais. É sair do automático por alguns minutos.",
      gapTitle: "O que trava hoje: a conversa ficou na logística.",
      gapBody: `O baralho ${recommendedDeck} destrava perguntas que puxam vocês de volta para o que está acontecendo por dentro.`,
    };
  }

  if (climate === "honesto" || climate === "pesado") {
    return {
      title: "Ainda existe vontade de falar. O que faltou foi um jeito seguro de começar.",
      body:
        "Suas respostas mostram que não falta assunto — falta uma pergunta que não transforme a conversa em cobrança.",
      signal: "Sinal encontrado: vontade de proximidade com cuidado para não pesar",
      offerHeadline: `A pergunta certa chega antes da conversa ${tonight}.`,
      whyNow:
        "Porque vontade de falar já existe — falta só um jeito seguro de começar.",
      epiphany:
        "Quando o assunto já vem pronto, ninguém precisa inventar por onde começar.",
      gapTitle: "O que trava hoje: começar parece que pode pesar.",
      gapBody: `O baralho ${recommendedDeck} destrava uma entrada leve, para a conversa ganhar profundidade sem virar cobrança.`,
    };
  }

  return {
    title: "Vocês não precisam de mais conversa. Precisam da pergunta certa.",
    body:
      "O seu resultado aponta para um começo leve, com espaço suficiente para a conversa ficar mais profunda sem forçar nada.",
    signal: `Sinal encontrado: começar por ${recommendedDeck} e deixar a conversa crescer`,
    offerHeadline: `Dá para criar esse espaço ${tonight}.`,
    whyNow:
      "Porque vocês não precisam esperar a relação ficar distante para abrir uma conversa diferente.",
    epiphany:
      "Uma boa pergunta tira a conversa do automático sem deixar o clima pesado.",
    gapTitle: "O que trava hoje: ninguém sabe por onde começar.",
    gapBody: `O baralho ${recommendedDeck} destrava um assunto pronto para vocês saírem do automático e descobrirem algo novo.`,
  };
}

function getRecapBars(answers: SaleAnswers) {
  const distanceScore = computeLp1DistanceResult(answers).score;
  const currentLevel = Math.max(
    18,
    Math.min(42, Math.round((100 - distanceScore) * 0.42)),
  );

  return [
    {
      label: "Conversa",
      today: currentLevel,
      distanceScore,
      deck: 92,
      todayCopy: "Virou só logística",
      afterCopy: "Sai do automático",
    },
    {
      label: "Perguntas",
      today: currentLevel,
      distanceScore,
      deck: 96,
      todayCopy: "Morrem no “sei lá”",
      afterCopy: "Puxam resposta de verdade",
    },
    {
      label: "Vontade de puxar assunto",
      today: currentLevel,
      distanceScore,
      deck: 98,
      todayCopy: "Some antes de sair",
      afterCopy: "Vem pronta, sem forçar",
    },
  ];
}

function OfferCard({
  offerState,
  remainingSeconds,
  recommendedDeck,
  offerHeadline,
  onCheckout,
  compact = false,
}: {
  offerState: OfferState | null;
  remainingSeconds: number;
  recommendedDeck: string;
  offerHeadline: string;
  onCheckout: () => void;
  compact?: boolean;
}) {
  const active = Boolean(offerState?.discountActive && remainingSeconds > 0);

  return (
    <>
      <div className={`lp1-sale-offer-card ${compact ? "is-compact" : ""}`}>
        <div className="lp1-sale-offer-heading">
          <p className="lp1-sale-kicker">ACESSO VITALÍCIO</p>
          <h2>{offerHeadline}</h2>
          <span className="lp1-sale-recommended">
            Baralho recomendado: {recommendedDeck}
          </span>
        </div>
        {offerState ? (
          <Lp1PriceCard
            fullPricing={offerState.full}
            offerPricing={offerState.offer}
            discountActive={active}
            discountLabel={
              active
                ? `Desconto por concluir o teste · acaba em ${formatRemaining(remainingSeconds)}`
                : null
            }
            onBuy={onCheckout}
            testId={
              compact
                ? "button-lp1-sale-checkout-bottom"
                : "button-lp1-sale-checkout"
            }
          />
        ) : (
          <p className="lp1-sale-price-loading">Carregando preço seguro…</p>
        )}
      </div>
    </>
  );
}

export function Lp1SalePage({
  answers,
  onCheckout,
}: {
  answers: SaleAnswers;
  onCheckout: () => void;
}) {
  const [offerState, setOfferState] = useState<OfferState | null>(null);
  const [offerError, setOfferError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const visitorKey = useMemo(() => getVisitorKey(), []);
  const recapBars = useMemo(() => getRecapBars(answers), [answers]);
  const displayName = useMemo(() => getDisplayName(answers), [answers]);
  const recommendedDeck = getClimateName(answers);
  const orderedDecks = useMemo(() => {
    const recommended = connectionThemes.find(
      (theme) => theme.title === recommendedDeck,
    );

    if (!recommended) return connectionThemes;

    return [
      recommended,
      ...connectionThemes.filter((theme) => theme.id !== recommended.id),
    ];
  }, [recommendedDeck]);
  const personalizedCopy = useMemo(() => getPersonalizedCopy(answers), [answers]);

  useEffect(() => {
    let cancelled = false;
    setOfferError("");
    fetch(API_URL(`/api/offer/start${getPricingRegionQuery()}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorKey }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("offer state request failed");
        return (await response.json()) as OfferState;
      })
      .then((state) => {
        if (!cancelled) setOfferState(state);
      })
      .catch(() => {
        if (!cancelled) {
          setOfferError("Não foi possível carregar a oferta. Tente novamente.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visitorKey]);

  useEffect(() => {
    if (!offerState?.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [offerState?.deadline]);

  const remainingSeconds = offerState
    ? Math.max(0, Math.ceil((new Date(offerState.deadline).getTime() - now) / 1000))
    : 0;
  const discountActive = Boolean(
    offerState?.discountActive && remainingSeconds > 0,
  );

  const scrollToOffer = () => {
    document.getElementById("lp1-sale-offer")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <main className="lp1-sale-page">
      {discountActive ? (
        <div className="lp1-sale-sticky-bar">
          <div className="lp1-sale-sticky-card" aria-live="polite">
            <div className="lp1-sale-sticky-copy">
              <div className="lp1-sale-sticky-active-copy">
                <span className="lp1-sale-sticky-prefix">Termina em</span>
                <b
                  className="lp1-sale-sticky-timer"
                  aria-label={`${formatRemaining(remainingSeconds)} restantes`}
                >
                  {formatRemaining(remainingSeconds)}
                </b>
              </div>
            </div>
            <button type="button" onClick={scrollToOffer}>
              PEGAR -40% OFF <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <section className="lp1-sale-section lp1-sale-recap" data-section-name="sale-recap">
        <p className="lp1-sale-recap-context">
          {displayName
            ? `${displayName}, é isso que o teste mostrou`
            : "O que o teste mostrou sobre vocês"}
        </p>
        <div className="lp1-sale-diagnostic-block">
          <figure className="lp1-sale-now-after-image">
            <img
              src="/hero/lp1-agora-depois.png"
              alt="Um casal distante agora e conectado com as cartas"
            />
          </figure>
          <div className="lp1-sale-gap-card">
            <div className="lp1-sale-gap-column is-now">
              <span className="lp1-sale-gap-column-title">Agora</span>
              <span className="lp1-sale-gap-tag">No modo colega de quarto</span>
              {recapBars.map((bar) => (
                <div className="lp1-sale-gap-row" key={`today-${bar.label}`}>
                  <span>{bar.label}</span>
                  <strong>{bar.todayCopy}</strong>
                  <i>
                    <b
                      style={{ width: `${bar.today}%` }}
                      aria-label={`${bar.label}: score de distância ${bar.distanceScore} de 100; nível atual ${bar.today} de 100`}
                    />
                  </i>
                </div>
              ))}
            </div>
            <div className="lp1-sale-gap-column is-deck">
              <span className="lp1-sale-gap-column-title">Com as cartas</span>
              <span className="lp1-sale-gap-tag">Conexão de verdade</span>
              {recapBars.map((bar) => (
                <div className="lp1-sale-gap-row" key={`deck-${bar.label}`}>
                  <span>{bar.label}</span>
                  <strong>{bar.afterCopy}</strong>
                  <i>
                    <b
                      style={{ width: `${bar.deck}%` }}
                      aria-label={`${bar.label}: potencial ${bar.deck} de 100`}
                    />
                  </i>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="lp1-sale-absolution">
          Não é falta de amor. Faltava a pergunta certa.
        </p>
      </section>

      <section className="lp1-sale-section lp1-sale-epiphany" data-section-name="sale-epiphany">
        <p className="lp1-sale-kicker">A VIRADA</p>
        <p className="lp1-sale-epiphany-agitation">
          Você escolheu a hora, criou coragem e disse “vamos conversar”. E veio
          o “sei lá”.
        </p>
        <h2>“Vamos conversar” não é pergunta — é cobrança.</h2>
        <p>
          Ela pede que o outro traga algo sem dizer o quê. Uma pergunta como
          “Você se arrepende de algo sobre a nossa história até aqui?” já chega
          com o assunto pronto e mostra a profundidade.
        </p>
        <h3>O problema nunca foi ele. Era a pergunta.</h3>
        <blockquote>
          “{realClientQuote}”
        </blockquote>
      </section>

      <Lp1MechanismSection />

      <Lp1ComparisonSection className="lp1-sale-comparison-section" />

      <section className="lp1-sale-section lp1-sale-benefits" data-section-name="sale-benefits">
        <p className="lp1-sale-kicker">O QUE TEM DENTRO</p>
        <h2>Um começo recomendado pra vocês. E mais 14 caminhos para continuar.</h2>
        <p className="lp1-sale-library-intro">
          Pelo que você respondeu, <strong>{recommendedDeck}</strong> é o
          melhor lugar para começar. Depois, os outros baralhos ficam abertos
          para cada fase, clima e vontade.
        </p>
        <figure className="lp1-sale-product-visual">
          <img
            src="/checkout-product-art.png"
            alt="Cartas de Perguntas de Conexão sendo seguradas por duas mãos"
            loading="lazy"
          />
        </figure>
        <p className="lp1-sale-deck-scroll-hint" aria-hidden="true">
          Deslize para ver todos os baralhos →
        </p>
        <div className="lp1-sale-deck-grid">
          {orderedDecks.map((theme) => (
            <article
              className={`lp1-sale-deck-card ${theme.title === recommendedDeck ? "is-recommended" : ""}`}
              key={theme.id}
            >
              <img src={`/theme-backgrounds/${theme.id}.jpg`} alt="" loading="lazy" />
              <div className="lp1-sale-deck-shade" aria-hidden="true" />
              {theme.title === recommendedDeck ? (
                <span className="lp1-sale-deck-badge">Baralho recomendado</span>
              ) : null}
              <div className="lp1-sale-deck-copy">
                <strong>{theme.title}</strong>
                <p>{theme.description}</p>
                <small>{theme.count} perguntas</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp1-sale-section lp1-sale-proof" data-section-name="sale-proof">
        <p className="lp1-sale-kicker">O QUE ACONTECE DEPOIS</p>
        <p className="lp1-sale-proof-anchor">
          212 mil pessoas já salvaram essas perguntas no TikTok
        </p>
        <h2>Uma pergunta pode mudar a noite.</h2>
        <div className="lp1-sale-testimonial-grid">
          {testimonialImages.map((image, index) => (
            <article className="lp1-sale-testimonial-card" key={image}>
              <img
                src={image}
                alt={`Print real de depoimento de cliente ${index + 1}`}
                loading="lazy"
              />
            </article>
          ))}
        </div>
      </section>

      <section
        className="lp1-sale-section lp1-sale-offer-section"
        id="lp1-sale-offer"
        data-section-name="sale-offer"
      >
        <OfferCard
          offerState={offerState}
          remainingSeconds={remainingSeconds}
          recommendedDeck={recommendedDeck}
          offerHeadline={personalizedCopy.offerHeadline}
          onCheckout={onCheckout}
        />
        {offerError ? (
          <button
            type="button"
            className="lp1-sale-retry"
            onClick={() => window.location.reload()}
          >
            {offerError} Tentar novamente
          </button>
        ) : null}
      </section>

      <section className="lp1-sale-section lp1-sale-faq" data-section-name="sale-faq">
        <p className="lp1-sale-kicker">PERGUNTAS FREQUENTES</p>
        <h2>Antes de começar.</h2>
        <div>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={17} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp1-sale-section lp1-sale-close" data-section-name="sale-close">
        <Heart size={20} aria-hidden="true" />
        <h2>
          Vocês não precisam esperar a relação ficar distante.
        </h2>
        <p>
          Não precisam de viagem, nem jantar caro, nem terapia. Às vezes só
          precisam de uma pergunta que nenhum dos dois pensou em fazer.
        </p>
        <OfferCard
          offerState={offerState}
          remainingSeconds={remainingSeconds}
          recommendedDeck={recommendedDeck}
          offerHeadline={personalizedCopy.offerHeadline}
          onCheckout={onCheckout}
          compact
        />
        <p className="lp1-sale-last-line">
          Hoje à noite pode ser só mais uma noite. Ou a noite em que vocês
          começaram uma conversa diferente. ❤️
        </p>
      </section>
    </main>
  );
}