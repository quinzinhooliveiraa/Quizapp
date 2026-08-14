import { type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Feather, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';

type StepId =
  | 'intro'
  | 'relationship'
  | 'note'
  | 'name'
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
  { id: 'relationship', progress: 0.1 },
  { id: 'note', progress: 0.17 },
  { id: 'name', progress: 0.24 },
  { id: 'date', progress: 0.32 },
  { id: 'days', progress: 0.42 },
  { id: 'curiosity', progress: 0.53 },
  { id: 'surprise', progress: 0.63 },
  { id: 'feeling', progress: 0.73 },
  { id: 'insight', progress: 0.82 },
  { id: 'preparing', progress: 0.92 },
  { id: 'deck', progress: 1 },
];

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
type DatePartKind = 'day' | 'month' | 'year';

const welcomeDeckStorageKey = 'conexao-personalized-decks';
const welcomeDeckIdStorageKey = 'conexao-welcome-deck-id';
const welcomeDeckDoneStorageKey = 'conexao-welcome-deck-done';
const openWelcomeDeckStorageKey = 'conexao-open-welcome-deck';

function removeWelcomeDeck() {
  const welcomeDeckId = localStorage.getItem(welcomeDeckIdStorageKey);
  try {
    const stored = JSON.parse(localStorage.getItem(welcomeDeckStorageKey) || '[]');
    const decks = Array.isArray(stored)
      ? stored.filter((deck: unknown) => {
        if (!deck || typeof deck !== 'object') return false;
        const item = deck as { id?: unknown; label?: unknown };
        return item.id !== welcomeDeckId && item.label !== 'Seu primeiro baralho';
      })
      : [];
    localStorage.setItem(welcomeDeckStorageKey, JSON.stringify(decks));
  } catch {
    localStorage.removeItem(welcomeDeckStorageKey);
  }
  localStorage.removeItem(welcomeDeckIdStorageKey);
  localStorage.removeItem(welcomeDeckDoneStorageKey);
  localStorage.removeItem(openWelcomeDeckStorageKey);
}

function daysBetween(dateString: string) {
  const start = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 249;
  const now = new Date();
  const difference = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
  return difference;
}

