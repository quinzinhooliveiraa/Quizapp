import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useListQuestionThemes,
  getListQuestionThemesQueryKey,
  useListQuestions,
  getListQuestionsQueryKey,
  useGetAccessPreview,
  useCreateQuestionSession,
  useGetQuestionSession,
  getGetQuestionSessionQueryKey,
  useCreateInvite,
  useGetInvite,
  getGetInviteQueryKey,
  type Question,
  type QuestionTheme,
} from '@workspace/api-client-react';
import { questions as connectionQuestions, themes as connectionThemes } from '@workspace/connection-content';
import { ArrowRight, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Copy, Download, Feather, Flame, Heart, House, Layers3, Link as LinkIcon, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Quote, RotateCw, Send, Settings2, Shuffle, Sparkles, Star, Upload, UserRound, Users, WandSparkles, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import Onboarding from '@/pages/Onboarding';

const queryClient = new QueryClient();
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const apiUrl = (path: string) => `${apiBase}${path}`;

const fallbackThemes: QuestionTheme[] = connectionThemes;
const fallbackQuestions: Question[] = connectionQuestions.map(({ stage: _stage, ...question }) => question);

type QuestionStage = 'novo' | 'firme' | 'qualquer';
type StageWeights = Record<QuestionStage, number>;

const stageById: Record<string, QuestionStage> = Object.fromEntries(
  connectionQuestions.map(question => [question.id, question.stage]),
);

const PERSONALIZED_DECKS_STORAGE_KEY = 'conexao-personalized-decks';
const SEEN_BY_THEME_STORAGE_KEY = 'conexao-seen-by-theme';
const SAVED_QUESTIONS_STORAGE_KEY = 'conexao-saved-question-ids';
const FAVORITE_THEMES_STORAGE_KEY = 'conexao-favorite-theme-ids';
const ADULT_THEME_CONFIRMATION_STORAGE_KEY = 'conexao-18plus-confirmed';

type PersonalizedDeck = {
  id: string;
  createdAt: string;
  label: string;
  ids: string[];
  cover: string;
  seenIds: string[];
};

const dailyMoodOptions = [
  { value: 'tranquilos', label: 'Tranquilos', themes: ['porto-seguro'], intensity: 'gentle' as const },
  { value: 'saudade', label: 'Com saudade um do outro', themes: ['mesmo-longe', 'perto-de-novo'], intensity: 'honest' as const },
  { value: 'animados', label: 'Animados', themes: ['modo-leve', 'viagens'], intensity: 'gentle' as const },
  { value: 'colo', label: 'Precisando de colo', themes: ['porto-seguro', 'livro-aberto'], intensity: 'deep' as const },
];

const dailyVibeOptions = [
  { value: 'fundo', label: 'Conversar fundo', themes: ['porto-seguro', 'livro-aberto'], intensity: 'deep' as const },
  { value: 'relembrar', label: 'Relembrar coisas boas', themes: ['la-atras'], intensity: 'honest' as const },
  { value: 'sonhar', label: 'Sonhar um pouco', themes: ['em-voz-alta', 'perto-de-novo'], intensity: 'honest' as const },
  { value: 'rir', label: 'Só rir e ser leve', themes: ['modo-leve'], intensity: 'gentle' as const },
  { value: 'reconectar', label: 'Resolver o que ficou', themes: ['depois-da-tempestade', 'perto-de-novo'], intensity: 'honest' as const },
  { value: 'esquentar', label: 'Esquentar as coisas', themes: ['luzes-baixas', 'fogo-alto', 'sem-freio'], intensity: 'honest' as const },
];
const dailyCountOptions = [5, 10, 15, 20];
const deckCoverOptions = [
  { id: 'amethyst', label: 'Ametista' },
  { id: 'sunset', label: 'Pôr do sol' },
  { id: 'meadow', label: 'Campo aberto' },
  { id: 'ember', label: 'Brasa' },
  { id: 'ocean', label: 'Maré' },
  { id: 'lilac', label: 'Lilás' },
] as const;
const deckCoverByVibe: Record<string, string> = {
  fundo: 'amethyst',
  relembrar: 'sunset',
  sonhar: 'ocean',
  rir: 'meadow',
  reconectar: 'lilac',
  esquentar: 'ember',
};
const ONBOARDING_WELCOME_DECK_DONE_KEY = 'conexao-welcome-deck-done';
const ONBOARDING_WELCOME_DECK_ID_KEY = 'conexao-welcome-deck-id';
const ONBOARDING_OPEN_WELCOME_DECK_KEY = 'conexao-open-welcome-deck';

const onboardingFeelingToVibe: Record<string, string> = {
  'Mais perto do que de costume': 'fundo',
  'Leve e divertido': 'rir',
  'Honesto, mesmo que seja difícil': 'fundo',
  'Um pouco perigoso': 'esquentar',
};

const onboardingRelationshipToMood: Record<string, string> = {
  'Meu namorado ou minha namorada': 'tranquilos',
  'Meu namorado ou namorada': 'tranquilos',
  'Meu esposo ou minha esposa': 'tranquilos',
  'Alguém com quem estou saindo': 'animados',
  'Namoro à distância': 'saudade',
};

function isDeckCoverId(value: unknown): value is string {
  return typeof value === 'string' && deckCoverOptions.some(option => option.id === value);
}

function isDeckCoverValue(value: unknown): value is string {
  return isDeckCoverId(value) || (typeof value === 'string' && value.startsWith('data:image/'));
}

function deckCoverStyle(cover: string): CSSProperties | undefined {
  if (isDeckCoverId(cover)) return undefined;
  return {
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(8,5,20,.48)), url("${cover}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
}

function resizeCoverImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Escolha uma imagem.'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('A imagem precisa ter até 12 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler essa imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Não foi possível abrir essa imagem.'));
      image.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Não foi possível preparar essa imagem.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', .82));
      };
      image.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}

