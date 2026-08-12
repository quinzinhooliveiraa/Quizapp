import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
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
} from '@workspace/api-client-react';
import { Heart, ArrowRight, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Copy, Feather, Link as LinkIcon, Menu, Quote, RotateCw, Send, Settings2, Shuffle, Sparkles, Star, Users, X } from 'lucide-react';
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
];
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

function Home() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<'couple' | 'family'>('couple');
  const receiveWebhook = useReceiveCheckoutWebhook();
  const [checkoutState, setCheckoutState] = useState<'idle' | 'sent'>('idle');
  const checkout = () => {
    receiveWebhook.mutate({ data: { eventId: `demo-${Date.now()}`, eventType: 'payment.completed', buyerEmail: 'demo@conexao.local', buyerName: 'Visitante', packageId: selectedPackage, paymentReference: 'demo-access' } }, { onSuccess: () => setCheckoutState('sent'), onError: () => setCheckoutState('sent') });
  };
  return <Shell>
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
    const updateViewport = () => {
      const width = Math.max(document.documentElement.clientWidth, 1);
      const height = Math.max(window.visualViewport?.height || window.innerHeight, 1);
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
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
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
  const themes = themesData?.length ? themesData : fallbackThemes;
  const [themeId, setThemeId] = useState<string | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [themeDragOffset, setThemeDragOffset] = useState(0);
  const [isThemeDragging, setIsThemeDragging] = useState(false);
  const themeDragStartX = useRef<number | null>(null);
  const themeDragDelta = useRef(0);
  const themePointerCaptured = useRef(false);
  const suppressThemeClick = useRef(false);
  const [activeNav, setActiveNav] = useState('todos');
  const [saved, setSaved] = useState<string[]>([]);
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
  const questionParams = { theme: themeId || undefined };
  const questionsQuery = useListQuestions(questionParams, { query: { enabled: !!themeId, queryKey: getListQuestionsQueryKey(questionParams) } });
  const createSession = useCreateQuestionSession();
  const createInvite = useCreateInvite();
  const questions = themeId ? (questionsQuery.data?.length ? questionsQuery.data : (fallbackQuestions.filter(q => q.themeId === themeId).length ? fallbackQuestions.filter(q => q.themeId === themeId) : fallbackQuestions)) : [];
  const currentQuestion = questions.length ? questions[questionIndex % questions.length] : null;
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit : !!accessQuery.data?.canInvite;
  const inviteLimit = sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed = sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;
  const selectedTheme = themes.find(theme => theme.id === themeId);
  const dailyTotal = selectedTheme?.count || questions.length || 1;
  const dailyPosition = questions.length ? (questionIndex % questions.length) + 1 : 1;

  const changeTheme = (id: string) => { setThemeId(id); setQuestionIndex(0); };
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
  const nextQuestion = () => setQuestionIndex(i => {
    if (!randomMode || questions.length < 2) return (i + 1) % Math.max(questions.length, 1);
    const randomOffset = Math.floor(Math.random() * (questions.length - 1)) + 1;
    return (i + randomOffset) % questions.length;
  });
  const previousQuestion = () => setQuestionIndex(i => {
    if (!randomMode || questions.length < 2) return (i - 1 + questions.length) % Math.max(questions.length, 1);
    const randomOffset = Math.floor(Math.random() * (questions.length - 1)) + 1;
    return (i + randomOffset) % questions.length;
  });
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
    <main className={`connection-app ${themeId ? 'is-question-view' : 'is-deck-view'}`}>
      {!themeId ? <>
        <header className="app-header" data-testid="header-decks">
          <div className="app-wordmark" data-testid="text-app-brand"><span className="app-logo-orb"><span /></span><span>Perguntas<br /><b>de Conexão</b></span></div>
          <button className="app-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes" data-testid="button-open-settings"><Settings2 size={21} /></button>
        </header>
        <section className="deck-home" aria-labelledby="deck-home-title">
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
                return <button key={theme.id} className={`theme-cover theme-cover-${index % 5} theme-offset-${offset} ${index === themeIndex ? 'is-active' : ''}`} onClick={() => selectThemeCard(index)} data-testid={`button-theme-card-${theme.id}`}>
                  <span className="theme-cover-shade" /><span className="theme-cover-top"><span>{theme.count} perguntas</span><Heart size={20} strokeWidth={1.8} /></span>
                  <span className="theme-cover-copy"><b>{theme.title}</b><small>{theme.description}</small><i>{index === themeIndex ? 'Toque novamente para abrir' : 'ver objetivo'}</i></span>
                </button>;
              })}
            </div>
            <div className="carousel-dots" aria-label="Posição do objetivo">{themes.map((theme, index) => <button key={theme.id} className={index === themeIndex ? 'is-active' : ''} onClick={() => moveThemeIndex(index)} aria-label={`Selecionar ${theme.title}`} data-testid={`button-theme-dot-${theme.id}`} />)}</div>
          </div>
          {themesError && <div className="app-inline-error" data-testid="status-themes-error"><span>Não conseguimos atualizar os objetivos.</span><button onClick={() => queryClientRef.invalidateQueries({ queryKey: getListQuestionThemesQueryKey() })} data-testid="button-retry-themes">Tentar novamente <RotateCw size={13} /></button></div>}
          <p className="deck-note"><Sparkles size={14} /> Uma pergunta por vez. O resto acontece entre vocês.</p>
        </section>
      </> : <>
        <header className="question-header" data-testid="header-question">
          <button className="decks-back-pill" onClick={() => setThemeId(null)} data-testid="button-back-decks"><ChevronLeft size={17} /> Decks</button>
          <div className="question-header-count" data-testid="text-question-position">{String(dailyPosition).padStart(2, '0')} <span>/ {String(questions.length || dailyTotal).padStart(2, '0')}</span></div>
        </header>
        <section className="question-view-stage">
          <div className="question-card-stack">
            <div className="question-mode-bar" aria-label="Modo da carta">
              <button className={`question-mode-button ${!writingOpen ? 'is-active' : ''}`} onClick={toggleQuestionMode} aria-label={randomMode ? 'Alternar para perguntas sequenciais' : 'Alternar para perguntas aleatórias'} data-testid="button-random-question"><Shuffle size={13} /> {randomMode ? 'Aleatória' : 'Sequencial'}</button>
              <button className={`question-mode-button ${writingOpen ? 'is-active' : ''}`} onClick={() => setWritingOpen(open => !open)} aria-pressed={writingOpen} data-testid="button-writing-mode"><Feather size={13} /> {writingOpen ? 'Escrevendo' : 'Escrever'}</button>
            </div>
            {questionsQuery.isLoading ? <div className="question-card question-card-loading" data-testid="loading-questions"><div className="loading-pill" /><div className="loading-copy" /><div className="loading-copy short" /></div> : questionsQuery.isError ? <div className="question-error" data-testid="status-questions-error"><p>Esta seleção não abriu agora.</p><button onClick={() => questionsQuery.refetch()} data-testid="button-retry-questions">Tentar novamente <RotateCw size={14} /></button></div> : currentQuestion && <article key={currentQuestion.id} className={`question-card question-gradient-${questionIndex % 4} ${writingOpen ? 'is-writing' : ''}`} data-testid={`card-question-${currentQuestion.id}`}>
              <div className="question-card-grain" />
               <div className="question-card-top"><span data-testid="text-question-theme">{selectedTheme?.title}</span><div className="question-card-brand-side"><strong data-testid="text-card-brand">Perguntas<br /><i>de Conexão</i></strong></div></div>
              <div className="question-card-copy"><span className="question-kicker">{currentQuestion.intensity === 'deep' ? 'PARA IR MAIS FUNDO' : currentQuestion.intensity === 'honest' ? 'COM TODA HONESTIDADE' : 'PARA COMEÇAR DEVAGAR'}</span><p data-testid={`text-question-${currentQuestion.id}`}>{currentQuestion.text}</p></div>
              {writingOpen && <div className="question-response"><textarea value={currentResponse} onChange={event => setResponses(current => ({ ...current, [currentQuestion.id]: event.target.value }))} placeholder="Escreva aqui, se quiser..." aria-label="Sua resposta para esta pergunta" data-testid={`textarea-response-${currentQuestion.id}`} /></div>}
              <div className="question-card-foot"><span>não existe resposta certa</span><span className="question-card-progress"><i /><i /><i /></span></div>
               <button className={`question-favorite-button ${saved.includes(currentQuestion.id) ? 'is-saved' : ''}`} onClick={() => setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} aria-label={saved.includes(currentQuestion.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-pressed={saved.includes(currentQuestion.id)} data-testid={`button-favorite-question-${currentQuestion.id}`}><Star size={16} fill={saved.includes(currentQuestion.id) ? 'currentColor' : 'none'} /></button>
            </article>}
          </div>
          {currentQuestion && <div className="question-side-nav"><button onClick={previousQuestion} aria-label="Pergunta anterior" data-testid="button-previous-question"><ChevronLeft size={19} /></button><button onClick={nextQuestion} aria-label="Próxima pergunta" data-testid="button-next-question"><ChevronRight size={19} /></button></div>}
        </section>
        <p className="question-hint" data-testid="text-question-hint">deslize ou use as setas para continuar</p>
      </>}
      <nav className="app-bottom-nav" aria-label="Navegação principal" data-testid="nav-bottom">
        {navItems.map(item => <button key={item.id} className={activeNav === item.id ? 'is-active' : ''} onClick={() => setActiveNav(item.id)} data-testid={`button-nav-${item.id}`}><span className={`nav-dot nav-dot-${item.id}`} />{item.label}</button>)}
      </nav>
    </main>
    {welcomeOpen && <div className="app-modal-backdrop"><div className="app-modal welcome-app-modal"><button className="app-modal-close" onClick={() => setWelcomeOpen(false)} aria-label="Fechar apresentação" data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-app-mark"><Feather size={19} /></div><p className="modal-eyebrow">antes da primeira carta</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="app-text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="app-primary-button" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
    {settingsOpen && <div className="app-modal-backdrop"><div className="app-modal settings-app-modal"><button className="app-modal-close" onClick={() => setSettingsOpen(false)} aria-label="Fechar ajustes" data-testid="button-close-settings"><X size={18} /></button><p className="modal-eyebrow">seu espaço</p><h2>Ajustes da<br /><em>experiência.</em></h2><div className="settings-row"><span>Perfil</span><strong data-testid="text-settings-name">{buyerName || 'Visitante'}</strong></div><div className="settings-row"><span>Acesso</span><strong data-testid="text-settings-access">{sessionQuery.data?.accessGranted || accessQuery.data?.hasAccess ? activeAccess?.packageName || 'Ativo' : 'Demonstração'}</strong></div><div className="settings-row"><span>Salvas</span><strong data-testid="text-settings-saved">{saved.length} pergunta{saved.length === 1 ? '' : 's'}</strong></div><button onClick={() => { setSettingsOpen(false); setWelcomeOpen(true); }} className="app-secondary-button" data-testid="button-edit-name">Editar como te chamar</button></div></div>}
    {inviteOpen && <div className="app-modal-backdrop"><div className="app-modal invite-app-modal"><button className="app-modal-close" onClick={() => setInviteOpen(false)} aria-label="Fechar convite" data-testid="button-close-invite"><X size={18} /></button>{inviteResult ? <><div className="invite-success-mark"><Check size={21} /></div><p className="modal-eyebrow">convite pronto</p><h2>Leve essa pergunta<br /><em>para mais perto.</em></h2><p>Compartilhe este endereço com <strong>{inviteResult.guestName}</strong>.</p><div className="invite-copy-row"><input readOnly value={inviteResult.inviteUrl} className="app-text-input" data-testid="input-invite-url" /><button onClick={copyInvite} aria-label="Copiar convite" data-testid="button-copy-invite"><Copy size={17} /></button></div><button onClick={() => { setInviteResult(null); setGuestName(''); }} className="app-text-button" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></> : <><p className="modal-eyebrow">um convite especial</p><h2>Quem você quer<br /><em>trazer para a conversa?</em></h2><input value={guestName} onChange={e => setGuestName(e.target.value)} className="app-text-input" placeholder="Nome de quem vai receber" data-testid="input-guest-name" /><button onClick={makeInvite} className="app-primary-button" disabled={!guestName.trim() || createInvite.isPending || (!!sessionId && !canInvite)} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : canInvite || !sessionId ? 'Gerar convite' : 'Sem convites disponíveis'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="app-form-error" data-testid="status-invite-error">Não foi possível gerar agora. Tente novamente.</p>}</>}</div></div>}
  </div>;
}

 function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const inviteQuery = useGetInvite(token, { query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) } });
  const invite = inviteQuery.data;
  return <Shell dark><main className="invite-entry"><div className="invite-entry-orbit" /><div className="invite-entry-card">{inviteQuery.isLoading ? <><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></> : invite ? <><div className="invite-symbol"><Feather size={23} /></div><p className="section-kicker light-kicker">um convite para você</p><h1><em>{invite.guestName}</em>, tem uma<br />conversa te esperando.</h1><p className="invite-entry-copy">Você foi convidado para participar de <strong>{invite.packageName}</strong>. Aqui, convidados podem responder e descobrir — só não podem criar novos convites.</p><Link href="/app" className="button button-salmon" data-testid="link-accept-invite">Aceitar convite <ArrowRight size={16} /></Link><span className="guest-note"><Users size={14} /> Você entra como convidado</span></> : <><div className="invite-symbol"><X size={23} /></div><p className="section-kicker light-kicker">convite não encontrado</p><h1>Este endereço<br /><em>já mudou de lugar.</em></h1><p className="invite-entry-copy">Peça a quem te convidou para enviar um novo acesso.</p><Link href="/app" className="button button-salmon" data-testid="link-open-demo">Conhecer a experiência <ArrowRight size={16} /></Link></>}</div></main></Shell>;
}

 function Router() {
   return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/onboarding" component={Onboarding} /><Route path="/app" component={AppExperienceReference} /><Route path="/invite/:token" component={InvitePage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;