function dateParts(dateString: string) {
  const [year, month, day] = dateString.split('-');
  return { day: Number(day), month: Number(month), year: Number(year) };
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
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`onboarding-choice ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      data-testid={`choice-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      <span>{label}</span>
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
  const [stepIndex, setStepIndex] = useState(() => {
    const saved = Number(localStorage.getItem('conexao-onboarding-step'));
    return Number.isInteger(saved) && saved >= 0 && saved < steps.length ? saved : 0;
  });
  const [name, setName] = useState(() => localStorage.getItem('conexao-onboarding-name') || '');
  const [pronoun, setPronoun] = useState(() => localStorage.getItem('conexao-onboarding-pronoun') || '');
  const [relationship, setRelationship] = useState(() => localStorage.getItem('conexao-onboarding-relationship') || '');
  const [date, setDate] = useState(() => localStorage.getItem('conexao-onboarding-date') || '2025-12-06');
  const [curiosity, setCuriosity] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('conexao-onboarding-curiosity') || '[]');
    } catch {
      return [];
    }
  });
  const [surprise, setSurprise] = useState('');
  const [feeling, setFeeling] = useState(() => localStorage.getItem('conexao-onboarding-feeling') || '');
  const [animatedDays, setAnimatedDays] = useState(0);
  const [dateDragOffset, setDateDragOffset] = useState<Record<DatePartKind, number>>({ day: 0, month: 0, year: 0 });
  const dateDragKind = useRef<DatePartKind | null>(null);
  const dateDragStartY = useRef<number | null>(null);
  const dateDragDelta = useRef(0);
  const datePointerCaptured = useRef(false);
  const suppressDateClick = useRef(false);

  const step = steps[stepIndex];
  const parts = useMemo(() => dateParts(date), [date]);
  const sharedDays = useMemo(() => daysBetween(date), [date]);
  const partnerPronoun = pronoun === 'Ele' ? 'ele' : pronoun === 'Ela' ? 'ela' : 'essa pessoa';

  useEffect(() => {
    if (
      localStorage.getItem('conexao-session')
      || localStorage.getItem('conexao-onboarding-complete') === 'true'
      || localStorage.getItem('conexao-guest-token')
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
    localStorage.setItem('conexao-onboarding-step', String(stepIndex));
    localStorage.setItem('conexao-onboarding-name', name);
    localStorage.setItem('conexao-onboarding-pronoun', pronoun);
    localStorage.setItem('conexao-onboarding-relationship', relationship);
    localStorage.setItem('conexao-onboarding-date', date);
    localStorage.setItem('conexao-onboarding-curiosity', JSON.stringify(curiosity));
    localStorage.setItem('conexao-onboarding-feeling', feeling);

    if (step.id === 'preparing') {
      localStorage.setItem('conexao-name', name.trim());
      localStorage.setItem('conexao-relationship', relationship);
      localStorage.setItem('conexao-curiosity', JSON.stringify(curiosity));
      localStorage.setItem('conexao-feeling', feeling);
      localStorage.setItem('conexao-partner-pronoun', pronoun);
      localStorage.setItem('conexao-onboarding-complete', 'true');
    }
  }, [step.id, stepIndex, name, pronoun, relationship, date, curiosity, feeling]);

  const goNext = () => setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  const goBack = () => setStepIndex((current) => Math.max(current - 1, 0));
  const reset = () => {
    localStorage.removeItem('conexao-onboarding-step');
    localStorage.removeItem('conexao-onboarding-name');
    localStorage.removeItem('conexao-onboarding-pronoun');
    localStorage.removeItem('conexao-onboarding-relationship');
    localStorage.removeItem('conexao-onboarding-date');
    localStorage.removeItem('conexao-onboarding-curiosity');
    localStorage.removeItem('conexao-onboarding-feeling');
    localStorage.removeItem('conexao-onboarding-complete');
    localStorage.removeItem('conexao-name');
    localStorage.removeItem('conexao-relationship');
    localStorage.removeItem('conexao-curiosity');
    localStorage.removeItem('conexao-feeling');
    localStorage.removeItem('conexao-partner-pronoun');
    removeWelcomeDeck();
    setStepIndex(0);
    setName('');
    setPronoun('');
    setRelationship('');
    setDate('2025-12-06');
    setCuriosity([]);
    setSurprise('');
    setFeeling('');
  };

  const selectDatePart = (kind: DatePartKind, value: number) => {
    const next = { ...parts, [kind]: value };
    const safeMonth = String(Math.min(12, Math.max(1, next.month))).padStart(2, '0');
    const safeDay = String(Math.min(28, Math.max(1, next.day))).padStart(2, '0');
    setDate(`${next.year}-${safeMonth}-${safeDay}`);
  };

  const handleDatePointerDown = (kind: DatePartKind, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dateDragKind.current = kind;
    dateDragStartY.current = event.clientY;
    dateDragDelta.current = 0;
    datePointerCaptured.current = false;
    suppressDateClick.current = false;
    setDateDragOffset(current => ({ ...current, [kind]: 0 }));
  };

  const handleDatePointerMove = (kind: DatePartKind, event: ReactPointerEvent<HTMLDivElement>) => {
    if (dateDragKind.current !== kind || dateDragStartY.current === null) return;
    dateDragDelta.current = event.clientY - dateDragStartY.current;
    if (Math.abs(dateDragDelta.current) >= 8 && !datePointerCaptured.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
      datePointerCaptured.current = true;
    }
    setDateDragOffset(current => ({ ...current, [kind]: dateDragDelta.current }));
  };

  const finishDatePointer = (kind: DatePartKind, event: ReactPointerEvent<HTMLDivElement>) => {
    if (dateDragKind.current !== kind || dateDragStartY.current === null) return;
    const delta = dateDragDelta.current;
    if (Math.abs(delta) >= 24) {
      suppressDateClick.current = true;
      selectDatePart(kind, parts[kind] + (delta < 0 ? 1 : -1));
    }
    dateDragKind.current = null;
    dateDragStartY.current = null;
    dateDragDelta.current = 0;
    setDateDragOffset(current => ({ ...current, [kind]: 0 }));
    if (datePointerCaptured.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    datePointerCaptured.current = false;
  };

  const cancelDatePointer = (kind: DatePartKind, event: ReactPointerEvent<HTMLDivElement>) => {
    if (dateDragKind.current !== kind) return;
    dateDragKind.current = null;
    dateDragStartY.current = null;
    dateDragDelta.current = 0;
    setDateDragOffset(current => ({ ...current, [kind]: 0 }));
    if (datePointerCaptured.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    datePointerCaptured.current = false;
  };

  const handleDateValueClick = (kind: DatePartKind, value: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressDateClick.current) {
      event.preventDefault();
      suppressDateClick.current = false;
      return;
    }
    selectDatePart(kind, value);
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
            <p className="onboarding-login-note">Já tem um baralho? <Link href="/app">Abrir meu acesso</Link></p>
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
            <div className="date-wheel" aria-label="Escolha a data em que a história começou">
              <div className="date-fade date-fade-top" />
              <div className="date-values">
                <div
                  className={`date-column ${dateDragKind.current === 'day' ? 'is-dragging' : ''}`}
                  style={{ '--date-drag-offset': `${dateDragOffset.day}px` } as CSSProperties}
                  onPointerDown={event => handleDatePointerDown('day', event)}
                  onPointerMove={event => handleDatePointerMove('day', event)}
                  onPointerUp={event => finishDatePointer('day', event)}
                  onPointerCancel={event => cancelDatePointer('day', event)}
                >
                  {[parts.day - 1, parts.day, parts.day + 1].map((value, index) => <button key={value} className={index === 1 ? 'is-active' : ''} onClick={event => handleDateValueClick('day', value, event)}>{value}</button>)}
                </div>
                <div
                  className={`date-column ${dateDragKind.current === 'month' ? 'is-dragging' : ''}`}
                  style={{ '--date-drag-offset': `${dateDragOffset.month}px` } as CSSProperties}
                  onPointerDown={event => handleDatePointerDown('month', event)}
                  onPointerMove={event => handleDatePointerMove('month', event)}
                  onPointerUp={event => finishDatePointer('month', event)}
                  onPointerCancel={event => cancelDatePointer('month', event)}
                >
                  {[parts.month - 1, parts.month, parts.month + 1].map(month => {
                    const safeMonth = ((month - 1 + 12) % 12) + 1;
                    return <button key={safeMonth} className={safeMonth === parts.month ? 'is-active' : ''} onClick={event => handleDateValueClick('month', safeMonth, event)}>{monthNames[safeMonth - 1]}</button>;
                  })}
                </div>
                <div
                  className={`date-column ${dateDragKind.current === 'year' ? 'is-dragging' : ''}`}
                  style={{ '--date-drag-offset': `${dateDragOffset.year}px` } as CSSProperties}
                  onPointerDown={event => handleDatePointerDown('year', event)}
                  onPointerMove={event => handleDatePointerMove('year', event)}
                  onPointerUp={event => finishDatePointer('year', event)}
                  onPointerCancel={event => cancelDatePointer('year', event)}
                >
                  {[parts.year - 1, parts.year, parts.year + 1].map((value, index) => <button key={value} className={index === 1 ? 'is-active' : ''} onClick={event => handleDateValueClick('year', value, event)}>{value}</button>)}
                </div>
              </div>
              <div className="date-fade date-fade-bottom" />
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
            <ContinueButton onClick={() => { localStorage.setItem(openWelcomeDeckStorageKey, 'true'); navigate('/app'); }} light>Abrir meu baralho</ContinueButton>
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

  const canContinue = step.id === 'name' ? name.trim().length > 0 : step.id === 'relationship' ? !!relationship : step.id === 'curiosity' ? curiosity.length > 0 : step.id === 'surprise' ? !!surprise : step.id === 'feeling' ? !!feeling : true;
  const noButton = ['intro', 'note', 'days', 'insight', 'preparing', 'deck'].includes(step.id);

  return (
    <main className="onboarding-shell">
      <div className="onboarding-frame">
        <StepHeader step={step} onBack={goBack} showBack={stepIndex > 0 && step.id !== 'preparing'} />
        {renderStep()}
        {!noButton && <ContinueButton onClick={goNext} disabled={!canContinue} />}
        {['note', 'days', 'insight'].includes(step.id) && <ContinueButton onClick={goNext} />}
      </div>
    </main>
  );
}