function readStoredArray(key: string): string[] {
  try {
    const value = JSON.parse(safeGetItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readStoredDecks(): PersonalizedDeck[] {
  try {
    const value = JSON.parse(safeGetItem(PERSONALIZED_DECKS_STORAGE_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((deck): deck is {
      id: string;
      createdAt: string;
      label: string;
      ids: string[];
      cover?: unknown;
      seenIds?: unknown;
    } => Boolean(
      deck
      && typeof deck === 'object'
      && typeof deck.id === 'string'
      && typeof deck.createdAt === 'string'
      && typeof deck.label === 'string'
      && Array.isArray(deck.ids)
      && deck.ids.every((id: unknown) => typeof id === 'string'),
    )).map((deck, index) => ({
      id: deck.id,
      createdAt: deck.createdAt,
      label: deck.label,
      ids: deck.ids,
      cover: isDeckCoverValue(deck.cover) ? deck.cover : deckCoverOptions[index % deckCoverOptions.length].id,
      seenIds: Array.isArray(deck.seenIds) ? deck.seenIds.filter((id): id is string => typeof id === 'string' && deck.ids.includes(id)) : [],
    }));
  } catch {
    return [];
  }
}

function readStoredRecord(key: string): Record<string, string[]> {
  try {
    const value = JSON.parse(safeGetItem(key) || '{}');
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).map(([id, ids]) => [id, Array.isArray(ids) ? ids.filter((item): item is string => typeof item === 'string') : []]));
  } catch {
    return {};
  }
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in embedded or private browsers.
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in embedded or private browsers.
  }
}

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function seededValue(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  return () => {
    value += value << 13;
    value ^= value >>> 7;
    value += value << 3;
    value ^= value >>> 17;
    value += value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function deterministicShuffle<T>(items: T[], seed: string) {
  const result = [...items];
  const random = seededValue(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getStageWeights(relationship: string): StageWeights {
  if (relationship.includes('saindo')) return { novo: 3, qualquer: 2, firme: 0 };
  if (relationship.includes('esposo') || relationship.includes('esposa')) return { novo: 0, qualquer: 2, firme: 3 };
  if (relationship.includes('distância') || relationship.includes('distancia')) return { novo: 1, qualquer: 2, firme: 2 };
  return { novo: 1, qualquer: 2, firme: 1 };
}

function weightByStage(list: Question[], seed: string, weights: StageWeights): Question[] {
  const random = seededValue(seed);
  return [...list]
    .map((question, index) => ({
      question,
      index,
      key: weights[stageById[question.id] || 'qualquer'] + random() * 2,
    }))
    .sort((first, second) => second.key - first.key || first.index - second.index)
    .map(item => item.question);
}

function selectPersonalizedQuestionIds(
  allQuestions: Question[],
  moodValue: string,
  vibeValue: string,
  count: number,
  seed: string,
  weights: StageWeights,
) {
  const available = allQuestions.length ? allQuestions : fallbackQuestions;
  const mood = dailyMoodOptions.find(option => option.value === moodValue) || dailyMoodOptions[0];
  const vibe = dailyVibeOptions.find(option => option.value === vibeValue) || dailyVibeOptions[0];
  const preferredThemes = new Set([...mood.themes, ...vibe.themes]);
  const shuffled = deterministicShuffle(available, seed);
  const score = (question: Question) => (
    (preferredThemes.has(question.themeId) ? 4 : 0)
    + (question.intensity === vibe.intensity ? 2 : 0)
    + (question.intensity === mood.intensity ? 1 : 0)
    + weights[stageById[question.id] || 'qualquer']
  );
  return shuffled
    .sort((first, second) => score(second) - score(first))
    .slice(0, Math.min(count, available.length))
    .map(question => question.id);
}
function Logo({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" data-testid="link-logo" className={`brand-mark ${inverse ? 'brand-mark-inverse' : ''}`}><span className="brand-symbol"><Feather size={18} strokeWidth={1.6} /></span><span>Perguntas<br /><i>de Conexão</i></span></Link>;
}

function Shell({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className={`site-shell ${dark ? 'shell-dark' : ''}`}>
    <header className="site-header">
      <Logo inverse={dark} />
      <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`}>
        <Link href="/app" data-testid="link-experience">Experiência</Link>
        <a href="#como-funciona" data-testid="link-how-it-works">Como funciona</a>
        <a href="#pacotes" data-testid="link-packages">Pacotes</a>
      </nav>
      <Link href="/app" className="header-cta" data-testid="link-header-cta">Abrir meu baralho <ArrowRight size={16} /></Link>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu" data-testid="button-menu"><Menu size={22} /></button>
    </header>
    {children}
    <footer className="site-footer"><Logo inverse /><span>Para conversas que ficam.</span><span className="footer-copy">© {new Date().getFullYear()} Perguntas de Conexão</span></footer>
  </div>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandaloneApp() {
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || safeGetItem('conexao-install-dismissed') === 'true') return;

    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(iosDevice);
    if (iosDevice) setVisible(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    safeSetItem('conexao-install-dismissed', 'true');
    setVisible(false);
  };

  const install = async () => {
    if (isIos || !installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallEvent(null);
  };

  if (!visible) return null;

  return <aside className="app-install-prompt" data-testid="card-install-app">
    <div className="app-install-icon"><Download size={17} /></div>
    <div className="app-install-copy">
      <strong>Abra direto no app</strong>
      {isIos ? <small>Toque em Compartilhar e depois em “Adicionar à Tela de Início”.</small> : <small>Adicione à tela de início para voltar sem passar pela página de vendas.</small>}
    </div>
    {!isIos && <button onClick={install} className="app-install-action" data-testid="button-install-app">Adicionar</button>}
    <button onClick={dismiss} className="app-install-dismiss" aria-label="Fechar convite de instalação" data-testid="button-dismiss-install">Agora não</button>
  </aside>;
}

function StoredAccessGate() {
  const [, navigate] = useLocation();
  const storedSessionId = safeGetItem('conexao-session')?.trim() || '';
  const storedGuestToken = safeGetItem('conexao-guest-token')?.trim() || '';
  const sessionQuery = useGetQuestionSession(storedSessionId, { query: { enabled: !!storedSessionId, queryKey: getGetQuestionSessionQueryKey(storedSessionId) } });
  const guestQuery = useGetInvite(storedGuestToken, { query: { enabled: !!storedGuestToken, queryKey: getGetInviteQueryKey(storedGuestToken) } });
  const hasStoredAccess = !!storedSessionId || !!storedGuestToken;
  const isChecking = (storedSessionId && sessionQuery.isPending) || (storedGuestToken && guestQuery.isPending);

  useEffect(() => {
    if ((sessionQuery.isSuccess && sessionQuery.data.accessGranted) || (guestQuery.isSuccess && guestQuery.data.hasAccess)) {
      navigate('/app', { replace: true });
    }
  }, [guestQuery.data, guestQuery.isSuccess, navigate, sessionQuery.data, sessionQuery.isSuccess]);

  if (!hasStoredAccess || (!isChecking && !((sessionQuery.isSuccess && sessionQuery.data.accessGranted) || (guestQuery.isSuccess && guestQuery.data.hasAccess)))) {
    return null;
  }

  return <div className="access-gate-overlay" role="status" aria-live="polite"><div className="access-gate"><span className="access-gate-mark"><Feather size={18} /></span><p>Abrindo seu espaço de conexão…</p></div></div>;
}

function Home() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<'couple' | 'family'>('couple');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'sending' | 'confirming' | 'error'>('idle');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    const checkoutCancelled = params.get('checkout') === 'cancelado';
    if (checkoutCancelled) {
      setCheckoutState('error');
      setCheckoutOpen(true);
      return;
    }
    if (!sessionId) return;

    setCheckoutState('confirming');
    setCheckoutOpen(true);
    let attempts = 0;
    let timeoutId: number | null = null;
    let cancelled = false;

    const checkPayment = async () => {
      attempts += 1;
      if (cancelled) return;
      try {
        const response = await fetch(apiUrl(`/api/access/sessions/${encodeURIComponent(sessionId)}`));
        if (response.ok) {
          const session = await response.json() as { accessGranted?: boolean };
          if (!cancelled && session.accessGranted) {
            safeSetItem('conexao-session', sessionId);
            safeSetItem('conexao-role', 'owner');
            window.location.href = '/onboarding';
            return;
          }
        }
      } catch {
        // Keep polling while the webhook and API settle.
      }

      if (cancelled) return;
      if (attempts < 15) {
        timeoutId = window.setTimeout(checkPayment, 2000);
      } else {
        setCheckoutState('error');
      }
    };

    void checkPayment();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  const checkout = async () => {
    if (!buyerNameInput.trim()) return;
    setCheckoutState('sending');
    try {
      const response = await fetch(apiUrl('/api/checkout/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackage,
          buyerName: buyerNameInput.trim(),
        }),
      });
      const data = await response.json() as { checkoutUrl?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error('checkout failed');
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutState('error');
    }
  };
  const [buyerNameInput, setBuyerNameInput] = useState('');
  return <Shell>
    <StoredAccessGate />
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> um baralho para estar perto</p>
          <h1>Há coisas que só aparecem quando a gente <em>pergunta.</em></h1>
          <p className="hero-lede">Perguntas de Conexão é um convite para sair do automático. Um baralho digital, feito para abrir espaço para histórias, silêncios e respostas honestas.</p>
           <div className="hero-actions"><Link href="/onboarding" className="button button-primary" data-testid="button-start-demo">Começar a experiência <ArrowRight size={17} /></Link><a href="#como-funciona" className="text-link" data-testid="link-learn-more">Entender o ritual <ChevronRight size={16} /></a></div>
          <div className="hero-note"><span className="tiny-avatar">M</span><span>Uma pergunta por vez.<br /><strong>O resto acontece entre vocês.</strong></span></div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="card-stack">
            <div className="deck-card deck-back" /><div className="deck-card deck-middle" />
            <div className="deck-card deck-front"><span className="card-kicker">Pergunta 01</span><Quote size={29} strokeWidth={1.2} /><p>Que parte de você aparece quando se sente verdadeiramente em casa?</p><span className="card-footer">perguntas de conexão</span></div>
          </div>
          <div className="art-caption"><span>feito para duas ou mais pessoas</span><span className="caption-dot" /><span>sem respostas certas</span></div>
        </div>
      </section>

      <section className="statement-section">
        <p className="section-kicker">não é um jogo de perguntas</p>
        <h2>É um jeito delicado de dizer:<br /><em>“quero conhecer você de novo.”</em></h2>
        <div className="statement-grid"><p>Entre a pergunta e a resposta existe um pequeno intervalo. É ali que mora a presença — aquela coisa rara que não cabe em notificações, agendas ou conversas apressadas.</p><p>Criamos perguntas que não pedem performance. Só curiosidade. Para casais, famílias e amizades que querem continuar descobrindo.</p></div>
      </section>

      <section className="ritual-section" id="como-funciona">
        <div className="ritual-heading"><p className="section-kicker">o ritual</p><h2>Abra espaço.<br /><em>Uma carta por vez.</em></h2></div>
        <div className="ritual-steps"><div className="ritual-step"><span>01</span><h3>Escolha o clima</h3><p>Presença, memórias ou amanhã. Comece de onde fizer sentido hoje.</p></div><div className="ritual-step"><span>02</span><h3>Leia sem pressa</h3><p>Uma pergunta aparece. Respirem. Alguém começa — e o outro escuta.</p></div><div className="ritual-step"><span>03</span><h3>Deixe acontecer</h3><p>Salve as perguntas que ficaram. Voltem quando quiserem continuar.</p></div></div>
      </section>

      <section className="packages-section" id="pacotes">
        <div className="packages-intro"><p className="section-kicker">um acesso, muitas conversas</p><h2>Escolha quem você<br /><em>quer trazer para perto.</em></h2><p>Pagamento único. Acesso imediato ao baralho completo e convites para quem importa.</p></div>
        <div className="package-list">
          <article className="package-card package-featured"><div className="package-tag">para dois</div><div className="package-top"><h3>Casal</h3><span className="package-price">R$ 47,90<span>/vitalício</span></span></div><p>Para criar um espaço só de vocês — em qualquer fase da história.</p><ul><li><Check size={15} /> Baralho completo</li><li><Check size={15} /> 1 convite especial</li><li><Check size={15} /> Modo resposta e favoritos</li></ul><button onClick={() => { setSelectedPackage('couple'); setCheckoutState('idle'); setCheckoutOpen(true); }} className="button button-primary button-full" data-testid="button-buy-couple">Escolher Casal <ArrowRight size={16} /></button></article>
          {false && <article className="package-card"><div className="package-tag">para a roda toda</div><div className="package-top"><h3>Família & amigos</h3><span className="package-price">R$ 59<span>/único</span></span></div><p>Para reunir as pessoas que fazem uma casa ser casa, mesmo à distância.</p><ul><li><Check size={15} /> Baralho completo</li><li><Check size={15} /> 5 convites especiais</li><li><Check size={15} /> Modo resposta e favoritos</li></ul><button onClick={() => { setSelectedPackage('family'); setCheckoutState('idle'); setCheckoutOpen(true); }} className="button button-outline button-full" data-testid="button-buy-family">Escolher Família <ArrowRight size={16} /></button></article>}
        </div>
      </section>

      <section className="quote-section"><Quote size={35} strokeWidth={1} /><blockquote>“A pergunta certa não abre uma conversa.<br /><em>Abre uma pessoa.</em>”</blockquote><span>— uma ideia para levar com vocês</span></section>
    </main>
     {checkoutOpen && <div className="modal-backdrop"><div className="checkout-modal"><button className="modal-close" onClick={() => setCheckoutOpen(false)} data-testid="button-close-checkout"><X size={18} /></button>{checkoutState === 'confirming' ? <><div className="success-seal"><RotateCw size={22} /></div><p className="section-kicker">pagamento em confirmação</p><h2>Confirmando seu<br /><em>acesso…</em></h2><p>Estamos esperando a confirmação da Abacate Pay. Assim que chegar, seu baralho abre automaticamente.</p></> : <><p className="section-kicker">acesso vitalício</p><h2>Seu baralho começa<br /><em>com uma pergunta.</em></h2><p>Você vai para a tela segura da Abacate Pay para pagar via Pix. O acesso só libera depois da confirmação.</p><input type="text" placeholder="Seu nome" value={buyerNameInput} onChange={event => setBuyerNameInput(event.target.value)} className="checkout-name-input" data-testid="input-checkout-name" />{checkoutState === 'error' && <p className="checkout-error">Não deu para iniciar ou confirmar o pagamento agora. Tente novamente em instantes.</p>}<button onClick={() => void checkout()} disabled={checkoutState === 'sending' || !buyerNameInput.trim()} className="button button-primary button-full" data-testid="button-confirm-checkout">{checkoutState === 'sending' ? 'Abrindo pagamento…' : 'Continuar para pagamento'} <ArrowRight size={16} /></button></>}</div></div>}
  </Shell>;
}

function AccessPill({ access }: { access: any }) {
  return <div className="access-pill" data-testid="status-access"><span className="access-dot" />{access?.hasAccess ? `${access.packageName || 'Acesso ativo'}` : 'Modo demonstração'}</div>;
}

function useDeviceViewport() {
  useEffect(() => {
    const standalone = isStandaloneApp();

    const updateViewport = () => {
      const width = Math.max(document.documentElement.clientWidth, 1);
      // In an installed PWA, keep the app on the stable layout viewport.
      // visualViewport changes as browser chrome/keyboard animates and makes
      // the deck jump even when the user is only scrolling.
      const height = Math.max(standalone ? window.innerHeight : (window.visualViewport?.height || window.innerHeight), 1);
      const availableCardHeight = Math.max(250, height - 210);
      const maxCardWidth = Math.min(width * 0.88, 384);
      const cardHeight = Math.min(availableCardHeight, maxCardWidth * 4 / 3);
      const cardWidth = cardHeight * 0.75;
      const availableThemeHeight = Math.max(220, height - 270);
      const compactScreen = width <= 380;
      const themeWidth = Math.min(width * (compactScreen ? 0.64 : 0.72), 320, availableThemeHeight * (compactScreen ? 0.68 : 0.75));

      document.documentElement.style.setProperty('--device-width', `${width}px`);
      document.documentElement.style.setProperty('--device-height', `${height}px`);
      document.documentElement.style.setProperty('--device-vh', `${height * 0.01}px`);
      document.documentElement.style.setProperty('--question-card-width', `${cardWidth}px`);
      document.documentElement.style.setProperty('--question-card-height', `${cardWidth * 4 / 3}px`);
      document.documentElement.style.setProperty('--theme-card-width', `${themeWidth}px`);
      document.documentElement.style.setProperty('--theme-card-height', `${themeWidth * 4 / 3}px`);
    };

    updateViewport();
    window.addEventListener('orientationchange', updateViewport);
    if (!standalone) {
      window.addEventListener('resize', updateViewport);
      window.visualViewport?.addEventListener('resize', updateViewport);
    }

    return () => {
      window.removeEventListener('orientationchange', updateViewport);
      if (!standalone) {
        window.removeEventListener('resize', updateViewport);
        window.visualViewport?.removeEventListener('resize', updateViewport);
      }
    };
  }, []);
}

function AppExperience() {
  const queryClientRef = useQueryClient();
  const { data: themesData, isLoading: themesLoading, isError: themesError } = useListQuestionThemes({ query: { queryKey: getListQuestionThemesQueryKey() } });
  const themes = themesData?.length ? themesData : fallbackThemes;
  const [themeId, setThemeId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState(() => safeGetItem('conexao-session') || '');
  const [welcomeOpen, setWelcomeOpen] = useState(!safeGetItem('conexao-name'));
  const [buyerName, setBuyerName] = useState(() => safeGetItem('conexao-name') || '');
  const role = safeGetItem('conexao-role');
  const isGuest = role === 'guest' || !!safeGetItem('conexao-guest-token');
  const isOwner = !isGuest;
  const guestDisplayName = safeGetItem('conexao-guest-name') || '';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [inviteResult, setInviteResult] = useState<any>(null);
  const accessQuery = useGetAccessPreview({ query: { queryKey: ['access-preview'] } });
  const sessionQuery = useGetQuestionSession(sessionId, { query: { enabled: !!sessionId, queryKey: getGetQuestionSessionQueryKey(sessionId) } });
  const questionParams = { theme: themeId || undefined };
  const questionsQuery = useListQuestions(questionParams, { query: { enabled: !!themeId, queryKey: getListQuestionsQueryKey(questionParams) } });
  const createSession = useCreateQuestionSession();
  const createInvite = useCreateInvite();
  const questions = themeId ? (questionsQuery.data?.length ? questionsQuery.data : (fallbackQuestions.filter(q => q.themeId === themeId).length ? fallbackQuestions.filter(q => q.themeId === themeId) : fallbackQuestions)) : [];
  const currentQuestion = questions.length ? questions[questionIndex % questions.length] : null;
  const questionAt = (offset: number) => questions[(questionIndex + offset + questions.length) % Math.max(questions.length, 1)] || fallbackQuestions[0];
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit : !!accessQuery.data?.canInvite;
  const inviteLimit = sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed = sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;

  const changeTheme = (id: string) => { setThemeId(id); setQuestionIndex(0); };
  const nextQuestion = () => { setQuestionIndex(i => (i + 1) % Math.max(questions.length, 1)); };
  const startSession = () => {
    if (!buyerName.trim()) return;
    safeSetItem('conexao-name', buyerName.trim());
    createSession.mutate({ data: { buyerName: buyerName.trim(), packageId: 'couple' } }, {
      onSuccess: session => { setSessionId(session.id); safeSetItem('conexao-session', session.id); setWelcomeOpen(false); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(session.id) }); },
      onError: () => setWelcomeOpen(false),
    });
  };
  const makeInvite = () => {
    if (!isOwner || !sessionId || !guestName.trim()) return;
    createInvite.mutate({ sessionId, data: { guestName: guestName.trim() } }, { onSuccess: result => { setInviteResult(result); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) }); } });
  };
  const copyInvite = () => { if (inviteResult?.inviteUrl) navigator.clipboard?.writeText(inviteResult.inviteUrl); };
  const selectedTheme = themes.find(theme => theme.id === themeId);
  const dailyTotal = selectedTheme?.count || questions.length || 1;
  const dailyPosition = questions.length ? (questionIndex % questions.length) + 1 : 1;
  return <Shell dark>
    <main className="experience-page experience-page-stories ritual-app">
      <div className="experience-top stories-top ritual-top"><div><p className="stories-kicker">o ritual de hoje</p><h1>Escolha uma <em>intenção.</em></h1></div><AccessPill access={activeAccess} /></div>
      {!themeId ? <section className="intention-gate" aria-labelledby="intention-title">
        <div className="intention-intro"><p className="ritual-label">antes da primeira carta</p><h2 id="intention-title">De onde vocês<br /><em>querem se encontrar?</em></h2><p>Escolha o que merece espaço hoje. A pergunta chega depois — uma só, no tempo de vocês.</p></div>
        <div className="intention-wheel" aria-label="Objetivos de conexão">
          <div className="wheel-core"><span className="wheel-core-mark"><Heart size={19} /></span><span>uma pausa<br /><em>para nós</em></span></div>
          <div className="wheel-ring" />
          {themesLoading ? <div className="wheel-loading"><span /><span /><span /></div> : themes.map((theme, index) => <button key={theme.id} onClick={() => changeTheme(theme.id)} className={`intention-card intention-card-${index % 5}`} data-testid={`button-intention-${theme.id}`}><span className="intention-index">0{index + 1}</span><strong>{theme.title}</strong><small>{theme.description}</small><span className="intention-topics">{theme.count} tópicos</span></button>)}
        </div>
        {themesError && <div className="intention-error"><span>Mostrando uma seleção essencial.</span><button onClick={() => queryClientRef.invalidateQueries({ queryKey: getListQuestionThemesQueryKey() })} data-testid="button-retry-themes">Tentar novamente <RotateCw size={13} /></button></div>}
        <p className="intention-hint"><Sparkles size={14} /> O baralho se adapta à intenção que escolherem.</p>
      </section> : <div className="ritual-deck-layout">
        <aside className="ritual-sidebar">
          <button className="change-intention" onClick={() => setThemeId(null)} data-testid="button-change-intention"><ChevronLeft size={15} /> mudar intenção</button>
          <div className="selected-intention"><span className="ritual-label">intenção de hoje</span><h2>{selectedTheme?.title || 'Presença'}</h2><p>{selectedTheme?.description}</p></div>
          <div className="daily-curation"><div className="curation-heading"><span>curadoria diária</span><strong>{dailyPosition} <i>/ {dailyTotal}</i></strong></div><div className="curation-bar"><span style={{ width: `${Math.min((dailyPosition / dailyTotal) * 100, 100)}%` }} /></div><p>Uma seleção feita para chegar devagar, sem pressa de terminar.</p></div>
          <div className="saved-summary"><BookmarkCheck size={16} /><span>{saved.length ? `${saved.length} salva${saved.length === 1 ? '' : 's'} para depois` : 'salve uma pergunta para voltar a ela'}</span></div>
        </aside>
        <section className="ritual-question-area">
          <div className="deck-heading"><div><span className="ritual-label">baralho de hoje</span><strong>{String(dailyPosition).padStart(2, '0')} <i>de {String(questions.length || dailyTotal).padStart(2, '0')}</i></strong></div><span className="deck-theme-dot"><span /> {selectedTheme?.title}</span></div>
          <div className="ritual-question-stage">{questionsQuery.isLoading ? <div className="ritual-question-card ritual-loading-card"><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></div> : questionsQuery.isError ? <div className="ritual-empty-card"><p>Não conseguimos abrir esta seleção agora.</p><button onClick={() => questionsQuery.refetch()} className="text-link" data-testid="button-retry-questions">Tentar novamente <RotateCw size={15} /></button></div> : currentQuestion ? <article key={currentQuestion.id} className={`ritual-question-card intensity-${currentQuestion.intensity}`} data-testid={`card-question-${currentQuestion.id}`}><div className="ritual-card-top"><span>{selectedTheme?.title}</span><button className={saved.includes(currentQuestion.id) ? 'is-saved' : ''} onClick={() => setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} aria-label={saved.includes(currentQuestion.id) ? 'Remover dos salvos' : 'Salvar pergunta para depois'} data-testid={`button-save-card-${currentQuestion.id}`}><Bookmark size={18} fill={saved.includes(currentQuestion.id) ? 'currentColor' : 'none'} /></button></div><div className="ritual-question-copy"><Quote size={29} /><p>{currentQuestion.text}</p></div></article> : null}</div>
          <div className="ritual-question-actions"><button onClick={() => setQuestionIndex(i => (i - 1 + questions.length) % Math.max(questions.length, 1))} className="round-button ritual-nav-button" aria-label="Pergunta anterior" data-testid="button-previous-question"><ChevronLeft size={18} /></button><button onClick={nextQuestion} className="button ritual-next-button" data-testid="button-next-question">Próxima pergunta <ArrowRight size={16} /></button><button onClick={() => currentQuestion && setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} className={`ritual-save-button ${currentQuestion && saved.includes(currentQuestion.id) ? 'is-saved' : ''}`} data-testid="button-save-question">{currentQuestion && saved.includes(currentQuestion.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />} {currentQuestion && saved.includes(currentQuestion.id) ? 'Salva para depois' : 'Salvar para depois'}</button></div>
        </section>
      </div>}
      {themeId && isOwner && <aside className="invite-panel ritual-invite-panel"><div className="invite-icon"><Users size={20} /></div><div><p className="section-kicker">para esta conversa</p><h3>Traga alguém</h3></div><p className="invite-copy">Uma pergunta pode encontrar vocês em qualquer lugar.</p><button onClick={() => setInviteOpen(true)} className="button ritual-invite-button" disabled={!canInvite && !!sessionId} data-testid="button-open-invite">Traga alguém <Send size={15} /></button><span className="invite-limit">{activeAccess ? `${inviteLimit - invitesUsed} convites disponíveis` : 'Convites disponíveis após o acesso'}</span></aside>}
    </main>
    {welcomeOpen && <div className="modal-backdrop"><div className="welcome-modal"><button className="modal-close" onClick={() => setWelcomeOpen(false)} data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-flourish"><Feather size={22} /></div><p className="section-kicker">antes de começar</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="button button-primary button-full" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
    {inviteOpen && isOwner && <div className="modal-backdrop"><div className="invite-modal"><button className="modal-close" onClick={() => setInviteOpen(false)} data-testid="button-close-invite"><X size={18} /></button>{inviteResult ? <><div className="success-seal"><Check size={24} /></div><p className="section-kicker">convite pronto</p><h2>Agora essa conversa<br /><em>pode chegar mais longe.</em></h2><p>Compartilhe este endereço com <strong>{inviteResult.guestName}</strong>.</p><div className="copy-row"><input readOnly value={inviteResult.inviteUrl} className="text-input" data-testid="input-invite-url" /><button onClick={copyInvite} className="round-button" aria-label="Copiar convite" data-testid="button-copy-invite"><Copy size={17} /></button></div><button onClick={() => { setInviteResult(null); setGuestName(''); }} className="text-link" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></> : <><p className="section-kicker">um convite especial</p><h2>Quem você quer<br /><em>trazer para a conversa?</em></h2><input value={guestName} onChange={e => setGuestName(e.target.value)} className="text-input" placeholder="Nome de quem vai receber" data-testid="input-guest-name" /><button onClick={makeInvite} className="button button-primary button-full" disabled={!guestName.trim() || createInvite.isPending} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : 'Gerar convite'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="form-error">Não foi possível gerar agora. Tente novamente.</p>}</>}</div></div>}
  </Shell>;
}

function AppExperienceReference() {
  useDeviceViewport();
  const queryClientRef = useQueryClient();
  const { data: themesData, isLoading: themesLoading, isError: themesError } = useListQuestionThemes({ query: { queryKey: getListQuestionThemesQueryKey() } });
  const themes: QuestionTheme[] = themesData?.length ? themesData : fallbackThemes;
  const [themeId, setThemeId] = useState<string | null>(null);
  const [adultThemePrompt, setAdultThemePrompt] = useState<QuestionTheme | null>(null);
  const [adultThemeConfirmed, setAdultThemeConfirmed] = useState(() => safeGetItem(ADULT_THEME_CONFIRMATION_STORAGE_KEY) === 'true');
  const [dailyMode, setDailyMode] = useState(false);
  const [favoriteMode, setFavoriteMode] = useState(false);
  const [dailyDeck, setDailyDeck] = useState<string[]>([]);
  const [personalizedDecks, setPersonalizedDecks] = useState<PersonalizedDeck[]>(() => readStoredDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [deckMenuId, setDeckMenuId] = useState<string | null>(null);
  const [deckMenuView, setDeckMenuView] = useState<'menu' | 'rename' | 'cover' | 'delete'>('menu');
  const [deckRenameValue, setDeckRenameValue] = useState('');
  const [isUploadingDeckCover, setIsUploadingDeckCover] = useState(false);
  const [deckCoverUploadError, setDeckCoverUploadError] = useState('');
  const deckCoverInputRef = useRef<HTMLInputElement | null>(null);
  const [dailyFormOpen, setDailyFormOpen] = useState(false);
  const [isPreparingDeck, setIsPreparingDeck] = useState(false);
  const [dailyMood, setDailyMood] = useState('');
  const [dailyVibe, setDailyVibe] = useState('');
  const [dailyCount, setDailyCount] = useState(10);
  const [dailyStep, setDailyStep] = useState(0);
  const [dailyCountCustom, setDailyCountCustom] = useState(false);
  const [dailyCustomCount, setDailyCustomCount] = useState('10');
  const [themeIndex, setThemeIndex] = useState(0);
  const [themeDragOffset, setThemeDragOffset] = useState(0);
  const [isThemeDragging, setIsThemeDragging] = useState(false);
  const themeCarouselRef = useRef<HTMLDivElement | null>(null);
  const themeDragStartX = useRef<number | null>(null);
  const themeDragDelta = useRef(0);
  const themePointerCaptured = useRef(false);
  const suppressThemeClick = useRef(false);
  const [questionDragOffset, setQuestionDragOffset] = useState(0);
  const [isQuestionDragging, setIsQuestionDragging] = useState(false);
  const [questionSwipeExit, setQuestionSwipeExit] = useState<'left' | 'right' | null>(null);
  const questionDragStartX = useRef<number | null>(null);
  const questionDragDelta = useRef(0);
  const questionPointerCaptured = useRef(false);
  const questionSwipeLocked = useRef(false);
  const questionSwipeTimer = useRef<number | null>(null);
  const [activeNav, setActiveNav] = useState('todos');
  const [saved, setSaved] = useState<string[]>(() => readStoredArray(SAVED_QUESTIONS_STORAGE_KEY));
  const [favoriteThemeIds, setFavoriteThemeIds] = useState<string[]>(() => readStoredArray(FAVORITE_THEMES_STORAGE_KEY));
  const [seenByTheme, setSeenByTheme] = useState<Record<string, string[]>>(() => readStoredRecord(SEEN_BY_THEME_STORAGE_KEY));
  const [questionIndex, setQuestionIndex] = useState(0);
  const questionHistory = useRef<number[]>([]);
  const [randomMode, setRandomMode] = useState(true);
  const [writingOpen, setWritingOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState(() => safeGetItem('conexao-session') || '');
  const [welcomeOpen, setWelcomeOpen] = useState(!safeGetItem('conexao-name'));
  const [buyerName, setBuyerName] = useState(() => safeGetItem('conexao-name') || '');
  const role = safeGetItem('conexao-role');
  const isGuest = role === 'guest' || !!safeGetItem('conexao-guest-token');
  const isOwner = !isGuest;
  const guestDisplayName = safeGetItem('conexao-guest-name') || '';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(() => safeGetItem('conexao-nav-collapsed') === 'true');
  const toggleNavCollapsed = () => setNavCollapsed(current => {
    const next = !current;
    safeSetItem('conexao-nav-collapsed', String(next));
    return next;
  });
  const [guestName, setGuestName] = useState('');
  const [inviteResult, setInviteResult] = useState<any>(null);
  const visibleThemes = useMemo(() => activeNav === 'temas'
    ? themes.filter(theme => theme.kind === 'tema')
    : activeNav === 'vibes'
      ? themes.filter(theme => theme.kind === 'vibe')
      : themes, [activeNav, themes]);
  const accessQuery = useGetAccessPreview({ query: { queryKey: ['access-preview'] } });
  const sessionQuery = useGetQuestionSession(sessionId, { query: { enabled: !!sessionId, queryKey: getGetQuestionSessionQueryKey(sessionId) } });
  const allQuestionsMode = dailyMode || favoriteMode;
  const questionParams = { theme: themeId && !allQuestionsMode ? themeId : undefined };
  const questionsQuery = useListQuestions(questionParams, { query: { enabled: !!themeId, queryKey: getListQuestionsQueryKey(questionParams) } });
  const onboardingComplete = safeGetItem('conexao-onboarding-complete') === 'true';
  const welcomeDeckDone = safeGetItem(ONBOARDING_WELCOME_DECK_DONE_KEY) === 'true';
  const openWelcomeDeck = safeGetItem(ONBOARDING_OPEN_WELCOME_DECK_KEY) === 'true';
  const welcomeDeckId = safeGetItem(ONBOARDING_WELCOME_DECK_ID_KEY) || '';
  const onboardingRelationship = safeGetItem('conexao-relationship') || '';
  const onboardingFeeling = safeGetItem('conexao-feeling') || '';
  const relationshipWeights = useMemo(() => getStageWeights(onboardingRelationship), [onboardingRelationship]);
  const allQuestionsQuery = useListQuestions({}, {
    query: {
      enabled: activeNav === 'eu' || allQuestionsMode || (onboardingComplete && !welcomeDeckDone),
      queryKey: getListQuestionsQueryKey({}),
    },
  });
  const createSession = useCreateQuestionSession();
  const createInvite = useCreateInvite();
  const availableQuestions = useMemo(() => (allQuestionsQuery.data?.length ? allQuestionsQuery.data : fallbackQuestions) as Question[], [allQuestionsQuery.data]);
  const dailyQuestions = useMemo(() => dailyDeck.map(id => availableQuestions.find(question => question.id === id)).filter((question): question is Question => Boolean(question)), [availableQuestions, dailyDeck]);
  const favoriteQuestions = useMemo(() => saved.map(id => availableQuestions.find(question => question.id === id)).filter((question): question is Question => Boolean(question)), [availableQuestions, saved]);
  const inProgressThemes = useMemo(() => themes.filter(theme => {
    const count = seenByTheme[theme.id]?.length || 0;
    return count > 0 && count < theme.count;
  }), [themes, seenByTheme]);
  const continueThemes = inProgressThemes.length ? inProgressThemes : themes.slice(0, 2);
  const themeQuestions = useMemo(() => {
    if (!themeId) return [];
    if (questionsQuery.data?.length) return questionsQuery.data;
    const fallbackThemeQuestions = fallbackQuestions.filter(question => question.themeId === themeId);
    return fallbackThemeQuestions.length ? fallbackThemeQuestions : fallbackQuestions;
  }, [questionsQuery.data, themeId]);
  const questions = useMemo(() => {
    if (favoriteMode) return favoriteQuestions;
    if (dailyMode) return dailyQuestions;
    if (!themeId) return [];
    return weightByStage(themeQuestions, `${themeId}-${onboardingRelationship}`, relationshipWeights);
  }, [dailyQuestions, dailyMode, favoriteMode, favoriteQuestions, onboardingRelationship, relationshipWeights, themeId, themeQuestions]);
  const currentQuestion = questions.length ? questions[questionIndex % questions.length] : null;
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit : !!accessQuery.data?.canInvite;
  const inviteLimit = sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed = sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;
  const showInvitePrompt = !!themeId && !!sessionId && invitesUsed === 0 && canInvite && !inviteResult && isOwner;
  const selectedTheme = themes.find(theme => theme.id === (allQuestionsMode ? currentQuestion?.themeId : themeId));
  const dailyTotal = favoriteMode ? questions.length || 1 : selectedTheme?.count || questions.length || 1;
  const dailyPosition = questions.length ? (questionIndex % questions.length) + 1 : 1;
  const isQuestionView = Boolean(themeId || dailyMode || favoriteMode);
  const markQuestionSeen = (question: Question | null) => {
    if (!question) return;
    setSeenByTheme(current => {
      const previous = current[question.themeId] || [];
      const next = { ...current, [question.themeId]: [...previous.filter(id => id !== question.id), question.id] };
      safeSetItem(SEEN_BY_THEME_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (activeDeckId) {
      setPersonalizedDecks(current => {
        const deck = current.find(item => item.id === activeDeckId);
        if (!deck || !deck.ids.includes(question.id)) return current;
        const seenIds = [...deck.seenIds.filter(id => id !== question.id), question.id];
        const nextDecks = seenIds.length >= deck.ids.length && deck.ids.length > 0
          ? current.filter(item => item.id !== activeDeckId)
          : current.map(item => item.id === activeDeckId ? { ...item, seenIds } : item);
        safeSetItem(PERSONALIZED_DECKS_STORAGE_KEY, JSON.stringify(nextDecks));
        return nextDecks;
      });
    }
  };

  const resetQuestionHistory = () => {
    questionHistory.current = [];
  };
  const applyTheme = (id: string) => {
    resetQuestionHistory();
    setActiveDeckId(null);
    setFavoriteMode(false);
    setDailyMode(false);
    setThemeId(id);
    setQuestionIndex(0);
  };
  const changeTheme = (id: string) => {
    const theme = themes.find(item => item.id === id);
    if (theme?.audience === '18+' && !adultThemeConfirmed) {
      setAdultThemePrompt(theme);
      return;
    }
    applyTheme(id);
  };
  const confirmAdultTheme = () => {
    if (!adultThemePrompt) return;
    safeSetItem(ADULT_THEME_CONFIRMATION_STORAGE_KEY, 'true');
    setAdultThemeConfirmed(true);
    applyTheme(adultThemePrompt.id);
    setAdultThemePrompt(null);
  };
  const openDailyForm = () => {
    setDailyMood('');
    setDailyVibe('');
    setDailyCount(10);
    setDailyStep(0);
    setDailyCountCustom(false);
    setDailyCustomCount('10');
    setDailyFormOpen(true);
  };
  const closeDailyForm = () => {
    setDailyFormOpen(false);
    setDailyStep(0);
  };
  const continueDailyForm = () => {
    if (dailyStep === 0 && !dailyMood) return;
    if (dailyStep === 1 && !dailyVibe) return;
    setDailyStep(step => Math.min(2, step + 1));
  };
  const chooseCustomDailyCount = () => {
    setDailyCountCustom(true);
    setDailyCustomCount(String(Math.min(30, Math.max(3, dailyCount))));
  };
  const updateDailyCustomCount = (value: string) => {
    if (!value) {
      setDailyCustomCount('');
      setDailyCount(0);
      return;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    const nextCount = Math.min(30, Math.max(3, Math.trunc(numericValue)));
    setDailyCustomCount(String(nextCount));
    setDailyCount(nextCount);
  };
  const generateDailyDeck = () => {
    if (!dailyMood || !dailyVibe || isPreparingDeck) return;
    closeDailyForm();
    setIsPreparingDeck(true);
    const selectedMood = dailyMood;
    const selectedVibe = dailyVibe;
    const selectedCount = dailyCount;
    window.setTimeout(() => {
      try {
        const mood = dailyMoodOptions.find(option => option.value === selectedMood);
        const vibe = dailyVibeOptions.find(option => option.value === selectedVibe);
        const createdAt = new Date().toISOString();
        const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(createdAt));
        const deck: PersonalizedDeck = {
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `deck-${Date.now()}`,
          createdAt,
          label: `${vibe?.label || mood?.label || 'Perguntas pra hoje'} · ${dateLabel}`,
          ids: selectPersonalizedQuestionIds(availableQuestions, selectedMood, selectedVibe, selectedCount, `${createdAt}-${selectedMood}-${selectedVibe}-${selectedCount}`, relationshipWeights),
          cover: deckCoverByVibe[selectedVibe] || deckCoverOptions[Math.floor(Math.random() * deckCoverOptions.length)].id,
          seenIds: [],
        };
        const nextDecks = [deck, ...personalizedDecks];
        setPersonalizedDecks(nextDecks);
        safeSetItem(PERSONALIZED_DECKS_STORAGE_KEY, JSON.stringify(nextDecks));
        setDailyDeck(deck.ids);
        setActiveDeckId(deck.id);
        setActiveNav('eu');
        setFavoriteMode(false);
        setDailyMode(true);
        setThemeId(null);
        setQuestionIndex(0);
         resetQuestionHistory();
      } finally {
        setIsPreparingDeck(false);
      }
    }, 1100);
  };
  useEffect(() => {
    if (!onboardingComplete || welcomeDeckDone || !onboardingRelationship || !onboardingFeeling) return;
    if (allQuestionsQuery.isLoading) return;

    const mood = onboardingRelationshipToMood[onboardingRelationship];
    const requestedVibe = onboardingFeelingToVibe[onboardingFeeling];
    if (!mood || !requestedVibe) return;

    const hasAdultTheme = themes.some(theme => theme.audience === '18+' || theme.id === 'luzes-baixas');
    const vibe = requestedVibe === 'esquentar' && !hasAdultTheme ? 'fundo' : requestedVibe;
    const createdAt = new Date().toISOString();
    const deckId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `deck-${Date.now()}`;
    const deck: PersonalizedDeck = {
      id: deckId,
      createdAt,
      label: 'Seu primeiro baralho',
      ids: selectPersonalizedQuestionIds(
        availableQuestions,
        mood,
        vibe,
        8,
        `${deckId}-${createdAt}-${onboardingRelationship}-${onboardingFeeling}`,
        relationshipWeights,
      ),
      cover: deckCoverByVibe[vibe] || deckCoverOptions[0].id,
      seenIds: [],
    };
    const nextDecks = [deck, ...personalizedDecks];

    safeSetItem(ONBOARDING_WELCOME_DECK_DONE_KEY, 'true');
    safeSetItem(ONBOARDING_WELCOME_DECK_ID_KEY, deck.id);
    safeSetItem(PERSONALIZED_DECKS_STORAGE_KEY, JSON.stringify(nextDecks));
    setPersonalizedDecks(nextDecks);
    setDailyDeck(deck.ids);
    setActiveDeckId(deck.id);
    setActiveNav('eu');
    setFavoriteMode(false);
    setDailyMode(true);
    setThemeId(null);
    setQuestionIndex(0);
  }, [
    allQuestionsQuery.isLoading,
    availableQuestions,
    onboardingComplete,
    onboardingFeeling,
    onboardingRelationship,
    personalizedDecks,
    themes,
    welcomeDeckDone,
  ]);
  const openSavedDailyDeck = (deck: PersonalizedDeck) => {
    setDailyDeck(deck.ids);
    setActiveDeckId(deck.id);
    setActiveNav('eu');
    setFavoriteMode(false);
    setDailyMode(true);
    setThemeId(null);
    setQuestionIndex(0);
    resetQuestionHistory();
  };
  useEffect(() => {
    if (!openWelcomeDeck || !welcomeDeckDone) return;
    const deck = personalizedDecks.find(item => item.id === welcomeDeckId)
      || personalizedDecks.find(item => item.label === 'Seu primeiro baralho')
      || personalizedDecks[0];
    if (!deck) return;
    safeRemoveItem(ONBOARDING_OPEN_WELCOME_DECK_KEY);
    openSavedDailyDeck(deck);
  }, [openWelcomeDeck, personalizedDecks, welcomeDeckDone, welcomeDeckId]);
  const persistPersonalizedDecks = (nextDecks: PersonalizedDeck[]) => {
    setPersonalizedDecks(nextDecks);
    safeSetItem(PERSONALIZED_DECKS_STORAGE_KEY, JSON.stringify(nextDecks));
  };
  const openDeckMenu = (deck: PersonalizedDeck) => {
    setDeckMenuId(deck.id);
    setDeckMenuView('menu');
    setDeckRenameValue(deck.label);
  };
  const closeDeckMenu = () => {
    setDeckMenuId(null);
    setDeckMenuView('menu');
  };
  const renamePersonalizedDeck = (id: string, newLabel: string) => {
    const label = newLabel.trim();
    if (!label) return;
    persistPersonalizedDecks(personalizedDecks.map(deck => deck.id === id ? { ...deck, label } : deck));
    closeDeckMenu();
  };
  const updatePersonalizedDeckCover = (id: string, coverId: string) => {
    if (!isDeckCoverValue(coverId)) return;
    persistPersonalizedDecks(personalizedDecks.map(deck => deck.id === id ? { ...deck, cover: coverId } : deck));
    closeDeckMenu();
  };
  const handleDeckCoverUpload = async (file: File | undefined) => {
    if (!file || !deckMenu) return;
    setIsUploadingDeckCover(true);
    setDeckCoverUploadError('');
    try {
      const cover = await resizeCoverImage(file);
      updatePersonalizedDeckCover(deckMenu.id, cover);
    } catch (error) {
      setDeckCoverUploadError(error instanceof Error ? error.message : 'Não foi possível usar essa imagem.');
    } finally {
      setIsUploadingDeckCover(false);
      if (deckCoverInputRef.current) deckCoverInputRef.current.value = '';
    }
  };
  const deletePersonalizedDeck = (id: string) => {
    persistPersonalizedDecks(personalizedDecks.filter(deck => deck.id !== id));
    if (activeDeckId === id) setActiveDeckId(null);
    closeDeckMenu();
  };
  const openFavoritesDeck = () => {
    resetQuestionHistory();
    setActiveDeckId(null);
    setActiveNav('eu');
    setFavoriteMode(true);
    setDailyMode(false);
    setThemeId(null);
    setQuestionIndex(0);
  };
  const openDeckTab = (tabId: string) => {
    setActiveNav(tabId);
    setActiveDeckId(null);
    setFavoriteMode(false);
    setDailyMode(false);
    setThemeId(null);
    setQuestionIndex(0);
    setThemeIndex(0);
    resetQuestionHistory();
  };
  const vibrateOnThemeChange = () => {
    // The Vibration API works in Android browsers, but Safari on iPhone does
    // not support web vibration. Check before calling so unsupported browsers
    // continue normally without throwing.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(15);
    }
  };
  const moveThemeIndex = (nextIndex: number) => {
    if (nextIndex === themeIndex) return;
    setThemeIndex(nextIndex);
    vibrateOnThemeChange();
  };
  const selectThemeCard = (index: number) => {
    if (suppressThemeClick.current) {
      suppressThemeClick.current = false;
      return;
    }
    const isDesktopRow = typeof window !== 'undefined' && window.matchMedia('(min-width: 1180px)').matches;
    if (isDesktopRow) {
      changeTheme(visibleThemes[index]?.id);
      return;
    }
    if (index === themeIndex) changeTheme(visibleThemes[index]?.id);
    else moveThemeIndex(index);
  };
  const navigateThemeCarousel = (direction: 1 | -1) => {
    if (!visibleThemes.length) return;
    const nextIndex = (themeIndex + direction + visibleThemes.length) % visibleThemes.length;
    moveThemeIndex(nextIndex);
    window.requestAnimationFrame(() => {
      themeCarouselRef.current
        ?.querySelector<HTMLElement>(`[data-theme-index="${nextIndex}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  };
  const handleThemePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    themeDragStartX.current = event.clientX;
    themeDragDelta.current = 0;
    suppressThemeClick.current = false;
    themePointerCaptured.current = false;
    setThemeDragOffset(0);
    setIsThemeDragging(true);
  };
  const handleThemePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (themeDragStartX.current === null) return;
    themeDragDelta.current = event.clientX - themeDragStartX.current;
    if (Math.abs(themeDragDelta.current) >= 8 && !themePointerCaptured.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
      themePointerCaptured.current = true;
    }
    setThemeDragOffset(themeDragDelta.current);
  };
  const finishThemePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (themeDragStartX.current === null) return;
    const delta = themeDragDelta.current;
    if (Math.abs(delta) >= 44 && visibleThemes.length > 1) {
      const direction = delta < 0 ? 1 : -1;
      const nextIndex = (themeIndex + direction + visibleThemes.length) % visibleThemes.length;
      suppressThemeClick.current = true;
      moveThemeIndex(nextIndex);
    }
    themeDragStartX.current = null;
    themeDragDelta.current = 0;
    setThemeDragOffset(0);
    setIsThemeDragging(false);
    if (themePointerCaptured.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    themePointerCaptured.current = false;
  };
  const handleThemePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (themeDragStartX.current === null) return;
    themeDragStartX.current = null;
    themeDragDelta.current = 0;
    setThemeDragOffset(0);
    setIsThemeDragging(false);
    if (themePointerCaptured.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    themePointerCaptured.current = false;
  };
  const getAdjacentQuestionIndex = (index: number, direction: 1 | -1) => {
    if (questions.length < 2 || allQuestionsMode || !randomMode) return (index + direction + questions.length) % Math.max(questions.length, 1);
    const questionId = questions[index]?.id || String(index);
    const randomOffset = Math.floor(seededValue(`${questionId}-${direction}`)() * (questions.length - 1)) + 1;
    return (index + (randomOffset * direction) + questions.length * 2) % questions.length;
  };
  const nextQuestion = () => {
    if (questions.length < 2) return;
    questionHistory.current.push(questionIndex);
    setQuestionIndex(getAdjacentQuestionIndex(questionIndex, 1));
  };
  const previousQuestion = () => {
    const previousIndex = questionHistory.current.pop();
    if (previousIndex === undefined) return;
    setQuestionIndex(previousIndex);
  };
  const nextQuestionIndex = questions.length > 1 ? getAdjacentQuestionIndex(questionIndex, 1) : null;
  const nextStackQuestion = nextQuestionIndex === null ? null : questions[nextQuestionIndex];
  const nextStackTheme = nextStackQuestion ? themes.find(theme => theme.id === nextStackQuestion.themeId) : null;
  const secondStackQuestionIndex = nextQuestionIndex === null ? null : getAdjacentQuestionIndex(nextQuestionIndex, 1);
  const secondStackQuestion = secondStackQuestionIndex === null ? null : questions[secondStackQuestionIndex];
  const secondStackTheme = secondStackQuestion ? themes.find(theme => theme.id === secondStackQuestion.themeId) : null;
  useEffect(() => markQuestionSeen(currentQuestion), [currentQuestion?.id, activeDeckId]);
  useEffect(() => { safeSetItem(SAVED_QUESTIONS_STORAGE_KEY, JSON.stringify(saved)); }, [saved]);
  useEffect(() => { safeSetItem(FAVORITE_THEMES_STORAGE_KEY, JSON.stringify(favoriteThemeIds)); }, [favoriteThemeIds]);
  useEffect(() => () => {
    if (questionSwipeTimer.current !== null) window.clearTimeout(questionSwipeTimer.current);
  }, []);
  const toggleThemeFavorite = (id: string) => setFavoriteThemeIds(current => current.includes(id) ? current.filter(themeIdValue => themeIdValue !== id) : [...current, id]);
  const toggleSaved = (id: string) => setSaved(current => current.includes(id) ? current.filter(questionId => questionId !== id) : [...current, id]);
  const handleQuestionPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (questionSwipeLocked.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, textarea, input, a')) return;
    questionDragStartX.current = event.clientX;
    questionDragDelta.current = 0;
    questionPointerCaptured.current = false;
    setQuestionDragOffset(0);
    setIsQuestionDragging(true);
  };
  const handleQuestionPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (questionDragStartX.current === null || questionSwipeLocked.current) return;
    questionDragDelta.current = event.clientX - questionDragStartX.current;
    if (Math.abs(questionDragDelta.current) >= 8 && !questionPointerCaptured.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
      questionPointerCaptured.current = true;
    }
    setQuestionDragOffset(questionDragDelta.current);
  };
  const finishQuestionPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (questionDragStartX.current === null) return;
    const delta = questionDragDelta.current;
    if (Math.abs(delta) >= 44 && questions.length > 1) {
      questionSwipeLocked.current = true;
      setQuestionSwipeExit(delta < 0 ? 'left' : 'right');
      questionSwipeTimer.current = window.setTimeout(() => {
        if (delta < 0) nextQuestion();
        else previousQuestion();
        setQuestionSwipeExit(null);
        setQuestionDragOffset(0);
        questionSwipeLocked.current = false;
        questionSwipeTimer.current = null;
      }, 320);
    } else {
      setQuestionDragOffset(0);
    }
    questionDragStartX.current = null;
    questionDragDelta.current = 0;
    setIsQuestionDragging(false);
    if (questionPointerCaptured.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    questionPointerCaptured.current = false;
  };
  const handleQuestionPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (questionSwipeLocked.current) return;
    if (questionDragStartX.current === null) return;
    questionDragStartX.current = null;
    questionDragDelta.current = 0;
    setQuestionDragOffset(0);
    setIsQuestionDragging(false);
    if (questionPointerCaptured.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    questionPointerCaptured.current = false;
  };
  const toggleQuestionMode = () => {
    resetQuestionHistory();
    setRandomMode(mode => !mode);
  };
  const currentResponse = currentQuestion ? responses[currentQuestion.id] || '' : '';
  useEffect(() => {
    setWritingOpen(false);
  }, [currentQuestion?.id]);
  const startSession = () => {
    if (!buyerName.trim()) { setWelcomeOpen(false); return; }
    safeSetItem('conexao-name', buyerName.trim());
    createSession.mutate({ data: { buyerName: buyerName.trim(), packageId: 'couple' } }, {
      onSuccess: session => { setSessionId(session.id); safeSetItem('conexao-session', session.id); setWelcomeOpen(false); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(session.id) }); },
      onError: () => setWelcomeOpen(false),
    });
  };
  const makeInvite = () => {
    if (!isOwner || !sessionId || !guestName.trim()) return;
    createInvite.mutate({ sessionId, data: { guestName: guestName.trim() } }, {
      onSuccess: result => { setInviteResult(result); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) }); },
    });
  };
  const copyInvite = () => { if (inviteResult?.inviteUrl) navigator.clipboard?.writeText(inviteResult.inviteUrl); };
  const navItems = [
    { id: 'todos', label: 'Todos', icon: House },
    { id: 'temas', label: 'Temas', icon: Layers3 },
    { id: 'vibes', label: 'Vibes', icon: WandSparkles },
    { id: 'eu', label: 'Meu espaço', icon: UserRound },
  ];
  const deckMenu = personalizedDecks.find(deck => deck.id === deckMenuId) || null;

  return <div className="app-viewport">
     <main className={`connection-app ${isQuestionView ? 'is-question-view' : 'is-deck-view'} ${writingOpen ? 'is-writing-mode' : ''} ${navCollapsed ? 'is-nav-collapsed' : ''}`}>
       {!isQuestionView ? <>
        <header className="app-header" data-testid="header-decks">
          <div className="app-wordmark" data-testid="text-app-brand"><span className="app-logo-orb"><span /></span><span>Perguntas<br /><b>de Conexão</b></span></div>
          <div className="app-header-context"><span className="app-header-overline">seu espaço de conversa</span><strong>{navItems.find(item => item.id === activeNav)?.label || 'Descobrir'}</strong></div>
          <div className="app-header-actions"><span className="app-access-note"><span className="app-access-note-dot" /> acesso ativo</span><button className="app-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes" data-testid="button-open-settings"><Settings2 size={19} /></button></div>
        </header>
         {activeNav === 'eu' ? <section className="deck-home eu-home" aria-labelledby="eu-home-title">
            <div className="eu-heading"><div><p className="eu-kicker">seu espaço</p><h1 id="eu-home-title">Olá, {buyerName || 'por aqui'}.</h1></div><time className="eu-date" dateTime={localDateKey()}>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</time></div>
           <section className="eu-daily-card" onClick={openDailyForm} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openDailyForm()} data-testid="card-daily-deck"><div className="eu-daily-glow" /><div className="eu-daily-copy"><p className="eu-kicker">seus decks</p><h2>Perguntas de hoje<br /><em>para vocês.</em></h2><p>Conte como vocês estão e receba um baralho feito para agora.</p><span className="eu-open-link">Criar meu deck <ArrowRight size={16} /></span></div><div className="eu-daily-art"><span className="daily-orbit daily-orbit-one" /><span className="daily-orbit daily-orbit-two" /><div className="daily-mini-card daily-mini-back" /><div className="daily-mini-card daily-mini-front"><span>seu deck</span><Quote size={24} /><strong>uma pergunta<br />de cada vez</strong></div></div></section>
           <section className="eu-section eu-invite-section" aria-labelledby="companions-title">
             <div className="eu-section-heading">
               <div><p className="eu-kicker">{isOwner ? 'para esta conversa' : 'acesso compartilhado'}</p><h2 id="companions-title">Quem joga com você</h2></div>
               <span>{isOwner ? `${invitesUsed} de ${inviteLimit} cadeiras usadas` : 'você está convidado'}</span>
             </div>
             {isOwner ? canInvite
               ? <button className="eu-collection-card" onClick={() => setInviteOpen(true)} data-testid="button-open-invite-eu"><span className="eu-collection-shade" /><span className="eu-collection-title"><Users size={17} /> Convidar alguém <ArrowRight size={15} /></span><small>Abra uma cadeira para alguém jogar com você.</small></button>
               : <div className="eu-collection-card" role="status" data-testid="card-invite-full"><span className="eu-collection-shade" /><span className="eu-collection-title"><Users size={17} /> Cadeira cheia</span><small>Sua cadeira já está com alguém.</small></div>
               : <div className="eu-empty-state" data-testid="card-guest-access"><span><Users size={16} /></span><div><strong>{guestDisplayName ? `Oi, ${guestDisplayName} — você é convidado aqui` : 'Você entrou como convidado'}</strong><p>Este baralho é de quem te convidou. Você pode jogar, responder e salvar — só não pode convidar outras pessoas.</p><Link href="/" className="app-secondary-button" data-testid="link-own-deck">Quero meu próprio baralho <ArrowRight size={15} /></Link></div></div>}
           </section>
            {personalizedDecks.length > 0 && <section className="eu-deck-history" aria-labelledby="deck-history-title"><div className="eu-section-heading"><div><p className="eu-kicker">seu histórico</p><h2 id="deck-history-title">Perguntas que você criou</h2></div><span>{personalizedDecks.length} {personalizedDecks.length === 1 ? 'baralho' : 'baralhos'}</span></div><div className="eu-deck-history-row">{personalizedDecks.map(deck => <article key={deck.id} className="eu-history-card"><button className="eu-history-card-open" onClick={() => openSavedDailyDeck(deck)} data-testid={`button-open-daily-deck-${deck.id}`}><span className={`eu-history-art deck-cover-${isDeckCoverId(deck.cover) ? deck.cover : 'custom'}`} style={deckCoverStyle(deck.cover)} aria-hidden="true"><span className="deck-cover-orbit" /><span className="deck-cover-spark" /></span><span className="eu-history-card-shade" /><span className="eu-history-copy"><strong>{deck.label}</strong><small>{deck.ids.length} perguntas · reabrir</small></span></button><button className="eu-history-menu-button" onClick={() => openDeckMenu(deck)} aria-label={`Ações para ${deck.label}`} data-testid={`button-menu-daily-deck-${deck.id}`}><MoreHorizontal size={18} /></button></article>)}</div></section>}
             <section className="eu-section eu-continue-section" aria-labelledby="continue-title"><div className="eu-section-heading"><div><p className="eu-kicker">continue jogando</p><h2 id="continue-title" className="sr-only">Continue jogando</h2></div><span>{inProgressThemes.length ? `${inProgressThemes.length} em andamento` : 'comece por aqui'}</span></div><div className="eu-progress-row">{continueThemes.map(theme => { const seenCount = seenByTheme[theme.id]?.length || 0; const lastQuestionId = seenByTheme[theme.id]?.at(-1); const themeQuestions = availableQuestions.filter(question => question.themeId === theme.id); const resumeIndex = Math.max(0, themeQuestions.findIndex(question => question.id === lastQuestionId)); return <button key={theme.id} className="eu-progress-card" onClick={() => { changeTheme(theme.id); setQuestionIndex(resumeIndex); }} data-testid={`button-continue-theme-${theme.id}`}><div className={`eu-progress-cover theme-cover-${themes.indexOf(theme) % 5}`}><span className="eu-progress-number">{String(seenCount).padStart(2, '0')}</span><Heart className="eu-progress-heart" size={20} fill={favoriteThemeIds.includes(theme.id) ? 'currentColor' : 'none'} /></div><div className="eu-progress-copy"><strong>{theme.title}</strong><small>{seenCount ? `${seenCount} de ${theme.count} perguntas` : 'comece agora'}</small><span className="eu-progress-bar"><i style={{ width: `${Math.min(100, (seenCount / Math.max(theme.count, 1)) * 100)}%` }} /></span><em>Retomar <ArrowRight size={13} /></em></div></button>; })}</div>{continueThemes.length === 0 && <div className="eu-empty-state"><span><Sparkles size={16} /></span><p>Quando uma pergunta ficar pelo caminho, ela aparece aqui para você continuar.</p></div>}</section>
           <section className="eu-section eu-favorites-section" aria-labelledby="favorites-title"><div className="eu-section-heading"><div><p className="eu-kicker">salvos</p><h2 id="favorites-title">Salvos</h2></div><span>{saved.length + favoriteThemeIds.length} salvos</span></div><div className="eu-saved-row"><button className={`eu-collection-card eu-collection-cards ${saved.length ? 'has-content' : ''}`} onClick={openFavoritesDeck} disabled={!saved.length} data-testid="button-favorite-cards"><span className="eu-collection-shade" /><span className="eu-collection-title">Cartas favoritas <b>{saved.length}</b></span>{!saved.length && <small>suas perguntas salvas aparecem aqui</small>}</button><div className="eu-favorite-topics"><p className="eu-favorite-label">Temas favoritos</p><div className="eu-topic-row">{favoriteThemeIds.length ? favoriteThemeIds.map(id => { const theme = themes.find(item => item.id === id); return theme ? <button key={id} className={`eu-topic-card theme-cover-${themes.indexOf(theme) % 5}`} onClick={() => changeTheme(id)} data-testid={`button-favorite-theme-${id}`}><span className="eu-topic-shade" /><strong>{theme.title}</strong><ArrowRight size={15} /></button> : null; }) : <div className="eu-topic-empty">Favorite um tema para encontrá-lo aqui.</div>}</div></div></div></section>
          </section> : <section className="deck-home" aria-labelledby="deck-home-title">
            <div className="deck-home-heading"><h1 id="deck-home-title" data-testid="text-deck-title">{activeNav === 'temas' ? 'Escolha um assunto pra começar' : activeNav === 'vibes' ? 'Escolha uma vibe pra agora' : 'Escolha um objetivo pra começar'}</h1><p className="deck-home-subtitle">{activeNav === 'temas' ? 'Conversas sobre as histórias e planos que fazem parte de vocês' : activeNav === 'vibes' ? 'Encontrem o clima que combina com este momento' : 'Por exemplo, descobrir algo novo, imaginar o que vem'}</p></div>
           <div className="theme-carousel-wrap">
             <button className="theme-carousel-arrow theme-carousel-arrow-previous" onClick={() => navigateThemeCarousel(-1)} disabled={!visibleThemes.length} aria-label="Objetivo anterior" title="Objetivo anterior" data-testid="button-previous-theme"><ChevronLeft size={20} /></button>
              <div
                 ref={themeCarouselRef}
                className={`theme-carousel ${isThemeDragging ? 'is-dragging' : ''}`}
                aria-label={activeNav === 'temas' ? 'Assuntos de conexão' : activeNav === 'vibes' ? 'Vibes de conexão' : 'Objetivos de conexão'}
                onPointerDown={handleThemePointerDown}
                onPointerMove={handleThemePointerMove}
                onPointerUp={finishThemePointer}
                onPointerCancel={handleThemePointerCancel}
                style={{ '--theme-drag-offset': `${themeDragOffset}px` } as CSSProperties}
              >
              {themesLoading && <div className="theme-skeleton" data-testid="loading-themes" />}
              {visibleThemes.map((theme, index) => {
                const offset = Math.max(-2, Math.min(2, index - themeIndex));
                  return <div key={theme.id} className={`theme-cover theme-cover-${index % 5} theme-offset-${offset} ${index === themeIndex ? 'is-active' : ''}`} onClick={() => selectThemeCard(index)} onKeyDown={event => event.key === 'Enter' && selectThemeCard(index)} role="button" tabIndex={0} data-theme-index={index} data-testid={`button-theme-card-${theme.id}`}>
                    <span className="theme-cover-shade" /><span className="theme-cover-top"><span className="theme-cover-meta"><span>{theme.count} perguntas</span>{theme.audience === '18+' && <span className="theme-cover-audience" role="img" aria-label="Conteúdo para maiores de 18 anos" title="Maiores de 18 anos"><Flame size={13} strokeWidth={2.2} aria-hidden="true" /></span>}{theme.audience === 'casais' && <span className="theme-cover-audience">casais</span>}</span><button className={`theme-cover-heart ${favoriteThemeIds.includes(theme.id) ? 'is-favorite' : ''}`} onClick={event => { event.stopPropagation(); toggleThemeFavorite(theme.id); }} aria-label={favoriteThemeIds.includes(theme.id) ? `Remover ${theme.title} dos favoritos` : `Favoritar ${theme.title}`} data-testid={`button-favorite-theme-card-${theme.id}`}><Heart size={20} strokeWidth={1.8} fill={favoriteThemeIds.includes(theme.id) ? 'currentColor' : 'none'} /></button></span>
                  <span className="theme-cover-copy"><b>{theme.title}</b><small>{theme.description}</small><i>{index === themeIndex ? 'Toque novamente para abrir' : 'ver objetivo'}</i></span>
                 </div>;
              })}
            </div>
             <button className="theme-carousel-arrow theme-carousel-arrow-next" onClick={() => navigateThemeCarousel(1)} disabled={!visibleThemes.length} aria-label="Próximo objetivo" title="Próximo objetivo" data-testid="button-next-theme"><ChevronRight size={20} /></button>
            <div className="carousel-dots" aria-label="Posição do objetivo">{visibleThemes.map((theme, index) => <button key={theme.id} className={index === themeIndex ? 'is-active' : ''} onClick={() => moveThemeIndex(index)} aria-label={`Selecionar ${theme.title}`} data-testid={`button-theme-dot-${theme.id}`} />)}</div>
          </div>
          {themesError && <div className="app-inline-error" data-testid="status-themes-error"><span>Não conseguimos atualizar os objetivos.</span><button onClick={() => queryClientRef.invalidateQueries({ queryKey: getListQuestionThemesQueryKey() })} data-testid="button-retry-themes">Tentar novamente <RotateCw size={13} /></button></div>}
          <p className="deck-note"><Sparkles size={14} /> Uma pergunta por vez. O resto acontece entre vocês.</p>
         </section>}
      </> : <>
        <header className="question-header" data-testid="header-question">
           <button className="decks-back-pill" onClick={() => { resetQuestionHistory(); setActiveDeckId(null); setFavoriteMode(false); setDailyMode(false); setThemeId(null); }} data-testid="button-back-decks"><ChevronLeft size={17} /> Decks</button>
          <div className="question-header-count" data-testid="text-question-position">{String(dailyPosition).padStart(2, '0')} <span>/ {String(questions.length || dailyTotal).padStart(2, '0')}</span></div>
        </header>
        <section className={`question-view-stage ${showInvitePrompt ? 'has-invite-prompt' : ''}`}>
           <div className="question-navigation" aria-label="Navegação entre perguntas">
             <button
               className="question-navigation-button question-navigation-previous"
               onClick={previousQuestion}
               aria-label="Pergunta anterior"
               title="Pergunta anterior"
               data-testid="button-previous-question-arrow"
             >
               <ChevronLeft size={21} />
             </button>
             <div className="question-card-stack">
              <div className="question-mode-bar" aria-label="Modo da carta">
                <button className={`question-mode-button ${!writingOpen ? 'is-active' : ''}`} onClick={toggleQuestionMode} aria-label={randomMode ? 'Alternar para perguntas sequenciais' : 'Alternar para perguntas aleatórias'} data-testid="button-random-question"><Shuffle size={13} /> {randomMode ? 'Aleatória' : 'Sequencial'}</button>
                <button className={`question-mode-button ${writingOpen ? 'is-active' : ''}`} onClick={() => setWritingOpen(open => !open)} aria-pressed={writingOpen} data-testid="button-writing-mode"><Feather size={13} /> {writingOpen ? 'Escrevendo' : 'Escrever'}</button>
             </div>
              {(allQuestionsMode ? allQuestionsQuery.isLoading : questionsQuery.isLoading) ? <div className="question-card question-card-loading" data-testid="loading-questions"><div className="loading-pill" /><div className="loading-copy" /><div className="loading-copy short" /></div> : (allQuestionsMode ? allQuestionsQuery.isError : questionsQuery.isError) ? <div className="question-error" data-testid="status-questions-error"><p>Esta seleção não abriu agora.</p><button onClick={() => (allQuestionsMode ? allQuestionsQuery.refetch() : questionsQuery.refetch())} data-testid="button-retry-questions">Tentar novamente <RotateCw size={14} /></button></div> : currentQuestion && <div className={`question-card-layers ${questionSwipeExit ? 'is-swiping' : ''}`}>
                {secondStackQuestion && <article
                  key={`underlay-${secondStackQuestion.id}`}
                  className={`question-card question-card-underlay question-gradient-${secondStackQuestionIndex! % 4}`}
                  aria-hidden="true"
                >
                  <div className="question-card-grain" />
                  <div className="question-card-top"><span>{secondStackTheme?.title}</span><div className="question-card-brand-side"><strong>Perguntas<br /><i>de Conexão</i></strong></div></div>
                </article>}
                {nextStackQuestion && <article
                  key={`back-${nextStackQuestion.id}`}
                  className={`question-card question-card-back question-gradient-${nextQuestionIndex! % 4}`}
                  aria-hidden="true"
                >
                  <div className="question-card-grain" />
                  <div className="question-card-top"><span>{nextStackTheme?.title}</span><div className="question-card-brand-side"><strong>Perguntas<br /><i>de Conexão</i></strong></div></div>
                  <div className="question-card-copy"><p>{nextStackQuestion.text}</p></div>
                  <div className="question-card-foot"><span>não existe resposta certa</span><span className="question-card-progress"><i /><i /><i /></span></div>
                </article>}
                <article
               key={currentQuestion.id}
                 className={`question-card question-card-front question-gradient-${questionIndex % 4} ${writingOpen ? 'is-writing' : ''} ${isQuestionDragging ? 'is-dragging' : ''} ${questionSwipeExit ? `is-swiping-out-${questionSwipeExit}` : ''}`}
               onPointerDown={handleQuestionPointerDown}
               onPointerMove={handleQuestionPointerMove}
               onPointerUp={finishQuestionPointer}
               onPointerCancel={handleQuestionPointerCancel}
               style={{ '--question-drag-offset': `${questionDragOffset}px` } as CSSProperties}
               data-testid={`card-question-${currentQuestion.id}`}
             >
              <div className="question-card-grain" />
               <div className="question-card-top"><span data-testid="text-question-theme">{selectedTheme?.title}</span><div className="question-card-brand-side"><strong data-testid="text-card-brand">Perguntas<br /><i>de Conexão</i></strong></div></div>
               <div className="question-card-copy"><p data-testid={`text-question-${currentQuestion.id}`}>{currentQuestion.text}</p></div>
              {writingOpen && <div className="question-response"><textarea value={currentResponse} onChange={event => setResponses(current => ({ ...current, [currentQuestion.id]: event.target.value }))} placeholder="Escreva aqui, se quiser..." aria-label="Sua resposta para esta pergunta" data-testid={`textarea-response-${currentQuestion.id}`} /></div>}
              <div className="question-card-foot"><span>não existe resposta certa</span><span className="question-card-progress"><i /><i /><i /></span></div>
                <button className={`question-favorite-button ${saved.includes(currentQuestion.id) ? 'is-saved' : ''}`} onClick={() => toggleSaved(currentQuestion.id)} aria-label={saved.includes(currentQuestion.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-pressed={saved.includes(currentQuestion.id)} data-testid={`button-favorite-question-${currentQuestion.id}`}><Star size={16} fill={saved.includes(currentQuestion.id) ? 'currentColor' : 'none'} /></button>
                </article>
              </div>}
             </div>
             <button
               className="question-navigation-button question-navigation-next"
               onClick={nextQuestion}
               aria-label="Próxima pergunta"
               title="Próxima pergunta"
               data-testid="button-next-question-arrow"
             >
               <ChevronRight size={21} />
             </button>
          </div>
           {showInvitePrompt && <aside className="invite-prompt-card" aria-labelledby="invite-prompt-title" data-testid="card-invite-prompt">
             <div className="invite-prompt-icon"><Users size={16} /></div>
             <div className="invite-prompt-copy">
               <span>traga alguém</span>
               <strong id="invite-prompt-title">Uma pergunta fica melhor com outra pessoa.</strong>
               <small>Convide alguém para jogar com você.</small>
             </div>
             <button className="invite-prompt-action" onClick={() => setInviteOpen(true)} data-testid="button-open-invite-prompt">Convidar <Send size={14} /></button>
           </aside>}
           {writingOpen && <button className="writing-done-button" onClick={() => setWritingOpen(false)} data-testid="button-writing-done"><Check size={16} /> Concluído</button>}
        </section>
        <p className="question-hint" data-testid="text-question-hint">deslize ou use as setas para continuar</p>
      </>}
      <nav className="app-bottom-nav" aria-label="Navegação principal" data-testid="nav-bottom">
          <div className="app-nav-identity"><span className="app-nav-identity-mark"><Feather size={15} /></span><span className="app-nav-identity-copy"><strong>Perguntas</strong><small>de Conexão</small></span></div>
           <button type="button" className="app-nav-toggle" onClick={toggleNavCollapsed} aria-label={navCollapsed ? 'Mostrar menu lateral' : 'Esconder menu lateral'} aria-pressed={navCollapsed} title={navCollapsed ? 'Mostrar menu lateral' : 'Esconder menu lateral'} data-testid="button-toggle-nav"><span className="nav-toggle-icon">{navCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</span></button>
          <p className="app-nav-label">Navegação</p>
         {navItems.map(item => { const Icon = item.icon; return <button key={item.id} className={activeNav === item.id ? 'is-active' : ''} onClick={() => openDeckTab(item.id)} data-testid={`button-nav-${item.id}`}><Icon size={17} strokeWidth={1.8} /><span className="nav-item-label">{item.label}</span><span className={`nav-dot nav-dot-${item.id}`} /></button>; })}
          <div className="app-nav-footer"><span className="app-nav-status"><span /> pronto para a próxima conversa</span><span className="app-nav-version">PC · 01</span></div>
      </nav>
    </main>
    <InstallAppPrompt />
      {dailyFormOpen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="daily-form-title">
          <div className="app-modal daily-form-modal">
            <button className="app-modal-close" onClick={closeDailyForm} aria-label="Fechar perguntas pra hoje" data-testid="button-close-daily-form"><X size={18} /></button>
            <p className="modal-eyebrow">perguntas pra hoje</p>
            <div className="daily-form-progress" aria-label={`Passo ${dailyStep + 1} de 3`}>
              <div className="onboarding-progress"><span style={{ width: `${((dailyStep + 1) / 3) * 100}%` }} /></div>
              <span className="onboarding-progress-value">Passo {dailyStep + 1} de 3</span>
            </div>
            <h2 id="daily-form-title">{dailyStep === 0 ? <>Como vocês estão <em>agora?</em></> : dailyStep === 1 ? <>O que combina <em>com agora?</em></> : <>Quantas perguntas <em>vocês querem?</em></>}</h2>
            <p>{dailyStep === 0 ? 'Escolha o que melhor descreve o momento de vocês.' : dailyStep === 1 ? 'Escolha o clima que combina com esta conversa.' : 'Definam o tamanho do baralho para hoje.'}</p>
            {dailyStep === 0 && <fieldset className="daily-form-group">
              <legend>Como vocês estão hoje?</legend>
              <div className="daily-option-grid">
                {dailyMoodOptions.map(option => <button key={option.value} type="button" className={`daily-option ${dailyMood === option.value ? 'is-selected' : ''}`} onClick={() => setDailyMood(option.value)} aria-pressed={dailyMood === option.value} data-testid={`button-daily-mood-${option.value}`}>{option.label}</button>)}
              </div>
              <button onClick={continueDailyForm} disabled={!dailyMood} className="app-primary-button daily-form-submit" data-testid="button-daily-continue-mood">Continuar <ArrowRight size={16} /></button>
            </fieldset>}
            {dailyStep === 1 && <fieldset className="daily-form-group">
              <legend>O que combina mais com agora?</legend>
              <div className="daily-option-grid">
                {dailyVibeOptions.filter(option => option.value !== 'esquentar' || themes.some(theme => theme.audience === '18+')).map(option => <button key={option.value} type="button" className={`daily-option ${dailyVibe === option.value ? 'is-selected' : ''}`} onClick={() => setDailyVibe(option.value)} aria-pressed={dailyVibe === option.value} data-testid={`button-daily-vibe-${option.value}`}>{option.label}</button>)}
              </div>
              <div className="daily-step-actions">
                <button onClick={() => setDailyStep(step => Math.max(0, step - 1))} className="app-secondary-button" data-testid="button-daily-back-vibe"><ChevronLeft size={16} /> Voltar</button>
                <button onClick={continueDailyForm} disabled={!dailyVibe} className="app-primary-button" data-testid="button-daily-continue-vibe">Continuar <ArrowRight size={16} /></button>
              </div>
            </fieldset>}
            {dailyStep === 2 && <fieldset className="daily-form-group">
              <legend>Quantas perguntas vocês querem?</legend>
              <div className="daily-option-grid daily-count-grid">
                {dailyCountOptions.map(option => <button key={option} type="button" className={`daily-option ${!dailyCountCustom && dailyCount === option ? 'is-selected' : ''}`} onClick={() => { setDailyCountCustom(false); setDailyCount(option); }} aria-pressed={!dailyCountCustom && dailyCount === option} data-testid={`button-daily-count-${option}`}>{option} perguntas</button>)}
                <button type="button" className={`daily-option ${dailyCountCustom ? 'is-selected' : ''}`} onClick={chooseCustomDailyCount} aria-pressed={dailyCountCustom} data-testid="button-daily-count-custom">Outro número</button>
              </div>
              {dailyCountCustom && <label className="daily-custom-count">Quantidade personalizada<input type="number" min={3} max={30} step={1} value={dailyCustomCount} onChange={event => updateDailyCustomCount(event.target.value)} aria-label="Quantidade personalizada de perguntas" data-testid="input-daily-custom-count" /><small>Escolha entre 3 e 30 perguntas.</small></label>}
              <div className="daily-step-actions">
                <button onClick={() => setDailyStep(step => Math.max(0, step - 1))} className="app-secondary-button" data-testid="button-daily-back-count"><ChevronLeft size={16} /> Voltar</button>
                <button onClick={generateDailyDeck} disabled={!dailyMood || !dailyVibe || dailyCount < 3} className="app-primary-button" data-testid="button-generate-daily-deck">Montar meu baralho <ArrowRight size={16} /></button>
              </div>
            </fieldset>}
          </div>
        </div>
      )}
      {deckMenu && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="deck-menu-title" onMouseDown={event => event.target === event.currentTarget && closeDeckMenu()}>
          <div className="app-modal deck-menu-modal">
            <button className="app-modal-close" onClick={closeDeckMenu} aria-label="Fechar ações do baralho" data-testid="button-close-deck-menu"><X size={18} /></button>
            {deckMenuView === 'menu' && <>
              <p className="modal-eyebrow">seu baralho</p>
              <h2 id="deck-menu-title">O que você quer <em>mudar?</em></h2>
              <p>Personalize este baralho ou retire-o do seu histórico.</p>
              <div className="deck-menu-actions">
                <button className="deck-menu-action" onClick={() => { setDeckRenameValue(deckMenu.label); setDeckMenuView('rename'); }} data-testid="button-rename-daily-deck"><span className="deck-menu-action-icon"><Feather size={16} /></span><span><strong>Mudar o nome</strong><small>Escolha como ele aparece para você</small></span><ArrowRight size={15} /></button>
                <button className="deck-menu-action" onClick={() => { setDeckCoverUploadError(''); setDeckMenuView('cover'); }} data-testid="button-change-daily-deck-cover"><span className={`deck-menu-action-icon deck-cover-${isDeckCoverId(deckMenu.cover) ? deckMenu.cover : 'custom'}`} style={deckCoverStyle(deckMenu.cover)}><span className="deck-cover-swatch" /></span><span><strong>Mudar a imagem</strong><small>Escolha uma nova capa ou foto</small></span><ArrowRight size={15} /></button>
                <button className="deck-menu-action deck-menu-action-danger" onClick={() => setDeckMenuView('delete')} data-testid="button-delete-daily-deck"><span className="deck-menu-action-icon"><X size={16} /></span><span><strong>Apagar</strong><small>Remover do seu histórico</small></span><ArrowRight size={15} /></button>
              </div>
            </>}
            {deckMenuView === 'rename' && <>
              <p className="modal-eyebrow">mudar o nome</p>
              <h2 id="deck-menu-title">Dê um nome <em>para este momento.</em></h2>
              <p>Esse nome fica salvo junto com o seu baralho.</p>
              <input autoFocus value={deckRenameValue} onChange={event => setDeckRenameValue(event.target.value)} onKeyDown={event => event.key === 'Enter' && renamePersonalizedDeck(deckMenu.id, deckRenameValue)} className="app-text-input" aria-label="Nome do baralho" data-testid="input-rename-daily-deck" />
              <div className="deck-menu-footer"><button className="app-secondary-button" onClick={() => setDeckMenuView('menu')} data-testid="button-cancel-rename-daily-deck">Voltar</button><button className="app-primary-button" onClick={() => renamePersonalizedDeck(deckMenu.id, deckRenameValue)} disabled={!deckRenameValue.trim()} data-testid="button-save-rename-daily-deck">Salvar <Check size={16} /></button></div>
            </>}
            {deckMenuView === 'cover' && <>
              <p className="modal-eyebrow">mudar a imagem</p>
              <h2 id="deck-menu-title">Escolha outra <em>capa.</em></h2>
              <p>A imagem ajuda a reconhecer o clima de cada baralho.</p>
              <div className="deck-cover-picker" role="radiogroup" aria-label="Capas disponíveis">
                {deckCoverOptions.map(option => <button key={option.id} className={`deck-cover-option deck-cover-${option.id} ${deckMenu.cover === option.id ? 'is-selected' : ''}`} onClick={() => updatePersonalizedDeckCover(deckMenu.id, option.id)} role="radio" aria-checked={deckMenu.cover === option.id} aria-label={option.label} data-testid={`button-select-deck-cover-${option.id}`}><span className="deck-cover-orbit" /><span className="deck-cover-spark" /><small>{option.label}</small>{deckMenu.cover === option.id && <Check size={15} />}</button>)}
              </div>
              <input ref={deckCoverInputRef} className="sr-only" type="file" accept="image/*" onChange={event => handleDeckCoverUpload(event.target.files?.[0])} data-testid="input-upload-deck-cover" />
              <button className="deck-upload-cover-button" onClick={() => deckCoverInputRef.current?.click()} disabled={isUploadingDeckCover} data-testid="button-upload-deck-cover"><Upload size={16} /> {isUploadingDeckCover ? 'Preparando imagem…' : 'Usar uma foto do celular'}</button>
              {deckCoverUploadError && <p className="deck-cover-upload-error" role="alert">{deckCoverUploadError}</p>}
              <button className="app-secondary-button deck-cover-back-button" onClick={() => setDeckMenuView('menu')} data-testid="button-cancel-cover-change">Voltar</button>
            </>}
            {deckMenuView === 'delete' && <>
              <div className="deck-delete-mark"><X size={20} /></div>
              <p className="modal-eyebrow">apagar baralho</p>
              <h2 id="deck-menu-title">Apagar este <em>baralho?</em></h2>
              <p>“{deckMenu.label}” será removido do seu histórico. Essa ação não pode ser desfeita.</p>
              <div className="deck-menu-footer"><button className="app-secondary-button" onClick={() => setDeckMenuView('menu')} data-testid="button-cancel-delete-daily-deck">Voltar</button><button className="app-primary-button deck-delete-confirm" onClick={() => deletePersonalizedDeck(deckMenu.id)} data-testid="button-confirm-delete-daily-deck">Apagar <X size={16} /></button></div>
            </>}
          </div>
        </div>
      )}
      {isPreparingDeck && (
        <div className="app-modal-backdrop preparing-deck-backdrop" role="status" aria-live="polite">
          <div className="deck-preparing">
            <div className="deck-preparing-stack" aria-hidden="true">
              <span className="preparing-card preparing-card-back" />
              <span className="preparing-card preparing-card-middle" />
              <span className="preparing-card preparing-card-front" />
            </div>
            <p className="modal-eyebrow">um momento só</p>
            <h2>Preparando seu <em>baralho…</em></h2>
            <p>Escolhendo perguntas que combinam com vocês agora.</p>
            <div className="preparing-dots" aria-hidden="true"><span /><span /><span /></div>
          </div>
        </div>
      )}
     {adultThemePrompt && <div className="app-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="adult-theme-title"><div className="app-modal adult-theme-modal"><button className="app-modal-close" onClick={() => setAdultThemePrompt(null)} aria-label="Fechar aviso" data-testid="button-cancel-adult-theme"><X size={18} /></button><div className="adult-theme-mark" role="img" aria-label="Conteúdo para maiores de 18 anos"><Flame size={19} strokeWidth={2.1} aria-hidden="true" /></div><p className="modal-eyebrow">um espaço para dois</p><h2 id="adult-theme-title">{adultThemePrompt.title}<em>.</em></h2><p>Este espaço tem perguntas mais ousadas, pensadas para casais. Quer continuar?</p><button onClick={confirmAdultTheme} className="app-primary-button" data-testid="button-confirm-adult-theme">Quero continuar <ArrowRight size={16} /></button><button onClick={() => setAdultThemePrompt(null)} className="app-secondary-button" data-testid="button-cancel-adult-theme-secondary">Voltar</button></div></div>}
    {welcomeOpen && <div className="app-modal-backdrop"><div className="app-modal welcome-app-modal"><button className="app-modal-close" onClick={() => setWelcomeOpen(false)} aria-label="Fechar apresentação" data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-app-mark"><Feather size={19} /></div><p className="modal-eyebrow">antes da primeira carta</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="app-text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="app-primary-button" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
     {settingsOpen && <div className="app-modal-backdrop"><div className="app-modal settings-app-modal"><button className="app-modal-close" onClick={() => setSettingsOpen(false)} aria-label="Fechar ajustes" data-testid="button-close-settings"><X size={18} /></button><p className="modal-eyebrow">seu espaço</p><h2>Ajustes da<br /><em>experiência.</em></h2><div className="settings-row"><span>Perfil</span><strong data-testid="text-settings-name">{`${isGuest ? (guestDisplayName || buyerName || 'Visitante') : (buyerName || 'Visitante')} · ${isOwner ? 'Dono' : 'Convidado'}`}</strong></div><div className="settings-row"><span>Acesso</span><strong data-testid="text-settings-access">{sessionQuery.data?.accessGranted || accessQuery.data?.hasAccess ? activeAccess?.packageName || 'Ativo' : 'Demonstração'}</strong></div><div className="settings-row"><span>Salvas</span><strong data-testid="text-settings-saved">{saved.length} pergunta{saved.length === 1 ? '' : 's'}</strong></div><button onClick={() => { setSettingsOpen(false); setWelcomeOpen(true); }} className="app-secondary-button" data-testid="button-edit-name">Editar como te chamar</button></div></div>}
     {inviteOpen && isOwner && <div className="app-modal-backdrop"><div className="app-modal invite-app-modal"><button className="app-modal-close" onClick={() => setInviteOpen(false)} aria-label="Fechar convite" data-testid="button-close-invite"><X size={18} /></button>{inviteResult ? <><div className="invite-success-mark"><Check size={21} /></div><p className="modal-eyebrow">convite pronto</p><h2>Leve essa pergunta<br /><em>para mais perto.</em></h2><p>Compartilhe este endereço com <strong>{inviteResult.guestName}</strong>.</p><div className="invite-copy-row"><input readOnly value={inviteResult.inviteUrl} className="app-text-input" data-testid="input-invite-url" /><button onClick={copyInvite} aria-label="Copiar convite" data-testid="button-copy-invite"><Copy size={17} /></button></div><button onClick={() => { setInviteResult(null); setGuestName(''); }} className="app-text-button" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></> : <><p className="modal-eyebrow">um convite especial</p><h2>Quem você quer<br /><em>trazer para a conversa?</em></h2><input value={guestName} onChange={e => setGuestName(e.target.value)} className="app-text-input" placeholder="Nome de quem vai receber" data-testid="input-guest-name" /><button onClick={makeInvite} className="app-primary-button" disabled={!guestName.trim() || createInvite.isPending || (!!sessionId && !canInvite)} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : canInvite || !sessionId ? 'Gerar convite' : 'Sem convites disponíveis'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="app-form-error" data-testid="status-invite-error">Não foi possível gerar agora. Tente novamente.</p>}</>}</div></div>}
  </div>;
}

 function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const inviteQuery = useGetInvite(token, { query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) } });
  const invite = inviteQuery.data;
  const acceptInvite = () => {
    if (invite && token) {
      safeSetItem('conexao-guest-token', token);
      safeSetItem('conexao-guest-name', invite.guestName);
      safeSetItem('conexao-name', invite.guestName);
      safeSetItem('conexao-role', 'guest');
    }
  };
  return <div className="invite-page-shell"><main className="invite-entry"><div className="invite-entry-orbit" /><div className="invite-entry-card">{inviteQuery.isLoading ? <><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></> : invite ? <><div className="invite-symbol"><Feather size={23} /></div><p className="section-kicker light-kicker">um convite para você</p><h1><em>{invite.guestName}</em>, tem uma<br />conversa te esperando.</h1><p className="invite-entry-copy">Você foi convidado para participar de <strong>{invite.packageName}</strong>. Aqui, convidados podem responder e descobrir — só não podem criar novos convites.</p><Link href="/app" onClick={acceptInvite} className="button button-salmon" data-testid="link-accept-invite">Aceitar convite <ArrowRight size={16} /></Link><span className="guest-note"><Users size={14} /> Você entra como convidado</span></> : <><div className="invite-symbol"><X size={23} /></div><p className="section-kicker light-kicker">convite não encontrado</p><h1>Este endereço<br /><em>já mudou de lugar.</em></h1><p className="invite-entry-copy">Peça a quem te convidou para enviar um novo acesso.</p><Link href="/app" className="button button-salmon" data-testid="link-open-demo">Conhecer a experiência <ArrowRight size={16} /></Link></>}</div></main></div>;
}

