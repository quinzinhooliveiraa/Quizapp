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
  useReceiveCheckoutWebhook,
  type Question,
  type QuestionTheme,
} from '@workspace/api-client-react';
import { Heart, ArrowRight, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Copy, Download, Feather, Link as LinkIcon, Menu, Quote, RotateCw, Send, Settings2, Shuffle, Sparkles, Star, Users, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import Onboarding from '@/pages/Onboarding';

const queryClient = new QueryClient();

const fallbackThemes = [
  { id: 'presenca', title: 'Presença', description: 'O que acontece quando vocês chegam inteiros à conversa.', count: 12 },
  { id: 'memorias', title: 'Memórias vivas', description: 'Histórias que ainda moram entre vocês.', count: 10 },
  { id: 'amanha', title: 'Amanhã', description: 'Desejos, planos e o que vale construir lado a lado.', count: 11 },
];
const fallbackQuestions = [
  { id: 'q-1', themeId: 'presenca', text: 'O que você gostaria que eu percebesse mais nos seus dias?', intensity: 'gentle' as const },
  { id: 'q-2', themeId: 'presenca', text: 'Em que momento recente você se sentiu verdadeiramente acompanhado por mim?', intensity: 'honest' as const },
  { id: 'q-3', themeId: 'presenca', text: 'Que parte sua você tem escondido por medo de mudar o jeito como sou visto?', intensity: 'deep' as const },
  { id: 'q-4', themeId: 'memorias', text: 'Qual lembrança pequena nossa você gostaria de guardar para sempre?', intensity: 'gentle' as const },
  { id: 'q-5', themeId: 'memorias', text: 'Que conversa do passado ainda merece uma segunda chance?', intensity: 'honest' as const },
  { id: 'q-6', themeId: 'amanha', text: 'Que vida parece possível quando você imagina que estamos do mesmo lado?', intensity: 'deep' as const },
  { id: 'q-7', themeId: 'amanha', text: 'Qual pequeno plano faria esta semana parecer mais nossa?', intensity: 'gentle' as const },
  { id: 'q-8', themeId: 'memorias', text: 'Que detalhe de quando nos conhecemos ainda te faz sorrir?', intensity: 'honest' as const },
];

const DAILY_DECK_STORAGE_KEY = 'conexao-daily-deck';
const SEEN_BY_THEME_STORAGE_KEY = 'conexao-seen-by-theme';
const SAVED_QUESTIONS_STORAGE_KEY = 'conexao-saved-question-ids';
const FAVORITE_THEMES_STORAGE_KEY = 'conexao-favorite-theme-ids';

function readStoredArray(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readStoredRecord(key: string): Record<string, string[]> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).map(([id, ids]) => [id, Array.isArray(ids) ? ids.filter((item): item is string => typeof item === 'string') : []]));
  } catch {
    return {};
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

function selectDailyQuestions(allQuestions: Question[], date: string) {
  const available = allQuestions.length ? allQuestions : fallbackQuestions;
  const byTheme = new Map<string, Question[]>();
  available.forEach(question => byTheme.set(question.themeId, [...(byTheme.get(question.themeId) || []), question]));
  const themeIds = deterministicShuffle([...byTheme.keys()], date);
  const mixed: Question[] = [];
  let round = 0;
  while (mixed.length < Math.min(10, available.length) && themeIds.length) {
    themeIds.forEach(themeId => {
      const options = deterministicShuffle(byTheme.get(themeId) || [], `${date}-${themeId}-${round}`);
      if (options[0] && !mixed.some(question => question.id === options[0].id)) mixed.push(options[0]);
    });
    round += 1;
    if (round > available.length) break;
  }
  return deterministicShuffle(mixed.length >= 8 ? mixed : available, date).slice(0, Math.min(10, available.length)).map(question => question.id);
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
    if (isStandaloneApp() || localStorage.getItem('conexao-install-dismissed') === 'true') return;

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
    localStorage.setItem('conexao-install-dismissed', 'true');
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
  const storedSessionId = localStorage.getItem('conexao-session')?.trim() || '';
  const storedGuestToken = localStorage.getItem('conexao-guest-token')?.trim() || '';
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
  const receiveWebhook = useReceiveCheckoutWebhook();
  const [checkoutState, setCheckoutState] = useState<'idle' | 'sent'>('idle');
  const checkout = () => {
    receiveWebhook.mutate({ data: { eventId: `demo-${Date.now()}`, eventType: 'payment.completed', buyerEmail: 'demo@conexao.local', buyerName: 'Visitante', packageId: selectedPackage, paymentReference: 'demo-access' } }, { onSuccess: () => setCheckoutState('sent'), onError: () => setCheckoutState('sent') });
  };
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
          <article className="package-card package-featured"><div className="package-tag">para dois</div><div className="package-top"><h3>Casal</h3><span className="package-price">R$ 39<span>/único</span></span></div><p>Para criar um espaço só de vocês — em qualquer fase da história.</p><ul><li><Check size={15} /> Baralho completo</li><li><Check size={15} /> 1 convite especial</li><li><Check size={15} /> Modo resposta e favoritos</li></ul><button onClick={() => { setSelectedPackage('couple'); setCheckoutOpen(true); }} className="button button-primary button-full" data-testid="button-buy-couple">Escolher Casal <ArrowRight size={16} /></button></article>
          <article className="package-card"><div className="package-tag">para a roda toda</div><div className="package-top"><h3>Família & amigos</h3><span className="package-price">R$ 59<span>/único</span></span></div><p>Para reunir as pessoas que fazem uma casa ser casa, mesmo à distância.</p><ul><li><Check size={15} /> Baralho completo</li><li><Check size={15} /> 5 convites especiais</li><li><Check size={15} /> Modo resposta e favoritos</li></ul><button onClick={() => { setSelectedPackage('family'); setCheckoutOpen(true); }} className="button button-outline button-full" data-testid="button-buy-family">Escolher Família <ArrowRight size={16} /></button></article>
        </div>
      </section>

      <section className="quote-section"><Quote size={35} strokeWidth={1} /><blockquote>“A pergunta certa não abre uma conversa.<br /><em>Abre uma pessoa.</em>”</blockquote><span>— uma ideia para levar com vocês</span></section>
    </main>
    {checkoutOpen && <div className="modal-backdrop"><div className="checkout-modal"><button className="modal-close" onClick={() => setCheckoutOpen(false)} data-testid="button-close-checkout"><X size={18} /></button>{checkoutState === 'sent' ? <><div className="success-seal"><Check size={24} /></div><h2>A experiência está pronta.</h2><p>Este é um checkout de demonstração. Você já pode abrir seu baralho e começar uma conversa.</p><Link href="/app" onClick={() => setCheckoutOpen(false)} className="button button-primary button-full" data-testid="link-checkout-app">Abrir experiência <ArrowRight size={16} /></Link></> : <><p className="section-kicker">acesso imediato</p><h2>Seu baralho começa<br /><em>com uma pergunta.</em></h2><p>Você escolheu o pacote <strong>{selectedPackage === 'couple' ? 'Casal' : 'Família & amigos'}</strong>. Em uma compra real, o acesso chega no seu e-mail.</p><button onClick={checkout} disabled={receiveWebhook.isPending} className="button button-primary button-full" data-testid="button-confirm-checkout">{receiveWebhook.isPending ? 'Preparando seu acesso…' : 'Continuar para pagamento'} <ArrowRight size={16} /></button></>}</div></div>}
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
      const availableCardHeight = Math.max(250, height - 250);
      const cardWidth = Math.min(width * 0.88, 384, availableCardHeight * 0.75);
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
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('conexao-session') || '');
  const [welcomeOpen, setWelcomeOpen] = useState(!localStorage.getItem('conexao-name'));
  const [buyerName, setBuyerName] = useState(() => localStorage.getItem('conexao-name') || '');
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
    localStorage.setItem('conexao-name', buyerName.trim());
    createSession.mutate({ data: { buyerName: buyerName.trim(), packageId: 'couple' } }, {
      onSuccess: session => { setSessionId(session.id); localStorage.setItem('conexao-session', session.id); setWelcomeOpen(false); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(session.id) }); },
      onError: () => setWelcomeOpen(false),
    });
  };
  const makeInvite = () => {
    if (!sessionId || !guestName.trim()) return;
    createInvite.mutate({ sessionId, data: { guestName: guestName.trim() } }, { onSuccess: result => { setInviteResult(result); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) }); }, onError: () => setInviteResult({ inviteUrl: `${window.location.origin}/invite/demo-conexao`, guestName: guestName.trim() }) });
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
      {themeId && <aside className="invite-panel ritual-invite-panel"><div className="invite-icon"><Users size={20} /></div><div><p className="section-kicker">para esta conversa</p><h3>Traga alguém</h3></div><p className="invite-copy">Uma pergunta pode encontrar vocês em qualquer lugar.</p><button onClick={() => setInviteOpen(true)} className="button ritual-invite-button" disabled={!canInvite && !!sessionId} data-testid="button-open-invite">Traga alguém <Send size={15} /></button><span className="invite-limit">{activeAccess ? `${inviteLimit - invitesUsed} convites disponíveis` : 'Convites disponíveis após o acesso'}</span></aside>}
    </main>
    {welcomeOpen && <div className="modal-backdrop"><div className="welcome-modal"><button className="modal-close" onClick={() => setWelcomeOpen(false)} data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-flourish"><Feather size={22} /></div><p className="section-kicker">antes de começar</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="button button-primary button-full" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
    {inviteOpen && <div className="modal-backdrop"><div className="invite-modal"><button className="modal-close" onClick={() => setInviteOpen(false)} data-testid="button-close-invite"><X size={18} /></button>{inviteResult ? <><div className="success-seal"><Check size={24} /></div><p className="section-kicker">convite pronto</p><h2>Agora essa conversa<br /><em>pode chegar mais longe.</em></h2><p>Compartilhe este endereço com <strong>{inviteResult.guestName}</strong>.</p><div className="copy-row"><input readOnly value={inviteResult.inviteUrl} className="text-input" data-testid="input-invite-url" /><button onClick={copyInvite} className="round-button" aria-label="Copiar convite" data-testid="button-copy-invite"><Copy size={17} /></button></div><button onClick={() => { setInviteResult(null); setGuestName(''); }} className="text-link" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></> : <><p className="section-kicker">um convite especial</p><h2>Quem você quer<br /><em>trazer para a conversa?</em></h2><input value={guestName} onChange={e => setGuestName(e.target.value)} className="text-input" placeholder="Nome de quem vai receber" data-testid="input-guest-name" /><button onClick={makeInvite} className="button button-primary button-full" disabled={!guestName.trim() || createInvite.isPending} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : 'Gerar convite'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="form-error">Não foi possível gerar agora. Tente novamente.</p>}</>}</div></div>}
  </Shell>;
}

