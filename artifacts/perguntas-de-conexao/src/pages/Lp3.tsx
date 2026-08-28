import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, Feather, Menu, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import {
  questions as libraryQuestions,
  themes as libraryThemes,
  type ConnectionQuestion,
  type ConnectionTheme,
} from "@workspace/connection-content";
import {
  selectLp3Narrative,
  type Lp3Answers,
} from "@/lib/lp3-narrative";
import { getLp3RecommendationBridge } from "@/lib/lp3-recommendation";
import { PlanToAction } from "@/components/PlanToAction";
import { RecommendedThemeCarousel } from "@/components/RecommendedThemeCarousel";
import { StoryToSolution } from "@/components/StoryToSolution";
import { Lp3Testimonials } from "@/components/Lp3Testimonials";
import heroMockupMac from "@assets/lp-hero-mockup-mac.webp";
import heroMockupPhone from "@assets/lp-hero-mockup-phone-no-bg.webp";

type Lp3Props = {
  onCheckout?: () => void;
  onCtaClick?: (ctaSource?: "lp3_offer") => void;
  onBack?: () => void;
};

type Screen = "intro" | "question" | "result" | "story" | "practice" | "recommend" | "offer";
type Answers = Lp3Answers;

type QuizQuestion = {
  id: string;
  key: string;
  title: string;
  options: string[];
};

const quizQuestions: QuizQuestion[] = [
  {
    id: "time",
    key: "tempo juntos",
    title: "Há quanto tempo vocês estão juntos?",
    options: [
      "Ainda estamos nos conhecendo",
      "Menos de 1 ano",
      "1–3 anos",
      "3–10 anos",
      "Mais de 10 anos",
    ],
  },
  {
    id: "routine",
    key: "rotina",
    title: "Quando vocês finalmente têm um tempo só para vocês, o que costuma acontecer?",
    options: [
      "Cada um acaba no celular",
      "A gente fala principalmente da rotina",
      "Assistimos alguma coisa",
      "Conversamos bastante",
      "Tentamos fazer algo diferente",
      "Depende muito do dia",
    ],
  },
  {
    id: "curiosity",
    key: "curiosidade",
    title: "Quando foi a última vez que uma conversa entre vocês fez você descobrir algo que não sabia sobre ele(a)?",
    options: ["Hoje", "Nos últimos dias", "Nas últimas semanas", "Há alguns meses", "Nem lembro"],
  },
  {
    id: "vulnerability",
    key: "vulnerabilidade",
    title: "Existe alguma coisa que você gostaria de conversar com ele(a), mas nunca encontrou o momento certo?",
    options: ["Sim", "Algumas coisas", "Talvez", "Acho que não"],
  },
  {
    id: "desire",
    key: "desejo",
    title: "Se você pudesse mudar uma coisa nas conversas de vocês hoje, o que seria?",
    options: [
      "Ter conversas mais profundas",
      "Conhecer melhor um ao outro",
      "Sair da rotina",
      "Voltar a sentir mais proximidade",
      "Reacender a intimidade",
      "Conversar sobre coisas difíceis",
      "Ter mais assunto mesmo à distância",
    ],
  },
];

const fallbackQuestions: ConnectionQuestion[] = [
  {
    id: "lp3-fallback-1",
    themeId: "porto-seguro",
    intensity: "gentle",
    stage: "qualquer",
    text: "O que alguém poderia perguntar mais vezes que faria diferença pra você?",
  },
];

function getStoredState(): { screen: Screen; currentQuestion: number; answers: Answers; practiceIndex: number } {
  if (typeof window === "undefined") {
    return { screen: "intro", currentQuestion: 0, answers: {}, practiceIndex: 0 };
  }

  try {
    const raw = window.localStorage.getItem("lp3_quiz_state");
    if (!raw) return { screen: "intro", currentQuestion: 0, answers: {}, practiceIndex: 0 };
    const parsed = JSON.parse(raw) as Partial<{
      screen: Screen;
      currentQuestion: number;
      answers: Answers;
      practiceIndex: number;
    }>;
    const allowedScreens: Screen[] = ["intro", "question", "result", "story", "practice", "recommend", "offer"];
    return {
      screen: allowedScreens.includes(parsed.screen ?? "intro") ? (parsed.screen as Screen) : "intro",
      currentQuestion: Math.max(0, Math.min(quizQuestions.length - 1, parsed.currentQuestion ?? 0)),
      answers: parsed.answers ?? {},
      practiceIndex: Math.max(0, parsed.practiceIndex ?? 0),
    };
  } catch {
    return { screen: "intro", currentQuestion: 0, answers: {}, practiceIndex: 0 };
  }
}

function getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const storageKey = "pdc-visitor-key";
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `anonymous-${Date.now()}`;
  }
}

function trackLp3(eventName: string, detail: Record<string, unknown> = {}) {
  if (typeof window !== "undefined") {
    const payload = {
      ...detail,
      visitor_id: getVisitorId(),
      lp_variant: "lp3",
    };
    window.dispatchEvent(
      new CustomEvent(`lp3:${eventName}`, { detail: payload }),
    );
  }
}

function findTheme(themeId: string): ConnectionTheme {
  return libraryThemes.find((theme) => theme.id === themeId) ?? libraryThemes[0];
}

export default function Lp3({ onCheckout, onCtaClick, onBack }: Lp3Props) {
  const stored = useMemo(getStoredState, []);
  const [screen, setScreen] = useState<Screen>(stored.screen);
  const [currentQuestion, setCurrentQuestion] = useState(stored.currentQuestion);
  const [answers, setAnswers] = useState<Answers>(stored.answers);
  const [practiceIndex, setPracticeIndex] = useState(stored.practiceIndex);
  const [liveNote, setLiveNote] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const result = useMemo(() => selectLp3Narrative(answers), [answers]);
  const recommendedTheme = useMemo(() => findTheme(result.themeId), [result.themeId]);
  const recommendationBridge = useMemo(
    () => getLp3RecommendationBridge(result.narrativeType),
    [result.narrativeType],
  );
  const practiceQuestions = useMemo(() => {
    const preferred = libraryQuestions.filter((question) =>
      question.themeId === result.themeId
      || question.themeId === recommendedTheme.id
      || question.intensity === (result.narrativeType === "intimacy" ? "deep" : "honest"),
    );
    return (preferred.length ? preferred : fallbackQuestions).slice(0, 8);
  }, [recommendedTheme.id, result.narrativeType, result.themeId]);
  const practiceQuestion = practiceQuestions[practiceIndex % practiceQuestions.length] ?? fallbackQuestions[0];
  const otherThemes = useMemo(
    () => libraryThemes.filter((theme) => theme.id !== recommendedTheme.id).slice(0, 5),
    [recommendedTheme.id],
  );

  useEffect(() => {
    window.localStorage.setItem("lp_variant", "lp3");
    window.localStorage.setItem("lp3_variant", "lp3");
    getVisitorId();
    trackLp3("viewed");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("lp3_quiz_state", JSON.stringify({ screen, currentQuestion, answers, practiceIndex }));
    let previousAnsweredAt: string | undefined;
    try {
      const previous = JSON.parse(
        window.localStorage.getItem("conexao-lp3-state") || "{}",
      ) as { answeredAt?: unknown };
      if (typeof previous.answeredAt === "string") {
        previousAnsweredAt = previous.answeredAt;
      }
    } catch {
      // A malformed previous handoff is replaced below.
    }
    const hasCompletedQuiz = quizQuestions.every((question) => Boolean(answers[question.id]));
    const handoff = {
      source: "lp3",
      answers: {
        relationshipDuration: answers.time,
        conversationFrequency: answers.routine,
        discoveryFrequency: answers.curiosity,
        difficultConversations: answers.vulnerability,
        primaryGoal: answers.desire,
      },
      inferredProfile: result.title,
      recommendedDeck: recommendedTheme.title,
      ...(hasCompletedQuiz
        ? { answeredAt: previousAnsweredAt ?? new Date().toISOString() }
        : {}),
    };
    window.localStorage.setItem("conexao-lp3-state", JSON.stringify(handoff));
    window.localStorage.setItem("conexao-lp3-relationship-duration", answers.time || "");
    window.localStorage.setItem("conexao-lp3-conversation-frequency", answers.routine || "");
    window.localStorage.setItem("conexao-lp3-discovery-frequency", answers.curiosity || "");
    window.localStorage.setItem("conexao-lp3-difficult-conversations", answers.vulnerability || "");
    window.localStorage.setItem("conexao-lp3-primary-goal", answers.desire || "");
  }, [answers, currentQuestion, practiceIndex, screen]);

  const moveTo = (nextScreen: Screen) => {
    setScreen(nextScreen);
    setLiveNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    trackLp3(`screen_${nextScreen}`, { result: result.title });
    if (nextScreen === "result") {
      trackLp3("profile_revealed", {
        profile: result.title,
        recommendedDeck: recommendedTheme.title,
      });
    }
  };

  const begin = () => {
    setCurrentQuestion(0);
    setScreen("question");
    setLiveNote("");
    trackLp3("started");
  };

  const reset = () => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("lp3"))
      .forEach((key) => window.localStorage.removeItem(key));
    setAnswers({});
    setCurrentQuestion(0);
    setPracticeIndex(0);
    setScreen("intro");
    setLiveNote("Tudo recomeçou. Quando quiser, começamos de novo.");
    trackLp3("reset");
  };

  const goBack = () => {
    if (screen === "question") {
      if (currentQuestion === 0) {
        setScreen("intro");
      } else {
        setCurrentQuestion((value) => value - 1);
      }
      return;
    }
    if (screen === "intro") {
      onBack?.();
      return;
    }
    const previous: Record<Exclude<Screen, "intro" | "question">, Screen> = {
      result: "question",
      story: "result",
      practice: "story",
      recommend: "practice",
      offer: "recommend",
    };
    moveTo(previous[screen as Exclude<Screen, "intro" | "question">]);
  };

  const selectOption = (value: string) => {
    const question = quizQuestions[currentQuestion];
    setAnswers((existing) => ({ ...existing, [question.id]: value }));
    setLiveNote("Resposta registrada.");
    trackLp3("answered", { question: question.id, answer: value });
    window.setTimeout(() => {
      if (currentQuestion === quizQuestions.length - 1) {
        moveTo("result");
      } else {
        setCurrentQuestion((valueToIncrement) => valueToIncrement + 1);
      }
    }, 220);
  };

  const nextPracticeQuestion = () => {
    setPracticeIndex((index) => index + 1);
    setLiveNote("Outra pergunta, para continuar de onde vocês estão.");
    trackLp3("practice_next", { theme: recommendedTheme.id });
  };

  const checkout = () => {
    trackLp3("checkout_intent", { source: "lp3_offer" });
    onCtaClick?.("lp3_offer");
    setLiveNote("Vamos continuar essa conversa.");
    onCheckout?.();
  };

  const renderIntro = () => (
    <section className="lp3-view lp-hero lp3-hero" data-section-name="hero" aria-labelledby="lp3-intro-title">
      <div className="lp-hero-inner">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">
            baralho digital de perguntas · para casais
          </span>
          <h1 id="lp3-intro-title" className="lp-hero-h1">
            Descubra perguntas para{" "}
            <span className="lp-hl-salmon">reacender a chama</span> do seu
            relacionamento e se{" "}
            <span className="lp-hl-lilac">reaproximar</span> do seu parceiro
            em uma noite
          </h1>
          <p className="lp-hero-sub">
            Responda algumas perguntas sobre vocês e descubra por onde começar
            uma conversa mais próxima. Leva menos de 2 minutos.
          </p>
          <div className="lp-hero-actions lp3-hero-actions">
            <button
              className="lp-cta-primary lp-cta-big lp3-hero-cta"
              type="button"
              onClick={begin}
              data-testid="button-lp3-start"
            >
              Começar <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="lp-hero-mockups lp-hero-mockups-photo" aria-hidden="true">
          <img
            src={heroMockupMac}
            alt=""
            className="lp-mockup-photo lp-mockup-photo-mac"
            width={1400}
            height={933}
            fetchPriority="high"
            loading="eager"
          />
          <img
            src={heroMockupPhone}
            alt=""
            className="lp-mockup-photo lp-mockup-photo-phone"
            width={360}
            height={778}
            loading="eager"
          />
        </div>
      </div>
    </section>
  );

  const renderQuestion = () => {
    const question = quizQuestions[currentQuestion];
    const selected = answers[question.id];
    const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;
    return (
      <section className="lp3-view lp3-question-wrap" aria-labelledby={`lp3-question-${question.id}`}>
        <div className="lp3-progress-row">
          <span>Pergunta {String(currentQuestion + 1).padStart(2, "0")} de 05</span>
          <span>{question.key}</span>
        </div>
        <div className="lp3-progress" aria-label={`Progresso: ${currentQuestion + 1} de ${quizQuestions.length}`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <h1 id={`lp3-question-${question.id}`} className="lp3-question-heading">{question.title}</h1>
        <div className="lp3-options" role="radiogroup" aria-label={question.title}>
          {question.options.map((option, index) => (
            <button
              className={`lp3-option ${selected === option ? "is-selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={selected === option}
              key={option}
              onClick={() => selectOption(option)}
              data-testid={`button-lp3-option-${question.id}-${index}`}
            >
              <span>{option}</span>
              <span className="lp3-option-index">{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
        <div className="lp3-question-footer">
          <button className="lp3-link-button" type="button" onClick={goBack} data-testid="button-lp3-back-question">
            <ChevronLeft size={14} aria-hidden="true" /> Voltar
          </button>
          <span className="lp3-live-note" aria-live="polite">{liveNote}</span>
          <button className="lp3-link-button lp3-reset" type="button" onClick={reset} data-testid="button-lp3-reset-question">
            Recomeçar
          </button>
        </div>
      </section>
    );
  };

  const renderResult = () => (
    <section className="lp3-view lp3-result" aria-labelledby="lp3-result-title">
      <div className="lp3-kicker">O que apareceu nas respostas</div>
      <div className="lp3-result-card">
        <h1 id="lp3-result-title" className="lp3-result-title">{result.title}</h1>
        <p className="lp3-result-lead">{result.insight}</p>
        {result.personalizations.length > 0 && (
          <div className="lp3-result-detail">
            {result.personalizations.map((personalization) => (
              <p key={personalization}>{personalization}</p>
            ))}
          </div>
        )}
      </div>
      <div className="lp3-back-row">
        <button className="lp3-link-button" type="button" onClick={goBack} data-testid="button-lp3-back-result">
          <ChevronLeft size={14} aria-hidden="true" /> Rever respostas
        </button>
        <button className="lp3-button lp3-button-ghost" type="button" onClick={() => moveTo("story")} data-testid="button-lp3-see-story">
          Continuar <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );

  const renderStory = () => (
    <section className="lp3-view lp3-story" aria-labelledby="lp3-story-title">
      <div className="lp3-kicker">A história de vocês</div>
      <h1 id="lp3-story-title" className="lp3-section-title">{result.title}</h1>
      <div className="lp3-editorial">
        <p style={{ whiteSpace: "pre-line" }}>{result.story}</p>
      </div>
      <Lp3Testimonials />
      <div className="lp3-back-row">
        <button className="lp3-link-button" type="button" onClick={goBack} data-testid="button-lp3-back-story">
          <ChevronLeft size={14} aria-hidden="true" /> Voltar
        </button>
        <button className="lp3-button lp3-button-primary" type="button" onClick={() => moveTo("practice")} data-testid="button-lp3-try-questions">
          Experimentar uma pergunta <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );

  const renderPractice = () => (
    <section className="lp3-view lp3-practice" aria-labelledby="lp3-practice-title">
      <div className="lp3-kicker">Da biblioteca compartilhada</div>
      <h1 id="lp3-practice-title" className="lp3-section-title">Agora, uma pergunta.</h1>
      <p className="lp3-section-intro">Sem responder certo ou errado. Leiam em voz alta, olhem um para o outro e deixem a resposta encontrar seu próprio tempo.</p>
      <div className="lp3-question-card" data-testid={`card-lp3-practice-${practiceQuestion.id}`}>
        <div className="lp3-card-footer">
          <span>{recommendedTheme.title}</span>
          <span>{practiceQuestion.intensity === "deep" ? "mais fundo" : "para começar"}</span>
        </div>
        <p data-testid={`text-lp3-practice-question-${practiceQuestion.id}`}>{practiceQuestion.text}</p>
        <div className="lp3-card-footer">
          <span>pergunta real</span>
          <span>{practiceIndex + 1} / 08</span>
        </div>
      </div>
      <div className="lp3-actions">
        <button className="lp3-button lp3-button-primary" type="button" onClick={nextPracticeQuestion} data-testid="button-lp3-another-question">
          Outra pergunta <RotateCcw size={15} aria-hidden="true" />
        </button>
        <button className="lp3-button lp3-button-ghost" type="button" onClick={() => moveTo("recommend")} data-testid="button-lp3-see-recommendation">
          Ver por onde começar <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="lp3-back-row">
        <button className="lp3-link-button" type="button" onClick={goBack} data-testid="button-lp3-back-practice">
          <ChevronLeft size={14} aria-hidden="true" /> Voltar
        </button>
        <span className="lp3-live-note" aria-live="polite">{liveNote}</span>
      </div>
    </section>
  );

  const renderRecommend = () => (
    <section className="lp3-view lp3-recommend" aria-labelledby="lp3-recommend-title">
      <div className="lp3-kicker">Uma direção possível</div>
      <StoryToSolution />
      <div className="lp3-deck" data-testid={`card-lp3-recommended-deck-${recommendedTheme.id}`}>
        <div>
          <span className="lp3-mono">Baralho recomendado</span>
          <h2 className="lp3-deck-name">{recommendedTheme.title}</h2>
        </div>
        <div>
          <p className="lp3-deck-copy">{recommendedTheme.description}</p>
        </div>
      </div>
      <PlanToAction
        recommendationBridge={recommendationBridge}
        questions={practiceQuestions}
        themeTitle={recommendedTheme.title}
        onAction={checkout}
      />
      <div>
        <span className="lp3-mono">E outros caminhos para vocês</span>
        <RecommendedThemeCarousel themes={otherThemes} />
      </div>
      <div className="lp3-back-row">
        <button className="lp3-link-button" type="button" onClick={goBack} data-testid="button-lp3-back-recommend">
          <ChevronLeft size={14} aria-hidden="true" /> Voltar
        </button>
      </div>
    </section>
  );

  const renderOffer = () => (
    <section className="lp3-view lp3-offer" aria-labelledby="lp3-offer-title">
      <div className="lp3-kicker">Para continuar de onde vocês estão</div>
      <h1 id="lp3-offer-title" className="lp3-offer-title">Mais espaço para vocês dois.</h1>
      <ul className="lp3-benefits">
        <li>15 baralhos para diferentes momentos</li>
        <li>445+ perguntas reais</li>
        <li>Acesso vitalício</li>
        <li>Sem assinatura</li>
        <li>No celular e no computador</li>
        <li>Convide seu parceiro</li>
      </ul>
      <div className="lp3-price">
        <strong>R$47,90</strong>
        <span>pagamento único</span>
      </div>
      <div className="lp3-actions">
        <button className="lp3-button lp3-button-primary" type="button" onClick={checkout} data-testid="button-lp3-checkout-intent">
          Quero começar essa conversa <ArrowRight size={15} aria-hidden="true" />
        </button>
        <p className="lp3-cta-note">Você começa escolhendo o seu nome e onde quer receber o acesso.</p>
      </div>
      <div className="lp3-back-row">
        <button className="lp3-link-button" type="button" onClick={goBack} data-testid="button-lp3-back-offer">
          <ChevronLeft size={14} aria-hidden="true" /> Voltar
        </button>
        <button className="lp3-link-button lp3-reset" type="button" onClick={reset} data-testid="button-lp3-reset-offer">
          Recomeçar experiência
        </button>
      </div>
      <span className="lp3-live-note" aria-live="polite">{liveNote}</span>
    </section>
  );

  const content = {
    intro: renderIntro,
    question: renderQuestion,
    result: renderResult,
    story: renderStory,
    practice: renderPractice,
    recommend: renderRecommend,
    offer: renderOffer,
  }[screen]();

  return (
    <div className="site-shell shell-dark lp3-shell">
      <header className="site-header">
        <Link href="/" data-testid="link-logo" className="brand-mark brand-mark-inverse">
          <span className="brand-symbol">
            <Feather size={18} strokeWidth={1.6} />
          </span>
          <span>
            Perguntas
            <br />
            <i>de Conexão</i>
          </span>
        </Link>
        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
          <Link href="/app" data-testid="link-experience">
            Experiência
          </Link>
          <a href="/#como-funciona" data-testid="link-how-it-works">
            Como funciona
          </a>
          <a href="/#lp-precos" data-testid="link-packages">
            Pacotes
          </a>
        </nav>
        <Link href="/login" className="header-cta" data-testid="link-header-cta">
          Abrir meu baralho <ArrowRight size={16} />
        </Link>
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          data-testid="button-menu"
        >
          <Menu size={22} />
        </button>
      </header>
      <main className="lp-main lp3-main" data-section-name={screen}>
        <div className="lp3-orbit" aria-hidden="true" />
        {content}
        <span className="sr-only" aria-live="polite">{liveNote}</span>
      </main>
      <footer className="site-footer">
        <Link href="/" className="brand-mark brand-mark-inverse" data-testid="link-footer-logo">
          <span className="brand-symbol">
            <Feather size={18} strokeWidth={1.6} />
          </span>
          <span>
            Perguntas
            <br />
            <i>de Conexão</i>
          </span>
        </Link>
        <span>Para conversas que ficam.</span>
        <span className="footer-copy">
          © {new Date().getFullYear()} Perguntas de Conexão
        </span>
      </footer>
    </div>
  );
}