import { type ReactNode, useState } from 'react';
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
import { Heart, ArrowRight, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Copy, Feather, Link as LinkIcon, Menu, Quote, RotateCw, Send, Sparkles, Users, X } from 'lucide-react';
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

function AppExperience() {
  const queryClientRef = useQueryClient();
  const { data: themesData, isLoading: themesLoading, isError: themesError } = useListQuestionThemes({ query: { queryKey: getListQuestionThemesQueryKey() } });
  const themes = themesData?.length ? themesData : fallbackThemes;
  const [themeId, setThemeId] = useState(themes[0]?.id || 'presenca');
  const [randomMode, setRandomMode] = useState(false);
  const [answerMode, setAnswerMode] = useState(false);
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
  const questionParams = { theme: themeId };
  const questionsQuery = useListQuestions(questionParams, { query: { queryKey: getListQuestionsQueryKey(questionParams) } });
  const createSession = useCreateQuestionSession();
  const createInvite = useCreateInvite();
  const questions = questionsQuery.data?.length ? questionsQuery.data : fallbackQuestions.filter(q => q.themeId === themeId || !themes.some(t => t.id === q.themeId)).length ? fallbackQuestions.filter(q => q.themeId === themeId) : fallbackQuestions;
  const currentQuestion = questions.length ? questions[questionIndex % questions.length] : fallbackQuestions[0];
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit : !!accessQuery.data?.canInvite;
  const inviteLimit = sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed = sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;

  const changeTheme = (id: string) => { setThemeId(id); setQuestionIndex(0); };
  const nextQuestion = () => { setQuestionIndex(i => randomMode ? Math.floor(Math.random() * Math.max(questions.length, 1)) : (i + 1) % Math.max(questions.length, 1)); setAnswerMode(false); };
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
  return <Shell>
    <main className="experience-page">
      <div className="experience-top"><div><p className="eyebrow"><span className="eyebrow-line" /> seu espaço de conversa</p><h1>Olá, {buyerName || 'que bom ter você aqui'}.</h1></div><AccessPill access={activeAccess} /></div>
      <div className="experience-layout">
        <aside className="theme-rail"><div className="rail-label">Escolha um caminho</div>{themesLoading ? <div className="skeleton-stack"><span /><span /><span /></div> : themes.map((theme, index) => <button key={theme.id} onClick={() => changeTheme(theme.id)} className={`theme-choice ${themeId === theme.id ? 'theme-selected' : ''}`} data-testid={`button-theme-${theme.id}`}><span className="theme-number">0{index + 1}</span><span><strong>{theme.title}</strong><small>{theme.description}</small></span><span className="theme-count">{theme.count}</span></button>)}<div className="rail-footer"><p>Uma boa conversa<br /><em>não precisa de pressa.</em></p><Heart size={17} /></div></aside>
        <section className="question-area">
          <div className="question-toolbar"><div className="current-theme">{themes.find(t => t.id === themeId)?.title || 'Presença'} <span>/</span> pergunta {String((questionIndex % Math.max(questions.length, 1)) + 1).padStart(2, '0')}</div><div className="toolbar-actions"><button onClick={() => setRandomMode(!randomMode)} className={`tool-button ${randomMode ? 'tool-active' : ''}`} data-testid="button-toggle-random"><RotateCw size={15} /> {randomMode ? 'Aleatório' : 'Sequencial'}</button><button onClick={() => setAnswerMode(!answerMode)} className={`tool-button ${answerMode ? 'tool-active' : ''}`} data-testid="button-toggle-answer"><Feather size={15} /> {answerMode ? 'Escrevendo' : 'Responder'}</button></div></div>
          <div className="question-stage">{questionsQuery.isLoading ? <div className="question-card loading-card"><div className="skeleton-line wide" /><div className="skeleton-line" /></div> : themesError && !questionsQuery.data ? <div className="empty-card"><p>Não conseguimos buscar o baralho agora.</p><button onClick={() => questionsQuery.refetch()} className="text-link" data-testid="button-retry-questions">Tentar novamente <RotateCw size={15} /></button></div> : <div className={`question-card intensity-${currentQuestion.intensity}`}><div className="card-corner">pc</div><div className="question-meta"><span>{currentQuestion.intensity === 'gentle' ? 'para chegar devagar' : currentQuestion.intensity === 'honest' ? 'para falar com verdade' : 'para ir mais fundo'}</span><Bookmark size={19} fill={saved.includes(currentQuestion.id) ? 'currentColor' : 'none'} className={saved.includes(currentQuestion.id) ? 'bookmark-saved' : ''} onClick={() => setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} data-testid={`button-save-${currentQuestion.id}`} /></div><div className="question-text"><Quote size={33} /><p>{currentQuestion.text}</p></div>{answerMode && <textarea autoFocus placeholder="Escreva aqui, se quiser..." className="answer-field" data-testid="input-answer" /> }<div className="card-bottom"><span>não existe resposta certa</span><span className="card-pips"><i className="pip-active" /><i /><i /></span></div></div>}</div>
          <div className="question-controls"><button onClick={() => setQuestionIndex(i => (i - 1 + questions.length) % Math.max(questions.length, 1))} className="round-button" aria-label="Pergunta anterior" data-testid="button-previous-question"><ChevronLeft size={19} /></button><button onClick={nextQuestion} className="button button-primary next-button" data-testid="button-next-question">Próxima pergunta <ArrowRight size={16} /></button><button onClick={() => setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} className={`save-button ${saved.includes(currentQuestion.id) ? 'save-active' : ''}`} data-testid="button-save-question">{saved.includes(currentQuestion.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />} {saved.includes(currentQuestion.id) ? 'Salva' : 'Salvar para depois'}</button></div>
          <div className="experience-note"><Sparkles size={15} /> <span>Conversa boa é quando ninguém está tentando chegar a algum lugar.</span></div>
        </section>
        <aside className="invite-panel"><div className="invite-icon"><Users size={20} /></div><p className="section-kicker">traga alguém</p><h3>Uma pergunta fica ainda melhor quando chega em outra pessoa.</h3><p className="invite-copy">Convide alguém para acessar este espaço. Você não precisa estar no mesmo lugar.</p><button onClick={() => setInviteOpen(true)} className="button button-dark button-full" disabled={!canInvite && !!sessionId} data-testid="button-open-invite">Criar convite <Send size={15} /></button><div className="invite-limit">{activeAccess ? `${inviteLimit - invitesUsed} convites disponíveis` : 'Convites disponíveis após o acesso'}</div><div className="saved-count"><Bookmark size={15} /> {saved.length ? `${saved.length} ${saved.length === 1 ? 'pergunta guardada' : 'perguntas guardadas'}` : 'Suas perguntas salvas aparecem aqui'}</div></aside>
      </div>
    </main>
    {welcomeOpen && <div className="modal-backdrop"><div className="welcome-modal"><button className="modal-close" onClick={() => setWelcomeOpen(false)} data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-flourish"><Feather size={22} /></div><p className="section-kicker">antes de começar</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="button button-primary button-full" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
    {inviteOpen && <div className="modal-backdrop"><div className="invite-modal"><button className="modal-close" onClick={() => setInviteOpen(false)} data-testid="button-close-invite"><X size={18} /></button>{inviteResult ? <><div className="success-seal"><Check size={24} /></div><p className="section-kicker">convite pronto</p><h2>Agora essa conversa<br /><em>pode chegar mais longe.</em></h2><p>Compartilhe este endereço com <strong>{inviteResult.guestName}</strong>.</p><div className="copy-row"><input readOnly value={inviteResult.inviteUrl} className="text-input" data-testid="input-invite-url" /><button onClick={copyInvite} className="round-button" aria-label="Copiar convite" data-testid="button-copy-invite"><Copy size={17} /></button></div><button onClick={() => { setInviteResult(null); setGuestName(''); }} className="text-link" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></> : <><p className="section-kicker">um convite especial</p><h2>Quem você quer<br /><em>trazer para a conversa?</em></h2><input value={guestName} onChange={e => setGuestName(e.target.value)} className="text-input" placeholder="Nome de quem vai receber" data-testid="input-guest-name" /><button onClick={makeInvite} className="button button-primary button-full" disabled={!guestName.trim() || createInvite.isPending} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : 'Gerar convite'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="form-error">Não foi possível gerar agora. Tente novamente.</p>}</>}</div></div>}
  </Shell>;
}

function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const inviteQuery = useGetInvite(token, { query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) } });
  const invite = inviteQuery.data;
  return <Shell dark><main className="invite-entry"><div className="invite-entry-orbit" /><div className="invite-entry-card">{inviteQuery.isLoading ? <><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></> : invite ? <><div className="invite-symbol"><Feather size={23} /></div><p className="section-kicker light-kicker">um convite para você</p><h1><em>{invite.guestName}</em>, tem uma<br />conversa te esperando.</h1><p className="invite-entry-copy">Você foi convidado para participar de <strong>{invite.packageName}</strong>. Aqui, convidados podem responder e descobrir — só não podem criar novos convites.</p><Link href="/app" className="button button-salmon" data-testid="link-accept-invite">Aceitar convite <ArrowRight size={16} /></Link><span className="guest-note"><Users size={14} /> Você entra como convidado</span></> : <><div className="invite-symbol"><X size={23} /></div><p className="section-kicker light-kicker">convite não encontrado</p><h1>Este endereço<br /><em>já mudou de lugar.</em></h1><p className="invite-entry-copy">Peça a quem te convidou para enviar um novo acesso.</p><Link href="/app" className="button button-salmon" data-testid="link-open-demo">Conhecer a experiência <ArrowRight size={16} /></Link></>}</div></main></Shell>;
}

 function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route path="/onboarding" component={Onboarding} /><Route path="/app" component={AppExperience} /><Route path="/invite/:token" component={InvitePage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;