function AppExperienceReference() {
  useDeviceViewport();
  const queryClientRef = useQueryClient();
  const { data: themesData, isLoading: themesLoading, isError: themesError } = useListQuestionThemes({ query: { queryKey: getListQuestionThemesQueryKey() } });
  const themes: QuestionTheme[] = themesData?.length ? themesData : fallbackThemes;
  const [themeId, setThemeId] = useState<string | null>(null);
  const [dailyMode, setDailyMode] = useState(false);
  const [favoriteMode, setFavoriteMode] = useState(false);
  const [dailyDeck, setDailyDeck] = useState<string[]>([]);
  const [themeIndex, setThemeIndex] = useState(0);
  const [themeDragOffset, setThemeDragOffset] = useState(0);
  const [isThemeDragging, setIsThemeDragging] = useState(false);
  const themeDragStartX = useRef<number | null>(null);
  const themeDragDelta = useRef(0);
  const themePointerCaptured = useRef(false);
  const suppressThemeClick = useRef(false);
  const [questionDragOffset, setQuestionDragOffset] = useState(0);
  const [isQuestionDragging, setIsQuestionDragging] = useState(false);
  const [questionSwipeExit, setQuestionSwipeExit] = useState<'left' | 'right' | null>(null);
  const [questionSwipeEnter, setQuestionSwipeEnter] = useState<'left' | 'right' | null>(null);
  const questionDragStartX = useRef<number | null>(null);
  const questionDragDelta = useRef(0);
  const questionPointerCaptured = useRef(false);
  const questionSwipeLocked = useRef(false);
  const questionSwipeTimer = useRef<number | null>(null);
  const questionSwipeUnlockTimer = useRef<number | null>(null);
  const [activeNav, setActiveNav] = useState('todos');
  const [saved, setSaved] = useState<string[]>(() => readStoredArray(SAVED_QUESTIONS_STORAGE_KEY));
  const [favoriteThemeIds, setFavoriteThemeIds] = useState<string[]>(() => readStoredArray(FAVORITE_THEMES_STORAGE_KEY));
  const [seenByTheme, setSeenByTheme] = useState<Record<string, string[]>>(() => readStoredRecord(SEEN_BY_THEME_STORAGE_KEY));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [randomMode, setRandomMode] = useState(true);
  const [writingOpen, setWritingOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('conexao-session') || '');
  const [welcomeOpen, setWelcomeOpen] = useState(!localStorage.getItem('conexao-name'));
  const [buyerName, setBuyerName] = useState(() => localStorage.getItem('conexao-name') || '');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [inviteResult, setInviteResult] = useState<any>(null);
  const accessQuery = useGetAccessPreview({ query: { queryKey: ['access-preview'] } });
  const sessionQuery = useGetQuestionSession(sessionId, { query: { enabled: !!sessionId, queryKey: getGetQuestionSessionQueryKey(sessionId) } });
  const allQuestionsMode = dailyMode || favoriteMode;
  const questionParams = { theme: themeId && !allQuestionsMode ? themeId : undefined };
  const questionsQuery = useListQuestions(questionParams, { query: { enabled: !!themeId, queryKey: getListQuestionsQueryKey(questionParams) } });
  const allQuestionsQuery = useListQuestions({}, { query: { enabled: activeNav === 'eu' || allQuestionsMode, queryKey: getListQuestionsQueryKey({}) } });
  const createSession = useCreateQuestionSession();
  const createInvite = useCreateInvite();
  const availableQuestions = useMemo(() => (allQuestionsQuery.data?.length ? allQuestionsQuery.data : fallbackQuestions) as Question[], [allQuestionsQuery.data]);
  useEffect(() => {
    if (activeNav !== 'eu' && !dailyMode) return;
    const date = localDateKey();
    try {
      const stored = JSON.parse(localStorage.getItem(DAILY_DECK_STORAGE_KEY) || 'null') as { date?: string; ids?: string[] } | null;
      const availableIds = new Set(availableQuestions.map(question => question.id));
      const validStored = stored?.date === date && stored.ids?.length && stored.ids.every(id => availableIds.has(id));
      const ids = validStored ? stored.ids || [] : selectDailyQuestions(availableQuestions, date);
      setDailyDeck(ids);
      localStorage.setItem(DAILY_DECK_STORAGE_KEY, JSON.stringify({ date, ids }));
    } catch {
      setDailyDeck(selectDailyQuestions(availableQuestions, date));
    }
  }, [activeNav, allQuestionsQuery.data, availableQuestions, dailyMode]);
  const dailyQuestions = dailyDeck.map(id => availableQuestions.find(question => question.id === id)).filter((question): question is Question => Boolean(question));
  const favoriteQuestions = useMemo(() => saved.map(id => availableQuestions.find(question => question.id === id)).filter((question): question is Question => Boolean(question)), [availableQuestions, saved]);
  const inProgressThemes = useMemo(() => themes.filter(theme => {
    const count = seenByTheme[theme.id]?.length || 0;
    return count > 0 && count < theme.count;
  }), [themes, seenByTheme]);
  const continueThemes = inProgressThemes.length ? inProgressThemes : themes.slice(0, 2);
  const questions = favoriteMode ? favoriteQuestions : dailyMode ? dailyQuestions : themeId ? (questionsQuery.data?.length ? questionsQuery.data : (fallbackQuestions.filter(q => q.themeId === themeId).length ? fallbackQuestions.filter(q => q.themeId === themeId) : fallbackQuestions)) : [];
  const currentQuestion = questions.length ? questions[questionIndex % questions.length] : null;
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit : !!accessQuery.data?.canInvite;
  const inviteLimit = sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed = sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;
  const showInvitePrompt = !!themeId && !!sessionId && invitesUsed === 0 && canInvite && !inviteResult;
  const selectedTheme = themes.find(theme => theme.id === (allQuestionsMode ? currentQuestion?.themeId : themeId));
  const dailyTotal = favoriteMode ? questions.length || 1 : selectedTheme?.count || questions.length || 1;
  const dailyPosition = questions.length ? (questionIndex % questions.length) + 1 : 1;
  const isQuestionView = Boolean(themeId || dailyMode || favoriteMode);
  const markQuestionSeen = (question: Question | null) => {
    if (!question) return;
    setSeenByTheme(current => {
      const previous = current[question.themeId] || [];
      const next = { ...current, [question.themeId]: [...previous.filter(id => id !== question.id), question.id] };
      localStorage.setItem(SEEN_BY_THEME_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const changeTheme = (id: string) => { setFavoriteMode(false); setDailyMode(false); setThemeId(id); setQuestionIndex(0); };
  const openDailyDeck = () => { setActiveNav('eu'); setFavoriteMode(false); setDailyMode(true); setThemeId(null); setQuestionIndex(0); };
  const openFavoritesDeck = () => { setActiveNav('eu'); setFavoriteMode(true); setDailyMode(false); setThemeId(null); setQuestionIndex(0); };
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
    if (index === themeIndex) changeTheme(themes[index]?.id);
    else moveThemeIndex(index);
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
    if (Math.abs(delta) >= 44 && themes.length > 1) {
      const direction = delta < 0 ? 1 : -1;
      const nextIndex = (themeIndex + direction + themes.length) % themes.length;
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
  const nextQuestion = () => setQuestionIndex(i => getAdjacentQuestionIndex(i, 1));
  const previousQuestion = () => setQuestionIndex(i => getAdjacentQuestionIndex(i, -1));
  const nextQuestionIndex = questions.length > 1 ? getAdjacentQuestionIndex(questionIndex, 1) : null;
  const nextStackQuestion = nextQuestionIndex === null ? null : questions[nextQuestionIndex];
  const nextStackTheme = nextStackQuestion ? themes.find(theme => theme.id === nextStackQuestion.themeId) : null;
  const secondStackQuestionIndex = nextQuestionIndex === null ? null : getAdjacentQuestionIndex(nextQuestionIndex, 1);
  const secondStackQuestion = secondStackQuestionIndex === null ? null : questions[secondStackQuestionIndex];
  const secondStackTheme = secondStackQuestion ? themes.find(theme => theme.id === secondStackQuestion.themeId) : null;
  useEffect(() => markQuestionSeen(currentQuestion), [currentQuestion?.id]);
  useEffect(() => { localStorage.setItem(SAVED_QUESTIONS_STORAGE_KEY, JSON.stringify(saved)); }, [saved]);
  useEffect(() => { localStorage.setItem(FAVORITE_THEMES_STORAGE_KEY, JSON.stringify(favoriteThemeIds)); }, [favoriteThemeIds]);
  useEffect(() => () => {
    if (questionSwipeTimer.current !== null) window.clearTimeout(questionSwipeTimer.current);
    if (questionSwipeUnlockTimer.current !== null) window.clearTimeout(questionSwipeUnlockTimer.current);
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
        setQuestionSwipeEnter(delta < 0 ? 'right' : 'left');
        setQuestionDragOffset(0);
        questionSwipeTimer.current = null;
        questionSwipeUnlockTimer.current = window.setTimeout(() => {
          setQuestionSwipeEnter(null);
          questionSwipeLocked.current = false;
          questionSwipeUnlockTimer.current = null;
        }, 390);
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
  const toggleQuestionMode = () => setRandomMode(mode => !mode);
  const currentResponse = currentQuestion ? responses[currentQuestion.id] || '' : '';
  useEffect(() => {
    setWritingOpen(false);
  }, [currentQuestion?.id]);
  const startSession = () => {
    if (!buyerName.trim()) { setWelcomeOpen(false); return; }
    localStorage.setItem('conexao-name', buyerName.trim());
    createSession.mutate({ data: { buyerName: buyerName.trim(), packageId: 'couple' } }, {
      onSuccess: session => { setSessionId(session.id); localStorage.setItem('conexao-session', session.id); setWelcomeOpen(false); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(session.id) }); },
      onError: () => setWelcomeOpen(false),
    });
  };
  const makeInvite = () => {
    if (!sessionId || !guestName.trim()) return;
    createInvite.mutate({ sessionId, data: { guestName: guestName.trim() } }, {
      onSuccess: result => { setInviteResult(result); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) }); },
      onError: () => setInviteResult({ inviteUrl: `${window.location.origin}/invite/demo-conexao`, guestName: guestName.trim() }),
    });
  };
  const copyInvite = () => { if (inviteResult?.inviteUrl) navigator.clipboard?.writeText(inviteResult.inviteUrl); };
  const navItems = [
    { id: 'todos', label: 'Todos' },
    { id: 'favoritos', label: 'Favoritos' },
    { id: 'temas', label: 'Temas' },
    { id: 'eu', label: 'Eu' },
  ];

  return <div className="app-viewport">
     <main className={`connection-app ${isQuestionView ? 'is-question-view' : 'is-deck-view'} ${writingOpen ? 'is-writing-mode' : ''}`}>
       {!isQuestionView ? <>
        <header className="app-header" data-testid="header-decks">
          <div className="app-wordmark" data-testid="text-app-brand"><span className="app-logo-orb"><span /></span><span>Perguntas<br /><b>de Conexão</b></span></div>
          <button className="app-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes" data-testid="button-open-settings"><Settings2 size={21} /></button>
        </header>
         {activeNav === 'eu' ? <section className="deck-home eu-home" aria-labelledby="eu-home-title">
            <div className="eu-heading"><div><p className="eu-kicker">seu espaço</p><h1 id="eu-home-title">Olá, {buyerName || 'por aqui'}.</h1></div><time className="eu-date" dateTime={localDateKey()}>{new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</time></div>
           <section className="eu-daily-card" onClick={openDailyDeck} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openDailyDeck()} data-testid="card-daily-deck"><div className="eu-daily-glow" /><div className="eu-daily-copy"><p className="eu-kicker">seus decks</p><h2>Perguntas de hoje<br /><em>para vocês.</em></h2><p>{dailyQuestions.length || 8} perguntas novas para abrir quando fizer sentido.</p><span className="eu-open-link">Abrir deck <ArrowRight size={16} /></span></div><div className="eu-daily-art"><span className="daily-orbit daily-orbit-one" /><span className="daily-orbit daily-orbit-two" /><div className="daily-mini-card daily-mini-back" /><div className="daily-mini-card daily-mini-front"><span>seu deck</span><Quote size={24} /><strong>uma pergunta<br />de cada vez</strong></div></div></section>
             <section className="eu-section eu-continue-section" aria-labelledby="continue-title"><div className="eu-section-heading"><div><p className="eu-kicker">continue jogando</p><h2 id="continue-title" className="sr-only">Continue jogando</h2></div><span>{inProgressThemes.length ? `${inProgressThemes.length} em andamento` : 'comece por aqui'}</span></div><div className="eu-progress-row">{continueThemes.map(theme => { const seenCount = seenByTheme[theme.id]?.length || 0; const lastQuestionId = seenByTheme[theme.id]?.at(-1); const themeQuestions = availableQuestions.filter(question => question.themeId === theme.id); const resumeIndex = Math.max(0, themeQuestions.findIndex(question => question.id === lastQuestionId)); return <button key={theme.id} className="eu-progress-card" onClick={() => { changeTheme(theme.id); setQuestionIndex(resumeIndex); }} data-testid={`button-continue-theme-${theme.id}`}><div className={`eu-progress-cover theme-cover-${themes.indexOf(theme) % 5}`}><span className="eu-progress-number">{String(seenCount).padStart(2, '0')}</span><Heart className="eu-progress-heart" size={20} fill={favoriteThemeIds.includes(theme.id) ? 'currentColor' : 'none'} /></div><div className="eu-progress-copy"><strong>{theme.title}</strong><small>{seenCount ? `${seenCount} de ${theme.count} perguntas` : 'comece agora'}</small><span className="eu-progress-bar"><i style={{ width: `${Math.min(100, (seenCount / Math.max(theme.count, 1)) * 100)}%` }} /></span><em>Retomar <ArrowRight size={13} /></em></div></button>; })}</div>{continueThemes.length === 0 && <div className="eu-empty-state"><span><Sparkles size={16} /></span><p>Quando uma pergunta ficar pelo caminho, ela aparece aqui para você continuar.</p></div>}</section>
           <section className="eu-section eu-favorites-section" aria-labelledby="favorites-title"><div className="eu-section-heading"><div><p className="eu-kicker">salvos</p><h2 id="favorites-title">Salvos</h2></div><span>{saved.length + favoriteThemeIds.length} salvos</span></div><div className="eu-saved-row"><button className={`eu-collection-card eu-collection-cards ${saved.length ? 'has-content' : ''}`} onClick={openFavoritesDeck} disabled={!saved.length} data-testid="button-favorite-cards"><span className="eu-collection-shade" /><span className="eu-collection-title">Cartas favoritas <b>{saved.length}</b></span>{!saved.length && <small>suas perguntas salvas aparecem aqui</small>}</button><div className="eu-favorite-topics"><p className="eu-favorite-label">Temas favoritos</p><div className="eu-topic-row">{favoriteThemeIds.length ? favoriteThemeIds.map(id => { const theme = themes.find(item => item.id === id); return theme ? <button key={id} className={`eu-topic-card theme-cover-${themes.indexOf(theme) % 5}`} onClick={() => changeTheme(id)} data-testid={`button-favorite-theme-${id}`}><span className="eu-topic-shade" /><strong>{theme.title}</strong><ArrowRight size={15} /></button> : null; }) : <div className="eu-topic-empty">Favorite um tema para encontrá-lo aqui.</div>}</div></div></div></section>
         </section> : <section className="deck-home" aria-labelledby="deck-home-title">
           <div className="deck-home-heading"><h1 id="deck-home-title" data-testid="text-deck-title">Escolha um objetivo pra começar</h1><p className="deck-home-subtitle">Por exemplo, descobrir algo novo, imaginar o que vem</p></div>
          <div className="theme-carousel-wrap">
              <div
                className={`theme-carousel ${isThemeDragging ? 'is-dragging' : ''}`}
                aria-label="Objetivos de conexão"
                onPointerDown={handleThemePointerDown}
                onPointerMove={handleThemePointerMove}
                onPointerUp={finishThemePointer}
                onPointerCancel={handleThemePointerCancel}
                style={{ '--theme-drag-offset': `${themeDragOffset}px` } as CSSProperties}
              >
              {themesLoading && <div className="theme-skeleton" data-testid="loading-themes" />}
              {themes.map((theme, index) => {
                const offset = Math.max(-2, Math.min(2, index - themeIndex));
                 return <div key={theme.id} className={`theme-cover theme-cover-${index % 5} theme-offset-${offset} ${index === themeIndex ? 'is-active' : ''}`} onClick={() => selectThemeCard(index)} onKeyDown={event => event.key === 'Enter' && selectThemeCard(index)} role="button" tabIndex={0} data-testid={`button-theme-card-${theme.id}`}>
                   <span className="theme-cover-shade" /><span className="theme-cover-top"><span>{theme.count} perguntas</span><button className={`theme-cover-heart ${favoriteThemeIds.includes(theme.id) ? 'is-favorite' : ''}`} onClick={event => { event.stopPropagation(); toggleThemeFavorite(theme.id); }} aria-label={favoriteThemeIds.includes(theme.id) ? `Remover ${theme.title} dos favoritos` : `Favoritar ${theme.title}`} data-testid={`button-favorite-theme-card-${theme.id}`}><Heart size={20} strokeWidth={1.8} fill={favoriteThemeIds.includes(theme.id) ? 'currentColor' : 'none'} /></button></span>
                  <span className="theme-cover-copy"><b>{theme.title}</b><small>{theme.description}</small><i>{index === themeIndex ? 'Toque novamente para abrir' : 'ver objetivo'}</i></span>
                 </div>;
              })}
            </div>
            <div className="carousel-dots" aria-label="Posição do objetivo">{themes.map((theme, index) => <button key={theme.id} className={index === themeIndex ? 'is-active' : ''} onClick={() => moveThemeIndex(index)} aria-label={`Selecionar ${theme.title}`} data-testid={`button-theme-dot-${theme.id}`} />)}</div>
          </div>
          {themesError && <div className="app-inline-error" data-testid="status-themes-error"><span>Não conseguimos atualizar os objetivos.</span><button onClick={() => queryClientRef.invalidateQueries({ queryKey: getListQuestionThemesQueryKey() })} data-testid="button-retry-themes">Tentar novamente <RotateCw size={13} /></button></div>}
          <p className="deck-note"><Sparkles size={14} /> Uma pergunta por vez. O resto acontece entre vocês.</p>
         </section>}
      </> : <>
        <header className="question-header" data-testid="header-question">
           <button className="decks-back-pill" onClick={() => { setFavoriteMode(false); setDailyMode(false); setThemeId(null); }} data-testid="button-back-decks"><ChevronLeft size={17} /> Decks</button>
          <div className="question-header-count" data-testid="text-question-position">{String(dailyPosition).padStart(2, '0')} <span>/ {String(questions.length || dailyTotal).padStart(2, '0')}</span></div>
        </header>
        <section className={`question-view-stage ${showInvitePrompt ? 'has-invite-prompt' : ''}`}>
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
                 className={`question-card question-card-front question-gradient-${questionIndex % 4} ${writingOpen ? 'is-writing' : ''} ${isQuestionDragging ? 'is-dragging' : ''} ${questionSwipeExit ? `is-swiping-out-${questionSwipeExit}` : ''} ${questionSwipeEnter ? `is-entering-from-${questionSwipeEnter}` : ''}`}
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
        {navItems.map(item => <button key={item.id} className={activeNav === item.id ? 'is-active' : ''} onClick={() => setActiveNav(item.id)} data-testid={`button-nav-${item.id}`}><span className={`nav-dot nav-dot-${item.id}`} />{item.label}</button>)}
      </nav>
    </main>
    <InstallAppPrompt />
    {welcomeOpen && <div className="app-modal-backdrop"><div className="app-modal welcome-app-modal"><button className="app-modal-close" onClick={() => setWelcomeOpen(false)} aria-label="Fechar apresentação" data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-app-mark"><Feather size={19} /></div><p className="modal-eyebrow">antes da primeira carta</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="app-text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="app-primary-button" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
    {settingsOpen && <div className="app-modal-backdrop"><div className="app-modal settings-app-modal"><button className="app-modal-close" onClick={() => setSettingsOpen(false)} aria-label="Fechar ajustes" data-testid="button-close-settings"><X size={18} /></button><p className="modal-eyebrow">seu espaço</p><h2>Ajustes da<br /><em>experiência.</em></h2><div className="settings-row"><span>Perfil</span><strong data-testid="text-settings-name">{buyerName || 'Visitante'}</strong></div><div className="settings-row"><span>Acesso</span><strong data-testid="text-settings-access">{sessionQuery.data?.accessGranted || accessQuery.data?.hasAccess ? activeAccess?.packageName || 'Ativo' : 'Demonstração'}</strong></div><div className="settings-row"><span>Salvas</span><strong data-testid="text-settings-saved">{saved.length} pergunta{saved.length === 1 ? '' : 's'}</strong></div><button onClick={() => { setSettingsOpen(false); setWelcomeOpen(true); }} className="app-secondary-button" data-testid="button-edit-name">Editar como te chamar</button></div></div>}
    {inviteOpen && <div className="app-modal-backdrop"><div className="app-modal invite-app-modal"><button className="app-modal-close" onClick={() => setInviteOpen(false)} aria-label="Fechar convite" data-testid="button-close-invite"><X size={18} /></button>{inviteResult ? <><div className="invite-success-mark"><Check size={21} /></div><p className="modal-eyebrow">convite pronto</p><h2>Leve essa pergunta<br /><em>para mais perto.</em></h2><p>Compartilhe este endereço com <strong>{inviteResult.guestName}</strong>.</p><div className="invite-copy-row"><input readOnly value={inviteResult.inviteUrl} className="app-text-input" data-testid="input-invite-url" /><button onClick={copyInvite} aria-label="Copiar convite" data-testid="button-copy-invite"><Copy size={17} /></button></div><button onClick={() => { setInviteResult(null); setGuestName(''); }} className="app-text-button" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></> : <><p className="modal-eyebrow">um convite especial</p><h2>Quem você quer<br /><em>trazer para a conversa?</em></h2><input value={guestName} onChange={e => setGuestName(e.target.value)} className="app-text-input" placeholder="Nome de quem vai receber" data-testid="input-guest-name" /><button onClick={makeInvite} className="app-primary-button" disabled={!guestName.trim() || createInvite.isPending || (!!sessionId && !canInvite)} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : canInvite || !sessionId ? 'Gerar convite' : 'Sem convites disponíveis'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="app-form-error" data-testid="status-invite-error">Não foi possível gerar agora. Tente novamente.</p>}</>}</div></div>}
  </div>;
}

 function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const inviteQuery = useGetInvite(token, { query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) } });
  const invite = inviteQuery.data;
  const acceptInvite = () => {
    if (invite && token) {
      localStorage.setItem('conexao-guest-token', token);
      localStorage.setItem('conexao-guest-name', invite.guestName);
      localStorage.setItem('conexao-name', invite.guestName);
    }
  };
  return <Shell dark><main className="invite-entry"><div className="invite-entry-orbit" /><div className="invite-entry-card">{inviteQuery.isLoading ? <><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></> : invite ? <><div className="invite-symbol"><Feather size={23} /></div><p className="section-kicker light-kicker">um convite para você</p><h1><em>{invite.guestName}</em>, tem uma<br />conversa te esperando.</h1><p className="invite-entry-copy">Você foi convidado para participar de <strong>{invite.packageName}</strong>. Aqui, convidados podem responder e descobrir — só não podem criar novos convites.</p><Link href="/app" onClick={acceptInvite} className="button button-salmon" data-testid="link-accept-invite">Aceitar convite <ArrowRight size={16} /></Link><span className="guest-note"><Users size={14} /> Você entra como convidado</span></> : <><div className="invite-symbol"><X size={23} /></div><p className="section-kicker light-kicker">convite não encontrado</p><h1>Este endereço<br /><em>já mudou de lugar.</em></h1><p className="invite-entry-copy">Peça a quem te convidou para enviar um novo acesso.</p><Link href="/app" className="button button-salmon" data-testid="link-open-demo">Conhecer a experiência <ArrowRight size={16} /></Link></>}</div></main></Shell>;
}

 function Router() {
   return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/onboarding" component={Onboarding} /><Route path="/app" component={AppExperienceReference} /><Route path="/invite/:token" component={InvitePage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;