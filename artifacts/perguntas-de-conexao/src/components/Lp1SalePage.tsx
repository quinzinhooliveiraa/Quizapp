import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
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
import {
  createMetaEventId,
  getMetaAttributionCookies,
  isMetaTrackingAllowed,
  trackMetaPixelEvent,
} from "@/lib/meta-pixel";

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

function getDiscountPercent(offerState: OfferState | null): number {
  if (
    !offerState ||
    offerState.full.amountCents <= 0 ||
    offerState.offer.amountCents >= offerState.full.amountCents
  ) {
    return 0;
  }

  return Math.round(
    ((offerState.full.amountCents - offerState.offer.amountCents) /
      offerState.full.amountCents) *
      100,
  );
}

const DECK_RECOMMENDATION_RULES: Record<string, string[][]> = {
  clima: [
    ["leve", "modo-leve", "perto-de-novo"],
    ["divertido", "modo-leve", "voce-nao-sabia"],
    ["conexao", "porto-seguro", "perto-de-novo"],
    ["normal", "porto-seguro", "voce-nao-sabia"],
    ["honesto", "livro-aberto", "porto-seguro"],
    ["profundo", "livro-aberto", "depois-da-tempestade"],
    ["intimo", "faisca", "luzes-baixas"],
  ],
  trava: [
    ["correria", "modo-leve", "porto-seguro"],
    ["celular", "perto-de-novo", "voce-nao-sabia"],
    ["briga", "depois-da-tempestade", "livro-aberto"],
    ["cama", "faisca", "luzes-baixas"],
    ["distancia", "mesmo-longe", "em-voz-alta"],
  ],
  dor: [
    ["afastamento", "mesmo-longe", "perto-de-novo"],
    ["medo", "porto-seguro", "livro-aberto"],
    ["eu-travo", "modo-leve", "porto-seguro"],
    ["como-comecar", "modo-leve", "porto-seguro"],
    ["sei-la", "voce-nao-sabia", "modo-leve"],
  ],
};

