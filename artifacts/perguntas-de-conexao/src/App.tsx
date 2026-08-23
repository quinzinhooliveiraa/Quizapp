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
  useListInvites,
  getListInvitesQueryKey,
  useGetInvite,
  getGetInviteQueryKey,
  type Question,
  type QuestionTheme,
  type InviteListItem,
} from '@workspace/api-client-react';
import { questions as connectionQuestions, themes as connectionThemes } from '@workspace/connection-content';
 import { ArrowRight, Bookmark, BookmarkCheck, Check, ChevronLeft, ChevronRight, Copy, Download, Feather, Flame, Heart, House, Layers3, LayoutTemplate, Link as LinkIcon, Menu, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Quote, RotateCw, Send, Settings2, Shuffle, Sparkles, Star, Upload, UserPlus, UserRound, Users, WandSparkles, Wifi, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';
import NotFound from '@/pages/not-found';
import Onboarding from '@/pages/Onboarding';
import Login from '@/pages/Login';
import Play from '@/pages/Play';
import Admin from '@/pages/Admin';
import { apiBaseUrl } from '@/config';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 4,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 8000),
      staleTime: 30_000,
    },
  },
});
const apiBase = apiBaseUrl;
const apiUrl = (path: string) => `${apiBase}${path}`;
const inviteUrlFromToken = (token: string) => `${window.location.origin}/invite/${token}`;

type Preferences = {
  relationshipType: string | null;
  partnerPronoun: string | null;
};

async function fetchPreferences(sessionId: string | null, guestToken: string | null): Promise<Preferences | null> {
  if (!sessionId && !guestToken) return null;
  const query = sessionId
    ? `sessionId=${encodeURIComponent(sessionId)}`
    : `guestToken=${encodeURIComponent(guestToken!)}`;
  try {
    const response = await fetch(`${apiBase}/api/preferences?${query}`);
    if (!response.ok) return null;
    return await response.json() as Preferences;
  } catch {
    return null;
  }
}

