import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Feather, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';

type StepId =
  | 'intro'
  | 'welcome-role'
  | 'guest-entry'
  | 'relationship'
  | 'note'
  | 'name'
  | 'email'
  | 'date'
  | 'days'
  | 'curiosity'
  | 'surprise'
  | 'feeling'
  | 'insight'
  | 'preparing'
  | 'deck';

type Step = { id: StepId; progress: number };

const steps: Step[] = [
  { id: 'intro', progress: 0.05 },
  { id: 'welcome-role', progress: 0.1 },
  { id: 'guest-entry', progress: 0.15 },
  { id: 'relationship', progress: 0.18 },
  { id: 'note', progress: 0.24 },
  { id: 'name', progress: 0.3 },
  { id: 'email', progress: 0.34 },
  { id: 'date', progress: 0.38 },
  { id: 'days', progress: 0.47 },
  { id: 'curiosity', progress: 0.58 },
  { id: 'surprise', progress: 0.68 },
  { id: 'feeling', progress: 0.77 },
  { id: 'insight', progress: 0.85 },
  { id: 'preparing', progress: 0.93 },
  { id: 'deck', progress: 1 },
];

type OnboardingRole = '' | 'owner' | 'guest';

const curiosityOptions = [
  'Como ela realmente é',
  'O que ela ainda não disse',
  'Se estamos na mesma página',
  'O que nunca é conversado',
  'Sinceramente, tudo',
];

const relationshipOptions = [
  'Meu namorado ou minha namorada',
  'Meu esposo ou minha esposa',
  'Alguém com quem estou saindo',
  'Namoro à distância',
];
const surpriseOptions = ['Nesta semana', 'Faz um tempo', 'Sinceramente, não lembro', 'Já passou da hora'];
const feelingOptions = [
  'Mais perto do que de costume',
  'Leve e divertido',
  'Honesto, mesmo que seja difícil',
  'Um pouco perigoso',
];
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const welcomeDeckStorageKey = 'conexao-personalized-decks';
const welcomeDeckIdStorageKey = 'conexao-welcome-deck-id';
const welcomeDeckDoneStorageKey = 'conexao-welcome-deck-done';
const openWelcomeDeckStorageKey = 'conexao-open-welcome-deck';

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

function removeWelcomeDeck() {
  const welcomeDeckId = safeGetItem(welcomeDeckIdStorageKey);
  try {
    const stored = JSON.parse(safeGetItem(welcomeDeckStorageKey) || '[]');
    const decks = Array.isArray(stored)
      ? stored.filter((deck: unknown) => {
        if (!deck || typeof deck !== 'object') return false;
        const item = deck as { id?: unknown; label?: unknown };
        return item.id !== welcomeDeckId && item.label !== 'Seu primeiro baralho';
      })
      : [];
    safeSetItem(welcomeDeckStorageKey, JSON.stringify(decks));
  } catch {
    safeRemoveItem(welcomeDeckStorageKey);
  }
  safeRemoveItem(welcomeDeckIdStorageKey);
  safeRemoveItem(welcomeDeckDoneStorageKey);
  safeRemoveItem(openWelcomeDeckStorageKey);
}

function daysBetween(dateString: string) {
  const start = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 249;
  const now = new Date();
  const difference = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
  return difference;
}

function dateParts(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return { day: 6, month: 12, year: 2025 };
  return { day, month, year };
}

function readOnboardingRole(): OnboardingRole {
  const role = safeGetItem('conexao-role');
  return role === 'owner' || role === 'guest' ? role : '';
}

function getInitialOnboardingStep() {
  const availableSteps = safeGetItem('conexao-guest-token')
    ? steps.filter(step => step.id !== 'welcome-role' && step.id !== 'guest-entry')
    : steps.filter(step => step.id !== 'email');
  const saved = Number(safeGetItem('conexao-onboarding-step'));
  if (!Number.isInteger(saved) || saved < 0 || saved >= availableSteps.length) return 0;

  // Fase 1B stored the old linear step index. Keep an unfinished owner flow
  // in the same place after the two new entry screens were inserted.
  if (!readOnboardingRole() && saved > 0) {
    safeSetItem('conexao-role', 'owner');
    return Math.min(saved + 2, availableSteps.length - 1);
  }
  return saved;
}

