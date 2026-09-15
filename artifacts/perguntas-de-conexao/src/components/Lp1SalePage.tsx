import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { apiBaseUrl } from "@/config";
import { computeLp1Score } from "@/lib/lp1-score";
import { testimonialImages } from "@/lib/testimonials";

type SaleAnswers = Record<string, unknown>;

type SalePrice = {
  display: string;
  unitNote: string;
  amountCents: number;
  symbol: string;
  amount: string;
  symbolPosition: "before" | "after";
  pixAvailable: boolean;
};

type OfferState = {
  discountActive: boolean;
  deadline: string;
  full: SalePrice;
  offer: SalePrice;
};

const API_URL = (path: string) => `${apiBaseUrl}${path}`;

const benefitCards = [
  {
    title: "459 perguntas",
    body: "em 15 baralhos, do leve ao profundo.",
    mark: "459",
    image: "/quiz/clima-leve.png",
  },
  {
    title: "Do leve ao profundo",
    body: "A profundidade chega no ritmo de vocês.",
    mark: "→",
    image: "/quiz/dx-como-comecar.png",
  },
  {
    title: "Acesso pra 2 pessoas",
    body: "Você + convite, sem pagar de novo.",
    mark: "2",
    image: "/quiz/dx-eu-travo.png",
  },
  {
    title: "Cada um no seu celular",
    body: "Respondem juntos, mesmo à distância.",
    mark: "↗",
    image: "/quiz/dx-afastamento.png",
  },
  {
    title: "Novos baralhos",
    body: "Incluídos para sempre, sem mensalidade.",
    mark: "∞",
    image: "/quiz/clima-honesto.png",
  },
  {
    title: "7 dias de garantia",
    body: "Se não fizer sentido, devolvemos.",
    mark: "✓",
    image: "/quiz/dx-sei-la.png",
  },
] as const;

const faqs = [
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
  const score = computeLp1Score(answers).value;

  return [
    {
      label: "Conversa",
      today: score,
      deck: 92,
      todayCopy: "Virou só logística",
      afterCopy: "Sai do automático",
    },
    {
      label: "Perguntas",
      today: score,
      deck: 96,
      todayCopy: "Morrem no “sei lá”",
      afterCopy: "Puxam resposta de verdade",
    },
    {
      label: "Vontade de puxar assunto",
      today: score,
      deck: 98,
      todayCopy: "Some antes de sair",
      afterCopy: "Vem pronta, sem forçar",
    },
  ];
}