function ProtectedExperienceRoute() {
  const [, navigate] = useLocation();
  const storedSessionId = safeGetItem('conexao-session')?.trim() || '';
  const storedGuestToken = safeGetItem('conexao-guest-token')?.trim() || '';
  const sessionQuery = useGetQuestionSession(storedSessionId, {
    query: {
      enabled: !!storedSessionId,
      queryKey: getGetQuestionSessionQueryKey(storedSessionId),
    },
  });
  const guestQuery = useGetInvite(storedGuestToken, {
    query: {
      enabled: !!storedGuestToken,
      queryKey: getGetInviteQueryKey(storedGuestToken),
    },
  });
  const hasAccess = sessionQuery.data?.accessGranted || guestQuery.data?.hasAccess;
  const isChecking = (storedSessionId && sessionQuery.isPending) || (storedGuestToken && guestQuery.isPending);

  useEffect(() => {
    if (!storedSessionId && !storedGuestToken) {
      navigate('/', { replace: true });
      return;
    }
    if (!isChecking && !hasAccess) {
      navigate('/', { replace: true });
    }
  }, [hasAccess, isChecking, navigate, storedGuestToken, storedSessionId]);

  if (isChecking || !hasAccess) {
    return <div className="access-gate-overlay" role="status" aria-live="polite"><div className="access-gate"><span className="access-gate-mark"><Feather size={18} /></span><p>Verificando seu acesso…</p></div></div>;
  }

  return <AppExperienceReference />;
}

 function Router() {
   return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/onboarding" component={Onboarding} /><Route path="/app" component={ProtectedExperienceRoute} /><Route path="/invite/:token" component={InvitePage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;