function extractInviteToken(value: string) {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(input, window.location.origin);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const inviteIndex = pathParts.findLastIndex(part => part.toLowerCase() === 'invite');
    const linkedToken = inviteIndex >= 0 ? pathParts[inviteIndex + 1] : '';
    if (linkedToken) return decodeURIComponent(linkedToken);
  } catch {
    // Fall through to the lightweight path and token checks below.
  }

  const pathMatch = input.match(/(?:^|\/)invite\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]);
    } catch {
      return pathMatch[1];
    }
  }

  return /^[^/\\s?#]+$/.test(input) ? input : null;
}

function StepHeader({
  step,
  onBack,
  showBack = true,
}: {
  step: Step;
  onBack: () => void;
  showBack?: boolean;
}) {
  return (
    <div className="onboarding-top">
      <button
        className={`onboarding-back ${showBack ? '' : 'is-hidden'}`}
        onClick={onBack}
        aria-label="Voltar"
        data-testid="button-onboarding-back"
      >
        <ArrowLeft size={19} strokeWidth={1.6} />
      </button>
      <div className="onboarding-progress" aria-label={`Progresso: ${Math.round(step.progress * 100)}%`}>
        <span style={{ width: `${step.progress * 100}%` }} />
      </div>
      <span className="onboarding-progress-value">{Math.round(step.progress * 100)}%</span>
    </div>
  );
}

function ContinueButton({
  children = 'Continuar',
  onClick,
  disabled = false,
  light = false,
}: {
  children?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  light?: boolean;
}) {
  return (
    <button
      className={`onboarding-continue ${light ? 'onboarding-continue-light' : ''}`}
      onClick={onClick}
      disabled={disabled}
      data-testid="button-onboarding-continue"
    >
      {children}
      <ArrowRight size={18} strokeWidth={1.8} />
    </button>
  );
}