async function patchPreferences(
  sessionId: string | null,
  guestToken: string | null,
  patch: { relationshipType?: string; partnerPronoun?: string },
): Promise<void> {
  if (!sessionId && !guestToken) return;
  try {
    await fetch(`${apiBase}/api/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, guestToken, ...patch }),
    });
  } catch {
    // Local storage remains the immediate fallback if the server is unavailable.
  }
}

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
const RELATIONSHIP_OPTIONS = [
  'Meu namorado ou minha namorada',
  'Meu esposo ou minha esposa',
  'Alguém com quem estou saindo',
  'Namoro à distância',
];
const PRONOUN_OPTIONS = ['Ela', 'Ele', 'Prefiro não dizer'];

type PersonalizedDeck = {
  id: string;
  createdAt: string;
  label: string;
  ids: string[];
  cover: string;
  seenIds: string[];
};

type SavedMoment = {
  id: string;
  questionId: string;
  themeId: string;
  fromPlayerName: string;
  answerText: string;
  roomCode: string | null;
  createdAt: string;
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

function LandingQuiz({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [theme, setTheme] = useState<'porto' | 'faisca' | 'livro' | ''>('');

  const previews: Record<string, { title: string; questions: string[] }> = {
    porto: {
      title: 'Porto Seguro',
      questions: [
        'Qual foi a última vez que você se sentiu completamente em casa comigo?',
        'O que eu faço, sem perceber, que te faz respirar mais fundo?',
        'Se um dia esta versão nossa acabasse, do que você mais sentiria falta?',
      ],
    },
    faisca: {
      title: 'Faísca',
      questions: [
        'O que em mim ainda te surpreende — que você não esperava?',
        'Quando foi a última vez que você me olhou e pensou "quero de novo"?',
        'Qual gesto meu, mesmo bobo, te desarma na hora?',
      ],
    },
    livro: {
      title: 'Livro Aberto',
      questions: [
        'Qual medo você tem sobre nós que ainda não me disse?',
        'O que você acha que eu deveria saber sobre você e nunca perguntei?',
        'Existe algo que você mudaria na gente hoje, se pudesse?',
      ],
    },
  };

  if (step === 3) {
    const preview = previews[theme] || previews.porto;
    return <div className="lp-quiz-result">
      <p className="lp-quiz-pill">Seu baralho ideal pra começar:</p>
      <h3 className="lp-quiz-result-title">{preview.title}</h3>
      <div className="lp-quiz-cards">
        {preview.questions.map((question, index) => <div key={question} className="lp-quiz-preview-card">
          <span className="lp-mock-tag">{preview.title.toLowerCase()}</span>
          <p>"{question}"</p>
          <span className="lp-mock-num">{String(index + 1).padStart(2, '0')} / 31</span>
        </div>)}
      </div>
      <p className="lp-quiz-cta-text"><strong>Essas são 3 de 31.</strong> Destrave as outras + os outros 14 baralhos:</p>
      <button onClick={onFinish} className="lp-cta-primary lp-cta-big" data-testid="button-quiz-cta">Ver o preço <ArrowRight size={18} /></button>
    </div>;
  }

  const steps = [
    { key: 'role', label: 'Vocês estão:', options: [['namorando', 'Namorando'], ['casado', 'Casados'], ['longa', 'Relação longa']] },
    { key: 'phase', label: 'Como você descreveria a fase de vocês?', options: [['inicio', 'Início, descobrindo'], ['anos', 'Anos juntos, rotina'], ['reconectar', 'Precisamos reconectar']] },
    { key: 'theme', label: 'O que mais te chama agora?', options: [['porto', 'Aquecer, sem susto'], ['faisca', 'Provocar, apimentar'], ['livro', 'Ir fundo de verdade']] },
  ] as const;
  const current = steps[step];

  return <div className="lp-quiz">
    <div className="lp-quiz-progress">{steps.map((item, index) => <span key={item.key} className={step >= index ? 'is-active' : ''} />)}</div>
    <p className="lp-quiz-question">{current.label}</p>
    <div className="lp-quiz-options">
      {current.options.map(([value, label]) => <button key={value} onClick={() => { if (step === 2) setTheme(value as typeof theme); setStep(step + 1); }} className="lp-quiz-option" data-testid={`button-quiz-${current.key}-${value}`}>{label}</button>)}
    </div>
  </div>;
}

const CAROUSEL_ROUNDS: { theme: string; kind: 'tema' | 'vibe'; text: string }[][] = [
  [
    { theme: 'lá atrás', kind: 'tema', text: 'Que lembrança da sua infância ainda molda quem você é hoje?' },
    { theme: 'faísca', kind: 'vibe', text: 'Qual é uma coisa que te excita em mim e que poucas pessoas sabem?' },
    { theme: 'em voz alta', kind: 'tema', text: 'Se nada fosse impossível, como você imagina nossa vida daqui a 5 anos?' },
  ],
  [
    { theme: 'porto seguro', kind: 'tema', text: 'Qual foi a última vez que você se sentiu completamente em casa comigo?' },
    { theme: 'livro aberto', kind: 'tema', text: 'Qual medo você tem sobre nós que ainda não me disse?' },
    { theme: 'modo leve', kind: 'tema', text: 'Qual foi a coisa mais boba que já rimos juntos até hoje?' },
  ],
  [
    { theme: 'você não sabia', kind: 'tema', text: 'Existe algo que você sempre quis me contar e nunca teve coragem?' },
    { theme: 'viagens', kind: 'tema', text: 'Qual lugar você ainda sonha em conhecer comigo?' },
    { theme: 'depois da tempestade', kind: 'tema', text: 'O que você aprendeu sobre nós depois da nossa pior briga?' },
  ],
  [
    { theme: 'carreira & dinheiro', kind: 'tema', text: 'Como você imagina que vamos dividir as contas daqui a 10 anos?' },
    { theme: 'luzes baixas', kind: 'vibe', text: 'O que você faria se soubesse que eu não ia julgar?' },
    { theme: 'mesmo longe', kind: 'vibe', text: 'O que mais faz falta em nós quando estamos distantes?' },
  ],
  [
    { theme: 'perto de novo', kind: 'vibe', text: 'Qual gesto meu, mesmo pequeno, ainda te desarma?' },
    { theme: 'fogo alto', kind: 'vibe', text: 'Existe algum desejo seu que você ainda não teve coragem de dividir comigo?' },
    { theme: 'em voz alta', kind: 'tema', text: 'Se pudéssemos recomeçar do zero, o que você mudaria em nós?' },
  ],
];

function QuestionCarousel() {
  const [round, setRound] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const goTo = (next: number) => {
    if (spinning) return;
    setSpinning(true);
    window.setTimeout(() => {
      setRound(((next % CAROUSEL_ROUNDS.length) + CAROUSEL_ROUNDS.length) % CAROUSEL_ROUNDS.length);
      setSpinning(false);
    }, 260);
  };

  return <div className="lp-carousel">
    <button type="button" onClick={() => goTo(round - 1)} className="lp-carousel-arrow" aria-label="Perguntas anteriores" data-testid="button-carousel-prev"><ChevronLeft size={20} /></button>
    <div className={`lp-carousel-track ${spinning ? 'is-spinning' : ''}`}>
      {CAROUSEL_ROUNDS[round].map((card, index) => <div key={`${round}-${index}`} className={`lp-mock-card lp-carousel-card ${card.kind === 'vibe' ? 'lp-mock-card-back' : ''}`}>
        <span className={`lp-mock-tag ${card.kind === 'vibe' ? 'lp-mock-tag-vibe' : ''}`}>{card.theme}</span>
        <p className="lp-mock-text">"{card.text}"</p>
        <Heart size={15} className="lp-carousel-heart" />
      </div>)}
    </div>
    <button type="button" onClick={() => goTo(round + 1)} className="lp-carousel-arrow" aria-label="Próximas perguntas" data-testid="button-carousel-next"><ChevronRight size={20} /></button>
  </div>;
}

function QuestionCarouselSection() {
  return <section className="lp-carousel-section">
    <div className="lp-container">
      <p className="lp-eyebrow lp-eyebrow-center">algumas perguntas que vocês vão encontrar</p>
      <QuestionCarousel />
      <p className="lp-solution-note">Mais de 445 perguntas originais esperando por vocês.</p>
    </div>
  </section>;
}

function LandingV2Quiz({ onBuy }: { onBuy: () => void }) {
  const themes = [
    ['Porto Seguro', 'As conversas que parecem casa.', '31 cartas'],
    ['Livro Aberto', 'Sem filtro, cara a cara.', '31 cartas'],
    ['Você Não Sabia', 'Descobertas que ainda cabem entre vocês.', '32 cartas'],
    ['Em Voz Alta', 'A vida que os dois querem construir.', '30 cartas'],
    ['Lá Atrás', 'O que formou quem você é hoje.', '28 cartas'],
    ['Modo Leve', 'Pra rir e não levar tão a sério.', '31 cartas'],
    ['Viagens', 'Lugares que já foram e ainda vão ser.', '30 cartas'],
    ['Carreira & Dinheiro', 'Como pensam o lado prático.', '30 cartas'],
    ['Depois da Tempestade', 'O caminho de volta.', '30 cartas'],
    ['Faísca', 'O lado mais provocante de vocês.', '31 cartas'],
    ['Luzes Baixas', 'Quando a noite pede mais coragem. 18+', '35 cartas'],
    ['Fogo Alto', 'Desejos, curiosidades, limites. 18+', '30 cartas'],
    ['Sem Freio', 'O mais ousado. Só pra quem topa. 18+', '30 cartas'],
    ['Mesmo Longe', 'Quando rotina ou distância afastam.', '30 cartas'],
    ['Perto de Novo', 'Esquentar o espaço entre vocês.', '30 cartas'],
  ];
  return <>
    <section className="lp-hero lp2-hero">
      <div className="lp-hero-inner">
        <div className="lp-hero-copy">
          <span className="lp-eyebrow">baralho digital de perguntas · para casais</span>
          <h1 className="lp-hero-h1">Descubra perguntas para <span className="lp-hl-salmon">reacender a chama</span> do seu relacionamento e se <span className="lp-hl-lilac">reaproximar</span> do seu parceiro em uma noite</h1>
          <p className="lp-hero-sub">Tenha acesso a perguntas de conexão que abrem conversa de verdade entre você e seu parceiro. <strong>Pare de ter conversas monótonas</strong> e reaproxime-se da pessoa que você ama.</p>
          <button onClick={() => document.getElementById('lp2-quiz')?.scrollIntoView({ behavior: 'smooth' })} className="lp-cta-primary lp-cta-big" data-testid="button-hero-cta-v2">Quero reacender a conexão <ArrowRight size={18} /></button>
        </div>
        <div className="lp-hero-mockups" aria-hidden="true">
          <div className="lp-mockup-mac"><div className="lp-mockup-mac-bar"><span /><span /><span /></div><div className="lp-mockup-mac-screen"><div className="lp-mock-card lp-mock-card-front"><span className="lp-mock-tag">porto seguro</span><p className="lp-mock-text">"Qual foi a última vez que você se sentiu completamente em casa comigo?"</p><span className="lp-mock-num">01 / 31</span></div></div></div>
          <div className="lp-mockup-phone"><div className="lp-mockup-phone-notch" /><div className="lp-mockup-phone-screen"><div className="lp-mock-card lp-mock-card-back"><span className="lp-mock-tag lp-mock-tag-vibe">faísca</span><p className="lp-mock-text">"O que em mim ainda te surpreende?"</p><span className="lp-mock-num">07 / 31</span></div></div></div>
        </div>
      </div>
    </section>
    <section className="lp2-story"><div className="lp-container lp2-story-narrow">
      <p className="lp-eyebrow">a real sobre o que acontece</p>
      <div className="lp2-story-body">
        <p className="lp2-story-lead">Ninguém acorda um dia e decide se afastar da pessoa que ama.</p>
        <p>Acontece devagar. Um mês corrido no trabalho. Uma briga que ficou sem resolver. Uma semana em que vocês mal se cruzaram. E, sem perceber, vocês trocaram as conversas que faziam vocês <strong>se conhecerem</strong> por conversas que só existem porque viraram rotina.</p>
        <p>"Foi na academia?" "Que horas você chega?" "Tô indo trabalhar."</p>
        <p>Até que chega uma fase em que vocês percebem que não sobrou tempo pra vocês mesmos. Sobra pro trabalho, pro celular, pra todo mundo — menos pros dois. E quando finalmente sobra, cada um vai pro próprio mundo: no mesmo sofá ou a quilômetros de distância. Não tem briga. Não tem grito. Só um silêncio que ninguém tem coragem de nomear.</p>
        <div className="lp2-story-pull">"Eu amo essa pessoa. Então por que a gente não tem mais nada pra conversar?"</div>
        <p>E quando você finalmente cria coragem e diz <strong>"vamos conversar"</strong>, sabe o que costuma acontecer? <strong>Você não tem assunto.</strong> A outra pessoa trava, responde seco — e vocês voltam ao silêncio. Só que agora a sensação fica pior do que antes.</p>
        <p>O problema não é falta de amor. <strong>O problema é a pergunta.</strong></p>
        <p>"Vamos conversar" não é uma pergunta — é uma cobrança. Ela pede que o outro traga alguma coisa sem dizer o quê. Já <em>"você se arrepende de algo sobre a nossa história até aqui?"</em> é diferente. Ela é específica. Ela já chega com o assunto pronto, então ninguém precisa inventar por onde começar. E ela abre uma porta que os dois queriam abrir há meses, sem saber como.</p>
        <p>É exatamente isso que a gente construiu.</p>
      </div>
    </div></section>
    <section className="lp-solution lp2-proposta"><div className="lp-container">
      <p className="lp-eyebrow lp-eyebrow-center">a proposta</p>
      <h2 className="lp-h2">São perguntas simples que vocês podem<br /><em>incluir na rotina começando hoje.</em></h2>
      <p className="lp-solution-lede">445+ perguntas escritas pra abrir espaço — sem clichê, sem "qual seu animal favorito". Vocês abrem uma carta, leem em voz alta e escutam. Separem 10 minutos. O resto acontece entre vocês.</p>
      <div className="lp-solution-pillars">
        <div className="lp-pillar"><div className="lp-pillar-icon">◇</div><strong>10 minutos por noite</strong><p>Não exige terapia, retiro nem fim de semana livre. Só uma carta por vez.</p></div>
        <div className="lp-pillar"><div className="lp-pillar-icon">▣</div><strong>Celular ou computador</strong><p>Abre no navegador, sem instalar nada, em qualquer aparelho.</p></div>
        <div className="lp-pillar"><div className="lp-pillar-icon">◎</div><strong>Não precisam estar juntos</strong><p>Namoro à distância, viagem a trabalho ou cada um no seu quarto: a sala online deixa vocês na mesma pergunta, ao mesmo tempo.</p></div>
      </div>
    </div></section>
    <section className="lp-quiz-section" id="lp2-quiz"><div className="lp-container">
      <p className="lp-eyebrow lp-eyebrow-center">experimente agora, de graça</p>
      <h2 className="lp-h2">Responda 3 perguntinhas e receba<br /><em>3 perguntas feitas pro momento de vocês.</em></h2>
      <p className="lp-solution-lede lp2-quiz-lede">Leva menos de 1 minuto. A gente monta na hora um mini-baralho com a cara da fase que vocês estão vivendo.</p>
      <LandingQuiz onFinish={onBuy} />
    </div></section>
    <section className="lp-themes lp2-themes" id="lp2-pacotes"><div className="lp-container">
      <p className="lp-eyebrow lp-eyebrow-center">o que tem dentro</p>
      <h2 className="lp-h2">16 baralhos temáticos,<br /><em>pra cada momento de vocês.</em></h2>
      <div className="lp-themes-grid">{themes.map(([name, description, count], index) => <div key={name} className={`lp-theme-card ${index > 8 ? 'lp-theme-vibe' : ''}`}><strong>{name}</strong><p>{description}</p><span>{count}</span></div>)}<div className="lp-theme-card lp-theme-bonus"><span className="lp-theme-bonus-badge">bônus</span><strong>Baralho do Dia</strong><p>Um baralho montado na hora, de acordo com o que vocês estão sentindo hoje.</p><span>todo dia um novo</span></div></div>
      <p className="lp-themes-note"><strong>445+ perguntas no total.</strong> Novos baralhos entram de tempos em tempos — o acesso é vitalício.</p>
    </div></section>
    <section className="lp-how" id="lp2-como-funciona"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">como funciona</p><h2 className="lp-h2">Três passos. <em>Um ritual novo.</em></h2><div className="lp-how-steps"><div className="lp-how-step"><span className="lp-how-num">01</span><strong>Escolham um baralho</strong><p>15 temas fixos + o bônus do dia, montado pelo que vocês estão sentindo.</p></div><div className="lp-how-step"><span className="lp-how-num">02</span><strong>Abram uma carta</strong><p>Leiam em voz alta, sem pressa, e deixem a pergunta agir.</p></div><div className="lp-how-step"><span className="lp-how-num">03</span><strong>Conversem de verdade</strong><p>Uma pergunta por vez. O resto acontece entre vocês.</p></div></div></div></section>
    <section className="lp-social"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">o que dizem</p><h2 className="lp-h2">Casais que já usaram<br /><em>e não largam mais.</em></h2><div className="lp-social-grid"><blockquote className="lp-testimonial"><p>"Descobri coisas do meu marido em uma noite que 8 anos de casamento não tinham me mostrado."</p><footer>— Marina L. · Belo Horizonte</footer></blockquote><blockquote className="lp-testimonial"><p>"A gente fez a distância desaparecer por 40 minutos. Valeu mais que qualquer presente."</p><footer>— Rafael C. · Curitiba</footer></blockquote><blockquote className="lp-testimonial"><p>"Virou nosso ritual de sexta à noite. Sério."</p><footer>— Julia M. · São Paulo</footer></blockquote></div><p className="lp-tiny-note">Depoimentos de casais em fase de teste.</p></div></section>
    <section className="lp-price" id="lp2-precos"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">acesso vitalício</p><h2 className="lp-h2">A próxima boa conversa<br /><em>pode ser hoje à noite.</em></h2><div className="lp-price-card"><div className="lp-price-badge">Oferta de lançamento</div><div className="lp-price-main"><span className="lp-price-old">De <s>R$ 97,00</s></span><div className="lp-price-value"><span className="lp-price-currency">R$</span><span className="lp-price-big">47</span><span className="lp-price-cents">,90</span></div><span className="lp-price-installments">à vista <strong>ou</strong> 5x de R$ 9,58</span></div><ul className="lp-price-includes"><li>✓ 445+ perguntas em 16 baralhos temáticos</li><li>✓ Baralho personalizado do dia, sempre novo</li><li>✓ Acesso pra <strong>2 pessoas</strong> (você + convite)</li><li>✓ Salas online sincronizadas, mesmo à distância</li><li>✓ Novos baralhos incluídos, pra sempre</li><li>✓ Sem mensalidade. Paga uma vez.</li></ul><button onClick={onBuy} className="lp-cta-primary lp-cta-full" data-testid="button-price-cta-v2">Começar agora por R$ 47,90 <ArrowRight size={18} /></button><div className="lp-guarantee"><div className="lp-guarantee-seal">✦</div><div><strong>Garantia incondicional de 7 dias.</strong><p>Se não fizer sentido pra vocês, devolvemos 100%. Sem drama, sem perguntas.</p></div></div></div></div></section>
    <section className="lp-faq" id="lp2-faq"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">dúvidas frequentes</p><h2 className="lp-h2">Ainda em dúvida?</h2><div className="lp-faq-list">{[['Precisa instalar algum aplicativo?', 'Não. É 100% online, roda no navegador do celular ou do computador.'], ['E se meu parceiro achar estranho?', 'É o mais comum. Por isso os baralhos começam leves — você escolhe o clima. Ninguém é obrigado a abrir nada antes de querer.'], ['Funciona à distância?', 'Sim. Vocês criam uma sala online e jogam sincronizados, cada um no seu aparelho.'], ['É vitalício mesmo?', 'Sim. Paga uma vez, usa pra sempre — incluindo os baralhos novos que entram depois.'], ['Como recebo depois de pagar?', 'Na hora. O pagamento é via Pix e o acesso abre automaticamente após a confirmação.']].map(([question, answer]) => <details key={question} className="lp-faq-item"><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>
    <section className="lp-final-cta"><div className="lp-container lp-final-cta-inner"><h2 className="lp-h2">Vocês não precisam se afastar mais.<br /><em>Só de uma pergunta pra recomeçar.</em></h2><p>Comece hoje por R$ 47,90, com acesso vitalício e 7 dias de garantia.</p><button onClick={onBuy} className="lp-cta-primary lp-cta-big" data-testid="button-final-cta-v2">Quero começar agora <ArrowRight size={20} /></button></div></section>
  </>;
}

function Shell({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className={`site-shell ${dark ? 'shell-dark' : ''}`}>
    <header className="site-header">
      <Logo inverse={dark} />
     <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`}>
        <Link href="/app" data-testid="link-experience">Experiência</Link>
        <a href="#como-funciona" data-testid="link-how-it-works">Como funciona</a>
       <a href="#lp-precos" data-testid="link-packages">Pacotes</a>
      </nav>
       <Link href="/login" className="header-cta" data-testid="link-header-cta">Abrir meu baralho <ArrowRight size={16} /></Link>
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
    const wantsToBuy = typeof window !== 'undefined' && (window.location.hash === '#pacotes' || new URLSearchParams(window.location.search).get('comprar') === '1');
    if (wantsToBuy) return;
    const ownerReady = sessionQuery.isSuccess && sessionQuery.data.accessGranted;
    const guestReady = guestQuery.isSuccess && guestQuery.data.hasAccess;
    if (!ownerReady && !guestReady) return;
    const onboardingDone = storedGuestToken
      ? Boolean((guestQuery.data as { onboardingComplete?: boolean } | undefined)?.onboardingComplete)
      : Boolean((sessionQuery.data as { onboardingComplete?: boolean } | undefined)?.onboardingComplete);
    navigate(onboardingDone ? '/app' : '/onboarding', { replace: true });
  }, [guestQuery.data, guestQuery.isSuccess, navigate, sessionQuery.data, sessionQuery.isSuccess, storedGuestToken]);

  const wantsToBuy = typeof window !== 'undefined' && (window.location.hash === '#pacotes' || new URLSearchParams(window.location.search).get('comprar') === '1');
  if (wantsToBuy) return null;
  if (!hasStoredAccess || (!isChecking && !((sessionQuery.isSuccess && sessionQuery.data.accessGranted) || (guestQuery.isSuccess && guestQuery.data.hasAccess)))) {
    return null;
  }

  return <div className="access-gate-overlay" role="status" aria-live="polite"><div className="access-gate"><span className="access-gate-mark"><Feather size={18} /></span><p>Abrindo seu espaço de conexão…</p></div></div>;
}