function getRecommendedDeckIds(answers: SaleAnswers): string[] {
  const scores = new Map<string, number>();
  const themeOrder = new Map(connectionThemes.map((theme, index) => [theme.id, index]));
  const addScore = (deckIds: string[], points: number) => {
    deckIds.forEach((deckId, index) => {
      scores.set(deckId, (scores.get(deckId) ?? 0) + Math.max(1, points - index * 2));
    });
  };
  const addRule = (group: "clima" | "trava" | "dor", value: string, points: number) => {
    const rule = DECK_RECOMMENDATION_RULES[group].find(([match]) => match === value);
    if (rule) addScore(rule.slice(1), points);
  };

  addRule("clima", String(answers.clima ?? ""), 12);
  String(answers.travas ?? "")
    .split(",")
    .filter(Boolean)
    .forEach((value) => addRule("trava", value, 10));
  addRule("dor", String(answers.dor ?? ""), 8);

  const routine = String(answers.rotina ?? "");
  if (routine === "tudo" || routine === "muito") {
    addScore(["modo-leve", "porto-seguro"], 7);
  }

  const phase = String(answers.fase ?? answers.stage ?? "");
  if (phase === "novo") addScore(["voce-nao-sabia", "modo-leve"], 6);
  if (phase === "perdidos" || phase === "reconexao") {
    addScore(["perto-de-novo", "livro-aberto"], 7);
  }

  const objection = String(answers.objecao ?? "");
  if (objection === "intenso-demais") addScore(["faisca", "luzes-baixas"], 7);
  if (objection === "ele-nao-topa" || objection === "nao-sei-comecar") {
    addScore(["modo-leve", "porto-seguro"], 6);
  }

  const mappedConversation = String(answers["sei-la-mapeado"] ?? "");
  if (mappedConversation === "rende" || mappedConversation === "vai-longe") {
    addScore(["voce-nao-sabia", "modo-leve"], 5);
  }
  if (mappedConversation === "sei-la" || mappedConversation === "nao-sei") {
    addScore(["porto-seguro", "livro-aberto"], 5);
  }

  const conversationTopics = String(answers.conversas ?? "")
    .split(",")
    .filter(Boolean);
  if (conversationTopics.includes("intimidade")) {
    addScore(["faisca", "luzes-baixas"], 5);
  }
  if (conversationTopics.includes("nos-dois") || conversationTopics.includes("pessoal")) {
    addScore(["voce-nao-sabia", "porto-seguro"], 4);
  }

  if (String(answers.celular ?? "") === "sempre") {
    addScore(["perto-de-novo", "mesmo-longe"], 5);
  }

  if (scores.size === 0) {
    addScore(["porto-seguro", "modo-leve", "voce-nao-sabia"], 3);
  }

  return [...connectionThemes]
    .sort(
      (a, b) =>
        (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
        (themeOrder.get(a.id) ?? 0) - (themeOrder.get(b.id) ?? 0),
    )
    .slice(0, 3)
    .map((theme) => theme.id);
}

function getClimateName(answers: SaleAnswers): string {
  const primaryDeckId = getRecommendedDeckIds(answers)[0] ?? "porto-seguro";
  return (
    connectionThemes.find((theme) => theme.id === primaryDeckId)?.title ??
    "Porto Seguro"
  );
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
  recommendedDecks,
  offerHeadline,
  onCheckout,
  compact = false,
}: {
  offerState: OfferState | null;
  remainingSeconds: number;
  recommendedDecks: string[];
  offerHeadline: string;
  onCheckout: () => void;
  compact?: boolean;
}) {
  const active = Boolean(offerState?.discountActive && remainingSeconds > 0);
  const discountPercent = getDiscountPercent(offerState);

  return (
    <>
      <div className="lp1-sale-offer-card">
        {!compact ? (
          <div className="lp1-sale-offer-heading">
            <p className="lp1-sale-kicker">acesso vitalício</p>
            <h2>
              Hoje pode ser mais uma noite
              <br />
              <em>cada um no seu celular.</em>
            </h2>
            <p className="lp1-price-context">
              Ou vocês podem estar tendo a conversa de verdade daqui a dez
              minutos. São 3 passos:
            </p>
            <span className="lp1-sale-recommended">
              Baralhos recomendados: {recommendedDecks.join(" · ")}
            </span>
          </div>
        ) : null}
        {offerState ? (
          <div className="lp1-price-stack">
            {!compact ? (
              <div className="lp-price-card lp1-price-card lp1-price-steps-card">
                <ol className="lp1-price-steps">
                  <li>
                    <span className="lp1-price-step-number" aria-hidden="true">
                      1
                    </span>
                    <span className="lp1-price-step-copy">
                      <strong>Você paga.</strong>{" "}
                      {offerState.full.pixAvailable
                        ? "Pix cai na hora e o acesso abre sozinho."
                        : "O acesso abre sozinho, na hora."}
                    </span>
                  </li>
                  <li>
                    <span className="lp1-price-step-number" aria-hidden="true">
                      2
                    </span>
                    <span className="lp1-price-step-copy">
                      <strong>Convida ele(a).</strong> Um link. A pessoa entra
                      sem pagar de novo.
                    </span>
                  </li>
                  <li>
                    <span className="lp1-price-step-number" aria-hidden="true">
                      3
                    </span>
                    <span className="lp1-price-step-copy">
                      <strong>Escolhem um baralho.</strong> Leem a primeira
                      pergunta em voz alta. Pronto.
                    </span>
                  </li>
                </ol>
              </div>
            ) : null}
            <Lp1PriceCard
              fullPricing={offerState.full}
              offerPricing={offerState.offer}
              discountActive={active}
              discountLabel={
                active ? (
                  <>
                    <span className="lp-price-discount-copy">
                       O seu desconto de {discountPercent}% termina em
                    </span>
                    <strong className="lp-price-discount-timer">
                      <Clock3 size={18} strokeWidth={2.2} aria-hidden="true" />
                      {formatRemaining(remainingSeconds)}
                    </strong>
                  </>
                ) : null
              }
              onBuy={onCheckout}
              testId={
                compact
                  ? "button-lp1-sale-checkout-bottom"
                  : "button-lp1-sale-checkout"
              }
              showBenefits
              className="lp1-price-benefits-card"
            />
          </div>
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
  checkoutOpen = false,
}: {
  answers: SaleAnswers;
  onCheckout: () => void;
  checkoutOpen?: boolean;
}) {
  const [offerState, setOfferState] = useState<OfferState | null>(null);
  const [offerError, setOfferError] = useState("");
  const [offerRetry, setOfferRetry] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [recapVisible, setRecapVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [offerCardVisible, setOfferCardVisible] = useState(false);
  const recapRef = useRef<HTMLDivElement | null>(null);
  const visitorKey = useMemo(() => getVisitorKey(), []);
  const recapBars = useMemo(() => getRecapBars(answers), [answers]);
  const displayName = useMemo(() => getDisplayName(answers), [answers]);
  const recommendedDeckIds = useMemo(
    () => getRecommendedDeckIds(answers),
    [answers],
  );
  const recommendedDeck = useMemo(
    () => getClimateName(answers),
    [answers],
  );
  const recommendedDecks = useMemo(
    () =>
      recommendedDeckIds
        .map((deckId) => connectionThemes.find((theme) => theme.id === deckId))
        .filter((theme): theme is (typeof connectionThemes)[number] => Boolean(theme)),
    [recommendedDeckIds],
  );
  const orderedDecks = useMemo(() => {
    const recommendedIds = new Set(recommendedDeckIds);
    return [
      ...recommendedDecks,
      ...connectionThemes.filter((theme) => !recommendedIds.has(theme.id)),
    ];
  }, [recommendedDeckIds, recommendedDecks]);
  const recommendedDeckTitles = recommendedDecks.map((theme) => theme.title);
  const personalizedCopy = useMemo(() => getPersonalizedCopy(answers), [answers]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    setOfferState(null);
    setOfferError("");

    const loadOffer = async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(API_URL(`/api/offer/start${getPricingRegionQuery()}`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visitorKey }),
          });
          if (!response.ok) throw new Error("offer state request failed");
          const state = (await response.json()) as OfferState;
          if (!cancelled) setOfferState(state);
          return;
        } catch {
          if (cancelled) return;
          if (attempt === 2) {
            setOfferError("Não foi possível carregar a oferta. Tente novamente.");
            return;
          }
          await new Promise<void>((resolve) => {
            retryTimer = window.setTimeout(resolve, 650 * (attempt + 1));
          });
        }
      }
    };

    void loadOffer();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [offerRetry, visitorKey]);

  const viewContentTrackedRef = useRef(false);
  useEffect(() => {
    if (!offerState || viewContentTrackedRef.current) return;
    viewContentTrackedRef.current = true;
    if (!isMetaTrackingAllowed()) return;

    const pricing = offerState.discountActive ? offerState.offer : offerState.full;
    const value = pricing.amountCents / 100;
    const currency = pricing.currency.toUpperCase();
    const eventId = createMetaEventId("ViewContent");
    const attribution = getMetaAttributionCookies();
    trackMetaPixelEvent(
      "ViewContent",
      { content_name: "Perguntas de Conexão", value, currency },
      eventId,
    );
    void fetch(API_URL("/api/track/meta-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "ViewContent",
        eventId,
        visitorKey,
        value,
        currency,
        consent: true,
        internal: false,
        fbp: attribution.fbp,
        fbc: attribution.fbc,
        sourceUrl: window.location.href,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [offerState, visitorKey]);

  useEffect(() => {
    if (!offerState?.deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [offerState?.deadline]);

  useEffect(() => {
    const element = recapRef.current;
    if (!element || recapVisible) return;

    if (!("IntersectionObserver" in window)) {
      setRecapVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRecapVisible(true);
        observer.disconnect();
      },
      { threshold: 0.2, rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [recapVisible]);

  useEffect(() => {
    let frame = 0;
    const updateScrollState = () => {
      frame = 0;
      setHasScrolled(window.scrollY > 360);
    };
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const offerCards = Array.from(
      document.querySelectorAll<HTMLElement>(".lp1-sale-offer-card"),
    );
    if (offerCards.length === 0 || !("IntersectionObserver" in window)) {
      setOfferCardVisible(false);
      return;
    }

    const visibleCards = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target as HTMLElement;
          if (entry.isIntersecting) visibleCards.add(card);
          else visibleCards.delete(card);
        });
        setOfferCardVisible(visibleCards.size > 0);
      },
      { threshold: 0.12, rootMargin: "-8% 0px -8% 0px" },
    );

    offerCards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  const remainingSeconds = offerState
    ? Math.max(0, Math.ceil((new Date(offerState.deadline).getTime() - now) / 1000))
    : 0;
  const discountActive = Boolean(
    offerState?.discountActive && remainingSeconds > 0,
  );
  const discountPercent = getDiscountPercent(offerState);
  const showBottomCta = hasScrolled && !offerCardVisible && !checkoutOpen;

  const scrollToOffer = () => {
    document.getElementById("lp1-sale-offer")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <main className={`lp1-sale-page ${showBottomCta ? "has-bottom-cta" : ""}`}>
      {discountActive ? (
        <div className="lp1-sale-sticky-bar">
          <div className="lp1-sale-sticky-card" aria-live="polite">
            <div className="lp1-sale-sticky-copy">
              <div className="lp1-sale-sticky-active-copy">
                <span className="lp1-sale-sticky-prefix">
                  O seu desconto de {discountPercent}% termina em
                </span>
                <b
                  className="lp1-sale-sticky-timer"
                  aria-label={`${formatRemaining(remainingSeconds)} restantes`}
                >
                  {formatRemaining(remainingSeconds)}
                </b>
              </div>
            </div>
            <button type="button" onClick={onCheckout}>
              Obter desconto{" "}
              <ArrowRight size={15} aria-hidden="true" />
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
              src="/hero/lp1-agora-depois.webp"
              alt="Um casal distante agora e conectado com as cartas"
            />
          </figure>
          <div
            ref={recapRef}
            className={`lp1-sale-gap-card ${recapVisible ? "is-visible" : ""}`}
          >
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
        <p className="lp1-sale-kicker">A virada</p>
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
          <img
            className="lp1-sale-epiphany-print"
            src={testimonialImages[5]}
            alt="Print real do depoimento de um cliente"
            loading="lazy"
          />
          <footer className="lp1-sale-epiphany-attribution">
            <span>Cliente real do Perguntas de Conexão</span>
            <span className="lp1-sale-epiphany-verified">
              <ShieldCheck size={12} aria-hidden="true" />
              Verificado
            </span>
          </footer>
        </blockquote>
      </section>

      <Lp1MechanismSection />

      <Lp1ComparisonSection className="lp1-sale-comparison-section" />

      <section className="lp1-sale-section lp1-sale-benefits" data-section-name="sale-benefits">
        <p className="lp1-sale-kicker">o que tem dentro</p>
        <h2>Todos os baralhos para vocês. Três escolhidos pelo quiz.</h2>
        <p className="lp1-sale-library-intro">
          Pelo que vocês responderam, <strong>{recommendedDeck}</strong> é o
          melhor lugar para começar. Os outros dois recomendados completam esse
          caminho, e todos os outros baralhos continuam disponíveis.
        </p>
        <p className="lp1-sale-deck-scroll-hint" aria-hidden="true">
          Deslize para ver todos os baralhos →
        </p>
        <div className="lp1-sale-deck-grid">
          {orderedDecks.map((theme) => {
            const isRecommended = recommendedDeckIds.includes(theme.id);
            return (
            <article
              className={`lp1-sale-deck-card ${isRecommended ? "is-recommended" : ""}`}
              key={theme.id}
            >
              <img src={`/theme-backgrounds/${theme.id}.jpg`} alt="" loading="lazy" decoding="async" />
              <div className="lp1-sale-deck-shade" aria-hidden="true" />
              {isRecommended ? (
                <span className="lp1-sale-deck-badge">baralho recomendado</span>
              ) : null}
              <div className="lp1-sale-deck-copy">
                <strong>{theme.title}</strong>
                <p>{theme.description}</p>
                <small>{theme.count} perguntas</small>
              </div>
            </article>
            );
          })}
        </div>
      </section>

      <section className="lp1-sale-section lp1-sale-proof" data-section-name="sale-proof">
        <p className="lp1-sale-kicker">o que acontece depois</p>
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
          recommendedDecks={recommendedDeckTitles}
          offerHeadline={personalizedCopy.offerHeadline}
          onCheckout={onCheckout}
        />
        {offerError ? (
          <button
            type="button"
            className="lp1-sale-retry"
            onClick={() => setOfferRetry((attempt) => attempt + 1)}
          >
            {offerError} Tentar novamente
          </button>
        ) : null}
      </section>

      <section className="lp1-sale-section lp1-sale-faq" data-section-name="sale-faq">
        <p className="lp1-sale-kicker">perguntas frequentes</p>
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
          recommendedDecks={recommendedDeckTitles}
          offerHeadline={personalizedCopy.offerHeadline}
          onCheckout={onCheckout}
          compact
        />
        <p className="lp1-sale-last-line">
          Hoje à noite pode ser só mais uma noite. Ou a noite em que vocês
          começaram uma conversa diferente. ❤️
        </p>
      </section>
      {showBottomCta ? (
        <div className="lp1-sale-bottom-cta" aria-label="Continuar para pagamento">
          <button
            type="button"
            onClick={onCheckout}
            data-testid="button-lp1-sale-sticky-checkout"
          >
            Continuar para pagamento <ArrowRight size={18} aria-hidden="true" />
          </button>
          <span className="lp1-sale-bottom-cta-note">
            Acesso imediato · Pagamento seguro · Garantia de 7 dias
          </span>
        </div>
      ) : null}
    </main>
  );
}