function Choice({
  label,
  selected,
  multi = false,
  onClick,
  description,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
  description?: string;
}) {
  return (
    <button
      className={`onboarding-choice ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      data-testid={`choice-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      <span className="onboarding-choice-copy">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </span>
      {multi ? (
        <span className="onboarding-checkbox">{selected ? <Check size={15} strokeWidth={2.5} /> : null}</span>
      ) : (
        <span className={`onboarding-radio ${selected ? 'is-selected' : ''}`} />
      )}
    </button>
  );
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [stepIndex, setStepIndex] = useState(getInitialOnboardingStep);
  const isInvitedGuest = !!safeGetItem('conexao-guest-token');
  const activeSteps = useMemo(
    () => isInvitedGuest
      ? steps.filter(step => step.id !== 'welcome-role' && step.id !== 'guest-entry')
      : steps.filter(step => step.id !== 'email'),
    [isInvitedGuest],
  );
  const [role, setRole] = useState<OnboardingRole>(readOnboardingRole);
  const [name, setName] = useState(() => safeGetItem('conexao-onboarding-name') || safeGetItem('conexao-guest-name') || safeGetItem('conexao-name') || '');
  const [pronoun, setPronoun] = useState(() => safeGetItem('conexao-onboarding-pronoun') || '');
  const [relationship, setRelationship] = useState(() => safeGetItem('conexao-onboarding-relationship') || '');
  const [date, setDate] = useState(() => safeGetItem('conexao-onboarding-date') || '2025-12-06');
  const [curiosity, setCuriosity] = useState<string[]>(() => {
    try {
      return JSON.parse(safeGetItem('conexao-onboarding-curiosity') || '[]');
    } catch {
      return [];
    }
  });
  const [guestEmail, setGuestEmail] = useState(() => safeGetItem('conexao-guest-email') || '');
  const [surprise, setSurprise] = useState('');
  const [feeling, setFeeling] = useState(() => safeGetItem('conexao-onboarding-feeling') || '');
  const [guestInviteLink, setGuestInviteLink] = useState('');
  const [guestInviteError, setGuestInviteError] = useState('');
  const [animatedDays, setAnimatedDays] = useState(0);

  const step = activeSteps[stepIndex];
  const parts = useMemo(() => dateParts(date), [date]);
  const sharedDays = useMemo(() => daysBetween(date), [date]);
  const partnerPronoun = pronoun === 'Ele' ? 'ele' : pronoun === 'Ela' ? 'ela' : 'essa pessoa';

  useEffect(() => {
    const hasPaidOwnerSession = Boolean(
      safeGetItem('conexao-session')
      && readOnboardingRole() === 'owner'
      && safeGetItem('conexao-onboarding-complete') !== 'true',
    );
    if (
      (safeGetItem('conexao-session') && !hasPaidOwnerSession)
      || safeGetItem('conexao-onboarding-complete') === 'true'
    ) {
      navigate('/app', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener?.('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (step.id !== 'days') return undefined;
    if (prefersReducedMotion) {
      setAnimatedDays(sharedDays);
      return undefined;
    }

    setAnimatedDays(0);
    const startedAt = performance.now();
    const duration = 1250;
    let animationFrame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;
      setAnimatedDays(Math.round(sharedDays * easedProgress));
      if (progress < 1) animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [prefersReducedMotion, sharedDays, step.id]);

  useEffect(() => {
    safeSetItem('conexao-onboarding-step', String(stepIndex));
    safeSetItem('conexao-onboarding-name', name);
    safeSetItem('conexao-onboarding-pronoun', pronoun);
    safeSetItem('conexao-onboarding-relationship', relationship);
    safeSetItem('conexao-onboarding-date', date);
    safeSetItem('conexao-onboarding-curiosity', JSON.stringify(curiosity));
    safeSetItem('conexao-onboarding-feeling', feeling);
    if (role) safeSetItem('conexao-role', role);

    if (step.id === 'preparing') {
      safeSetItem('conexao-name', name.trim());
      safeSetItem('conexao-relationship', relationship);
      safeSetItem('conexao-curiosity', JSON.stringify(curiosity));
      safeSetItem('conexao-feeling', feeling);
      safeSetItem('conexao-partner-pronoun', pronoun);
      safeSetItem('conexao-onboarding-complete', 'true');
    }
  }, [step.id, stepIndex, name, pronoun, relationship, date, curiosity, feeling, role]);

  const goNext = () => setStepIndex((current) => Math.min(current + 1, activeSteps.length - 1));
  const goBack = () => setStepIndex((current) => Math.max(current - 1, 0));
  const reset = () => {
    safeRemoveItem('conexao-onboarding-step');
    safeRemoveItem('conexao-onboarding-name');
    safeRemoveItem('conexao-onboarding-pronoun');
    safeRemoveItem('conexao-onboarding-relationship');
    safeRemoveItem('conexao-onboarding-date');
    safeRemoveItem('conexao-onboarding-curiosity');
    safeRemoveItem('conexao-onboarding-feeling');
    safeRemoveItem('conexao-onboarding-complete');
    safeRemoveItem('conexao-role');
    safeRemoveItem('conexao-name');
    safeRemoveItem('conexao-relationship');
    safeRemoveItem('conexao-curiosity');
    safeRemoveItem('conexao-feeling');
    safeRemoveItem('conexao-partner-pronoun');
    removeWelcomeDeck();
    setStepIndex(0);
    setName('');
    setPronoun('');
    setRelationship('');
    setDate('2025-12-06');
    setCuriosity([]);
    setSurprise('');
    setFeeling('');
    setRole('');
    setGuestInviteLink('');
    setGuestInviteError('');
  };

  const renderStep = () => {
    switch (step.id) {
      case 'intro':
        return (
          <div className="onboarding-content onboarding-intro">
            <div className="onboarding-logo"><span><Feather size={18} /></span> Perguntas <em>de Conexão</em></div>
            <div className="onboarding-deck-art" aria-hidden="true">
              <div className="onboarding-glow" />
              <div className="mini-card mini-card-back" />
              <div className="mini-card mini-card-middle" />
              <div className="mini-card mini-card-front">
                <span>perguntas de conexão</span>
                <p>O que você ainda quer descobrir sobre quem ama?</p>
              </div>
            </div>
            <div className="onboarding-intro-copy">
              <p className="onboarding-kicker">saia do automático</p>
              <h1>Troque o<br /><em>“como foi seu dia?”</em><br />por algo que fica.</h1>
              <p>Um baralho feito para duas pessoas se encontrarem de verdade.</p>
            </div>
            <ContinueButton onClick={goNext}>Começar</ContinueButton>
             <p className="onboarding-login-note">Já tem um baralho? <Link href="/login">Abrir meu acesso</Link></p>
          </div>
        );
      case 'welcome-role':
        return (
          <div className="onboarding-content onboarding-choice-screen onboarding-role-screen">
            <div>
              <p className="onboarding-kicker">pra começar</p>
              <h1>Você está começando<br /><em>o seu baralho</em> ou foi convidado?</h1>
              <p className="onboarding-subtitle">As duas coisas levam ao mesmo lugar — só o caminho muda.</p>
            </div>
            <div className="onboarding-choice-list">
              <Choice
                label="Tenho meu próprio baralho"
                description="Comprei e quero personalizar minha experiência."
                selected={role === 'owner'}
                onClick={() => {
                  setRole('owner');
                  safeSetItem('conexao-role', 'owner');
                }}
              />
              <Choice
                label="Fui convidado por alguém"
                description="Recebi um link e quero entrar no baralho."
                selected={role === 'guest'}
                onClick={() => {
                  setRole('guest');
                  safeSetItem('conexao-role', 'guest');
                }}
              />
            </div>
          </div>
        );
      case 'guest-entry':
        return (
          <div className="onboarding-content onboarding-choice-screen onboarding-guest-screen">
            <div>
              <p className="onboarding-kicker">seu convite</p>
              <h1>Cole o link que<br /><em>você recebeu.</em></h1>
              <p className="onboarding-subtitle">Ele leva você direto para o baralho de quem te convidou.</p>
            </div>
            <div className="onboarding-guest-form">
              <input
                value={guestInviteLink}
                onChange={(event) => {
                  setGuestInviteLink(event.target.value);
                  if (guestInviteError) setGuestInviteError('');
                }}
                autoFocus
                placeholder="https://.../invite/..."
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                aria-label="Link do convite"
                data-testid="input-guest-invite-link"
              />
              {guestInviteError && <p className="onboarding-form-error" role="alert" data-testid="status-guest-invite-error">{guestInviteError}</p>}
              <p className="onboarding-bottom-note">Não tem o link? Peça pra quem te convidou reenviar.</p>
            </div>
          </div>
        );
      case 'relationship':
        return (
          <div className="onboarding-content onboarding-choice-screen">
            <div>
              <p className="onboarding-kicker">vamos personalizar</p>
              <h1>Com quem você<br /><em>quer jogar?</em></h1>
              <p className="onboarding-subtitle">A gente adapta a experiência a partir daqui.</p>
            </div>
            <div className="onboarding-choice-list">
              {relationshipOptions.map((option) => <Choice key={option} label={option} selected={relationship === option} onClick={() => setRelationship(option)} />)}
            </div>
            <div className="onboarding-bottom-note">Você pode mudar isso depois.</div>
          </div>
        );
      case 'note':
        return (
          <div className="onboarding-content onboarding-note-screen">
            <div className="founder-avatar">Q</div>
            <p className="onboarding-kicker">uma nota para você</p>
            <div className="onboarding-letter">
              <p>Oi, eu sou a equipe por trás das Perguntas de Conexão.</p>
              <p>Há algum tempo, percebemos uma coisa: a gente pode amar alguém e ainda assim não saber mais o que perguntar.</p>
              <p>As melhores conversas não acontecem por acaso. Elas começam com uma pergunta que ninguém pensou em fazer.</p>
              <p>Foi por isso que criamos este espaço — para ajudar você a conhecer essa pessoa de novo.</p>
            </div>
          </div>
        );
      case 'name':
        return (
          <div className="onboarding-content onboarding-name-screen">
            <div>
              <p className="onboarding-kicker">seu baralho é pessoal</p>
              <h1>Como devo<br /><em>te chamar?</em></h1>
              <p className="onboarding-subtitle">Esse nome aparece no seu baralho.</p>
            </div>
            <div className="onboarding-name-form">
              <input value={name} onChange={(event) => setName(event.target.value)} autoFocus placeholder="Seu nome" data-testid="input-onboarding-name" />
              <div className="name-suggestions"><button type="button" className={pronoun === 'Ela' ? 'is-selected' : ''} onClick={() => setPronoun('Ela')}>Ela</button><button type="button" className={pronoun === 'Ele' ? 'is-selected' : ''} onClick={() => setPronoun('Ele')}>Ele</button><button type="button" className={pronoun === 'Prefiro não dizer' ? 'is-selected' : ''} onClick={() => setPronoun('Prefiro não dizer')}>Prefiro não dizer</button></div>
            </div>
          </div>
        );
      case 'date':
        return (
          <div className="onboarding-content onboarding-date-screen">
            <div>
              <p className="onboarding-kicker">uma história tem um começo</p>
              <h1>Quando a história<br /><em>de vocês começou?</em></h1>
            </div>
            <div className="date-native" aria-label="Escolha a data em que a história começou">
              <div className="date-native-display">
                {parts.day} de {monthNames[parts.month - 1]} de {parts.year}
              </div>
              <input
                type="date"
                className="date-native-input"
                value={date}
                onChange={event => { if (event.target.value) setDate(event.target.value); }}
                max={new Date().toISOString().slice(0, 10)}
                data-testid="input-onboarding-date"
                aria-label="Data em que a história começou"
              />
            </div>
          </div>
        );
      case 'days':
        return (
          <div className="onboarding-content onboarding-days-screen">
            <div className="plant-illustration" aria-hidden="true">
              <span className="plant-ground" />
              {[0.46, 0.65, 0.82, 1, 1.18].map((scale, index) => {
                const leafProgress = Math.max(0, Math.min(1, (animatedDays / Math.max(sharedDays, 1)) * 5 - index));
                return <i key={scale} style={{ opacity: 0.16 + leafProgress * 0.84, transform: `scale(${scale * (0.42 + leafProgress * 0.58)}) rotate(-12deg)` }} />;
              })}
            </div>
            <h1>Vocês já compartilharam<br /><strong>{animatedDays}</strong> dias</h1>
            <p>Ainda é cedo. Tem muita coisa que vocês ainda não perguntaram.</p>
          </div>
        );
      case 'curiosity':
        return (
          <div className="onboarding-content onboarding-question-screen">
            <div>
              <p className="onboarding-kicker">vamos chegar ao que importa</p>
              <h1>O que você quer<br /><em>descobrir sobre {partnerPronoun}?</em></h1>
              <p className="onboarding-subtitle">Selecione quantos quiser.</p>
            </div>
            <div className="onboarding-choice-list">
              {curiosityOptions.map((option) => <Choice key={option} label={option} multi selected={curiosity.includes(option)} onClick={() => setCuriosity((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])} />)}
            </div>
          </div>
        );
      case 'surprise':
        return (
          <div className="onboarding-content onboarding-question-screen">
            <div>
              <p className="onboarding-kicker">uma pergunta honesta</p>
              <h1>Quando foi a última vez<br />que {partnerPronoun} te surpreendeu<br /><em>com uma resposta?</em></h1>
            </div>
            <div className="onboarding-choice-list">
              {surpriseOptions.map((option) => <Choice key={option} label={option} selected={surprise === option} onClick={() => setSurprise(option)} />)}
            </div>
          </div>
        );
      case 'feeling':
        return (
          <div className="onboarding-content onboarding-question-screen">
            <div>
              <p className="onboarding-kicker">a intenção muda a conversa</p>
              <h1>Como você quer<br /><em>se sentir hoje à noite?</em></h1>
              <p className="onboarding-subtitle">Escolha o que está mais alto agora.</p>
            </div>
            <div className="feeling-construction" aria-hidden="true"><span /><span /><span /><i /><i /><i /></div>
            <div className="onboarding-choice-list">
              {feelingOptions.map((option) => <Choice key={option} label={option} selected={feeling === option} onClick={() => setFeeling(option)} />)}
            </div>
          </div>
        );
      case 'insight':
        return (
          <div className="onboarding-content onboarding-insight-screen">
            <div className="insight-sparkle"><Sparkles size={42} strokeWidth={1.2} /></div>
            <h1>Percebe o que acabou<br /><em>de acontecer, {name || 'você'}?</em></h1>
            <p>Você ficou curioso sobre essa pessoa de propósito. Essa é a parte que a maioria pula. Hoje, você recebe as perguntas para acompanhar essa curiosidade.</p>
          </div>
        );
      case 'preparing':
        return (
          <div className="onboarding-content onboarding-preparing-screen">
            <div className="preparing-deck"><div /><div /><div><span>{name || 'Seu'}'s cartas</span><small>perguntas escolhidas para vocês</small></div></div>
            <h1>Preparando seu<br /><em>baralho...</em></h1>
            <p>Escolhendo perguntas a partir da energia que você trouxe...</p>
            <div className="preparing-incoming-cards" aria-hidden="true"><i /><i /><i /></div>
          </div>
        );
      case 'deck':
        return (
          <div className="onboarding-content onboarding-deck-ready">
            <div className="deck-ready-icon"><Check size={27} /></div>
            <p className="onboarding-kicker">seu baralho está pronto</p>
            <h1>Agora é só<br /><em>começar a conversa.</em></h1>
            <p>As perguntas certas não entregam respostas prontas. Elas abrem espaço para vocês se encontrarem.</p>
             <ContinueButton onClick={() => {
               const hasAccess = safeGetItem('conexao-session') || safeGetItem('conexao-guest-token');
               if (hasAccess) {
                 safeSetItem(openWelcomeDeckStorageKey, 'true');
                 navigate('/app');
               } else {
                 navigate('/#pacotes');
               }
             }} light>{safeGetItem('conexao-session') || safeGetItem('conexao-guest-token') ? 'Abrir meu baralho' : 'Escolher meu baralho'}</ContinueButton>
            <button onClick={reset} className="onboarding-restart">Refazer o quiz</button>
          </div>
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    if (step.id === 'preparing') {
      const timeout = window.setTimeout(goNext, 1800);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [step.id]);

  const continueOnboarding = () => {
    if (step.id === 'welcome-role') {
      if (role === 'owner') {
        setStepIndex(activeSteps.findIndex(item => item.id === 'relationship'));
      } else if (role === 'guest') {
        setStepIndex(activeSteps.findIndex(item => item.id === 'guest-entry'));
      }
      return;
    }

    if (step.id === 'guest-entry') {
      const token = extractInviteToken(guestInviteLink);
      if (!token) {
        setGuestInviteError('Esse link não parece certo — confere e cola de novo');
        return;
      }
      safeSetItem('conexao-role', 'guest');
      navigate(`/invite/${encodeURIComponent(token)}`);
      return;
    }

    goNext();
  };

  const canContinue = step.id === 'welcome-role'
    ? !!role
    : step.id === 'guest-entry'
      ? true
      : step.id === 'name'
        ? name.trim().length > 0
        : step.id === 'relationship'
          ? !!relationship
          : step.id === 'curiosity'
            ? curiosity.length > 0
            : step.id === 'surprise'
              ? !!surprise
              : step.id === 'feeling'
                ? !!feeling
                : true;
  const noButton = ['intro', 'note', 'days', 'insight', 'preparing', 'deck'].includes(step.id);
  const onboardingStage = stepIndex <= activeSteps.findIndex(item => item.id === 'guest-entry')
    ? 0
    : stepIndex <= activeSteps.findIndex(item => item.id === 'feeling')
      ? 1
      : 2;

  return (
    <main className="onboarding-shell">
      <aside className="onboarding-desktop-rail" aria-hidden="true">
        <div className="onboarding-rail-brand"><span><Feather size={16} /></span><strong>Perguntas<br /><em>de Conexão</em></strong></div>
        <div className="onboarding-rail-intro">
          <span className="onboarding-rail-kicker">primeiro acesso</span>
          <p>Um espaço para voltar a ouvir quem está perto.</p>
        </div>
        <div className="onboarding-rail-steps">
           <div className={`onboarding-rail-step ${onboardingStage === 0 ? 'is-current' : ''} ${onboardingStage > 0 ? 'is-complete' : ''}`}><span>01</span><strong>Seu começo</strong></div>
           <div className={`onboarding-rail-step ${onboardingStage === 1 ? 'is-current' : ''} ${onboardingStage > 1 ? 'is-complete' : ''}`}><span>02</span><strong>O que importa</strong></div>
           <div className={`onboarding-rail-step ${onboardingStage === 2 ? 'is-current' : ''}`}><span>03</span><strong>Seu baralho</strong></div>
        </div>
        <span className="onboarding-rail-foot">feito para conversas que ficam</span>
      </aside>
      <div className="onboarding-frame">
        <StepHeader step={step} onBack={goBack} showBack={stepIndex > 0 && step.id !== 'preparing'} />
        {renderStep()}
        {!noButton && <ContinueButton onClick={continueOnboarding} disabled={!canContinue} />}
        {['note', 'days', 'insight'].includes(step.id) && <ContinueButton onClick={goNext} />}
      </div>
    </main>
  );
}