function Home({ variant = 'v1' }: { variant?: 'v1' | 'v2' }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<'couple' | 'family'>('couple');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'sending' | 'confirming' | 'error' | 'waiting-manual'>('idle');
  const [confirmingLong, setConfirmingLong] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isStandaloneApp()) return;
    // If access is stored, StoredAccessGate handles redirecting to /app.
    if (safeGetItem('conexao-session') || safeGetItem('conexao-guest-token')) return;
    // An installed app without access should continue through onboarding, not sales.
    navigate('/onboarding', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (checkoutState !== 'confirming') {
      setConfirmingLong(false);
      return;
    }

    const timer = window.setTimeout(() => setConfirmingLong(true), 15000);
    return () => window.clearTimeout(timer);
  }, [checkoutState]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionIdFromUrl = params.get('session');
    const pendingSession = safeGetItem('conexao-pending-session');
    const sessionId = sessionIdFromUrl || pendingSession;
    const checkoutCancelled = params.get('checkout') === 'cancelado';
    if (checkoutCancelled) {
      setCheckoutState('error');
      setCheckoutOpen(true);
      return;
    }
    if (!sessionId) return;

    const billId = safeGetItem('conexao-pending-bill');
    setCheckoutState('confirming');
    setCheckoutOpen(true);
    let attempts = 0;
    let timeoutId: number | null = null;
    let cancelled = false;

    const checkPayment = async () => {
      attempts += 1;
      if (cancelled) return;
      try {
        const sessionUrl = billId
          ? `/api/access/sessions/${encodeURIComponent(sessionId)}?bill=${encodeURIComponent(billId)}`
          : `/api/access/sessions/${encodeURIComponent(sessionId)}`;
        const response = await fetch(apiUrl(sessionUrl));
        if (response.ok) {
          const session = await response.json() as { accessGranted?: boolean };
          if (!cancelled && session.accessGranted) {
            safeSetItem('conexao-session', sessionId);
            safeSetItem('conexao-role', 'owner');
            safeRemoveItem('conexao-pending-session');
            safeRemoveItem('conexao-pending-bill');
            window.location.href = '/onboarding';
            return;
          }
        }
      } catch {
        // Keep polling while the webhook and API settle.
      }

      if (cancelled) return;
      if (attempts < 30) {
        timeoutId = window.setTimeout(checkPayment, 2000);
      } else {
        setCheckoutState('waiting-manual');
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
      const data = await response.json() as { checkoutUrl?: string; sessionId?: string; billId?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error('checkout failed');
      if (data.sessionId) safeSetItem('conexao-pending-session', data.sessionId);
      if (data.billId) safeSetItem('conexao-pending-bill', data.billId);
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutState('error');
    }
  };
  const [buyerNameInput, setBuyerNameInput] = useState('');
     return <Shell dark>
    <StoredAccessGate />
    <Link href="/login" className="home-login-link" data-testid="link-home-login">Já tem baralho? Entrar</Link>
      <main className="lp-main">{variant === 'v2' ? <LandingV2Quiz onBuy={() => { setSelectedPackage('couple'); setCheckoutState('idle'); setCheckoutOpen(true); }} /> : <>
       <section className="lp-hero"><div className="lp-hero-inner"><div className="lp-hero-copy">
         <span className="lp-eyebrow">baralho digital de perguntas · para casais</span>
         <h1 className="lp-hero-h1">Suas conversas viraram <em>logística.</em><br /><strong>É hora de voltar a se conhecer.</strong></h1>
         <p className="lp-hero-sub">300+ perguntas de conexão real. Sem quiz de revista, sem clichê. Uma pergunta por vez — o resto acontece entre vocês.</p>
         <div className="lp-hero-actions"><button onClick={() => document.getElementById('lp-quiz')?.scrollIntoView({ behavior: 'smooth' })} className="lp-cta-primary" data-testid="button-hero-cta">Ver 3 perguntas grátis <ArrowRight size={18} /></button><a href="#lp-precos" className="lp-cta-secondary">Ir direto pro preço</a></div>
         <div className="lp-hero-trust"><div className="lp-trust-avatars"><span className="lp-trust-avatar lp-trust-a">M</span><span className="lp-trust-avatar lp-trust-b">L</span><span className="lp-trust-avatar lp-trust-c">R</span></div><span>Já usado por <strong>+300 casais</strong> no Brasil</span></div>
        </div><div className="lp-hero-mockups" aria-hidden="true"><div className="lp-mockup-mac"><div className="lp-mockup-mac-bar"><span /><span /><span /></div><div className="lp-mockup-mac-screen"><div className="lp-mock-card lp-mock-card-front"><span className="lp-mock-tag">porto seguro</span><p className="lp-mock-text">"Qual foi a última vez que você se sentiu <em>completamente</em> em casa comigo?"</p><span className="lp-mock-num">03 / 31</span></div></div></div><div className="lp-mockup-phone"><div className="lp-mockup-phone-notch" /><div className="lp-mockup-phone-screen"><div className="lp-mock-card lp-mock-card-back"><span className="lp-mock-tag lp-mock-tag-vibe">faísca</span><p className="lp-mock-text">"O que em mim ainda te <em>surpreende?</em>"</p><span className="lp-mock-num">07 / 31</span></div></div></div></div></div></section>
       <QuestionCarouselSection />
       <section className="lp-pain"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">quem tá aí sabe</p><h2 className="lp-h2">Você olha pra ele(a) e pensa:<br /><em>"onde a gente se perdeu?"</em></h2><ul className="lp-pain-list"><li><span className="lp-pain-icon">◌</span><div><strong>As conversas viraram logística.</strong><p>"Buscou pão?" "Que horas vem?" "Feriado a gente vai onde?"</p></div></li><li><span className="lp-pain-icon">◌</span><div><strong>Cada um no próprio celular.</strong><p>Sentados no mesmo sofá, quilômetros de distância um do outro.</p></div></li><li><span className="lp-pain-icon">◌</span><div><strong>Você tentou "vamos conversar".</strong><p>Deu silêncio, resposta seca, ou desviou pro Netflix. De novo.</p></div></li></ul><p className="lp-pain-close">Não é falta de amor. É que <strong>ninguém ensinou a fazer as perguntas certas.</strong></p></div></section>
       <section className="lp-solution"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">a proposta</p><h2 className="lp-h2">Um baralho digital<br /><em>que faz o trabalho pesado.</em></h2><p className="lp-solution-lede">300+ perguntas escritas pra abrir espaço — sem quiz de revista, sem clichê, sem "qual seu animal favorito". Uma pergunta por vez. Você abre, lê em voz alta, escuta. O resto acontece entre vocês.</p><div className="lp-solution-pillars"><div className="lp-pillar"><div className="lp-pillar-icon">◇</div><strong>15 baralhos temáticos</strong><p>De "Porto Seguro" até "Fogo Alto", para cada fase da conversa.</p></div><div className="lp-pillar"><div className="lp-pillar-icon">▣</div><strong>Roda no celular e PC</strong><p>Abre no navegador, sem instalar app, em qualquer aparelho.</p></div><div className="lp-pillar"><div className="lp-pillar-icon">◎</div><strong>Jogue junto de longe</strong><p>Sala online sincronizada para estarem na mesma pergunta.</p></div></div></div></section>
       <section className="lp-quiz-section" id="lp-quiz"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">experimente</p><h2 className="lp-h2">Ver 3 perguntas de verdade,<br /><em>feitas pra vocês.</em></h2><LandingQuiz onFinish={() => document.getElementById('lp-precos')?.scrollIntoView({ behavior: 'smooth' })} /></div></section>
       <section className="lp-how" id="como-funciona"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">como funciona</p><h2 className="lp-h2">Três passos, um ritual novo.</h2><div className="lp-how-steps"><div className="lp-how-step"><span className="lp-how-num">01</span><strong>Escolham juntos o tema da noite</strong><p>Comecem por Porto Seguro para aquecer ou Livro Aberto para ir mais fundo.</p></div><div className="lp-how-step"><span className="lp-how-num">02</span><strong>Uma pergunta por vez</strong><p>Vire a carta, leia em voz alta, escute a resposta. Sem pressa.</p></div><div className="lp-how-step"><span className="lp-how-num">03</span><strong>Salvem os momentos que importam</strong><p>Guarde as respostas que marcaram vocês e volte quando quiser.</p></div></div></div></section>
       <section className="lp-themes" id="pacotes"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">o que tem dentro</p><h2 className="lp-h2">15 baralhos temáticos,<br /><em>pra cada momento de vocês.</em></h2><div className="lp-themes-grid">{[['Porto Seguro','As conversas que parecem casa.',31],['Livro Aberto','Sem filtro, cara a cara.',31],['Você Não Sabia','Descobertas que ainda cabem entre vocês.',32],['Em Voz Alta','A vida que os dois querem construir.',30],['Lá Atrás','O que formou quem você é hoje.',28],['Modo Leve','Pra rir e não levar tão a sério.',31],['Viagens','Lugares que já foram e ainda vão ser.',30],['Carreira & Dinheiro','Como pensam o lado prático.',30],['Depois da Tempestade','O caminho de volta.',30],['Faísca','O lado mais provocante de vocês.',31],['Luzes Baixas','Quando a noite pede mais coragem. 18+',35],['Fogo Alto','Desejos, curiosidades, limites. 18+',30],['Sem Freio','O mais ousado. Só pra quem topa. 18+',30],['Mesmo Longe','Quando rotina ou distância afastam.',30],['Perto de Novo','Esquentar o espaço entre vocês.',30]].map(([name, description, count], index) => <div key={String(name)} className={`lp-theme-card ${index > 8 ? 'lp-theme-vibe' : ''}`}><strong>{name}</strong><p>{description}</p><span>{count} cartas</span></div>)}</div><p className="lp-themes-note"><strong>445+ perguntas no total.</strong> Novos baralhos entram de tempos em tempos — o acesso é vitalício.</p></div></section>
       <section className="lp-social"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">o que dizem</p><h2 className="lp-h2">Casais que já usaram<br /><em>e não largam mais.</em></h2><div className="lp-social-grid"><blockquote className="lp-testimonial"><p>"Descobri coisas do meu marido em uma noite que 8 anos de casamento não tinham me mostrado."</p><footer>— Marina L. · Belo Horizonte</footer></blockquote><blockquote className="lp-testimonial"><p>"A gente fez a distância desaparecer por 40 minutos. Valeu mais que qualquer presente."</p><footer>— Rafael C. · Curitiba</footer></blockquote><blockquote className="lp-testimonial"><p>"Virou nosso ritual de sexta à noite. Sério."</p><footer>— Julia M. · São Paulo</footer></blockquote></div><p className="lp-tiny-note">Depoimentos de casais em fase de teste.</p></div></section>
       <section className="lp-price" id="lp-precos"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">acesso vitalício</p><h2 className="lp-h2">Um baralho que dura<br /><em>o quanto vocês quiserem.</em></h2><div className="lp-price-card"><div className="lp-price-badge">Oferta de lançamento</div><div className="lp-price-main"><span className="lp-price-old">De <s>R$ 97,00</s></span><div className="lp-price-value"><span className="lp-price-currency">R$</span><span className="lp-price-big">47</span><span className="lp-price-cents">,90</span></div><span className="lp-price-installments">à vista <strong>ou</strong> 5x de R$ 9,58</span></div><ul className="lp-price-includes"><li>✓ 445+ perguntas nos 15 baralhos temáticos</li><li>✓ Acesso pra <strong>2 pessoas</strong> (você + convite)</li><li>✓ Salas online sincronizadas</li><li>✓ Celular e computador</li><li>✓ Novos baralhos incluídos, pra sempre</li><li>✓ Sem mensalidade. Paga uma vez.</li></ul><button onClick={() => { setSelectedPackage('couple'); setCheckoutState('idle'); setCheckoutOpen(true); }} className="lp-cta-primary lp-cta-full" data-testid="button-price-cta">Começar agora por R$ 47,90 <ArrowRight size={18} /></button><div className="lp-guarantee"><div className="lp-guarantee-seal">✦</div><div><strong>Garantia incondicional de 7 dias.</strong><p>Se não fizer sentido pra vocês, devolvemos 100%. Sem drama.</p></div></div></div></div></section>
       <section className="lp-faq"><div className="lp-container"><p className="lp-eyebrow lp-eyebrow-center">perguntas frequentes</p><h2 className="lp-h2">Ainda em dúvida?</h2><div className="lp-faq-list">{[['Precisa instalar app?','Não. É um site que roda no navegador — abre no celular ou PC.'],['Funciona pra quem tá namorando há pouco tempo?','Funciona ainda melhor: o baralho dá o empurrão para ir mais fundo em vez de conversa de superfície.'],['É vitalício mesmo?','Sim, sem mensalidade. Paga uma vez e usa o quanto quiser, incluindo baralhos novos.'],['Dá pra usar longe?','Sim. Você cria uma sala, manda o código e joga sincronizado com seu parceiro.'],['Tem 18+?','Sim, há três baralhos separados para acessar quando quiser.'],['Como recebo depois de pagar?','Na hora. O pagamento é via Pix e o app abre automaticamente após a confirmação.']].map(([question, answer]) => <details key={question} className="lp-faq-item"><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>
       <section className="lp-final-cta"><div className="lp-container lp-final-cta-inner"><h2 className="lp-h2">O próximo bom papo<br /><em>tá a uma pergunta de distância.</em></h2><p>Começa hoje. R$ 47,90 vitalício, garantia de 7 dias.</p><button onClick={() => { setSelectedPackage('couple'); setCheckoutState('idle'); setCheckoutOpen(true); }} className="lp-cta-primary lp-cta-big" data-testid="button-final-cta">Quero começar agora <ArrowRight size={20} /></button></div></section>
      </>}</main>
     {checkoutOpen && <div className="modal-backdrop"><div className="checkout-modal"><button className="modal-close" onClick={() => setCheckoutOpen(false)} data-testid="button-close-checkout"><X size={18} /></button>{checkoutState === 'waiting-manual' ? <div className="checkout-confirming"><div className="success-seal"><Check size={22} /></div><p className="section-kicker">pagamento recebido?</p><h2>Estamos verificando<br /><em>com a Abacate Pay.</em></h2><p>Se você já pagou, clique no botão abaixo para revalidar. Se ainda não pagou, feche esta tela e conclua o pagamento.</p><button onClick={() => { const pendingSessionId = safeGetItem('conexao-pending-session'); if (pendingSessionId) window.location.href = `/?session=${encodeURIComponent(pendingSessionId)}`; }} className="button button-primary button-full">Já paguei — verificar de novo <ArrowRight size={16} /></button></div> : checkoutState === 'confirming' ? <div className="checkout-confirming"><div className="confirming-deck" aria-hidden="true"><span className="conf-card" /><span className="conf-card" /><span className="conf-card" /><span className="conf-card" /></div><p className="conf-kicker">preparando seu baralho</p><h2>{confirmingLong ? <>Quase lá…<br /><em>as cartas estão chegando.</em></> : <>Suas cartas estão<br /><em>entrando no baralho.</em></>}</h2><p>{confirmingLong ? 'Tá demorando um pouco mais que o normal — é a confirmação da Abacate Pay chegando. Não feche esta tela.' : 'Assim que o pagamento for confirmado (geralmente em segundos), seu baralho abre automaticamente.'}</p></div> : <><p className="section-kicker">acesso vitalício</p><h2>Seu baralho começa<br /><em>com uma pergunta.</em></h2><p>Você vai para a tela segura da Abacate Pay para pagar via Pix. O acesso só libera depois da confirmação.</p><input type="text" placeholder="Seu nome" value={buyerNameInput} onChange={event => setBuyerNameInput(event.target.value)} className="checkout-name-input" data-testid="input-checkout-name" />{checkoutState === 'error' && <p className="checkout-error">Não deu para iniciar ou confirmar o pagamento agora. Tente novamente em instantes.</p>}<button onClick={() => void checkout()} disabled={checkoutState === 'sending' || !buyerNameInput.trim()} className="button button-primary button-full" data-testid="button-confirm-checkout">{checkoutState === 'sending' ? 'Abrindo pagamento…' : 'Continuar para pagamento'} <ArrowRight size={16} /></button></>}</div></div>}
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
  const [welcomeOpen, setWelcomeOpen] = useState(!safeGetItem('conexao-name') && !safeGetItem('conexao-guest-token'));
  const [buyerName, setBuyerName] = useState(() => safeGetItem('conexao-name') || '');
  const role = safeGetItem('conexao-role');
  const isGuest = role === 'guest' || !!safeGetItem('conexao-guest-token');
  const isOwner = !isGuest;
  const guestDisplayName = safeGetItem('conexao-guest-name') || '';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
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
  const invitesList: InviteListItem[] = [];
  const cancelInvite = (_invite: InviteListItem) => {};

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
    createInvite.mutate({ sessionId, data: { guestName: guestName.trim() } }, { onSuccess: result => { setInviteResult(result); queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) }); queryClientRef.invalidateQueries({ queryKey: getListInvitesQueryKey(sessionId) }); } });
  };
  const copyInvite = () => {
    if (!inviteResult?.token) return;
    const clipboardWrite = navigator.clipboard?.writeText(inviteUrlFromToken(inviteResult.token));
    if (!clipboardWrite) return;
    clipboardWrite.then(() => {
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2000);
    }).catch(() => {});
  };
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
          <div className="ritual-question-stage">{questionsQuery.isLoading ? <div className="ritual-question-card ritual-loading-card"><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></div> : questionsQuery.isError ? <div className="ritual-empty-card"><p>Reconectando…</p><button onClick={() => questionsQuery.refetch()} className="text-link" data-testid="button-retry-questions">Tentar agora <RotateCw size={15} /></button></div> : currentQuestion ? <article key={currentQuestion.id} className={`ritual-question-card intensity-${currentQuestion.intensity}`} data-testid={`card-question-${currentQuestion.id}`}><div className="ritual-card-top"><span>{selectedTheme?.title}</span><button className={saved.includes(currentQuestion.id) ? 'is-saved' : ''} onClick={() => setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} aria-label={saved.includes(currentQuestion.id) ? 'Remover dos salvos' : 'Salvar pergunta para depois'} data-testid={`button-save-card-${currentQuestion.id}`}><Bookmark size={18} fill={saved.includes(currentQuestion.id) ? 'currentColor' : 'none'} /></button></div><div className="ritual-question-copy"><Quote size={29} /><p>{currentQuestion.text}</p></div></article> : null}</div>
          <div className="ritual-question-actions"><button onClick={() => setQuestionIndex(i => (i - 1 + questions.length) % Math.max(questions.length, 1))} className="round-button ritual-nav-button" aria-label="Pergunta anterior" data-testid="button-previous-question"><ChevronLeft size={18} /></button><button onClick={nextQuestion} className="button ritual-next-button" data-testid="button-next-question">Próxima pergunta <ArrowRight size={16} /></button><button onClick={() => currentQuestion && setSaved(s => s.includes(currentQuestion.id) ? s.filter(id => id !== currentQuestion.id) : [...s, currentQuestion.id])} className={`ritual-save-button ${currentQuestion && saved.includes(currentQuestion.id) ? 'is-saved' : ''}`} data-testid="button-save-question">{currentQuestion && saved.includes(currentQuestion.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />} {currentQuestion && saved.includes(currentQuestion.id) ? 'Salva para depois' : 'Salvar para depois'}</button></div>
        </section>
      </div>}
      {themeId && isOwner && <aside className="invite-panel ritual-invite-panel"><div className="invite-icon"><Users size={20} /></div><div><p className="section-kicker">para esta conversa</p><h3>Traga alguém</h3></div><p className="invite-copy">Uma pergunta pode encontrar vocês em qualquer lugar.</p><button onClick={() => setInviteOpen(true)} className="button ritual-invite-button" disabled={!canInvite && !!sessionId} data-testid="button-open-invite">Traga alguém <Send size={15} /></button><span className="invite-limit">{activeAccess ? `${inviteLimit - invitesUsed} convites disponíveis` : 'Convites disponíveis após o acesso'}</span></aside>}
    </main>
    {welcomeOpen && <div className="modal-backdrop"><div className="welcome-modal"><button className="modal-close" onClick={() => setWelcomeOpen(false)} data-testid="button-close-welcome"><X size={18} /></button><div className="welcome-flourish"><Feather size={22} /></div><p className="section-kicker">antes de começar</p><h2>Como podemos<br /><em>te chamar?</em></h2><p>É só para deixar este espaço um pouco mais seu. Você pode entrar sem preencher nada.</p><input value={buyerName} onChange={e => setBuyerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startSession()} placeholder="Seu nome" className="text-input" data-testid="input-buyer-name" /><button onClick={startSession} className="button button-primary button-full" data-testid="button-enter-experience">{createSession.isPending ? 'Abrindo seu espaço…' : 'Entrar na experiência'} <ArrowRight size={16} /></button></div></div>}
      {inviteOpen && isOwner && <div className="modal-backdrop" onClick={() => setInviteOpen(false)}><div className="invite-modal invite-modal-hub" onClick={event => event.stopPropagation()}><button className="modal-close" onClick={() => setInviteOpen(false)} data-testid="button-close-invite"><X size={18} /></button><p className="section-kicker">quem joga com você</p><h2>Convidados<br /><em>desse baralho.</em></h2><div className="invite-hub-stats"><div><strong>{invitesList.filter(invite => invite.isUsed).length}</strong><small>entraram</small></div><div><strong>{invitesList.filter(invite => !invite.isUsed).length}</strong><small>aguardando</small></div><div><strong>{Math.max(0, inviteLimit - invitesList.length)}</strong><small>cadeiras livres</small></div></div>{invitesList.length > 0 && <ul className="invite-hub-list" aria-label="Convites">{invitesList.map(invite => { const initial = (invite.guestName || '?').charAt(0).toUpperCase(); return <li key={invite.token} className={`invite-hub-row${invite.isUsed ? ' is-active' : ''}`} data-testid={`companion-${invite.token}`}><div className={`invite-hub-avatar${invite.isUsed ? ' is-active' : ''}`}>{initial}</div><div className="invite-hub-main"><span className="invite-hub-name">{invite.guestName}</span><span className="invite-hub-status">{invite.isUsed && invite.usedAt ? `entrou em ${new Date(invite.usedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'aguardando aceitar'}</span></div><button type="button" onClick={() => cancelInvite(invite)} className="invite-hub-remove" aria-label={`Desconvidar ${invite.guestName}`} data-testid={`button-cancel-invite-${invite.token}`}><X size={14} /></button></li>; })}</ul>}{canInvite ? inviteResult ? <div className="invite-hub-success"><div className="success-seal"><Check size={22} /></div><p className="section-kicker">convite criado</p><h3>Compartilhe com <em>{inviteResult.guestName}</em></h3><div className="invite-share-block invite-share-block-light"><button onClick={copyInvite} className="invite-share-button" data-testid="button-copy-invite"><Copy size={18} /> {copiedInvite ? 'Copiado!' : 'Copiar link do convite'}</button><details className="invite-share-details"><summary>Ver o link</summary><input readOnly value={inviteResult.token ? inviteUrlFromToken(inviteResult.token) : ''} className="text-input" data-testid="input-invite-url" onFocus={event => event.currentTarget.select()} /></details></div><button onClick={() => { setInviteResult(null); setGuestName(''); setCopiedInvite(false); }} className="text-link" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></div> : <div className="invite-hub-form"><p className="section-kicker">novo convite</p><label className="invite-hub-label" htmlFor="guest-name">Nome de quem vai receber</label><input id="guest-name" value={guestName} onChange={event => setGuestName(event.target.value)} className="text-input" placeholder="Ex: Ana" data-testid="input-guest-name" /><button onClick={makeInvite} className="button button-primary button-full" disabled={!guestName.trim() || createInvite.isPending} data-testid="button-create-invite">{createInvite.isPending ? 'Criando…' : 'Gerar convite'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="form-error">Não foi possível gerar agora. Tente novamente.</p>}</div> : <div className="invite-hub-full"><p><strong>Cadeiras cheias.</strong> Desconvide alguém acima pra liberar espaço.</p></div>}</div></div>}
  </Shell>;
}

function AppExperienceReference() {
  useDeviceViewport();
  const [, navigate] = useLocation();
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
  const [welcomeOpen, setWelcomeOpen] = useState(!safeGetItem('conexao-name') && !safeGetItem('conexao-guest-token'));
  const [buyerName, setBuyerName] = useState(() => safeGetItem('conexao-name') || '');
  const role = safeGetItem('conexao-role');
  const isGuest = role === 'guest' || !!safeGetItem('conexao-guest-token');
  const isOwner = !isGuest;
  const guestDisplayName = safeGetItem('conexao-guest-name') || '';
  const storedGuestToken = safeGetItem('conexao-guest-token') || '';
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  const [editRelationship, setEditRelationship] = useState(() => safeGetItem('conexao-relationship') || '');
  const [editPronoun, setEditPronoun] = useState(() => safeGetItem('conexao-partner-pronoun') || '');
  const [expandedField, setExpandedField] = useState<'relationship' | 'pronoun' | null>(null);
  useEffect(() => {
    fetchPreferences(sessionId || null, storedGuestToken || null).then(preferences => {
      if (!preferences) return;
      if (preferences.relationshipType) {
        safeSetItem('conexao-relationship', preferences.relationshipType);
        setEditRelationship(preferences.relationshipType);
      }
      if (preferences.partnerPronoun) {
        safeSetItem('conexao-partner-pronoun', preferences.partnerPronoun);
        setEditPronoun(preferences.partnerPronoun);
      }
    });
  }, [sessionId, storedGuestToken]);
  useEffect(() => {
    if (settingsOpen) {
      setEditRelationship(safeGetItem('conexao-relationship') || '');
      setEditPronoun(safeGetItem('conexao-partner-pronoun') || '');
    }
  }, [settingsOpen]);
  useEffect(() => {
    if (!settingsOpen) setExpandedField(null);
  }, [settingsOpen]);

  useEffect(() => {
    const currentSessionId = safeGetItem('conexao-session')?.trim();
    if (!currentSessionId) return;
    fetch(`${apiBase}/api/admin/check?sessionId=${encodeURIComponent(currentSessionId)}`)
      .then(response => response.ok ? response.json() : { isAdmin: false })
      .then(data => setIsAdminAccount(Boolean(data.isAdmin)))
      .catch(() => setIsAdminAccount(false));
  }, []);
  const [navCollapsed, setNavCollapsed] = useState(() => safeGetItem('conexao-nav-collapsed') === 'true');
  const toggleNavCollapsed = () => setNavCollapsed(current => {
    const next = !current;
    safeSetItem('conexao-nav-collapsed', String(next));
    return next;
  });
  const [guestName, setGuestName] = useState('');
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [savedMoments, setSavedMoments] = useState<SavedMoment[]>([]);
  const handleLogout = () => {
    const keysToRemove = [
      'conexao-session',
      'conexao-guest-token',
      'conexao-guest-name',
      'conexao-guest-email',
      'conexao-name',
      'conexao-role',
      'conexao-onboarding-complete',
      'conexao-onboarding-step',
      'conexao-onboarding-name',
      'conexao-onboarding-pronoun',
      'conexao-onboarding-relationship',
      'conexao-onboarding-date',
      'conexao-onboarding-curiosity',
      'conexao-onboarding-feeling',
      'conexao-relationship',
      'conexao-curiosity',
      'conexao-feeling',
      'conexao-partner-pronoun',
      'conexao-pending-session',
      'conexao-pending-bill',
    ];
    keysToRemove.forEach(key => {
      try { window.localStorage?.removeItem(key); } catch { /* noop */ }
    });
    navigate('/login', { replace: true });
  };
  const visibleThemes = useMemo(() => activeNav === 'temas'
    ? themes.filter(theme => theme.kind === 'tema')
    : activeNav === 'vibes'
      ? themes.filter(theme => theme.kind === 'vibe')
      : themes, [activeNav, themes]);
  const accessQuery = useGetAccessPreview({ query: { queryKey: ['access-preview'] } });
  const sessionQuery = useGetQuestionSession(sessionId, { query: { enabled: !!sessionId, queryKey: getGetQuestionSessionQueryKey(sessionId) } });
  const guestQuery = useGetInvite(storedGuestToken, { query: { enabled: !!storedGuestToken, queryKey: getGetInviteQueryKey(storedGuestToken) } });
  const invitesQuery = useListInvites(sessionId, { query: { enabled: !!sessionId && isOwner, queryKey: getListInvitesQueryKey(sessionId) } });
  const allQuestionsMode = dailyMode || favoriteMode;
  const questionParams = { theme: themeId && !allQuestionsMode ? themeId : undefined };
  const questionsQuery = useListQuestions(questionParams, { query: { enabled: !!themeId, queryKey: getListQuestionsQueryKey(questionParams) } });
  const onboardingComplete = Boolean(
    (sessionQuery.data as { onboardingComplete?: boolean } | undefined)?.onboardingComplete
    || (guestQuery.data as { onboardingComplete?: boolean } | undefined)?.onboardingComplete,
  );
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
  const [invitesList, setInvitesList] = useState<InviteListItem[]>([]);
  useEffect(() => {
    const raw = invitesQuery.data || [];
    const sorted = [...raw].sort((a, b) => {
      if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1;
      return 0;
    });
    setInvitesList(sorted);
  }, [invitesQuery.data]);
  const availableQuestions = useMemo(() => (allQuestionsQuery.data?.length ? allQuestionsQuery.data : fallbackQuestions) as Question[], [allQuestionsQuery.data]);
  useEffect(() => {
    const sid = safeGetItem('conexao-session');
    const tok = safeGetItem('conexao-guest-token') || '';
    if (!sid && !tok) {
      setSavedMoments([]);
      return;
    }
    const qs = sid ? `sessionId=${encodeURIComponent(sid)}` : `guestToken=${encodeURIComponent(tok)}`;
    fetch(apiUrl(`/api/moments?${qs}`))
      .then(response => response.ok ? response.json() as Promise<{ moments?: SavedMoment[] }> : null)
      .then(data => {
        if (data?.moments) setSavedMoments(data.moments);
      })
      .catch(() => {
        // Keep the existing list visible when the moments endpoint is temporarily unavailable.
      });
  }, [activeNav]);
  const deleteMoment = async (id: string) => {
    const sid = safeGetItem('conexao-session');
    const tok = safeGetItem('conexao-guest-token') || '';
    const qs = sid ? `sessionId=${encodeURIComponent(sid)}` : `guestToken=${encodeURIComponent(tok)}`;
    try {
      const response = await fetch(apiUrl(`/api/moments/${encodeURIComponent(id)}?${qs}`), { method: 'DELETE' });
      if (!response.ok) return;
      setSavedMoments(current => current.filter(moment => moment.id !== id));
    } catch {
      // Keep the moment visible when deletion fails.
    }
  };
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
  const cancelInvite = async (invite: InviteListItem) => {
    const confirmMsg = invite.isUsed
      ? `Cancelar o acesso de ${invite.guestName}? Isso vai retirar o acesso e liberar 1 vaga.`
      : `Cancelar o convite para ${invite.guestName}? A vaga volta pra você.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const response = await fetch(
        apiUrl(`/api/access/sessions/${encodeURIComponent(sessionId)}/invites/${encodeURIComponent(invite.token)}`),
        { method: 'DELETE' },
      );
      if (!response.ok) return;
      setInvitesList(current => current.filter(item => item.token !== invite.token));
      queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) });
    } catch {
      // Keep the invite visible when the cancellation request fails.
    }
  };
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
  const [unstuckOpen, setUnstuckOpen] = useState(false);
  useEffect(() => {
    setWritingOpen(false);
    setUnstuckOpen(false);
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
      onSuccess: result => {
        setInviteResult(result);
        queryClientRef.invalidateQueries({ queryKey: getGetQuestionSessionQueryKey(sessionId) });
        queryClientRef.invalidateQueries({ queryKey: getListInvitesQueryKey(sessionId) });
      },
    });
  };
  const copyInvite = () => {
    if (!inviteResult?.token) return;
    const clipboardWrite = navigator.clipboard?.writeText(inviteUrlFromToken(inviteResult.token));
    if (!clipboardWrite) return;
    clipboardWrite.then(() => {
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2000);
    }).catch(() => {});
  };
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
              {isOwner && <section className="eu-section eu-online-section" aria-labelledby="online-title"><div className="eu-section-heading"><div><p className="eu-kicker">jogar online</p><h2 id="online-title">Uma sala pra vocês</h2></div></div><Link href="/play" className="eu-play-hero" data-testid="link-play-online"><div className="eu-play-hero-glow" aria-hidden="true" /><div className="eu-play-hero-content"><div className="eu-play-hero-icon"><Wifi size={26} /></div><div><h2>Uma sala pra vocês,<br /><em>mesmo de longe.</em></h2><p className="eu-play-hero-note">Crie uma sala, mande o código, e joguem juntos em tempo real de qualquer lugar.</p><span className="eu-play-hero-cta">Criar ou entrar com código <ArrowRight size={16} /></span></div></div></Link></section>}
            <section className="eu-section eu-invite-section" aria-labelledby="companions-title">
              <div className="eu-section-heading"><div><p className="eu-kicker">{isOwner ? 'quem joga com você' : 'acesso compartilhado'}</p><h2 id="companions-title">{isOwner ? 'Convidados' : 'Este baralho'}</h2></div></div>
              {!isOwner && <div className="eu-empty-state" data-testid="card-guest-access"><span><Users size={16} /></span><div><strong>{guestDisplayName ? `Oi, ${guestDisplayName} — você é convidado aqui` : 'Você entrou como convidado'}</strong>{guestQuery.data?.ownerName && <p className="guest-invited-by">Você foi convidado por <strong>{guestQuery.data.ownerName}</strong></p>}<p>Este baralho é de quem te convidou. Você pode jogar, responder e salvar — só não pode convidar outras pessoas.</p><Link href="/#pacotes" className="app-secondary-button" data-testid="link-own-deck">Quero meu próprio baralho <ArrowRight size={15} /></Link></div></div>}
              {isOwner && <button type="button" onClick={() => setInviteOpen(true)} className="eu-invite-hub" data-testid="button-open-invite-eu"><div className="eu-invite-hub-icon"><UserPlus size={22} /></div><div className="eu-invite-hub-text"><strong>Convidar alguém</strong><small>{invitesList.length === 0 ? `${inviteLimit} cadeiras livres para gente próxima` : `${invitesList.filter(invite => invite.isUsed).length} entraram · ${invitesList.length}/${inviteLimit} cadeiras usadas`}</small></div><ArrowRight size={18} className="eu-invite-hub-arrow" /></button>}
           </section>
            {personalizedDecks.length > 0 && <section className="eu-deck-history" aria-labelledby="deck-history-title"><div className="eu-section-heading"><div><p className="eu-kicker">seu histórico</p><h2 id="deck-history-title">Perguntas que você criou</h2></div><span>{personalizedDecks.length} {personalizedDecks.length === 1 ? 'baralho' : 'baralhos'}</span></div><div className="eu-deck-history-row">{personalizedDecks.map(deck => <article key={deck.id} className="eu-history-card"><button className="eu-history-card-open" onClick={() => openSavedDailyDeck(deck)} data-testid={`button-open-daily-deck-${deck.id}`}><span className={`eu-history-art deck-cover-${isDeckCoverId(deck.cover) ? deck.cover : 'custom'}`} style={deckCoverStyle(deck.cover)} aria-hidden="true"><span className="deck-cover-orbit" /><span className="deck-cover-spark" /></span><span className="eu-history-card-shade" /><span className="eu-history-copy"><strong>{deck.label}</strong><small>{deck.ids.length} perguntas · reabrir</small></span></button><button className="eu-history-menu-button" onClick={() => openDeckMenu(deck)} aria-label={`Ações para ${deck.label}`} data-testid={`button-menu-daily-deck-${deck.id}`}><MoreHorizontal size={18} /></button></article>)}</div></section>}
             <section className="eu-section eu-continue-section" aria-labelledby="continue-title"><div className="eu-section-heading"><div><p className="eu-kicker">continue jogando</p><h2 id="continue-title" className="sr-only">Continue jogando</h2></div><span>{inProgressThemes.length ? `${inProgressThemes.length} em andamento` : 'comece por aqui'}</span></div><div className="eu-progress-row">{continueThemes.map(theme => { const seenCount = seenByTheme[theme.id]?.length || 0; const lastQuestionId = seenByTheme[theme.id]?.at(-1); const themeQuestions = availableQuestions.filter(question => question.themeId === theme.id); const resumeIndex = Math.max(0, themeQuestions.findIndex(question => question.id === lastQuestionId)); return <button key={theme.id} className="eu-progress-card" onClick={() => { changeTheme(theme.id); setQuestionIndex(resumeIndex); }} data-testid={`button-continue-theme-${theme.id}`}><div className={`eu-progress-cover theme-cover-${themes.indexOf(theme) % 5}`}><span className="eu-progress-number">{String(seenCount).padStart(2, '0')}</span><Heart className="eu-progress-heart" size={20} fill={favoriteThemeIds.includes(theme.id) ? 'currentColor' : 'none'} /></div><div className="eu-progress-copy"><strong>{theme.title}</strong><small>{seenCount ? `${seenCount} de ${theme.count} perguntas` : 'comece agora'}</small><span className="eu-progress-bar"><i style={{ width: `${Math.min(100, (seenCount / Math.max(theme.count, 1)) * 100)}%` }} /></span><em>Retomar <ArrowRight size={13} /></em></div></button>; })}</div>{continueThemes.length === 0 && <div className="eu-empty-state"><span><Sparkles size={16} /></span><p>Quando uma pergunta ficar pelo caminho, ela aparece aqui para você continuar.</p></div>}</section>
           <section className="eu-section eu-favorites-section" aria-labelledby="favorites-title"><div className="eu-section-heading"><div><p className="eu-kicker">salvos</p><h2 id="favorites-title">Salvos</h2></div><span>{saved.length + favoriteThemeIds.length} salvos</span></div><div className="eu-saved-row"><button className={`eu-collection-card eu-collection-cards ${saved.length ? 'has-content' : ''}`} onClick={openFavoritesDeck} disabled={!saved.length} data-testid="button-favorite-cards"><span className="eu-collection-shade" /><span className="eu-collection-title">Cartas favoritas <b>{saved.length}</b></span>{!saved.length && <small>suas perguntas salvas aparecem aqui</small>}</button><div className="eu-favorite-topics"><p className="eu-favorite-label">Temas favoritos</p><div className="eu-topic-row">{favoriteThemeIds.length ? favoriteThemeIds.map(id => { const theme = themes.find(item => item.id === id); return theme ? <button key={id} className={`eu-topic-card theme-cover-${themes.indexOf(theme) % 5}`} onClick={() => changeTheme(id)} data-testid={`button-favorite-theme-${id}`}><span className="eu-topic-shade" /><strong>{theme.title}</strong><ArrowRight size={15} /></button> : null; }) : <div className="eu-topic-empty">Favorite um tema para encontrá-lo aqui.</div>}</div></div></div></section>
             <section className="eu-section eu-moments-section" aria-labelledby="moments-title"><div className="eu-section-heading"><div><p className="eu-kicker">momentos</p><h2 id="moments-title">Respostas guardadas</h2></div><span>{savedMoments.length} {savedMoments.length === 1 ? 'momento' : 'momentos'}</span></div>{savedMoments.length === 0 ? <div className="eu-empty-state" data-testid="empty-saved-moments"><span><Bookmark size={16} /></span><p>Quando alguém responder algo que você quer guardar, salve por aqui. Fica só pra você.</p></div> : <div className="eu-moments-list">{savedMoments.map(moment => { const theme = themes.find(item => item.id === moment.themeId); const question = availableQuestions.find(item => item.id === moment.questionId); return <article key={moment.id} className="eu-moment-card" data-testid={`moment-${moment.id}`}><div className="eu-moment-header"><div><p className="eu-moment-kicker">{theme?.title || 'Tema'}</p><p className="eu-moment-question">{question?.text || 'Pergunta'}</p></div><button type="button" onClick={() => deleteMoment(moment.id)} className="eu-moment-delete" aria-label="Remover momento" data-testid={`button-delete-moment-${moment.id}`}><X size={14} /></button></div><p className="eu-moment-answer">“{moment.answerText}”</p><p className="eu-moment-attribution">— {moment.fromPlayerName} · {new Date(moment.createdAt).toLocaleDateString('pt-BR')}</p></article>; })}</div>}</section>
          </section> : <section className="deck-home" aria-labelledby="deck-home-title">
             {activeNav === 'todos' && isOwner && <button type="button" onClick={() => navigate('/play')} className="play-banner-cta play-banner-slim" data-testid="button-play-online-top"><div className="play-banner-icon"><Wifi size={16} /></div><span className="play-banner-inline"><strong>Jogar online</strong><small>abre uma sala e manda o código</small></span><ArrowRight size={16} className="play-banner-arrow" /></button>}
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
          {themesError && <div className="app-inline-error" data-testid="status-themes-error"><span>Reconectando…</span><button onClick={() => queryClientRef.invalidateQueries({ queryKey: getListQuestionThemesQueryKey() })} data-testid="button-retry-themes">Tentar agora <RotateCw size={13} /></button></div>}
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
              {(allQuestionsMode ? allQuestionsQuery.isLoading : questionsQuery.isLoading) ? <div className="question-card question-card-loading" data-testid="loading-questions"><div className="loading-pill" /><div className="loading-copy" /><div className="loading-copy short" /></div> : (allQuestionsMode ? allQuestionsQuery.isError : questionsQuery.isError) ? <div className="question-error" data-testid="status-questions-error"><p>Reconectando…</p><button onClick={() => (allQuestionsMode ? allQuestionsQuery.refetch() : questionsQuery.refetch())} data-testid="button-retry-questions">Tentar agora <RotateCw size={14} /></button></div> : currentQuestion && <div className={`question-card-layers ${questionSwipeExit ? 'is-swiping' : ''}`}>
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
               <div className="question-unstuck">
                 {unstuckOpen ? (
                   <div className="question-unstuck-panel" data-testid="panel-unstuck">
                     <p className="question-unstuck-title">Sem pressa. Se ajudar:</p>
                     <ul>
                       <li>Responde a primeira coisa que veio à cabeça — sem editar.</li>
                       <li>Reformula a pergunta com suas próprias palavras.</li>
                       <li>Pega só um pedacinho: uma cena, uma sensação, uma palavra.</li>
                     </ul>
                     <button
                       type="button"
                       className="question-unstuck-close"
                       onClick={() => setUnstuckOpen(false)}
                       data-testid="button-close-unstuck"
                     >
                       Fechar
                     </button>
                   </div>
                 ) : (
                   <button
                     type="button"
                     className="question-unstuck-trigger"
                     onClick={() => setUnstuckOpen(true)}
                     data-testid="button-open-unstuck"
                   >
                     Travou?
                   </button>
                 )}
               </div>
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
         {settingsOpen && <div className="app-modal-backdrop"><div className="app-modal settings-app-modal"><button className="app-modal-close" onClick={() => setSettingsOpen(false)} aria-label="Fechar ajustes" data-testid="button-close-settings"><X size={18} /></button><p className="modal-eyebrow">seu espaço</p><h2>Ajustes da<br /><em>experiência.</em></h2><div className="settings-row"><span>Perfil</span><strong data-testid="text-settings-name">{`${isGuest ? (guestDisplayName || buyerName || 'Visitante') : (buyerName || 'Visitante')} · ${isOwner ? 'Dono' : 'Convidado'}`}</strong></div><div className="settings-row"><span>Acesso</span><strong data-testid="text-settings-access">{sessionQuery.data?.accessGranted || accessQuery.data?.hasAccess ? activeAccess?.packageName || 'Ativo' : 'Demonstração'}</strong></div><div className="settings-row"><span>Salvas</span><strong data-testid="text-settings-saved">{saved.length} pergunta{saved.length === 1 ? '' : 's'}</strong></div><div className="settings-row settings-row-clickable" onClick={() => setExpandedField(expandedField === 'relationship' ? null : 'relationship')} data-testid="row-relationship"><span>Tipo de relacionamento</span><strong>{editRelationship || 'Não definido'} <ChevronRight size={14} className={`settings-chevron ${expandedField === 'relationship' ? 'is-open' : ''}`} /></strong></div>{expandedField === 'relationship' && <div className="settings-choices-inline">{RELATIONSHIP_OPTIONS.map(opt => <button key={opt} type="button" onClick={() => { setEditRelationship(opt); safeSetItem('conexao-relationship', opt); patchPreferences(sessionId || null, storedGuestToken || null, { relationshipType: opt }); setExpandedField(null); }} className={`settings-choice ${editRelationship === opt ? 'is-selected' : ''}`} data-testid={`button-relationship-${opt}`}>{opt}</button>)}</div>}<div className="settings-row settings-row-clickable" onClick={() => setExpandedField(expandedField === 'pronoun' ? null : 'pronoun')} data-testid="row-pronoun"><span>Pronome do parceiro</span><strong>{editPronoun || 'Não definido'} <ChevronRight size={14} className={`settings-chevron ${expandedField === 'pronoun' ? 'is-open' : ''}`} /></strong></div>{expandedField === 'pronoun' && <div className="settings-choices-inline">{PRONOUN_OPTIONS.map(opt => <button key={opt} type="button" onClick={() => { setEditPronoun(opt); safeSetItem('conexao-partner-pronoun', opt); patchPreferences(sessionId || null, storedGuestToken || null, { partnerPronoun: opt }); setExpandedField(null); }} className={`settings-choice ${editPronoun === opt ? 'is-selected' : ''}`} data-testid={`button-pronoun-${opt}`}>{opt}</button>)}</div>}<button onClick={() => { setSettingsOpen(false); setWelcomeOpen(true); }} className="app-secondary-button" data-testid="button-edit-name">Editar como te chamar</button>{isAdminAccount && <Link href="/admin" className="app-secondary-button admin-panel-link" data-testid="button-open-admin-panel" onClick={() => setSettingsOpen(false)}><LayoutTemplate size={15} /> Painel Admin</Link>}<button onClick={() => { setSettingsOpen(false); handleLogout(); }} className="app-secondary-button app-logout-button" data-testid="button-logout">Sair da conta</button></div></div>}
        {inviteOpen && isOwner && <div className="app-modal-backdrop" onClick={() => setInviteOpen(false)}><div className="app-modal invite-app-modal invite-modal-hub" onClick={event => event.stopPropagation()}><button className="app-modal-close" onClick={() => setInviteOpen(false)} aria-label="Fechar convite" data-testid="button-close-invite"><X size={18} /></button><p className="modal-eyebrow">quem joga com você</p><h2>Convidados<br /><em>desse baralho.</em></h2><div className="invite-hub-stats"><div><strong>{invitesList.filter(invite => invite.isUsed).length}</strong><small>entraram</small></div><div><strong>{invitesList.filter(invite => !invite.isUsed).length}</strong><small>aguardando</small></div><div><strong>{Math.max(0, inviteLimit - invitesList.length)}</strong><small>cadeiras livres</small></div></div>{invitesList.length > 0 && <ul className="invite-hub-list" aria-label="Convites">{invitesList.map(invite => { const initial = (invite.guestName || '?').charAt(0).toUpperCase(); return <li key={invite.token} className={`invite-hub-row${invite.isUsed ? ' is-active' : ''}`} data-testid={`companion-${invite.token}`}><div className={`invite-hub-avatar${invite.isUsed ? ' is-active' : ''}`}>{initial}</div><div className="invite-hub-main"><span className="invite-hub-name">{invite.guestName}</span><span className="invite-hub-status">{invite.isUsed && invite.usedAt ? `entrou em ${new Date(invite.usedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : 'aguardando aceitar'}</span></div><button type="button" onClick={() => cancelInvite(invite)} className="invite-hub-remove" aria-label={`Desconvidar ${invite.guestName}`} data-testid={`button-cancel-invite-${invite.token}`}><X size={14} /></button></li>; })}</ul>}{canInvite ? inviteResult ? <div className="invite-hub-success"><div className="invite-success-mark"><Check size={21} /></div><p className="modal-eyebrow">convite criado</p><h3>Compartilhe com <em>{inviteResult.guestName}</em></h3><div className="invite-share-block"><button onClick={copyInvite} className="invite-share-button" data-testid="button-copy-invite"><Copy size={18} /> {copiedInvite ? 'Copiado!' : 'Copiar link do convite'}</button><details className="invite-share-details"><summary>Ver o link</summary><input readOnly value={inviteResult.token ? inviteUrlFromToken(inviteResult.token) : ''} className="app-text-input" data-testid="input-invite-url" onFocus={event => event.currentTarget.select()} /></details></div><button onClick={() => { setInviteResult(null); setGuestName(''); setCopiedInvite(false); }} className="app-text-button" data-testid="button-new-invite">Criar outro convite <ArrowRight size={15} /></button></div> : <div className="invite-hub-form"><p className="modal-eyebrow">novo convite</p><label className="invite-hub-label" htmlFor="guest-name-app">Nome de quem vai receber</label><input id="guest-name-app" value={guestName} onChange={event => setGuestName(event.target.value)} className="app-text-input" placeholder="Ex: Ana" data-testid="input-guest-name" /><button onClick={makeInvite} className="app-primary-button" disabled={!guestName.trim() || createInvite.isPending} data-testid="button-create-invite">{createInvite.isPending ? 'Criando convite…' : 'Gerar convite'} <LinkIcon size={16} /></button>{createInvite.isError && <p className="app-form-error" data-testid="status-invite-error">Não foi possível gerar agora. Tente novamente.</p>}</div> : <div className="invite-hub-full"><p><strong>Cadeiras cheias.</strong> Desconvide alguém acima pra liberar espaço.</p></div>}</div></div>}
  </div>;
}

 function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const inviteQuery = useGetInvite(token, { query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) } });
  const invite = inviteQuery.data;
  const acceptInvite = () => {
    if (invite && token) {
      const keysToRemove = [
        'conexao-session',
        'conexao-onboarding-complete',
        'conexao-onboarding-step',
        'conexao-onboarding-name',
        'conexao-onboarding-pronoun',
        'conexao-onboarding-relationship',
        'conexao-onboarding-date',
        'conexao-onboarding-curiosity',
        'conexao-onboarding-feeling',
        'conexao-relationship',
        'conexao-curiosity',
        'conexao-feeling',
        'conexao-partner-pronoun',
        'conexao-guest-email',
      ];
      keysToRemove.forEach(key => {
        try { window.localStorage?.removeItem(key); } catch { /* noop */ }
      });
      safeSetItem('conexao-guest-token', token);
      safeSetItem('conexao-guest-name', invite.guestName);
      safeSetItem('conexao-name', invite.guestName);
      safeSetItem('conexao-role', 'guest');
      fetch(apiUrl(`/api/access/invites/${encodeURIComponent(token)}/accept`), { method: 'POST' }).catch(() => {});
    }
  };
  return <div className="invite-page-shell"><main className="invite-entry"><div className="invite-entry-orbit" /><div className="invite-entry-card">{inviteQuery.isLoading ? <><div className="skeleton-line short" /><div className="skeleton-line wide" /><div className="skeleton-line" /></> : invite ? <><div className="invite-symbol"><Feather size={23} /></div><p className="section-kicker light-kicker">um convite para você</p><h1><em>{invite.guestName}</em>, tem uma<br />conversa te esperando.</h1>{invite.ownerName && <p className="guest-invited-by">Você foi convidado por <strong>{invite.ownerName}</strong></p>}<p className="invite-entry-copy">Você foi convidado para participar de <strong>{invite.packageName}</strong>. Aqui, convidados podem responder e descobrir — só não podem criar novos convites.</p><Link href="/onboarding" onClick={acceptInvite} className="button button-salmon" data-testid="link-accept-invite">Aceitar convite <ArrowRight size={16} /></Link><span className="guest-note"><Users size={14} /> Você entra como convidado</span></> : <><div className="invite-symbol"><X size={23} /></div><p className="section-kicker light-kicker">convite não encontrado</p><h1>Este endereço<br /><em>já mudou de lugar.</em></h1><p className="invite-entry-copy">Peça a quem te convidou para enviar um novo acesso.</p><Link href="/app" className="button button-salmon" data-testid="link-open-demo">Conhecer a experiência <ArrowRight size={16} /></Link></>}</div></main></div>;
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
  const inviteRevoked = !!storedGuestToken && guestQuery.isError;
  const sessionRevoked = !!storedSessionId && sessionQuery.isError;

  useEffect(() => {
    if (!storedSessionId && !storedGuestToken) {
      navigate('/', { replace: true });
      return;
    }
    if (!isChecking && !hasAccess && !inviteRevoked && !sessionRevoked) {
      navigate('/', { replace: true });
    }
  }, [hasAccess, inviteRevoked, isChecking, navigate, sessionRevoked, storedGuestToken, storedSessionId]);

  if (inviteRevoked || sessionRevoked) {
    const clearAndGo = () => {
      ['conexao-session', 'conexao-guest-token', 'conexao-guest-name', 'conexao-name', 'conexao-role', 'conexao-onboarding-complete'].forEach(key => {
        try { window.localStorage?.removeItem(key); } catch { /* noop */ }
      });
      navigate('/', { replace: true });
    };
    return <div className="access-gate-overlay" role="status"><div className="access-gate access-gate-denied"><span className="access-gate-mark"><X size={20} /></span><h2>Seu acesso foi encerrado.</h2><p>{inviteRevoked ? 'Quem te convidou removeu seu acesso a este baralho.' : 'Sua sessão não é mais válida.'}</p><p className="access-gate-hint">Fale com quem te convidou pra receber um novo convite, ou compre seu próprio baralho.</p><div className="access-gate-actions"><button onClick={clearAndGo} className="button button-primary" data-testid="button-clear-revoked">Voltar ao início</button></div></div></div>;
  }

  if (isChecking || !hasAccess) {
    return <div className="access-gate-overlay" role="status" aria-live="polite"><div className="access-gate"><span className="access-gate-mark"><Feather size={18} /></span><p>Verificando seu acesso…</p></div></div>;
  }

  return <AppExperienceReference />;
}

 function Router() {
   return <RoutedErrorBoundary><Switch><Route path="/"><Home variant="v2" /></Route><Route path="/lp2"><Home /></Route><Route path="/onboarding" component={Onboarding} /><Route path="/login" component={Login} /><Route path="/play" component={Play} /><Route path="/app" component={ProtectedExperienceRoute} /><Route path="/invite/:token" component={InvitePage} /><Route path="/admin" component={Admin} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;