function PriceText({ price }: { price: SalePrice }) {
  return price.symbolPosition === "before" ? (
    <>
      <span>{price.symbol}</span> {price.amount}
    </>
  ) : (
    <>
      {price.amount} <span>{price.symbol}</span>
    </>
  );
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
  const price = active ? offerState?.offer : offerState?.full;
  const discountPercent =
    active && offerState?.full && offerState.offer
      ? Math.round(
          ((offerState.full.amountCents - offerState.offer.amountCents) /
            offerState.full.amountCents) *
            100,
        )
      : 0;

  return (
    <div className={`lp1-sale-offer-card ${compact ? "is-compact" : ""}`}>
      <div className="lp1-sale-offer-heading">
        <p className="lp1-sale-kicker">ACESSO VITALÍCIO</p>
        <h2>{offerHeadline}</h2>
        <span className="lp1-sale-recommended">
          Baralho recomendado: {recommendedDeck}
        </span>
      </div>
      <div className="lp1-sale-urgency">
        {active ? (
          <>
            Preço especial expira em{" "}
            <strong>{formatRemaining(remainingSeconds)}</strong>
          </>
        ) : (
          "Preço normal"
        )}
      </div>
      <p className="lp1-sale-guarantee-line lp1-sale-guarantee-before">
        7 dias de garantia. Não gostou, devolve.
      </p>
      <p className="lp1-sale-differential">
        <strong>{offerState?.full.display ?? "R$ 50"}. Uma vez. Pra sempre.</strong>{" "}
        Sem assinatura, sem renovação, sem “cancele antes de 4 semanas”. 7 dias
        de garantia, sem condição e sem precisar provar nada.
      </p>
      {price ? (
        <div className="lp1-sale-price">
          {active ? (
            <del>{offerState?.full.display}</del>
          ) : null}
          <strong>
            <PriceText price={price} />
          </strong>
          {active && discountPercent > 0 ? (
            <b className="lp1-sale-discount-badge">{discountPercent}% OFF</b>
          ) : null}
          <span>pagamento único</span>
        </div>
      ) : (
        <p className="lp1-sale-price-loading">Carregando preço seguro…</p>
      )}
      {price ? (
        <p className="lp1-sale-unit-note">{price.unitNote}.</p>
      ) : null}
      <p className="lp1-sale-guarantee-line">
        7 dias de garantia. Não gostou, devolve.
      </p>
      <button
        type="button"
        className="lp1-sale-primary-button"
        onClick={onCheckout}
        disabled={!price}
        data-testid={compact ? "button-lp1-sale-checkout-bottom" : "button-lp1-sale-checkout"}
      >
        {compact ? "Quero começar" : "Quero o Perguntas de Conexão"}{" "}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
      <p className="lp1-sale-payment-note">
        {price?.pixAvailable ? "Pix ou cartão" : "Cartão"} · acesso na hora
      </p>
      <p className="lp1-sale-fear-note">
        Sem pagamento neste passo — você revisa e confirma no próximo.
      </p>
      <p className="lp1-sale-objection">
        <Check size={16} aria-hidden="true" /> Funciona mesmo se ele não entrar
        de cara: você começa sozinha, pelas perguntas leves. Ele entra quando a
        conversa já estiver boa.
      </p>
      <p className="lp1-sale-bonus">
        <span aria-hidden="true">🎁</span> Leva 3 perguntas de amostra pra usar
        hoje à noite, agora.
      </p>
    </div>
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
  const recommendedDeck = getClimateName(answers);
  const personalizedCopy = useMemo(() => getPersonalizedCopy(answers), [answers]);

  useEffect(() => {
    let cancelled = false;
    setOfferError("");
    fetch(API_URL("/api/offer/state"), {
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
        <div className="lp1-sale-now-after-labels" aria-label="Agora e depois">
          <span>Agora</span>
          <i aria-hidden="true" />
          <strong>Depois</strong>
        </div>
        <figure className="lp1-sale-now-after-image">
          <img
            src="/hero/lp1-agora-depois.png"
            alt="Um casal distante agora e conectado depois"
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
                    aria-label={`${bar.label}: score ${bar.today} de 100`}
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
      </section>

      <section className="lp1-sale-section lp1-sale-epiphany" data-section-name="sale-epiphany">
        <p className="lp1-sale-kicker">A DIFERENÇA</p>
        <h2>{personalizedCopy.epiphany}</h2>
        <h3>Precisem da pergunta que abre espaço.</h3>
        <p>
          “Como foi seu dia?” é fácil responder “normal”. Mas quando alguém
          pergunta algo que você nunca pensou em responder, a conversa muda. É
          isso que o Perguntas de Conexão faz.
        </p>
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

      <section className="lp1-sale-section lp1-sale-benefits" data-section-name="sale-benefits">
        <p className="lp1-sale-kicker">O QUE VOCÊS LEVAM</p>
        <h2>Uma pergunta boa para cada noite que vocês quiserem lembrar.</h2>
        <div className="lp1-sale-benefit-grid">
          {benefitCards.map(({ title, body, mark, image }, index) => (
            <article className="lp1-sale-benefit-card" key={title}>
              <div className={`lp1-sale-benefit-image is-${index + 1}`}>
                <img src={image} alt="" loading="lazy" />
                <span>{mark}</span>
              </div>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="lp1-sale-section lp1-sale-mechanism" data-section-name="sale-mechanism">
        <p className="lp1-sale-kicker">O MECANISMO</p>
        <h2>“Mas e se ele responder sei lá?”</h2>
        <p>É justamente por isso que o jogo não começa nas perguntas pesadas.</p>
        <div className="lp1-sale-steps">
          <span><b>🌿</b> LEVE</span>
          <i>→</i>
          <span><b>❤️</b> HONESTA</span>
          <i>→</i>
          <span><b>🧠</b> PROFUNDA</span>
        </div>
        <p>
          Não tem pontuação, nem vencedor, nem obrigação de responder. E
          funciona à distância — cada um no seu celular, na mesma pergunta.
        </p>
      </section>

      <section className="lp1-sale-section lp1-sale-table-section" data-section-name="sale-table">
        <p className="lp1-sale-kicker">A DIFERENÇA NA PRÁTICA</p>
        <h2>“Vamos conversar” × Perguntas de Conexão</h2>
        <div className="lp1-sale-comparison-table">
          {[
            ["Nomeia o problema", "✓", "✓"],
            ["Faz a pessoa se sentir ouvida", "✓", "✓"],
            ["Já chega com o assunto pronto", "—", "✓"],
            ["Funciona mesmo se só um teve a ideia", "—", "✓"],
            ["Respondem juntos, cada um no seu celular", "—", "✓"],
            ["Tem mais 458 para amanhã", "—", "✓"],
          ].map(([label, generic, deck]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{generic}</b>
              <b className="is-ours">{deck}</b>
            </div>
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
              <div className="lp1-sale-testimonial-meta">
                <span>Depoimento real</span>
                <b>
                  <Check size={13} aria-hidden="true" /> Verificado
                </b>
              </div>
              <img
                src={image}
                alt={`Print real de depoimento de cliente ${index + 1}`}
                loading="lazy"
              />
            </article>
          ))}
        </div>
        <p className="lp1-sale-disclaimer">
          Prints reais de clientes. Nenhum nome ou foto foi trocado.
        </p>
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