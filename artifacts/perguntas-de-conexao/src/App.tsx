import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  forwardRef,
  lazy,
  Suspense,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/splash-screen";
import {
  useListQuestionThemes,
  getListQuestionThemesQueryKey,
  useListQuestions,
  getListQuestionsQueryKey,
  useGetAccessPreview,
  useCreateQuestionSession,
  useGetQuestionSession,
  getGetQuestionSessionQueryKey,
  useListPublicReviews,
  getListPublicReviewsQueryKey,
  useCreateInvite,
  useListInvites,
  getListInvitesQueryKey,
  useGetInvite,
  getGetInviteQueryKey,
  type Question,
  type QuestionTheme,
  type InviteListItem,
} from "@workspace/api-client-react";
import {
  questions as connectionQuestions,
  themes as connectionThemes,
} from "@workspace/connection-content";
import {
  DEFAULT_PRIMARY_LANDING_PAGE_ID,
  getLandingPageById,
  getLandingPageByPath,
  type LandingPageId,
} from "@/lib/landing-pages";
import { landingTestimonials, testimonialImages } from "@/lib/testimonials";
import { selectLp1Diagnosis } from "@/lib/lp1-diagnosis";
import {
  computeLp1DistanceResult,
  computeLp1Score,
} from "@/lib/lp1-score";
import { Lp3Testimonials } from "@/components/Lp3Testimonials";
import { Lp1ComparisonSection } from "@/components/Lp1ComparisonSection";
import { RecommendedQuestionCarousel } from "@/components/RecommendedQuestionCarousel";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Feather,
  Flame,
  FlaskConical,
  Heart,
  HeartHandshake,
  House,
  Layers3,
  LayoutTemplate,
  Link as LinkIcon,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  Quote,
  RotateCw,
  Send,
  ShieldCheck,
  Settings2,
  Shuffle,
  Sparkles,
  Star,
  Timer,
  Upload,
  UserPlus,
  UserRound,
  Users,
  WandSparkles,
  Wifi,
  X,
} from "lucide-react";
import {
  Link,
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
  useParams,
} from "wouter";
const NotFound = lazy(() => import("@/pages/not-found"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Login = lazy(() => import("@/pages/Login"));
const Play = lazy(() => import("@/pages/Play"));
const Admin = lazy(() => import("@/pages/Admin"));
const Termos = lazy(() => import("@/pages/Termos"));
const Privacidade = lazy(() => import("@/pages/Privacidade"));
import Lp3 from "@/pages/Lp3";
import { BrandLogo, SiteFooter } from "@/components/BrandLogo";
import { ThemePeekDialog } from "@/components/ThemePeekDialog";
import { Lp1SalePage } from "@/components/Lp1SalePage";
import { Lp1MechanismSection } from "@/components/Lp1MechanismSection";
import { Lp1PriceCard } from "@/components/Lp1PriceCard";
import { apiBaseUrl } from "@/config";
import {
  getPricingRegionQuery,
  usePricing,
} from "@/lib/pricing";
import { SUPPORT_DIALOG_EVENT, openSupportDialog } from "@/lib/support";
import { getThemePeek } from "@/lib/theme-peek";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 4,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      staleTime: 30_000,
    },
  },
});
const apiBase = apiBaseUrl;
const apiUrl = (path: string) => `${apiBase}${path}`;

function getQuizAttribution() {
  if (typeof window === "undefined") {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
    utmContent: params.get("utm_content") || undefined,
    utmTerm: params.get("utm_term") || undefined,
  };
}

function trackLp1QuizAnswer({
  screenId,
  answerKey,
  answerValue,
  step,
  experimentAssignment,
}: {
  screenId: string;
  answerKey: string;
  answerValue: string;
  step: number;
  experimentAssignment?: StoredExperimentAssignment;
}) {
  void fetch(apiUrl("/api/track/quiz-answer"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lpId: "v2",
      quizId: "lp1",
      visitorKey: getOrCreateVisitorKey(),
      screenId,
      answerKey,
      answerValue,
      step,
      experimentId: experimentAssignment?.experimentId,
      experimentVariantId: experimentAssignment?.experimentVariantId,
      internal: isInternalTrackingEnabled(),
      ...getQuizAttribution(),
    }),
    keepalive: true,
  }).catch(() => undefined);
}
// Baralhos que têm foto de fundo (arquivos em /public/theme-backgrounds/).
const THEME_BACKGROUND_IDS = new Set([
  "porto-seguro",
  "livro-aberto",
  "voce-nao-sabia",
  "em-voz-alta",
  "la-atras",
  "modo-leve",
  "viagens",
  "carreira-dinheiro",
  "depois-da-tempestade",
  "faisca",
  "luzes-baixas",
  "fogo-alto",
  "sem-freio",
  "mesmo-longe",
  "perto-de-novo",
]);
const themeBackgroundUrl = (id: string): string | null =>
  THEME_BACKGROUND_IDS.has(id) ? `/theme-backgrounds/${id}.jpg` : null;
const inviteUrlFromToken = (token: string) =>
  `${window.location.origin}/invite/${token}`;
const nativeCheckoutEnabled = true;
/** Tempo de vida de uma cobrança Pix. Precisa bater com o relógio da verificação. */
const PIX_LIFETIME_MS = 15 * 60 * 1000;
const PENDING_CHECKOUT_MAX_AGE_MS = PIX_LIFETIME_MS;
const HOSTED_CHECKOUT_MAX_WAIT_MS = 3 * 60 * 1000;
const HOSTED_CHECKOUT_POLL_INTERVAL_MS = 2000;
const CARD_CHECKOUT_MAX_WAIT_MS = 15 * 60 * 1000;
const CARD_CHECKOUT_POLL_INTERVAL_MS = 3000;
const EXPERIMENT_ASSIGNMENT_STORAGE_KEY = "pdc-experiment-assignment";
const INTERNAL_TRACKING_STORAGE_KEY = "pdc_internal";
const stripePublishableKey = (
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
)?.trim();
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

type StoredExperimentAssignment = {
  experimentId: string;
  experimentVariantId: string;
};

function storeExperimentAssignment(assignment: StoredExperimentAssignment) {
  const raw = JSON.stringify(assignment);
  try {
    sessionStorage.setItem(EXPERIMENT_ASSIGNMENT_STORAGE_KEY, raw);
  } catch {
    // Keep the durable copy below when session storage is unavailable.
  }
  safeSetItem(EXPERIMENT_ASSIGNMENT_STORAGE_KEY, raw);
}

async function copyPixCode(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Try the legacy clipboard API below for browsers without clipboard permission.
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);
  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
}

type NativeCheckoutData = {
  sessionId: string;
  brCode: string;
  brCodeBase64: string;
  chargeId: string;
  startedAt: number;
};

type CardCheckoutData = {
  sessionId: string;
  clientSecret: string;
  startedAt: number;
};

type CheckoutOfferPrice = {
  display: string;
  pixAvailable: boolean;
};

type CheckoutOfferState = {
  discountActive: boolean;
  deadline: string;
  full: CheckoutOfferPrice;
  offer: CheckoutOfferPrice;
};

function formatOfferRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type CheckoutReview = {
  id: string;
  displayName: string | null;
  rating: number;
  message: string;
  createdAt: string;
};

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

type Preferences = {
  relationshipType: string | null;
  partnerPronoun: string | null;
};

async function fetchPreferences(
  sessionId: string | null,
  guestToken: string | null,
): Promise<Preferences | null> {
  if (!sessionId && !guestToken) return null;
  const query = sessionId
    ? `sessionId=${encodeURIComponent(sessionId)}`
    : `guestToken=${encodeURIComponent(guestToken!)}`;
  try {
    const response = await fetch(`${apiBase}/api/preferences?${query}`);
    if (!response.ok) return null;
    return (await response.json()) as Preferences;
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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, guestToken, ...patch }),
    });
  } catch {
    // Local storage remains the immediate fallback if the server is unavailable.
  }
}

const fallbackThemes: QuestionTheme[] = connectionThemes;
const fallbackQuestions: Question[] = connectionQuestions.map(
  ({ stage: _stage, ...question }) => question,
);

type QuestionStage = "novo" | "firme" | "qualquer";
type StageWeights = Record<QuestionStage, number>;

const stageById: Record<string, QuestionStage> = Object.fromEntries(
  connectionQuestions.map((question) => [question.id, question.stage]),
);

const PERSONALIZED_DECKS_STORAGE_KEY = "conexao-personalized-decks";
const SEEN_BY_THEME_STORAGE_KEY = "conexao-seen-by-theme";
const SAVED_QUESTIONS_STORAGE_KEY = "conexao-saved-question-ids";
const FAVORITE_THEMES_STORAGE_KEY = "conexao-favorite-theme-ids";
const ADULT_THEME_CONFIRMATION_STORAGE_KEY = "conexao-18plus-confirmed";
const RELATIONSHIP_OPTIONS = [
  "Meu namorado ou minha namorada",
  "Meu esposo ou minha esposa",
  "Alguém com quem estou saindo",
  "Namoro à distância",
];
const PRONOUN_OPTIONS = ["Ela", "Ele", "Prefiro não dizer"];

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
  {
    value: "tranquilos",
    label: "Tranquilos",
    themes: ["porto-seguro"],
    intensity: "gentle" as const,
  },
  {
    value: "saudade",
    label: "Com saudade um do outro",
    themes: ["mesmo-longe", "perto-de-novo"],
    intensity: "honest" as const,
  },
  {
    value: "animados",
    label: "Animados",
    themes: ["modo-leve", "viagens"],
    intensity: "gentle" as const,
  },
  {
    value: "colo",
    label: "Precisando de colo",
    themes: ["porto-seguro", "livro-aberto"],
    intensity: "deep" as const,
  },
];

const dailyVibeOptions = [
  {
    value: "fundo",
    label: "Conversar fundo",
    themes: ["porto-seguro", "livro-aberto"],
    intensity: "deep" as const,
  },
  {
    value: "relembrar",
    label: "Relembrar coisas boas",
    themes: ["la-atras"],
    intensity: "honest" as const,
  },
  {
    value: "sonhar",
    label: "Sonhar um pouco",
    themes: ["em-voz-alta", "perto-de-novo"],
    intensity: "honest" as const,
  },
  {
    value: "rir",
    label: "Só rir e ser leve",
    themes: ["modo-leve"],
    intensity: "gentle" as const,
  },
  {
    value: "reconectar",
    label: "Resolver o que ficou",
    themes: ["depois-da-tempestade", "perto-de-novo"],
    intensity: "honest" as const,
  },
  {
    value: "esquentar",
    label: "Esquentar as coisas",
    themes: ["luzes-baixas", "fogo-alto", "sem-freio"],
    intensity: "honest" as const,
  },
];
const dailyCountOptions = [5, 10, 15, 20];
const deckCoverOptions = [
  { id: "amethyst", label: "Ametista" },
  { id: "sunset", label: "Pôr do sol" },
  { id: "meadow", label: "Campo aberto" },
  { id: "ember", label: "Brasa" },
  { id: "ocean", label: "Maré" },
  { id: "lilac", label: "Lilás" },
] as const;
const deckCoverByVibe: Record<string, string> = {
  fundo: "amethyst",
  relembrar: "sunset",
  sonhar: "ocean",
  rir: "meadow",
  reconectar: "lilac",
  esquentar: "ember",
};
const ONBOARDING_WELCOME_DECK_DONE_KEY = "conexao-welcome-deck-done";
const ONBOARDING_WELCOME_DECK_ID_KEY = "conexao-welcome-deck-id";
const ONBOARDING_OPEN_WELCOME_DECK_KEY = "conexao-open-welcome-deck";

const onboardingFeelingToVibe: Record<string, string> = {
  "Mais perto do que de costume": "fundo",
  "Leve e divertido": "rir",
  "Honesto, mesmo que seja difícil": "fundo",
  "Um pouco perigoso": "esquentar",
};

const onboardingRelationshipToMood: Record<string, string> = {
  "Meu namorado ou minha namorada": "tranquilos",
  "Meu namorado ou namorada": "tranquilos",
  "Meu esposo ou minha esposa": "tranquilos",
  "Alguém com quem estou saindo": "animados",
  "Namoro à distância": "saudade",
};

function isDeckCoverId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    deckCoverOptions.some((option) => option.id === value)
  );
}

function isDeckCoverValue(value: unknown): value is string {
  return (
    isDeckCoverId(value) ||
    (typeof value === "string" && value.startsWith("data:image/"))
  );
}

function deckCoverStyle(cover: string): CSSProperties | undefined {
  if (isDeckCoverId(cover)) return undefined;
  return {
    backgroundImage: `linear-gradient(180deg, rgba(255,255,255,.08), rgba(8,5,20,.48)), url("${cover}")`,
    backgroundPosition: "center",
    backgroundSize: "cover",
  };
}

function resizeCoverImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Escolha uma imagem."));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error("A imagem precisa ter até 12 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível ler essa imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error("Não foi possível abrir essa imagem."));
      image.onload = () => {
        const maxDimension = 1200;
        const scale = Math.min(
          1,
          maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Não foi possível preparar essa imagem."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      image.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.readAsDataURL(file);
  });
}

function readStoredArray(key: string): string[] {
  try {
    const value = JSON.parse(safeGetItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function readStoredDecks(): PersonalizedDeck[] {
  try {
    const value = JSON.parse(
      safeGetItem(PERSONALIZED_DECKS_STORAGE_KEY) || "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (
          deck,
        ): deck is {
          id: string;
          createdAt: string;
          label: string;
          ids: string[];
          cover?: unknown;
          seenIds?: unknown;
        } =>
          Boolean(
            deck &&
            typeof deck === "object" &&
            typeof deck.id === "string" &&
            typeof deck.createdAt === "string" &&
            typeof deck.label === "string" &&
            Array.isArray(deck.ids) &&
            deck.ids.every((id: unknown) => typeof id === "string"),
          ),
      )
      .map((deck, index) => ({
        id: deck.id,
        createdAt: deck.createdAt,
        label: deck.label,
        ids: deck.ids,
        cover: isDeckCoverValue(deck.cover)
          ? deck.cover
          : deckCoverOptions[index % deckCoverOptions.length].id,
        seenIds: Array.isArray(deck.seenIds)
          ? deck.seenIds.filter(
              (id): id is string =>
                typeof id === "string" && deck.ids.includes(id),
            )
          : [],
      }));
  } catch {
    return [];
  }
}

function readStoredRecord(key: string): Record<string, string[]> {
  try {
    const value = JSON.parse(safeGetItem(key) || "{}");
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value).map(([id, ids]) => [
        id,
        Array.isArray(ids)
          ? ids.filter((item): item is string => typeof item === "string")
          : [],
      ]),
    );
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

function getCheckoutBuyerName(email: string, name?: string): string {
  const normalizedName = name?.trim();
  if (normalizedName) return normalizedName;

  const emailName = email
    .trim()
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();

  return emailName || "Cliente";
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in embedded or private browsers.
  }
}

function syncInternalTrackingFromUrl(): void {
  if (typeof window === "undefined") return;
  const internalFlag = new URLSearchParams(window.location.search).get(
    "internal",
  );
  if (internalFlag === "1") {
    safeSetItem(INTERNAL_TRACKING_STORAGE_KEY, "1");
  } else if (internalFlag === "0") {
    safeRemoveItem(INTERNAL_TRACKING_STORAGE_KEY);
  }
}

function isInternalTrackingEnabled(): boolean {
  return safeGetItem(INTERNAL_TRACKING_STORAGE_KEY) === "1";
}

function getStoredVisitorKey(): string {
  try {
    return (
      sessionStorage.getItem("pdc-visitor-key") ||
      localStorage.getItem("pdc-visitor-key") ||
      ""
    );
  } catch {
    return "";
  }
}

function getOrCreateVisitorKey(): string {
  const existing = getStoredVisitorKey();
  if (existing) return existing;

  const visitorKey =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    sessionStorage.setItem("pdc-visitor-key", visitorKey);
  } catch {
    // The durable copy below is enough for returning visitors.
  }
  safeSetItem("pdc-visitor-key", visitorKey);
  return visitorKey;
}

function clearPendingCheckoutStorage(): void {
  safeRemoveItem("conexao-pending-pix");
  safeRemoveItem("conexao-pending-card");
  safeRemoveItem("conexao-pending-session");
  safeRemoveItem("conexao-pending-bill");
  safeRemoveItem("conexao-pending-at");
}

function clearCompletedCheckoutStorage(): void {
  clearPendingCheckoutStorage();
  safeRemoveItem("conexao-pending-source-lp");
  safeRemoveItem("conexao-pending-buyer-name");
  safeRemoveItem("conexao-pending-buyer-email");
  try {
    sessionStorage.removeItem("lp1-quiz-step");
    sessionStorage.removeItem("lp1-quiz-offer");
  } catch {
    // Session storage may be unavailable in embedded or private browsers.
  }
}

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function seededValue(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1)
    value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
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
  if (relationship.includes("saindo"))
    return { novo: 3, qualquer: 2, firme: 0 };
  if (relationship.includes("esposo") || relationship.includes("esposa"))
    return { novo: 0, qualquer: 2, firme: 3 };
  if (relationship.includes("distância") || relationship.includes("distancia"))
    return { novo: 1, qualquer: 2, firme: 2 };
  return { novo: 1, qualquer: 2, firme: 1 };
}

function weightByStage(
  list: Question[],
  seed: string,
  weights: StageWeights,
): Question[] {
  const random = seededValue(seed);
  return [...list]
    .map((question, index) => ({
      question,
      index,
      key: weights[stageById[question.id] || "qualquer"] + random() * 2,
    }))
    .sort(
      (first, second) => second.key - first.key || first.index - second.index,
    )
    .map((item) => item.question);
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
  const mood =
    dailyMoodOptions.find((option) => option.value === moodValue) ||
    dailyMoodOptions[0];
  const vibe =
    dailyVibeOptions.find((option) => option.value === vibeValue) ||
    dailyVibeOptions[0];
  const preferredThemes = new Set([...mood.themes, ...vibe.themes]);
  const shuffled = deterministicShuffle(available, seed);
  const score = (question: Question) =>
    (preferredThemes.has(question.themeId) ? 4 : 0) +
    (question.intensity === vibe.intensity ? 2 : 0) +
    (question.intensity === mood.intensity ? 1 : 0) +
    weights[stageById[question.id] || "qualquer"];
  return shuffled
    .sort((first, second) => score(second) - score(first))
    .slice(0, Math.min(count, available.length))
    .map((question) => question.id);
}
const LANDING_QUIZ_STEPS = [
  {
    key: "intensity",
    label: "Quando você tenta puxar assunto de verdade, o que acontece?",
    options: [
      ["gentle", 'Ele(a) responde "sei lá" e morre ali'],
      ["honest", "A gente fala da rotina e acabou"],
      ["deep", "A gente conversa bem — quero ir mais fundo"],
    ],
  },
  {
    key: "stage",
    label: "Vocês estão juntos há quanto tempo?",
    options: [
      ["novo", "Estamos começando"],
      ["anos", "Alguns anos"],
      ["muitos-anos", "Muitos anos"],
    ],
  },
  {
    key: "theme",
    label: "E hoje à noite, o que vocês querem?",
    options: [
      ["porto-seguro", "Aquecer, sem susto"],
      ["livro-aberto", "Ir fundo de verdade"],
      ["faisca", "Provocar, apimentar"],
    ],
  },
] as const;

type LandingQuizAnswerKey = (typeof LANDING_QUIZ_STEPS)[number]["key"];
type LandingQuizAnswers = Partial<
  Record<
    | LandingQuizAnswerKey
    | "fase"
    | "travas"
    | "dor"
    | "rotina"
    | "clima"
    | "objecao"
    | "pain"
    | "s04-rotina"
    | "s05-silencio",
    string
  >
>;

function selectLandingQuizQuestions(
  themeId: string | undefined,
  intensityValue: string | undefined,
  stageValue: string | undefined,
) {
  const fallbackTheme = connectionThemes[0];
  const selectedTheme =
    connectionThemes.find((theme) => theme.id === themeId) || fallbackTheme;
  const intensity =
    intensityValue === "gentle" ||
    intensityValue === "honest" ||
    intensityValue === "deep"
      ? intensityValue
      : "gentle";
  const stage = stageValue === "novo" ? "novo" : "firme";
  const seen = new Set<string>();
  const selected: typeof connectionQuestions = [];

  const addQuestions = (
    candidates: typeof connectionQuestions,
  ) => {
    candidates.forEach((question) => {
      if (selected.length >= 3 || seen.has(question.id)) return;
      seen.add(question.id);
      selected.push(question);
    });
  };

  addQuestions(
    connectionQuestions.filter(
      (question) =>
        question.themeId === selectedTheme.id &&
        question.intensity === intensity &&
        (question.stage === stage || question.stage === "qualquer"),
    ),
  );
  addQuestions(
    connectionQuestions.filter(
      (question) =>
        question.themeId === selectedTheme.id &&
        question.intensity === intensity,
    ),
  );
  addQuestions(
    connectionQuestions.filter((question) => question.themeId === selectedTheme.id),
  );
  addQuestions(connectionQuestions);

  return { theme: selectedTheme, questions: selected };
}

function LandingQuizQuestion({
  step,
  onAnswer,
  testIdPrefix = "button-quiz",
}: {
  step: 0 | 1 | 2;
  onAnswer: (key: LandingQuizAnswerKey, value: string) => void;
  testIdPrefix?: string;
}) {
  const current = LANDING_QUIZ_STEPS[step];

  return (
    <>
      <p className="lp-quiz-question">{current.label}</p>
      <div className="lp-quiz-options">
        {current.options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onAnswer(current.key, value)}
            className="lp-quiz-option"
            data-testid={`${testIdPrefix}-${current.key}-${value}`}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function LandingQuiz({
  onFinish,
  step,
  answers,
  onAnswer,
}: {
  onFinish: () => void;
  step: number;
  answers: LandingQuizAnswers;
  onAnswer: (key: LandingQuizAnswerKey, value: string) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState(0);

  if (step === 3) {
    const preview = selectLandingQuizQuestions(
      answers.theme,
      answers.intensity,
      answers.stage,
    );
    return (
      <div className="lp-quiz-result">
        <p className="lp-quiz-pill">Seu baralho ideal pra começar:</p>
        <h3 className="lp-quiz-result-title">{preview.theme.title}</h3>
        <div
          className="lp-quiz-cards"
          style={{ "--preview-index": previewIndex } as React.CSSProperties}
        >
          {preview.questions.map((question, index) => (
            <div
              key={question.id}
              className={`lp-quiz-preview-card ${index === previewIndex ? "is-active" : ""}`}
            >
              <span className="lp-mock-tag">
                {preview.theme.title.toLowerCase()}
              </span>
              <p>"{question.text}"</p>
              <span className="lp-mock-num">
                {String(index + 1).padStart(2, "0")} / {preview.theme.count}
              </span>
            </div>
          ))}
        </div>
        <div className="lp-quiz-card-nav" aria-label="Navegar pelas perguntas">
          <button
            type="button"
            onClick={() =>
              setPreviewIndex(
                (previewIndex + preview.questions.length - 1) %
                  preview.questions.length,
              )
            }
            aria-label="Pergunta anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {previewIndex + 1} / {preview.questions.length}
          </span>
          <button
            type="button"
            onClick={() =>
              setPreviewIndex((previewIndex + 1) % preview.questions.length)
            }
            aria-label="Próxima pergunta"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="lp-quiz-cta-text">
          <strong>
            Essas são 3 de {preview.theme.count}.
          </strong>{" "}
          Destrave as outras {preview.theme.count - 3} + os outros 14 baralhos:
        </p>
        <button
          onClick={onFinish}
          className="lp-cta-primary lp-cta-big"
          data-testid="button-quiz-cta"
        >
          Começar hoje à noite <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="lp-quiz">
      <div className="lp-quiz-progress">
        <span>Pergunta {step + 1} de 3</span>
        <div className="lp-quiz-progress-track" aria-hidden="true">
          <div
            className="lp-quiz-progress-fill"
            style={{ width: `${25 + step * 25}%` }}
          />
        </div>
      </div>
      <LandingQuizQuestion
        step={step as 0 | 1 | 2}
        onAnswer={(key, value) => onAnswer(key, value)}
      />
    </div>
  );
}

type Lp1ScreenBase = {
  id: string;
  kind:
    | "question"
    | "card"
    | "trial-card"
    | "trial-chart"
    | "table"
    | "result"
    | "loading"
    | "summary"
    | "sample"
    | "capture"
    | "photo"
    | "chart"
    | "info"
    | "proof";
  image?: string;
  eyebrow?: string;
};

type Lp1Question = Lp1ScreenBase & {
  kind: "question";
  key: string;
  title: string;
  subtitle?: string;
  why?: string;
  format:
    | "single"
    | "list"
    | "cards"
    | "wide"
    | "scale"
    | "multi"
    | "clima"
    | "slider";
  emoji?: boolean;
  options: {
    value: string;
    label: string;
    description?: string;
    expand?: string;
    icon?: string;
    imageSrc?: string;
  }[];
  scaleEnds?: [string, string];
};

type Lp1TrialCardScreen = Lp1ScreenBase & {
  kind: "trial-card";
  key: "cartas";
  title: string;
};

type Lp1TrialChartScreen = Lp1ScreenBase & {
  kind: "trial-chart";
  title: string;
  cta: string;
};

type Lp1TableScreen = Lp1ScreenBase & {
  kind: "table";
  title: string;
  cta: string;
};

type Lp1ResultScreen = Lp1ScreenBase & {
  kind: "result";
  title: string;
  cta: string;
};

type Lp1Card = Lp1ScreenBase & {
  kind: "card";
  title: string;
  body: string[];
  cta: string;
};

type Lp1NarrativeScreen = Lp1ScreenBase & {
  kind: "photo" | "chart" | "info" | "proof";
  title: string;
  body?: string[];
  cta: string;
  source?: string;
  chartKind?: "travas" | "baralhos";
};

type Lp1Placeholder = Lp1ScreenBase & {
  kind: "loading" | "summary" | "sample" | "capture";
  title: string;
  body?: string[];
  cta: string;
  key?: string;
};

type Lp1Screen =
  | Lp1Question
  | Lp1Card
  | Lp1TrialCardScreen
  | Lp1TrialChartScreen
  | Lp1TableScreen
  | Lp1ResultScreen
  | Lp1NarrativeScreen
  | Lp1Placeholder;
type Lp1CartaVerdict = "nao" | "talvez" | "sim";
type Lp1AnswerKey =
  | "intensity"
  | "stage"
  | "theme"
  | "fase"
  | "travas"
  | "dor"
  | "sei-la-mapeado"
  | "rotina"
  | "clima"
  | "objecao"
  | "pain"
  | "inicia"
  | "s04-rotina"
  | "s05-silencio"
  | "profundidade"
  | "quando"
  | "email";
type Lp1Answers = Partial<Record<Lp1AnswerKey, string>> & {
  cartas?: Record<string, Lp1CartaVerdict>;
  climaVerdicts?: Record<string, Lp1CartaVerdict>;
};

const LP1_LEGACY_SCREENS: Lp1Screen[] = [
  {
    id: "s00-capa",
    kind: "card",
    title: "Duas pessoas. 22 telas. Uma conversa que pode mudar a noite.",
    body: [
      "Responda algumas perguntas sobre vocês e descubra por onde começar.",
      "Leva 2 minutos. No fim, você recebe um diagnóstico feito para o momento de vocês.",
    ],
    cta: "Começar o teste",
  },
  {
    id: "s01-fase",
    kind: "question",
    eyebrow: "SOBRE VOCÊS",
    key: "stage",
    title: "Em que fase vocês estão?",
    subtitle: "Não existe resposta certa. Só a que parece mais com vocês hoje.",
    format: "cards",
    emoji: true,
    options: [
      { value: "novo", label: "Estamos começando", icon: "✦" },
      { value: "anos", label: "Já construímos uma história", icon: "◌" },
      { value: "muitos-anos", label: "Estamos juntos há muitos anos", icon: "∞" },
    ],
  },
  {
    id: "s02-o-que-busca",
    kind: "question",
    key: "theme",
    title: "O que você gostaria de sentir mais entre vocês?",
    subtitle: "Escolha o que mais faria diferença hoje.",
    format: "list",
    emoji: true,
    options: [
      { value: "porto-seguro", label: "Acolhimento e proximidade", icon: "♡" },
      { value: "faisca", label: "Desejo e provocação", icon: "✦" },
      { value: "livro-aberto", label: "Profundidade e verdade", icon: "◐" },
    ],
  },
  {
    id: "s03-sei-la",
    kind: "question",
    key: "pain",
    title: "Quando você tenta puxar assunto de verdade, o que acontece?",
    why: "Perguntamos para entender o que mais trava a conversa hoje.",
    format: "wide",
    options: [
      { value: "sei-la", label: 'Ele(a) responde "sei lá"' },
      {
        value: "eu-travo",
        label: "Sim, quase sempre",
        expand: "Essa é a resposta mais comum aqui. Não é desinteresse.",
      },
      { value: "como-comecar", label: "Eu não sei por onde começar" },
      { value: "medo", label: "Tenho medo de perguntar" },
      { value: "afastamento", label: "A gente se afastou sem perceber" },
    ],
  },
  {
    id: "s04-rotina",
    kind: "question",
    key: "s04-rotina",
    title: "Quanto da conversa de vocês hoje é sobre a rotina?",
    subtitle: "Pense na última semana, não no relacionamento inteiro.",
    format: "scale",
    options: [
      { value: "pouco", label: "Quase nada" },
      { value: "alguma", label: "Um pouco" },
      { value: "metade", label: "Metade" },
      { value: "muito", label: "Quase tudo" },
      { value: "tudo", label: "Tudo vira logística" },
    ],
  },
  {
    id: "s05-silencio",
    kind: "question",
    key: "s05-silencio",
    title: "Quando fica um silêncio entre vocês, ele parece…",
    format: "clima",
    emoji: true,
    options: [
      { value: "calmo", label: "Confortável", icon: "☼" },
      { value: "neutro", label: "Normal", icon: "◌" },
      { value: "pesado", label: "Difícil de atravessar", icon: "∿" },
    ],
  },
  {
    id: "s06-pausa",
    kind: "card",
    title: "Nem toda distância começa com uma briga.",
    body: [
      "Às vezes ela aparece quando as perguntas vão ficando para depois.",
      "Vamos olhar para o que ainda está vivo entre vocês.",
    ],
    cta: "Continuar",
  },
  {
    id: "s07-perguntas",
    kind: "question",
    key: "s07-perguntas",
    title: "Com que frequência vocês perguntam algo que não cabe na resposta “tudo bem”?",
    format: "list",
    emoji: true,
    options: [
      { value: "raramente", label: "Raramente", icon: "·" },
      { value: "as-vezes", label: "Às vezes", icon: "◌" },
      { value: "frequente", label: "Com frequência", icon: "✦" },
    ],
  },
  {
    id: "s08-respiro",
    kind: "card",
    title: "Você não precisa ter a conversa perfeita.",
    body: [
      "Precisa só de uma pergunta que abra espaço para a próxima resposta.",
    ],
    cta: "Abrir esse espaço",
  },
  {
    id: "s09-intensidade",
    kind: "question",
    key: "intensity",
    title: "Até onde você quer ir hoje?",
    subtitle: "O baralho acompanha o ritmo de vocês.",
    format: "cards",
    emoji: true,
    options: [
      { value: "gentle", label: "Começar leve", icon: "☼" },
      { value: "honest", label: "Ter uma conversa honesta", icon: "◐" },
      { value: "deep", label: "Ir fundo de verdade", icon: "✦" },
    ],
  },
  {
    id: "s10-mudanca",
    kind: "question",
    key: "s10-mudanca",
    title: "Se algo mudasse entre vocês esta semana, o que você escolheria?",
    format: "wide",
    emoji: true,
    options: [
      { value: "tempo", label: "Mais tempo de qualidade", icon: "⌁" },
      { value: "escuta", label: "Mais escuta", icon: "◌" },
      { value: "toque", label: "Mais carinho e desejo", icon: "♡" },
      { value: "leveza", label: "Mais leveza", icon: "✦" },
    ],
  },
  {
    id: "s11-pausa",
    kind: "loading",
    title: "Estamos juntando as peças do que você contou.",
    body: ["Ainda faltam algumas perguntas. O resultado começa a aparecer."],
    cta: "Continuar",
  },
  {
    id: "s12-ritmo",
    kind: "card",
    title: "O ritmo também é uma resposta.",
    body: [
      "Não vamos empurrar vocês para um lugar que não combina com a noite de hoje.",
    ],
    cta: "Escolher meu ritmo",
  },
  {
    id: "s13-lembranca",
    kind: "question",
    key: "objecao",
    title: "O que mais poderia fazer você deixar isso para depois?",
    subtitle: "Escolha a frase que mais parece com o que passa pela sua cabeça.",
    format: "list",
    options: [
      { value: "ele-nao-topa", label: "Ele(a) não vai topar" },
      { value: "nao-vai-mudar", label: "Não sei se isso muda alguma coisa" },
      { value: "sem-tempo", label: "A gente não tem tempo" },
      { value: "nao-sei-comecar", label: "Eu não sei como começar" },
    ],
  },
  {
    id: "s14-falta",
    kind: "question",
    key: "s14-falta",
    title: "O que você sente falta de receber?",
    why: "A resposta ajuda a separar desejo de expectativa.",
    format: "list",
    options: [
      { value: "atenção", label: "Atenção sem eu precisar pedir" },
      { value: "curiosidade", label: "Curiosidade sobre o meu mundo" },
      { value: "iniciativa", label: "Iniciativa para estarmos juntos" },
      { value: "nada", label: "Não sinto falta de nada específico" },
    ],
  },
  {
    id: "s15-loading",
    kind: "loading",
    title: "Falta pouco para o seu resultado.",
    body: ["Mais duas perguntas e a gente fecha o retrato."],
    cta: "Continuar",
  },
  {
    id: "s16-diagnostico",
    kind: "summary",
    title: "O clima de vocês agora",
    body: ["Aqui vai aparecer o retrato do momento de vocês."],
    cta: "Continuar",
  },
  {
    id: "s17-plano",
    kind: "summary",
    title: "As próximas três noites de vocês",
    body: ["O plano personalizado entra na próxima fase."],
    cta: "Continuar",
  },
  {
    id: "s18-amostra",
    kind: "sample",
    title: "Uma boa pergunta não exige uma resposta pronta.",
    body: ["Ela só faz a outra pessoa querer continuar falando."],
    cta: "Ver a próxima",
  },
  {
    id: "s19-medida",
    kind: "question",
    key: "s19-medida",
    title: "O que faria esta experiência valer a pena para você?",
    format: "wide",
    emoji: true,
    options: [
      { value: "rir", label: "Rir juntos de novo", icon: "😂" },
      { value: "descobrir", label: "Descobrir algo que eu não sabia", icon: "🧠" },
      { value: "aproximar", label: "Me sentir mais perto", icon: "❤️" },
      { value: "coragem", label: "Conseguir falar do que importa", icon: "💬" },
    ],
  },
  {
    id: "s20-hoje",
    kind: "question",
    key: "s20-hoje",
    title: "Quando vocês poderiam começar?",
    format: "cards",
    emoji: true,
    options: [
      { value: "agora", label: "Hoje à noite", icon: "🌙" },
      { value: "semana", label: "Nos próximos dias", icon: "📅" },
      { value: "quando-der", label: "Quando a rotina deixar", icon: "⏳" },
    ],
  },
  {
    id: "s21-amostra",
    kind: "sample",
    title: "3 perguntas feitas para vocês.",
    body: ["Pode usar hoje à noite — são de graça, e são suas."],
    cta: "Continuar",
  },
  {
    id: "s22-contato",
    kind: "capture",
    key: "email",
    title: "Quer receber o seu resultado?",
    body: ["Deixe seu e-mail para não perder o diagnóstico e a sua primeira pergunta."],
    cta: "Continuar",
  },
  {
    id: "s23-organizando",
    kind: "loading",
    title: "Seu diagnóstico está quase pronto.",
    body: ["Estamos escolhendo o ponto de partida que mais combina com vocês."],
    cta: "Ver meu resultado",
  },
];

const LP1_SCREEN_ONE_TO_TEN: Lp1Screen[] = [
  {
    id: "s01-fase",
    kind: "question",
    key: "fase",
    title: "Em que fase vocês estão?",
    subtitle: "Não existe resposta certa. Só a que parece mais com vocês hoje.",
    format: "single",
    emoji: true,
    options: [
      { value: "novo", label: "Estamos começando", icon: "🌱" },
      { value: "historia", label: "Já temos uma história", icon: "🏡" },
      { value: "muitos-anos", label: "Muitos anos juntos", icon: "♾️" },
      { value: "perdidos", label: "A gente meio que se perdeu", icon: "🌙" },
    ],
  },
  {
    id: "s02-travas",
    kind: "question",
    eyebrow: "ONDE ACONTECE",
    key: "travas",
    title: "Onde a conversa de vocês costuma travar?",
    subtitle: "Marque todos que acontecem.",
    format: "multi",
    options: [
      {
        value: "correria",
        label: "Na correria — só sobra logística",
        imageSrc: "/quiz/trava-correria.jpg",
      },
      {
        value: "celular",
        label: "Cada um no celular, lado a lado",
        imageSrc: "/quiz/trava-celular.jpg",
      },
      {
        value: "briga",
        label: "Depois de uma briga mal resolvida",
        imageSrc: "/quiz/trava-briga.jpg",
      },
      {
        value: "cama",
        label: "Na cama — virou automático",
        imageSrc: "/quiz/trava-cama.jpg",
      },
      {
        value: "distancia",
        label: "Na distância — cada um no seu canto",
        imageSrc: "/quiz/trava-distancia.jpg",
      },
    ],
  },
  {
    id: "s03-mapa-travas",
    kind: "chart",
    eyebrow: "O MAPA DE VOCÊS",
    chartKind: "travas",
    title: "Você marcou momentos específicos.",
    body: [
      "Não é o relacionamento inteiro que trava. São momentos específicos — e é neles que a pergunta certa entra.",
    ],
    cta: "Continuar",
  },
  {
    id: "s04-dor",
    kind: "question",
    eyebrow: "O QUE TRAVA",
    key: "dor",
    title: "Quando você tenta puxar assunto de verdade, o que acontece?",
    format: "single",
    emoji: true,
    options: [
      { value: "sei-la", label: 'Ele(a) responde "sei lá"', icon: "🙄" },
      { value: "eu-travo", label: "Eu travo — não sei nem o que dizer", icon: "😶" },
      {
        value: "como-comecar",
        label: "Como é que a gente chega nesse tipo de conversa?",
        icon: "🤷",
      },
      { value: "medo", label: "Tenho medo da resposta", icon: "😬" },
      {
        value: "afastamento",
        label: "A gente se afastou sem perceber",
        icon: "🫥",
      },
    ],
  },
  {
    id: "s05-dor-espelho",
    kind: "photo",
    eyebrow: "O QUE TRAVA",
    title: "",
    body: [],
    cta: "Continuar",
  },
  {
    id: "s06-rotina",
    kind: "question",
    eyebrow: "O RITMO",
    key: "rotina",
    title: "Na última semana, quanto da conversa de vocês foi só logística?",
    subtitle: "Conta, mercado, horário, o que falta em casa.",
    format: "scale",
    scaleEnds: ["Quase nada", "Praticamente tudo"],
    options: [
      { value: "pouco", label: "Quase nada" },
      { value: "alguma", label: "Pouco" },
      { value: "metade", label: "Metade" },
      { value: "muito", label: "Bastante" },
      { value: "tudo", label: "Praticamente tudo" },
    ],
  },
  {
    id: "s07-clima",
    kind: "question",
    eyebrow: "O CLIMA",
    key: "clima",
    title: "Quando fica um silêncio entre vocês, ele parece…",
    format: "clima",
    emoji: true,
    options: [
      {
        value: "leve",
        label: "Confortável",
        imageSrc: "/quiz/clima-leve.png",
      },
      { value: "normal", label: "Normal", icon: "◌" },
      {
        value: "honesto",
        label: "Difícil de atravessar",
        imageSrc: "/quiz/clima-honesto.png",
      },
    ],
  },
  {
    id: "s08-pergunta-importa",
    kind: "info",
    eyebrow: "POR QUE A PERGUNTA IMPORTA",
    title: "Não é conversa. É a pergunta ser específica.",
    body: [
      "Em 1997 o psicólogo Arthur Aron colocou estranhos para responderem 36 perguntas em ordem crescente de profundidade. Dois deles se casaram. O que o estudo mostrou não foi sobre amor: foi que a intimidade não depende de vontade, depende da pergunta ter resposta.",
      "“Vamos conversar” não é uma pergunta. É uma cobrança.",
    ],
    source: "Aron et al., Personality and Social Psychology Bulletin, 1997.",
    cta: "Continuar",
  },
  {
    id: "s09-baralhos",
    kind: "chart",
    eyebrow: "O QUE JÁ EXISTE PRONTO",
    chartKind: "baralhos",
    title: "Já existe um ponto de partida para vocês.",
    body: [],
    cta: "Continuar",
  },
  {
    id: "s10-objecao",
    kind: "question",
    key: "objecao",
    title: "O que mais te faria deixar isso pra depois?",
    eyebrow: "O QUE ATRAPALHA",
    format: "single",
    options: [
      {
        value: "intenso-demais",
        label: "Vou parecer intenso demais",
        icon: "🫣",
        expand:
          "Quem faz a pergunta é a carta, não você. Ninguém precisa chegar com assunto pronto — nem você.",
      },
      {
        value: "ele-nao-topa",
        label: "Ele(a) não vai topar",
        icon: "🤨",
        expand:
          "É o medo de todo mundo. Por isso começa leve: as primeiras são fáceis de responder até pra quem trava.",
      },
      {
        value: "sem-tempo",
        label: "A gente não tem tempo",
        icon: "⏳",
        expand:
          "Uma carta por noite. Dez minutos, sem marcar nada, sem clima.",
      },
      {
        value: "nao-vai-mudar",
        label: "Não sei se muda alguma coisa",
        icon: "🤔",
        expand:
          "Não precisa acreditar. Vê as três de hoje à noite e julga depois.",
      },
    ],
  },
];

const LP1_SCREEN_ELEVEN_TO_TWENTY_TWO: Lp1Screen[] = [
  {
    id: "s16-experimentar",
    kind: "question",
    eyebrow: "O RITMO DE VOCÊS",
    key: "profundidade",
    title:
      "Se as perguntas começassem leves e fossem ficando mais profundas conforme vocês se sentissem à vontade, você gostaria de experimentar?",
    format: "single",
    emoji: true,
    options: [
      { value: "leve", label: "Sim", icon: "❤️" },
      { value: "honesta", label: "Com certeza", icon: "🙂" },
      { value: "fundo", label: "Acho que sim", icon: "🤔" },
      { value: "talvez", label: "Talvez", icon: "😬" },
    ],
  },
  ...Array.from({ length: 5 }, (_, index): Lp1TrialCardScreen => ({
    id: `s${String(index + 17).padStart(2, "0")}-carta`,
    kind: "trial-card",
    key: "cartas",
    eyebrow: "UMA CARTA DE VERDADE",
    title: "É pra vocês?",
  })),
  {
    id: "s22-diferenca",
    kind: "table",
    eyebrow: "a diferença",
    title: "Vocês já tentaram conversar. Não é disso que falta.",
    cta: "Continuar",
  },
  {
    id: "s23-profundidade",
    kind: "question",
    eyebrow: "O RITMO DE HOJE",
    key: "profundidade",
    title: "Até onde vocês querem ir hoje?",
    format: "single",
    emoji: true,
    options: [
      { value: "leve", label: "Começar leve", icon: "🌤️" },
      { value: "honesta", label: "Ter uma conversa honesta", icon: "🌗" },
      { value: "fundo", label: "Ir fundo de verdade", icon: "🌑" },
    ],
  },
  {
    id: "s24-quando",
    kind: "question",
    eyebrow: "QUANDO COMEÇA",
    key: "quando",
    title: "Quando vocês leem a primeira?",
    format: "single",
    emoji: true,
    options: [
      { value: "hoje", label: "Hoje à noite", icon: "🌙" },
      { value: "dias", label: "Nos próximos dias", icon: "📅" },
      { value: "quando", label: "Quando der", icon: "🤷" },
    ],
  },
  {
    id: "s25-resultado",
    kind: "capture",
    eyebrow: "SEU RESULTADO",
    key: "email",
    title: "Pra onde eu mando o resultado?",
    body: ["O diagnóstico e as 3 primeiras cartas, de graça."],
    cta: "Continuar",
  },
  {
    id: "s26-carregando",
    kind: "loading",
    eyebrow: "SEU RESULTADO",
    title: "Lendo as suas respostas…",
    body: [],
    cta: "",
  },
  {
    id: "s27-clima",
    kind: "result",
    eyebrow: "O CLIMA DE VOCÊS AGORA",
    title: "",
    cta: "Ver o baralho de vocês",
  },
];

const LP1_SCREENS_LEGACY: Lp1Screen[] = [
  ...LP1_SCREEN_ONE_TO_TEN,
  ...LP1_SCREEN_ELEVEN_TO_TWENTY_TWO,
];

const LP1_DEFINITIVE_SCREENS: Lp1Screen[] = [
  {
    id: "s02-momento",
    kind: "question",
    key: "momento",
    title: "Hoje, vocês estão em qual momento?",
    format: "cards",
    emoji: true,
    options: [
      { value: "namorando", label: "Namorando", icon: "❤️" },
      { value: "casados", label: "Casados", icon: "💍" },
      { value: "distancia", label: "À distância", icon: "🌎" },
      { value: "comecando", label: "Começando agora", icon: "✨" },
      { value: "reconexao", label: "Em reconexão", icon: "🫶" },
    ],
  },
  {
    id: "s03-tempo",
    kind: "question",
    key: "tempo",
    title: "Há quanto tempo vocês estão juntos?",
    format: "cards",
    emoji: true,
    options: [
      {
        value: "menos-seis",
        label: "Menos de 6 meses",
        icon: "✨",
        imageSrc: "/quiz/tempo-menos-seis.png",
      },
      {
        value: "seis-um",
        label: "6 meses a 2 anos",
        icon: "🌱",
        imageSrc: "/quiz/tempo-seis-dois.png",
      },
      {
        value: "um-tres",
        label: "2 a 5 anos",
        icon: "🏡",
        imageSrc: "/quiz/tempo-dois-cinco.png",
      },
      {
        value: "mais-dez",
        label: "Mais de 5 anos",
        icon: "🕯️",
        imageSrc: "/quiz/tempo-mais-cinco.png",
      },
    ],
  },
  {
    id: "s04-conversas",
    kind: "question",
    key: "conversas",
    title: "Hoje, a conversa de vocês é mais sobre o quê?",
    subtitle: "Pode escolher mais de uma.",
    format: "multi",
    emoji: true,
    options: [
      { value: "rotina", label: "Rotina e contas", icon: "🏠" },
      { value: "trabalho", label: "Trabalho", icon: "💼" },
      { value: "besteira", label: "Besteira e risada", icon: "😂" },
      { value: "nos-dois", label: "Vocês dois", icon: "❤️" },
      { value: "intimidade", label: "Intimidade", icon: "🔥" },
      { value: "pessoal", label: "Planos", icon: "🌎" },
    ],
  },
  {
    id: "s05-sei-la",
    kind: "question",
    key: "sei-la-mapeado",
    title: "Você tenta puxar uma conversa de verdade. E aí?",
    format: "single",
    emoji: true,
    options: [
      { value: "sei-la", label: 'Vem o "sei lá"', icon: "🙄" },
      { value: "nao-sei", label: 'Vem o "não sei"', icon: "😶" },
      { value: "superficial", label: "Responde, mas fica raso", icon: "😐" },
      { value: "muda-assunto", label: "Muda de assunto", icon: "🔄" },
      { value: "rende", label: "Às vezes rende", icon: "💬" },
      { value: "vai-longe", label: "Quando engata, vai longe", icon: "✨" },
    ],
  },
  {
    id: "s05b-dor-espelho",
    kind: "photo",
    eyebrow: "O QUE TRAVA",
    title: "",
    body: [],
    cta: "Continuar",
  },
  {
    id: "s06-inicia",
    kind: "question",
    key: "inicia",
    title: "Quando a conversa não rola, geralmente é por quê?",
    why: "Não é falta de amor — é a pergunta ou a hora.",
    format: "single",
    emoji: true,
    options: [
      {
        value: "ele-nao-entra",
        label: "Ele(a) não entra no assunto",
        icon: "🤐",
      },
      {
        value: "nao-sei-perguntar",
        label: "Eu não sei o que perguntar",
        icon: "😕",
      },
      {
        value: "nao-senta",
        label: "Nunca parece a hora certa",
        icon: "⏳",
      },
      {
        value: "clima",
        label: "Quando tento, o clima trava",
        icon: "🌧️",
      },
    ],
  },
  {
    id: "s07-celular",
    kind: "question",
    key: "celular",
    title: "O celular senta com vocês?",
    format: "single",
    emoji: true,
    options: [
      { value: "sempre", label: "Sempre", icon: "📱" },
      { value: "as-vezes", label: "Às vezes", icon: "🙂" },
      { value: "quase-nunca", label: "Quase nunca", icon: "🌙" },
    ],
  },
  {
    id: "s08-prova",
    kind: "proof",
    eyebrow: "+500 CASAIS",
    title: "já encontraram novas formas de se conectar.",
    body: [
      "Casais que reservam alguns minutos para conversar relatam mais proximidade depois de usar as nossas perguntas.",
    ],
    source: "Dados de uma pesquisa com casais que usaram o baralho.",
    cta: "Continuar",
  },
  {
    id: "s09-desejo-noite",
    kind: "question",
    key: "desejo_noite",
    eyebrow: "IMAGINE ISSO",
    title: "Imagine uma noite que realmente parece diferente.",
    subtitle: "Qual dessas cenas você gostaria mais de viver com seu parceiro?",
    format: "cards",
    emoji: true,
    options: [
      {
        value: "proximos",
        label: "Uma noite sem celular",
        icon: "📵",
        imageSrc: "/quiz/s09-sem-celular.png",
      },
      {
        value: "rir",
        label: "Rir de coisas que vocês nunca perguntaram",
        icon: "😂",
        imageSrc: "/quiz/s09-rir.png",
      },
      {
        value: "conversar",
        label: "Uma conversa longa",
        icon: "🕯️",
        imageSrc: "/quiz/s09-conversa-longa.png",
      },
      {
        value: "quimica",
        label: "Uma conversa que aproxima de verdade",
        icon: "🔥",
        imageSrc: "/quiz/s09-aproxima.png",
      },
    ],
  },
  {
    id: "s10-sentir",
    kind: "question",
    key: "sentir",
    title: "No fim de uma noite dessas, o que você queria sentir?",
    format: "multi",
    options: [
      { value: "entende", label: "Que ele(a) me entende de novo" },
      { value: "encontrou", label: "Que a gente se reencontrou" },
      { value: "leveza", label: "Leveza, rir junto" },
      { value: "ouvido", label: "Aquela paz de ter sido ouvido(a)" },
      { value: "desejo", label: "Desejo de volta" },
    ],
  },
  {
    id: "s11-conhece",
    kind: "question",
    key: "conhece",
    title: "Você ainda sente que conhece ele(a) de verdade?",
    format: "single",
    emoji: true,
    options: [
      { value: "sim", label: "Sim, bastante", icon: "💯" },
      { value: "mais-ou-menos", label: "Mais ou menos", icon: "🙂" },
      { value: "as-vezes-nao", label: "Às vezes sinto que não", icon: "🤔" },
      { value: "sei-tudo", label: "Sinto que já sei tudo", icon: "😶" },
    ],
  },
  {
    id: "s12-nunca-perguntou",
    kind: "question",
    key: "nunca-perguntou",
    title: "Tem uma pergunta que você queria fazer pra ele(a) e nunca fez?",
    format: "single",
    options: [
      { value: "varias", label: "Várias" },
      { value: "algumas", label: "Uma ou outra" },
      { value: "nem-sei", label: "Nem sei qual seria" },
      { value: "vergonha", label: "Tenho, mas dá medo" },
      { value: "nao", label: "Não" },
    ],
  },
  {
    id: "s13-atrapalha",
    kind: "question",
    key: "atrapalha",
    title: "O que mais te faz empurrar essa conversa pra depois?",
    format: "multi",
    emoji: true,
    options: [
      { value: "cansaco", label: "Cansaço e rotina", icon: "😴" },
      { value: "celular", label: "O celular", icon: "📱" },
      { value: "comecar", label: "Não sei como começar", icon: "🤷" },
      { value: "medo", label: "Vou parecer forçado(a)", icon: "😬" },
      { value: "medo-resposta", label: "Medo da resposta", icon: "😨" },
      {
        value: "nao-para",
        label: "Sinto que a gente já falou de tudo",
        icon: "💭",
      },
    ],
  },
  {
    id: "s14-educacao",
    kind: "info",
    title: "Uma conversa boa não começa necessariamente com “precisamos conversar”.",
    body: [
      "Uma conversa boa não depende de alguém ser “bom de conversa”. Às vezes vocês só precisam de uma pergunta que dê vontade de responder.",
    ],
    cta: "Faz sentido",
  },
  {
    id: "s17-cartas",
    kind: "trial-card",
    key: "cartas",
    eyebrow: "5 PERGUNTAS REAIS",
    title: "Qual dessas perguntas é pra vocês?",
  },
  {
    id: "s18-clima",
    kind: "question",
    key: "clima",
    eyebrow: "ESCOLHA PELO FEELING",
    title: "Qual clima combina mais com vocês?",
    subtitle: "Como vocês gostariam que a próxima conversa começasse?",
    format: "clima",
    emoji: true,
    options: [
      {
        value: "leve",
        label: "Leve",
        description: "para respirar juntos e sair do automático",
        icon: "🌿",
        imageSrc: "/quiz/clima-leve.png",
      },
      {
        value: "honesto",
        label: "Honesto",
        description: "para falar do que existe entre vocês",
        icon: "❤️",
        imageSrc: "/quiz/clima-honesto.jpeg",
      },
      {
        value: "profundo",
        label: "Profundo",
        description: "para descobrir um ao outro de outro jeito",
        icon: "🧠",
        imageSrc: "/quiz/clima-honesto.png",
      },
      {
        value: "intimo",
        label: "Íntimo",
        description: "para reacender a faísca entre vocês",
        icon: "🔥",
        imageSrc: "/quiz/clima-intimo.jpeg",
      },
    ],
  },
  {
    id: "s13b-crenca",
    kind: "photo",
    eyebrow: "A VERDADE",
    title: "Você não vai virar “aquela pessoa intensa”.",
    body: [
      "Quem faz a pergunta é a carta, não você. Não tem obrigação de responder, começa leve e só vai fundo quando os dois quiserem. Funciona mesmo se só um topar hoje — e você não precisa da resposta perfeita: “nunca pensei nisso” já é começo.",
    ],
    cta: "Faz sentido",
    image: "/hero/hero-casal-novo-mobile.webp",
  },
  {
    id: "s20-urgencia",
    kind: "question",
    key: "urgencia",
    title: "Quando você gostaria de ter uma noite diferente com ele?",
    format: "single",
    emoji: true,
    options: [
      { value: "hoje", label: "Hoje", icon: "🌙" },
      { value: "proximos-dias", label: "Nos próximos dias", icon: "📅" },
      { value: "essa-semana", label: "Essa semana", icon: "🗓️" },
      {
        value: "oportunidade",
        label: "Quando surgir uma oportunidade",
        icon: "⏳",
      },
    ],
  },
  {
    id: "s21-ultimo",
    kind: "question",
    key: "ultimo",
    title: "Se você pudesse começar essa conversa hoje, gostaria de ter as perguntas certas na mão?",
    format: "single",
    emoji: true,
    options: [
      { value: "sim-quero", label: "Sim, quero", icon: "❤️" },
      { value: "muito", label: "Muito", icon: "🥺" },
      { value: "otimo", label: "Seria ótimo", icon: "🙂" },
      { value: "ajudaria", label: "Acho que ajudaria", icon: "🤔" },
    ],
  },
  {
    id: "s22-carregando",
    kind: "loading",
    eyebrow: "SEU RESULTADO",
    title: "Seu resultado está quase pronto…",
    body: [],
    cta: "",
  },
  {
    id: "s24-clima",
    kind: "result",
    eyebrow: "O MOMENTO DAS CONVERSAS DE VOCÊS",
    title: "",
    cta: "Ver o que preparei pra vocês",
  },
];

const LP1_SCREENS: Lp1Screen[] = LP1_DEFINITIVE_SCREENS;

const LP1_DOR_ESPELHO: Record<
  string,
  { title: string; body: string[] }
> = {
  "sei-la": {
    title: "Ele não estava fugindo de você.",
    body: [
      "“Vamos conversar” pede que o outro traga alguma coisa sem dizer o quê. Ninguém sabe responder isso. Nem você, se ele perguntasse primeiro.",
    ],
  },
  "eu-travo": {
    title: "O problema nunca foi você não ter o que dizer.",
    body: [
      "É que ninguém chega com a pergunta pronta. Quando a carta faz a pergunta, você só responde.",
    ],
  },
  "como-comecar": {
    title: "“Como é que a gente chega nesse tipo de conversa?”",
    body: [
      "É a pergunta que mais aparece. E a resposta é sem graça: alguém chega com uma pergunta na mão e lê em voz alta. É isso.",
    ],
  },
  medo: {
    title: "Você tem medo da resposta. Faz sentido.",
    body: [
      "Por isso o baralho começa leve. Ninguém abre o jogo numa pergunta pesada — a profundidade vem depois, quando os dois já estão dentro.",
    ],
  },
  afastamento: {
    title: "Nem toda distância começa com uma briga.",
    body: [
      "Às vezes ela aparece quando as perguntas vão ficando pra depois. Aí o silêncio deixa de ser uma noite ruim e vira o normal.",
    ],
  },
};

const LP1_TRAVA_DECKS: Record<string, string[]> = {
  correria: ["modo-leve", "porto-seguro"],
  celular: ["perto-de-novo", "voce-nao-sabia"],
  briga: ["depois-da-tempestade", "livro-aberto"],
  cama: ["faisca", "luzes-baixas"],
  distancia: ["mesmo-longe", "em-voz-alta"],
};

const LP1_TRIAL_DEPTHS = [
  "gentle",
  "gentle",
  "honest",
  "honest",
  "honest",
] as const;

const LP1_CLIMA_DECKS: Record<string, string[]> = {
  leve: ["modo-leve", "perto-de-novo"],
  honesto: ["porto-seguro", "voce-nao-sabia"],
  profundo: ["livro-aberto", "depois-da-tempestade"],
  intimo: ["faisca", "luzes-baixas"],
};

type Lp1TrialCard = {
  id: string;
  deckId: string;
  deckName: string;
  question: string;
};

const LP1_TRIAL_QUESTIONS = [
  "Qual é o nosso “programa de preguiça” perfeito?",
  "O que te faz sentir “cheguei em casa” quando me vê?",
  "Qual foi o momento em que você mais me amou até hoje?",
  "Quando foi a última vez que você fingiu estar bem perto de mim?",
  "O que passa pela sua cabeça quando você se sente distante de mim?",
] as const;

function getLp1TrialCards(answers: Lp1Answers): Lp1TrialCard[] {
  const selectedTravas = (answers.travas ?? "").split(",").filter(Boolean);
  const pointedDecks = [
    ...selectedTravas.flatMap((trava) => LP1_TRAVA_DECKS[trava] ?? []),
    ...(LP1_CLIMA_DECKS[answers.clima ?? ""] ?? []),
  ];
  const deckIds: string[] = [];
  const addDeck = (deckId: string) => {
    if (!deckIds.includes(deckId)) deckIds.push(deckId);
  };

  pointedDecks.forEach(addDeck);
  addDeck("porto-seguro");
  addDeck("modo-leve");
  const deckSlots = deckIds.length > 0 ? deckIds : ["porto-seguro"];
  return LP1_TRIAL_QUESTIONS.map((question, index) => {
    const deckId = deckSlots[index % deckSlots.length] ?? "porto-seguro";
    return {
      id: `lp1-trial-${index + 1}`,
      deckId,
      deckName:
        connectionThemes.find((theme) => theme.id === deckId)?.title ?? deckId,
      question,
    };
  });
}

function lp1AnswersWithAliases(
  previous: Lp1Answers,
  key: string,
  value: string,
): Lp1Answers {
  const next = { ...previous, [key]: value };
  if (key === "fase") {
    next.stage = value === "novo" ? "novo" : value === "muitos-anos" ? "muitos-anos" : "anos";
    next.theme = value === "perdidos" ? "porto-seguro" : "livro-aberto";
    next.intensity = value === "perdidos" ? "deep" : "gentle";
  }
  if (key === "dor" || key === "sei-la-mapeado") {
    next.dor = value;
    next.pain = value;
    next["sei-la-mapeado"] = value;
    next.intensity =
      value === "medo" || value === "afastamento" ? "deep" : "honest";
    next.theme = value === "afastamento" ? "porto-seguro" : "livro-aberto";
  }
  if (key === "rotina") {
    next["s04-rotina"] = value;
    next.intensity = value === "tudo" || value === "muito" ? "deep" : "honest";
  }
  if (key === "clima") {
    next["s05-silencio"] =
      value === "leve" ? "calmo" : value === "honesto" ? "pesado" : "neutro";
    next.intensity = value === "honesto" ? "deep" : "gentle";
  }
  return next;
}

const LP1_THEME_NAMES: Record<string, string> = {
  "porto-seguro": "Porto Seguro",
  "livro-aberto": "Livro Aberto",
  "voce-nao-sabia": "Você Não Sabia",
  "em-voz-alta": "Em Voz Alta",
  "la-atras": "Lá Atrás",
  "modo-leve": "Modo Leve",
  viagens: "Viagens",
  "carreira-dinheiro": "Carreira & Dinheiro",
  "depois-da-tempestade": "Depois da Tempestade",
  faisca: "Faísca",
  "mesmo-longe": "Mesmo Longe",
};

function Lp1Diagnosis({
  answers,
  onContinue,
}: {
  answers: LandingQuizAnswers;
  onContinue: () => void;
}) {
  const diagnosis = selectLp1Diagnosis(answers);
  const preview = selectLandingQuizQuestions(
    answers.theme,
    answers.intensity,
    answers.stage,
  );
  const previewQuestions = preview.questions.slice(0, 3).map((question) => ({
    id: question.id,
    text: question.text,
  }));

  return (
    <section className="lp1-diagnosis" aria-labelledby="lp1-diagnosis-title">
      <div className="lp1-diagnosis-card">
        <span className="lp1-diagnosis-badge">DIAGNÓSTICO PERSONALIZADO</span>
        <p className="lp1-diagnosis-kicker">O que o teste mostrou</p>
        <h1 id="lp1-diagnosis-title" className="lp1-diagnosis-title">
          {diagnosis.title}
        </h1>
        <p className="lp1-diagnosis-insight">{diagnosis.insight}</p>
        {diagnosis.personalizations.map((personalization) => (
          <p className="lp1-diagnosis-insight" key={personalization}>
            {personalization}
          </p>
        ))}
        {previewQuestions.length > 0 ? (
          <div className="lp1-diagnosis-questions">
            <p className="lp1-diagnosis-questions-label">
              Uma prévia do que vem por aí
            </p>
            <RecommendedQuestionCarousel questions={previewQuestions} />
          </div>
        ) : null}
        <p className="lp1-diagnosis-recommendation">
          Seu baralho pra começar:{" "}
          <strong>
            {LP1_THEME_NAMES[diagnosis.themeId] ?? "Porto Seguro"}
          </strong>
        </p>
        <p className="lp1-diagnosis-anchor">
          É uma prévia: 3 de 459 perguntas. As outras 456 abrem quando o
          baralho for de vocês.
        </p>
        <button
          type="button"
          className="lp1-diagnosis-cta"
          onClick={onContinue}
          data-testid="button-lp1-diagnosis-continue"
        >
          Começar hoje à noite <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

const LP1_OFFER_HEADLINES: Record<string, string> = {
  routine: "Dá pra resolver isso hoje à noite.",
  discovery: "Dá pra descobrir algo novo hoje à noite.",
  "waiting-conversation": "Dá pra abrir essa conversa hoje à noite.",
  reconnection: "Dá pra começar a se reencontrar hoje à noite.",
  beginning: "Dá pra manter essa curiosidade viva hoje à noite.",
  distance: "Dá pra se sentir perto hoje à noite.",
  intimacy: "Dá pra reacender essa intimidade hoje à noite.",
  healthy: "Dá pra continuar escolhendo um ao outro hoje à noite.",
};

function Lp1Offer({
  answers,
  onFinish,
}: {
  answers: LandingQuizAnswers;
  onFinish: () => void;
}) {
  const diagnosis = selectLp1Diagnosis(answers);
  const pricing = usePricing();
  const testimonialNameByNarrative: Record<string, string> = {
    routine: "Marina",
    discovery: "Julia",
    "waiting-conversation": "Rafael",
    reconnection: "Marina",
    beginning: "Caio",
    distance: "Fernanda",
    intimacy: "Camila",
    healthy: "Lucas",
  };
  const testimonial =
    landingTestimonials.find(
      ({ name }) => name === testimonialNameByNarrative[diagnosis.narrativeType],
    ) ?? landingTestimonials[0];
  const testimonialImageIndex =
    Math.max(0, landingTestimonials.indexOf(testimonial)) % testimonialImages.length;

  return (
    <section className="lp1-offer" aria-labelledby="lp1-offer-title">
      <div className="lp1-offer-card">
        <p className="lp1-offer-kicker">A VERDADE QUE O TESTE MOSTROU</p>
        <h1 id="lp1-offer-title" className="lp1-offer-title">
          {diagnosis.title}
        </h1>
        <p className="lp1-offer-solution">
          <em>
            {LP1_OFFER_HEADLINES[diagnosis.narrativeType] ??
              "Dá pra resolver isso hoje à noite."}
          </em>
        </p>

        <div className="lp1-offer-gain-label">O QUE VOCÊS LEVAM</div>
        <ul className="lp1-offer-benefits">
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>459 perguntas</strong> em 15 baralhos, começando pelo que
              faz sentido para vocês
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Começa leve e vai fundo</strong> no ritmo de vocês —
              ninguém trava
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Jogo a distância:</strong> respondam juntos, cada um no
              seu celular
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Acesso vitalício</strong> — paga uma vez, é de vocês, com
              baralhos novos incluídos
            </span>
          </li>
          <li>
            <Check aria-hidden="true" />
            <span>
              <strong>Um convite</strong> pra ele(a) entrar sem pagar de novo
            </span>
          </li>
        </ul>

        <div className="lp1-offer-testimonial" aria-label="Depoimento de cliente">
          <img
            className="lp1-offer-testimonial-image"
            src={testimonialImages[testimonialImageIndex]}
            alt="Depoimento de casal"
          />
        </div>

        <Lp1PriceCard
          fullPricing={pricing}
          onBuy={onFinish}
          testId="button-lp1-offer-checkout"
        />
      </div>
    </section>
  );
}

function Lp1Quiz({
  onFinish,
  onBackToLanding,
  experimentAssignment,
}: {
  onFinish: () => void;
  onBackToLanding: () => void;
  experimentAssignment?: StoredExperimentAssignment;
}) {
  const [step, setStep] = useState(() => {
    try {
      const storedStep = Number(sessionStorage.getItem("lp1-quiz-step"));
      return Number.isFinite(storedStep) && storedStep > 0 ? storedStep : 0;
    } catch {
      return 0;
    }
  });
  const [answers, setAnswers] = useState<Lp1Answers>({});
  const [showOffer, setShowOffer] = useState(() => {
    try {
      return sessionStorage.getItem("lp1-quiz-offer") === "true";
    } catch {
      return false;
    }
  });
  const [captureAttempted, setCaptureAttempted] = useState(false);
  const [trialCardIndex, setTrialCardIndex] = useState(0);
  const [climateIndex, setClimateIndex] = useState(0);
  const singleAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = LP1_SCREENS[step] ?? LP1_SCREENS[0];
  const isLastScreen = step === LP1_SCREENS.length - 1;
  const selectedAnswer =
    current.kind === "question" && current.key
      ? answers[current.key as Lp1AnswerKey]
      : "";
  const selectedValue = typeof selectedAnswer === "string" ? selectedAnswer : "";
  const visualStep = Math.min(step + 1, LP1_SCREENS.length);

  useEffect(() => {
    try {
      sessionStorage.setItem("lp1-quiz-step", String(step));
    } catch {
      // Session storage may be unavailable in embedded or private browsers.
    }
  }, [step]);

  useEffect(() => {
    try {
      sessionStorage.setItem("lp1-quiz-offer", String(showOffer));
    } catch {
      // Session storage may be unavailable in embedded or private browsers.
    }
  }, [showOffer]);

  useEffect(() => {
    return () => {
      if (singleAdvanceTimer.current !== null) {
        clearTimeout(singleAdvanceTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (current.kind !== "trial-card") {
      setTrialCardIndex(0);
    }
  }, [current.kind, step]);

  useEffect(() => {
    setClimateIndex(0);
  }, [step]);

  const selectAnswer = (key: string, value: string) => {
    setAnswers((previous) => lp1AnswersWithAliases(previous, key, value));
    if (typeof navigator !== "undefined") navigator.vibrate?.(10);
  };

  const selectTrialCard = (cardId: string, verdict: Lp1CartaVerdict) => {
    const nextAnswers: Lp1Answers = {
      ...answers,
      cartas: {
        ...(answers.cartas ?? {}),
        [cardId]: verdict,
      },
    };
    setAnswers(nextAnswers);
    trackLp1QuizAnswer({
      screenId: `${current.id}:${cardId}`,
      answerKey: "cartas",
      answerValue: verdict,
      step,
      experimentAssignment,
    });
    if (singleAdvanceTimer.current !== null) {
      clearTimeout(singleAdvanceTimer.current);
    }
    singleAdvanceTimer.current = setTimeout(() => {
      singleAdvanceTimer.current = null;
      const cards = getLp1TrialCards(nextAnswers);
      if (trialCardIndex < cards.length - 1) {
        setTrialCardIndex((index) => index + 1);
      } else {
        advance(nextAnswers);
      }
    }, 220);
  };

  const selectClimateVerdict = (
    climateValue: string,
    verdict: Lp1CartaVerdict,
  ) => {
    const climateVerdicts = {
      ...(answers.climaVerdicts ?? {}),
      [climateValue]: verdict,
    };
    const nextAnswers: Lp1Answers = {
      ...answers,
      climaVerdicts: climateVerdicts,
    };
    const climateQuestion =
      current.kind === "question" && current.id === "s18-clima"
        ? current
        : null;

    if (!climateQuestion) return;

    if (climateIndex < climateQuestion.options.length - 1) {
      setAnswers(nextAnswers);
      trackLp1QuizAnswer({
        screenId: `${current.id}:${climateValue}`,
        answerKey: "climaVerdicts",
        answerValue: verdict,
        step,
        experimentAssignment,
      });
      setClimateIndex((index) => index + 1);
      if (typeof navigator !== "undefined") navigator.vibrate?.(10);
      return;
    }

    const preferredClimate =
      climateQuestion.options.find(
        (option) => climateVerdicts[option.value] === "sim",
      ) ??
      climateQuestion.options.find(
        (option) => climateVerdicts[option.value] === "talvez",
      ) ??
      climateQuestion.options[0];

    if (preferredClimate) {
      nextAnswers.clima = preferredClimate.value;
    }
    setAnswers(nextAnswers);
    trackLp1QuizAnswer({
      screenId: `${current.id}:${climateValue}`,
      answerKey: "climaVerdicts",
      answerValue: verdict,
      step,
      experimentAssignment,
    });
    if (typeof navigator !== "undefined") navigator.vibrate?.(10);
    advance(nextAnswers);
  };

  const advance = (nextAnswers = answers) => {
    if (isLastScreen) {
      const score = computeLp1Score(nextAnswers as LandingQuizAnswers);
      console.info("[lp1] score", score);
      trackLp1QuizAnswer({
        screenId: "quiz-complete",
        answerKey: "completed",
        answerValue: "true",
        step: LP1_SCREENS.length,
        experimentAssignment,
      });
      setShowOffer(false);
      setStep(LP1_SCREENS.length);
      return;
    }
    setStep((previous) => Math.min(previous + 1, LP1_SCREENS.length - 1));
  };

  const handleSingleSelect = (key: string, value: string) => {
    selectAnswer(key, value);
    trackLp1QuizAnswer({
      screenId: current.id,
      answerKey: key,
      answerValue: value,
      step,
      experimentAssignment,
    });
    if (singleAdvanceTimer.current !== null) {
      clearTimeout(singleAdvanceTimer.current);
    }
    const hasExpansion =
      current.kind === "question" &&
      current.options.some((option) => option.value === value && option.expand);
    singleAdvanceTimer.current = setTimeout(() => {
      singleAdvanceTimer.current = null;
      advance(lp1AnswersWithAliases(answers, key, value));
    }, hasExpansion ? 1400 : 280);
  };

  const handleNext = () => {
    if (current.kind === "capture") {
      const email = answers.email?.trim() ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setCaptureAttempted(true);
        return;
      }
    }
    if (current.kind === "question") {
      if (!selectedValue) return;
      const score = computeLp1Score(answers as LandingQuizAnswers);
      console.info("[lp1] score", score);
    }
    advance();
  };

  const handleMultiSelect = (value: string) => {
    if (current.kind !== "question") return;
    const currentValues = selectedValue ? selectedValue.split(",") : [];
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];
    selectAnswer(current.key, nextValues.join(","));
    trackLp1QuizAnswer({
      screenId: current.id,
      answerKey: current.key,
      answerValue: nextValues.join(","),
      step,
      experimentAssignment,
    });
  };

  const goBack = () => {
    if (step === 0) {
      onBackToLanding();
      return;
    }
    setStep((previous) => Math.max(previous - 1, 0));
  };

  return (
    <main className={`lp1-quiz-screen ${showOffer ? "is-offer" : ""}`}>
      {!showOffer && step < LP1_SCREENS.length ? (
        <>
          <header className="lp1-quiz-header">
            <button
              type="button"
              className="lp1-quiz-header-back"
              onClick={goBack}
              aria-label="Voltar"
            >
              <span aria-hidden="true">←</span>
            </button>
             <p className="lp1-quiz-counter" aria-label={`Tela ${visualStep} de ${LP1_SCREENS.length}`}>
              <span>{visualStep}</span>
               <span>/{LP1_SCREENS.length}</span>
            </p>
          </header>
          <div
            className="lp1-quiz-progress"
            role="progressbar"
             aria-label={`Progresso do quiz: tela ${visualStep} de ${LP1_SCREENS.length}`}
            aria-valuemin={1}
             aria-valuemax={LP1_SCREENS.length}
            aria-valuenow={visualStep}
          >
            <span className="lp1-quiz-progress-track" aria-hidden="true">
              <span
                className="lp1-quiz-progress-fill"
                 style={{ width: `${(visualStep / LP1_SCREENS.length) * 100}%` }}
              />
              <span
                className="lp1-quiz-progress-dot"
                 style={{ left: `${(visualStep / LP1_SCREENS.length) * 100}%` }}
              />
            </span>
          </div>
        </>
      ) : null}

      <div className="lp1-quiz-content">
        {showOffer ? (
          <Lp1SalePage
            answers={answers as unknown as Record<string, unknown>}
            onCheckout={onFinish}
          />
        ) : step === LP1_SCREENS.length ? (
          <Lp1Diagnosis
            answers={answers as LandingQuizAnswers}
            onContinue={() => setShowOffer(true)}
          />
        ) : current.kind === "question" && current.id === "s18-clima" ? (
          <Lp1ClimatePicker
            question={current}
            cardIndex={climateIndex}
            verdicts={answers.climaVerdicts ?? {}}
            onVerdict={selectClimateVerdict}
          />
        ) : current.kind === "question" ? (
          <section
            className={
              current.id === "s04-conversas"
                ? "lp1-conversation-question"
                : current.id === "s03-tempo"
                  ? "lp1-time-question"
                  : current.id === "s09-desejo-noite"
                    ? "lp1-night-question"
                  : current.id === "s10-sentir"
                    ? "lp1-feeling-question"
                  : current.id === "s19-encontrar"
                    ? "lp1-goal-question"
                    : current.id === "s13-atrapalha"
                      ? "lp1-obstacle-question"
                      : undefined
            }
            data-section-name={current.id}
          >
            {current.eyebrow ? <p className="lp1-quiz-eyebrow">{current.eyebrow}</p> : null}
            {current.format === "multi" ? (
              <div className="lp1-quiz-accumulation" aria-live="polite">
                <div className="lp1-quiz-accumulation-thumbs">
                  {current.options
                    .filter((option) => selectedValue.split(",").includes(option.value))
                    .map((option) => (
                      <img
                        key={option.value}
                        src={option.imageSrc}
                        className="lp1-quiz-accumulation-thumb"
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ))}
                </div>
                <span>
                  {selectedValue ? selectedValue.split(",").filter(Boolean).length : 0} de 5
                  marcados
                </span>
              </div>
            ) : null}
            <h1 className="lp1-quiz-title">{current.title}</h1>
            {current.subtitle ? (
              <p className="lp1-quiz-subtitle">{current.subtitle}</p>
            ) : null}
            {current.why ? <p className="lp1-quiz-why">{current.why}</p> : null}
            <Lp1QuestionOptions
              question={current}
              selectedValue={selectedValue}
              onSelect={(value) =>
                current.format === "multi"
                  ? handleMultiSelect(value)
                  : handleSingleSelect(current.key, value)
              }
            />
            {current.format === "multi" ? (
              <div className="lp1-quiz-actions">
                <button
                  type="button"
                  className="lp1-quiz-next"
                  disabled={!selectedValue}
                  onClick={handleNext}
                  data-testid={`button-lp1-quiz-next-${current.id}`}
                >
                  Continuar <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>
        ) : current.kind === "trial-card" ? (
          <Lp1TrialCardScreen
            cardIndex={trialCardIndex}
            sectionId={current.id}
            eyebrow={current.eyebrow}
            title={current.title}
            card={getLp1TrialCards(answers)[trialCardIndex]}
            answer={
              answers.cartas?.[
                getLp1TrialCards(answers)[trialCardIndex]?.id ?? ""
              ]
            }
            onSelect={selectTrialCard}
          />
        ) : current.kind === "trial-chart" ? (
          <Lp1TrialChartScreen
            cards={getLp1TrialCards(answers)}
            answers={answers}
            onContinue={handleNext}
          />
        ) : current.kind === "table" ? (
          <Lp1ComparisonScreen screen={current} onContinue={handleNext} />
        ) : current.kind === "loading" ? (
          <Lp1LoadingScreen sectionId={current.id} onComplete={handleNext} />
        ) : current.kind === "result" ? (
          <Lp1ResultScreen
            answers={answers}
            sectionId={current.id}
            cta={current.cta}
            onContinue={() => setShowOffer(true)}
          />
        ) : current.kind === "chart" ? (
          <Lp1ChartScreen
            screen={current}
            answers={answers}
            onContinue={handleNext}
          />
        ) : current.kind === "photo" ? (
          <Lp1PhotoScreen
            dor={answers["sei-la-mapeado"] ?? answers.dor ?? "sei-la"}
            screen={current}
            onContinue={handleNext}
          />
        ) : current.kind === "info" || current.kind === "proof" ? (
          <Lp1InfoScreen screen={current} answers={answers} onContinue={handleNext} />
        ) : (
          <section data-section-name={current.id}>
            {current.eyebrow ? <p className="lp1-quiz-eyebrow">{current.eyebrow}</p> : null}
            <h1 className="lp1-quiz-title">{current.title}</h1>
            {current.body?.map((paragraph) => (
              <p className="lp1-quiz-card-body" key={paragraph}>
                {paragraph}
              </p>
            ))}
            {current.kind === "capture" ? (
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                className="lp1-quiz-capture-input"
                placeholder="seu melhor e-mail"
                value={answers.email ?? ""}
                onChange={(event) =>
                  {
                    setCaptureAttempted(false);
                    setAnswers((previous) => ({
                      ...previous,
                      email: event.target.value,
                    }));
                  }
                }
                onFocus={(event) =>
                   (() => {
                     const el = event.currentTarget;
                     window.setTimeout(
                       () =>
                         el.scrollIntoView({
                        block: "center",
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                          .matches
                          ? "auto"
                          : "smooth",
                         }),
                       100,
                     );
                   })()
                }
                aria-label="Seu e-mail"
                data-testid="input-lp1-quiz-email"
              />
            ) : null}
            {current.kind === "capture" && captureAttempted ? (
              <p className="lp1-capture-error">
                Digite um e-mail válido ou veja seu resultado sem e-mail.
              </p>
            ) : null}
            {current.kind === "card" ? (
              <div className="lp1-quiz-actions">
                <button
                  type="button"
                  className="lp1-quiz-next"
                  onClick={handleNext}
                  data-testid={`button-lp1-quiz-next-${current.id}`}
                >
                  {current.cta} <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="lp1-quiz-next"
                  onClick={handleNext}
                  data-testid={`button-lp1-quiz-next-${current.id}`}
                >
                  {current.cta} <ArrowRight size={17} aria-hidden="true" />
                </button>
                {"key" in current && current.kind === "capture" ? (
                  <button
                    type="button"
                    className="lp1-quiz-skip"
                    onClick={() => {
                      setCaptureAttempted(false);
                      advance();
                    }}
                    data-testid="button-lp1-quiz-skip-email"
                  >
                   ver sem e-mail →
                  </button>
                ) : null}
                {step === 0 ? (
                  <button
                    type="button"
                    className="lp1-quiz-skip"
                    onClick={onFinish}
                    data-testid="button-lp1-quiz-existing-checkout"
                  >
                    Já fiz o teste — quero o baralho →
                  </button>
                ) : null}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Lp1TrialCardScreen({
  card,
  cardIndex,
  sectionId,
  eyebrow,
  title,
  answer,
  onSelect,
}: {
  card?: Lp1TrialCard;
  cardIndex: number;
  sectionId: string;
  eyebrow?: string;
  title: string;
  answer?: Lp1CartaVerdict;
  onSelect: (cardId: string, verdict: Lp1CartaVerdict) => void;
}) {
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    setDirection(null);
    setDragX(0);
    setShowConfetti(false);
  }, [card?.id]);

  if (!card) return null;

  const choose = (verdict: Lp1CartaVerdict) => {
    if (direction) return;
    setDirection(verdict === "nao" ? "left" : "right");
    if (verdict === "sim") {
      navigator.vibrate?.(12);
      setShowConfetti(true);
      window.setTimeout(() => setShowConfetti(false), 420);
    }
    window.setTimeout(() => onSelect(card.id, verdict), 220);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (direction) return;
    pointerStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null || direction) return;
    setDragX(event.clientX - pointerStart.current);
  };

  const handlePointerUp = () => {
    if (pointerStart.current === null || direction) return;
    const currentDrag = dragX;
    pointerStart.current = null;
    setDragX(0);
    if (Math.abs(currentDrag) >= 56) {
      choose(currentDrag < 0 ? "nao" : "sim");
    }
  };

  return (
    <section
      className="lp1-trial-card-screen"
      data-section-name={sectionId}
    >
      {eyebrow ? <p className="lp1-quiz-eyebrow">{eyebrow}</p> : null}
      <h1 className="lp1-quiz-title">{title}</h1>
      <div
        className={`lp1-trial-card ${direction ? `is-leaving-${direction}` : ""}`}
        style={
          dragX
            ? {
                transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`,
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="lp1-trial-card-deck">{card.deckName}</span>
        <p>{card.question}</p>
        <span className="lp1-trial-card-footer">
          CARTA REAL · {cardIndex + 1} de 5
        </span>
      </div>
      <div className="lp1-trial-verdicts" aria-label="Avaliar esta carta">
        {(
          [
            ["nao", "👎", "Não é pra nós"],
            ["talvez", "😐", "Talvez"],
            ["sim", "👍", "É pra nós"],
          ] as const
        ).map(([value, icon, label]) => (
          <button
            type="button"
            key={value}
            className={`lp1-trial-verdict ${
              answer === value ? "is-selected" : ""
            }`}
            onClick={() => choose(value)}
            aria-pressed={answer === value}
          >
            <span aria-hidden="true">{icon}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      {showConfetti ? <Lp1Confetti /> : null}
    </section>
  );
}

function Lp1Confetti() {
  return (
    <div className="lp1-confetti" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

function Lp1TrialChartScreen({
  cards,
  answers,
  onContinue,
}: {
  cards: Lp1TrialCard[];
  answers: Lp1Answers;
  onContinue: () => void;
}) {
  const verdicts = answers.cartas ?? {};
  const simCount = cards.filter((card) => verdicts[card.id] === "sim").length;
  const deckIds = Array.from(new Set(cards.map((card) => card.deckId)));
  const availableCards = new Set(
    connectionQuestions
      .filter((question) => deckIds.includes(question.themeId))
      .map((question) => question.id),
  ).size;
  const remainingCards = Math.max(0, availableCards - cards.length);

  return (
    <section className="lp1-trial-chart-screen" data-section-name="s16-escolhas">
      <p className="lp1-quiz-eyebrow">O QUE VOCÊS ESCOLHERAM</p>
      <h1 className="lp1-quiz-title">{simCount} das 5 são pra vocês.</h1>
      <div className="lp1-trial-mini-cards" aria-label="Resumo das cinco cartas">
        {cards.map((card, index) => {
          const verdict = verdicts[card.id] ?? "nao";
          return (
            <div
              className={`lp1-trial-mini-card is-${verdict}`}
              key={`${card.id}-${index}`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span>{verdict === "sim" ? "✓" : ""}</span>
              <small>{card.deckName}</small>
            </div>
          );
        })}
      </div>
      <p className="lp1-chart-copy">
        Vieram de {deckIds.length} baralhos diferentes. Tem mais{" "}
        {remainingCards} cartas só nesses.
      </p>
      <button type="button" className="lp1-quiz-next lp1-quiz-full-cta" onClick={onContinue}>
        Continuar <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

function Lp1ComparisonScreen({
  screen,
  onContinue,
}: {
  screen: Lp1TableScreen;
  onContinue: () => void;
}) {
  const rows = [
    ["Nomeia o problema", true, true],
    ["Faz a pessoa se sentir ouvida", true, true],
    ["Já chega com o assunto pronto", false, true],
    ["Funciona mesmo se só um teve a ideia", false, true],
    ["Respondem juntos, cada um no seu celular", false, true],
    ["Tem mais 458 pra amanhã", false, true],
  ] as const;

  return (
      <section className="lp1-comparison-screen" data-section-name={screen.id}>
      <p className="lp1-quiz-eyebrow">{screen.eyebrow}</p>
      <h1 className="lp1-quiz-title">{screen.title}</h1>
      <div className="lp1-comparison-table" role="table">
        <div className="lp1-comparison-row is-header" role="row">
          <span />
          <strong>“Vamos conversar”</strong>
          <strong>Perguntas de Conexão</strong>
        </div>
        {rows.map(([label, generic, connection]) => (
          <div className="lp1-comparison-row" role="row" key={label}>
            <span>{label}</span>
            <span className={generic ? "is-yes" : "is-no"} aria-label={generic ? "Sim" : "Não"}>
              {generic ? "✓" : "✗"}
            </span>
            <span
              className={`is-ours ${connection ? "is-yes" : "is-no"}`}
              aria-label={connection ? "Sim" : "Não"}
            >
              {connection ? "✓" : "✗"}
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="lp1-quiz-next lp1-quiz-full-cta" onClick={onContinue}>
        {screen.cta} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

const LP1_LOADING_MODALS = [
  {
    question: "Se a pergunta já viesse pronta, você leria uma hoje à noite?",
    options: ["Sim", "Ainda não sei"],
  },
  {
    question: "Dez minutos, uma carta, sem precisar marcar nada. Serve pra vocês?",
    options: ["Sim", "Ainda não sei"],
  },
  {
    question: "Topa começar por uma leve, não pela mais pesada?",
    options: ["Sim", "Ainda não sei"],
  },
] as const;

const LP1_LOADING_TESTIMONIALS = [
  testimonialImages[4],
  testimonialImages[1],
  testimonialImages[5],
] as const;
const LP1_LOADING_DURATION_MS = 15000;
const LP1_LOADING_PHASE_DURATION_MS = 5000;
const LP1_LOADING_MODAL_THRESHOLDS = [3500, 8000, 12500] as const;

function Lp1LoadingScreen({
  sectionId,
  onComplete,
}: {
  sectionId: string;
  onComplete: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [answeredModals, setAnsweredModals] = useState(0);
  const [modalFeedback, setModalFeedback] = useState("");
  const completedRef = useRef(false);

  useEffect(() => {
    if (
      modalIndex !== null ||
      completedRef.current
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsed((current) =>
        Math.min(LP1_LOADING_DURATION_MS, current + 100),
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [answeredModals, modalIndex]);

  useEffect(() => {
    if (
      modalIndex !== null ||
      answeredModals >= LP1_LOADING_MODALS.length
    ) {
      return;
    }
    const nextModal = answeredModals;
    if (elapsed >= LP1_LOADING_MODAL_THRESHOLDS[nextModal]) {
      setModalIndex(nextModal);
      setModalFeedback("");
    }
  }, [answeredModals, elapsed, modalIndex]);

  useEffect(() => {
    if (
      elapsed < LP1_LOADING_DURATION_MS ||
      modalIndex !== null ||
      answeredModals < LP1_LOADING_MODALS.length ||
      completedRef.current
    ) {
      return;
    }
    completedRef.current = true;
    onComplete();
  }, [answeredModals, elapsed, modalIndex, onComplete]);

  const handleModalOption = () => {
    setModalFeedback("");
    setAnsweredModals((current) => current + 1);
    setModalIndex(null);
  };

  const percentage = Math.round(
    (elapsed / LP1_LOADING_DURATION_MS) * 100,
  );
  const title =
    elapsed < LP1_LOADING_PHASE_DURATION_MS
      ? "Lendo as suas respostas…"
      : elapsed < LP1_LOADING_PHASE_DURATION_MS * 2
        ? "Cruzando com os 15 baralhos…"
        : "Montando as 3 primeiras cartas…";

  return (
    <section className="lp1-loading-screen" data-section-name={sectionId}>
      <p className="lp1-quiz-eyebrow">SEU RESULTADO</p>
      <h1 className="lp1-quiz-title">{title}</h1>
      <div className="lp1-loading-circle" style={{ "--loading-progress": `${percentage}%` } as CSSProperties}>
        <span>{percentage}%</span>
      </div>
      <div className="lp1-loading-checklist">
        {["Lendo as suas respostas", "Cruzando com os 15 baralhos", "Montando as 3 primeiras cartas"].map(
          (label, index) => (
            <p
              key={label}
              className={
                elapsed >= (index + 1) * LP1_LOADING_PHASE_DURATION_MS
                  ? "is-complete"
                  : ""
              }
            >
              <span aria-hidden="true">
                {elapsed >= (index + 1) * LP1_LOADING_PHASE_DURATION_MS
                  ? "✓"
                  : "○"}
              </span>
              {label}
            </p>
          ),
        )}
      </div>
      <img
        className="lp1-loading-testimonial"
        src={
          LP1_LOADING_TESTIMONIALS[
            Math.min(
              2,
              Math.floor(elapsed / LP1_LOADING_PHASE_DURATION_MS),
            )
          ]
        }
        alt="Depoimento de cliente"
      />
      {modalIndex !== null ? (
        <div className="lp1-loading-modal-backdrop" role="presentation">
          <div className="lp1-loading-modal" role="dialog" aria-modal="true">
            <p className="lp1-loading-modal-progress">
              Para continuar, especifique
            </p>
            <p>{LP1_LOADING_MODALS[modalIndex].question}</p>
            <div className="lp1-loading-modal-actions">
              {LP1_LOADING_MODALS[modalIndex].options.map((option, optionIndex) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => handleModalOption()}
                >
                  {option}
                </button>
              ))}
            </div>
            {modalFeedback ? (
              <p className="lp1-loading-modal-feedback" role="status">
                {modalFeedback}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type Lp1UrgencyMessage = {
  copy: string;
  insightIcon: string;
  insightLabel: string;
  insightValue: string;
};

function getLp1UrgencyMessage(
  answers: Lp1Answers,
  routineValue: string,
  riskLabel: string,
): Lp1UrgencyMessage {
  const read = (key: string) => {
    const value = (answers as Record<string, unknown>)[key];
    return typeof value === "string" ? value : "";
  };
  const split = (key: string) => read(key).split(",").filter(Boolean);
  const obstacles = split("atrapalha");
  const blocks = split("travas");
  const conversations = split("conversas");

  if (riskLabel === "Risco baixo") {
    return {
      copy:
        "Pelo que você contou, a conexão de vocês ainda está viva. Não existe um problema para consertar agora — existe uma troca boa para continuar escolhendo, antes que a rotina transforme presença em piloto automático.",
      insightIcon: "✦",
      insightLabel: "Conexão viva",
      insightValue: "pede continuidade",
    };
  }

  if (
    read("celular") === "sempre" ||
    blocks.includes("celular") ||
    obstacles.includes("celular")
  ) {
    return {
      copy:
        "Quando o celular entra em toda pausa de vocês, cada noite adiada vira um pouco mais de distância. Antes que estar lado a lado sem se encontrar pareça normal, criem um momento que seja só de vocês.",
      insightIcon: "📵",
      insightLabel: "Presença sem tela",
      insightValue: "pede atenção",
    };
  }

  if (read("dor") === "afastamento" || read("fase") === "perdidos") {
    return {
      copy:
        "A distância raramente chega de uma vez. Ela cresce nas conversas adiadas, nas noites iguais e no “depois a gente fala”. Se vocês querem mudar esse clima, o próximo momento precisa ser escolhido — não esperado.",
      insightIcon: "↔",
      insightLabel: "Proximidade entre vocês",
      insightValue: "precisa de espaço",
    };
  }

  if (
    read("inicia") === "ele-nao-entra" ||
    read("inicia") === "nao-senta" ||
    read("objecao") === "ele-nao-topa"
  ) {
    return {
      copy:
        "Esperar o momento perfeito ou a iniciativa do outro mantém tudo no mesmo lugar. Uma conversa que importa precisa de um começo pequeno — antes que o silêncio vire o jeito mais fácil de vocês passarem a noite.",
      insightIcon: "↗",
      insightLabel: "Iniciativa para se encontrar",
      insightValue: "não pode ficar para depois",
    };
  }

  if (
    obstacles.includes("medo-resposta") ||
    obstacles.includes("medo") ||
    read("dor") === "medo"
  ) {
    return {
      copy:
        "O medo da resposta é compreensível — mas adiar também muda a relação. Começar com uma pergunta leve dá a vocês uma chance de se reencontrar antes que o silêncio fique confortável.",
      insightIcon: "◌",
      insightLabel: "Coragem para perguntar",
      insightValue: "começa pequeno",
    };
  }

  if (
    read("rotina") === "tudo" ||
    read("rotina") === "muito" ||
    conversations.includes("rotina") ||
    obstacles.includes("cansaco")
  ) {
    return {
      copy:
        "A rotina já está ocupando espaço demais entre vocês. Não precisa acontecer uma briga para a conexão diminuir: quando as perguntas ficam para depois, o automático começa a parecer normal.",
      insightIcon: "◷",
      insightLabel: "Conversa além do automático",
      insightValue: routineValue,
    };
  }

  if (
    obstacles.includes("comecar") ||
    read("inicia") === "nao-sei-perguntar" ||
    read("dor") === "como-comecar"
  ) {
    return {
      copy:
        "Enquanto vocês esperam saber exatamente o que dizer, a rotina continua decidindo por vocês. Não precisa ser a conversa perfeita; precisa acontecer antes que mais uma semana passe igual.",
      insightIcon: "?",
      insightLabel: "Um começo possível",
      insightValue: "é o que falta",
    };
  }

  return {
    copy:
      "O que esfria uma relação nem sempre parece urgente no começo. São as perguntas adiadas e os momentos deixados para depois. Aproveitem o espaço que ainda existe entre vocês antes que ele vire distância.",
    insightIcon: "✦",
    insightLabel: "Espaço para se aproximar",
    insightValue: "ainda existe",
  };
}

function Lp1ResultScreen({
  answers,
  sectionId,
  cta,
  onContinue,
}: {
  answers: Lp1Answers;
  sectionId: string;
  cta: string;
  onContinue: () => void;
}) {
  const result = computeLp1DistanceResult(answers);
  const mirrorKeyByInicia: Record<string, string> = {
    "ele-nao-entra": "sei-la",
    "nao-sei-perguntar": "como-comecar",
    "nao-senta": "afastamento",
    clima: "medo",
  };
  const mirrorKey =
    (answers.inicia && mirrorKeyByInicia[answers.inicia]) ??
    answers.dor ??
    "sei-la";
  const mirror = LP1_DOR_ESPELHO[mirrorKey] ?? LP1_DOR_ESPELHO["sei-la"];
  const urgency = getLp1UrgencyMessage(
    answers,
    result.routineValue,
    result.label,
  );
  const resultTitle =
    result.label === "Risco baixo"
      ? "A conexão de vocês ainda está viva."
      : mirror.title;
  const riskTone =
    result.label === "Risco baixo"
      ? "is-baixo"
      : result.label === "Risco médio"
        ? "is-medio"
        : "is-alto";
  const relationshipDynamic =
    result.label === "Risco baixo"
      ? "Troca presente"
      : result.label === "Risco médio"
        ? "Conexão no automático"
        : "Distância ganhando espaço";
  const resultInsights = [
    { icon: urgency.insightIcon, label: "Padrão central", value: urgency.insightLabel },
    { icon: "⚡", label: "Risco de afastamento", value: result.label },
    { icon: "?", label: "Dinâmica da relação", value: relationshipDynamic },
    { icon: "🌱", label: "Espaço para começar hoje", value: result.spaceValue },
  ];
  const [meterPosition, setMeterPosition] = useState("50%");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMeterPosition(`${result.meterPosition}%`);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [result.score]);

  return (
    <section className="lp1-result-screen" data-section-name={sectionId}>
      <p className="lp1-quiz-eyebrow">O CLIMA DE VOCÊS AGORA</p>
      <h1 className="lp1-quiz-title">{resultTitle}</h1>
      <figure className="lp1-result-photo">
        <img
          src="/hero/resultado-conexao.png"
          alt="Casal refletindo juntos sobre a relação"
        />
      </figure>
      <div className="lp1-result-meter-card">
        <div className="lp1-result-meter-heading">
          <span>Risco de afastamento</span>
          <strong className={`lp1-result-meter-status ${riskTone}`}>
            {result.label}
          </strong>
        </div>
        <div className="lp1-result-meter">
          <span
            className="lp1-result-meter-balloon"
            style={{ left: meterPosition }}
          >
            vocês estão aqui
          </span>
          <span className="lp1-result-meter-marker" style={{ left: meterPosition }} />
        </div>
        <div className="lp1-result-meter-labels lp1-result-meter-labels-four">
          <span className="is-frio" style={{ left: "10%" }}>
            Baixo
          </span>
          <span className="is-morno" style={{ left: "37%" }}>
            Estável
          </span>
          <span className="is-morno" style={{ left: "64%" }}>
            Médio
          </span>
          <span className="is-distante" style={{ left: "90%" }}>
            Alto
          </span>
        </div>
        <div className="lp1-result-context">
          <span className="lp1-result-urgency-mark" aria-hidden="true">
            !
          </span>
          <div>
            <strong className="lp1-result-urgency-label">
              O QUE NÃO DEIXAR PARA DEPOIS
            </strong>
            <p>{urgency.copy}</p>
          </div>
        </div>
      </div>
      <p className="lp1-result-disclaimer">
        Este score de conexão é informal e serve apenas para reflexão. Ele não
        substitui uma avaliação clínica nem resume toda a experiência de vocês.
      </p>
      <div className="lp1-result-insights">
        {resultInsights.map((insight) => (
          <div className="lp1-result-insight" key={insight.label}>
            <span aria-hidden="true">{insight.icon}</span>
            <p>
              {insight.label} <strong>{insight.value}</strong>
            </p>
          </div>
        ))}
      </div>
      <button type="button" className="lp1-quiz-next lp1-quiz-full-cta" onClick={onContinue}>
        {cta} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

function Lp1ChartScreen({
  screen,
  answers,
  onContinue,
}: {
  screen: Lp1NarrativeScreen;
  answers: Lp1Answers;
  onContinue: () => void;
}) {
  const selectedTravas = (answers.travas ?? "").split(",").filter(Boolean);
  const deckIds = Array.from(
    new Set(selectedTravas.flatMap((trava) => LP1_TRAVA_DECKS[trava] ?? [])),
  );
  const decks = deckIds
    .map((id) => connectionThemes.find((theme) => theme.id === id))
    .filter((theme): theme is (typeof connectionThemes)[number] => Boolean(theme));
  const isDeckChart = screen.chartKind === "baralhos";
  const travaLabels: Record<string, string> = {
    correria: "Correria",
    celular: "Celular",
    briga: "Briga",
    cama: "Cama",
    distancia: "Distância",
  };
  const chartTitle = isDeckChart
    ? `${decks.length} dos 15 baralhos falam exatamente do que você marcou.`
    : `Você marcou ${selectedTravas.length} dos 5 momentos.`;
  const cardCount = decks.reduce((sum, deck) => sum + deck.count, 0);

  return (
    <section className="lp1-chart-screen" data-section-name={screen.id}>
      {screen.eyebrow ? <p className="lp1-quiz-eyebrow">{screen.eyebrow}</p> : null}
      <h1 className="lp1-quiz-title">{chartTitle}</h1>
      {isDeckChart ? (
        <>
          <div className="lp1-deck-chart" aria-label={`${decks.length} baralhos recomendados`}>
            {connectionThemes.map((theme, index) => {
              const active = deckIds.includes(theme.id);
              return (
                <div
                  className={`lp1-deck-chart-cell ${active ? "is-active" : ""}`}
                  key={theme.id}
                  style={{ animationDelay: `${index * 70}ms` }}
                  title={active ? theme.title : undefined}
                >
                  <span>{active ? theme.title : ""}</span>
                </div>
              );
            })}
          </div>
          <p className="lp1-chart-copy">
            São {cardCount} cartas escritas para esses momentos. Nenhuma começa pesada.
          </p>
        </>
      ) : (
        <>
          <div className="lp1-trava-chart" aria-label={`${selectedTravas.length} momentos marcados`}>
            {Object.keys(travaLabels).map((value, index) => {
              const active = selectedTravas.includes(value);
              return (
                <div
                  className={`lp1-trava-chart-row ${active ? "is-active" : ""}`}
                  key={value}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <span>{travaLabels[value]}</span>
                </div>
              );
            })}
          </div>
          <p className="lp1-chart-copy">{screen.body?.[0]}</p>
        </>
      )}
      <button type="button" className="lp1-quiz-next lp1-quiz-full-cta" onClick={onContinue}>
        {screen.cta} <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

function Lp1PhotoScreen({
  dor,
  screen,
  onContinue,
}: {
  dor: string;
  screen: Lp1NarrativeScreen;
  onContinue: () => void;
}) {
  const mirror = LP1_DOR_ESPELHO[dor] ?? LP1_DOR_ESPELHO["sei-la"];
  const isMirror = screen.id === "s05b-dor-espelho";
  const title = isMirror ? mirror.title : screen.title;
  const body = isMirror ? mirror.body : screen.body ?? [];
  return (
    <section className="lp1-photo-screen" data-section-name={screen.id}>
      <img
        className="lp1-photo-image"
        src={screen.image ?? `/quiz/dx-${dor}.png`}
        alt=""
        aria-hidden="true"
        onError={(event) => {
          event.currentTarget.style.visibility = "hidden";
        }}
      />
      <div className="lp1-photo-scrim" aria-hidden="true" />
      <div className="lp1-photo-copy">
        {screen.eyebrow ? <p className="lp1-quiz-eyebrow">{screen.eyebrow}</p> : null}
        <h1 className="lp1-quiz-title">{title}</h1>
        {body.map((paragraph) => (
          <p className="lp1-quiz-card-body" key={paragraph}>
            {paragraph}
          </p>
        ))}
        <button type="button" className="lp1-quiz-next lp1-quiz-full-cta" onClick={onContinue}>
          {screen.cta} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

type Lp1EducationMetric = {
  label: string;
  value: number;
};

type Lp1EducationInsight = {
  firstParagraph: string;
  secondParagraph: string;
  metrics: Lp1EducationMetric[];
};

function getLp1EducationInsight(answers: Lp1Answers): Lp1EducationInsight {
  const read = (key: string) =>
    (answers as Record<string, string | undefined>)[key] ?? "";
  const split = (key: string) => read(key).split(",").filter(Boolean);
  const obstacles = split("atrapalha");
  const topics = split("conversas");
  const feelings = split("sentir");
  const mappedResponse = read("sei-la-mapeado");
  const hasRoutine = obstacles.includes("rotina");
  const hasDistraction =
    obstacles.includes("celular") || read("celular") === "muito";
  const hasHardStart =
    obstacles.includes("comecar") ||
    mappedResponse === "sei-la" ||
    mappedResponse === "nao-sei";
  const hasFear = obstacles.includes("medo");
  const hasFatigue = obstacles.includes("cansaco");

  let firstParagraph =
    "Às vezes o problema não é falta de vontade. É falta de uma boa porta de entrada.";
  if (hasRoutine && hasDistraction) {
    firstParagraph =
      "Pelo que você contou, a rotina e as distrações acabam ocupando o espaço que poderia ser de vocês.";
  } else if (hasRoutine) {
    firstParagraph =
      "Pelo que você contou, o tempo está espremendo as conversas antes que elas realmente comecem.";
  } else if (hasDistraction) {
    firstParagraph =
      "Pelo que você contou, as distrações interrompem a presença de vocês antes da conversa ganhar profundidade.";
  } else if (hasHardStart) {
    firstParagraph =
      "Pelo que você contou, o mais difícil parece ser encontrar uma porta de entrada que não soe forçada.";
  } else if (hasFear) {
    firstParagraph =
      "Pelo que você contou, existe vontade de falar, mas também cuidado para não deixar o clima pesado.";
  } else if (hasFatigue) {
    firstParagraph =
      "Pelo que você contou, o cansaço tem chegado antes do espaço para uma conversa diferente.";
  }

  const feelingLabels: Record<string, string> = {
    encontrou: "proximidade",
    riu: "leveza",
    entende: "segurança",
    quimica: "desejo",
    intimidade: "intimidade",
    descobriu: "curiosidade",
  };
  const desiredFeelings = feelings
    .map((feeling) => feelingLabels[feeling])
    .filter(Boolean);
  const desiredText =
    desiredFeelings.length > 0
      ? desiredFeelings.length === 1
        ? desiredFeelings[0]
        : `${desiredFeelings.slice(0, -1).join(", ")} e ${
            desiredFeelings[desiredFeelings.length - 1]
          }`
      : "mais proximidade";
  const secondParagraph = `Uma pergunta certa cria espaço para você buscar ${desiredText} sem precisar começar com uma conversa difícil.`;

  const automaticScore = Math.min(
    92,
    Math.max(
      34,
      42 +
        obstacles.length * 7 +
        (mappedResponse === "superficial" ? 9 : 0) +
        (mappedResponse === "muda-assunto" ? 7 : 0),
    ),
  );
  const noveltyScore = Math.min(
    94,
    Math.max(
      54,
      58 +
        topics.length * 5 +
        feelings.length * 4 +
        (read("desejo_noite") ? 6 : 0) -
        obstacles.length * 2,
    ),
  );

  return {
    firstParagraph,
    secondParagraph,
    metrics: [
      { label: "Conversa no automático", value: automaticScore },
      { label: "Espaço para novidade", value: noveltyScore },
    ],
  };
}

function Lp1InfoScreen({
  screen,
  answers,
  onContinue,
}: {
  screen: Lp1NarrativeScreen;
  answers: Lp1Answers;
  onContinue: () => void;
}) {
  const isProofScreen = screen.id === "s08-prova";
  const isEducationScreen = screen.id === "s14-educacao";
  const isBeliefScreen = screen.id === "s13b-crenca";
  const educationInsight = isEducationScreen
    ? getLp1EducationInsight(answers)
    : null;

  return (
    <section
      className={`lp1-info-screen ${isProofScreen ? "lp1-proof-screen" : ""} ${
        isEducationScreen || isBeliefScreen ? "lp1-education-screen" : ""
      }`}
      data-section-name={screen.id}
    >
      {isProofScreen ? (
        <div className="lp1-proof-stat">{screen.eyebrow}</div>
      ) : screen.eyebrow && !isEducationScreen ? (
        <p className="lp1-quiz-eyebrow">{screen.eyebrow}</p>
      ) : null}
      <h1 className="lp1-quiz-title">{screen.title}</h1>
      {isProofScreen ? (
        <div className="lp1-proof-art">
          <img
            src="/proof-couples-orbits.png"
            alt="Casais conectados em círculos ao redor de um casal"
          />
        </div>
      ) : null}
      {isEducationScreen && educationInsight ? (
        <div className="lp1-education-panel">
          <p className="lp1-education-panel-title">POR QUE ISSO IMPORTA?</p>
          <p className="lp1-education-body">{educationInsight.firstParagraph}</p>
          <p className="lp1-education-body">{educationInsight.secondParagraph}</p>
          <div className="lp1-education-metrics">
            {educationInsight.metrics.map((metric) => (
              <div className="lp1-education-metric" key={metric.label}>
                <div className="lp1-education-metric-heading">
                  <span>{metric.label}</span>
                  <strong>{metric.value}%</strong>
                </div>
                <div className="lp1-education-meter" aria-hidden="true">
                  <span
                    style={
                      { "--meter-value": `${metric.value}%` } as CSSProperties
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isBeliefScreen ? (
        <div className="lp1-education-panel lp1-belief-panel">
          <p className="lp1-education-panel-title">O QUE ISSO TIRA DO CAMINHO</p>
          <ul className="lp1-belief-list">
            {screen.body?.map((paragraph) => (
              <li key={paragraph}>{paragraph}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {screen.body?.map((paragraph) => (
            <p className="lp1-info-body" key={paragraph}>
              {isProofScreen ? (
                <>
                  Casais que reservam alguns minutos para conversar{" "}
                  <strong>relatam mais proximidade</strong> depois de usar as nossas
                  perguntas.
                </>
              ) : (
                paragraph
              )}
            </p>
          ))}
          {screen.source ? <p className="lp1-info-source">Fonte: {screen.source}</p> : null}
        </>
      )}
      <button type="button" className="lp1-quiz-next lp1-quiz-full-cta" onClick={onContinue}>
        {isEducationScreen || isBeliefScreen ? "Faz sentido" : screen.cta}{" "}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

const lp1ClimateImagePreloadCache = new Map<string, Promise<void>>();

function preloadLp1ClimateImage(src: string) {
  const cached = lp1ClimateImagePreloadCache.get(src);
  if (cached) return cached;

  const preload = new Promise<void>((resolve) => {
    const image = document.createElement("img");
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
  lp1ClimateImagePreloadCache.set(src, preload);
  return preload;
}

function Lp1ClimatePicker({
  question,
  cardIndex,
  verdicts,
  onVerdict,
}: {
  question: Lp1Question;
  cardIndex: number;
  verdicts: Record<string, Lp1CartaVerdict>;
  onVerdict: (climateValue: string, verdict: Lp1CartaVerdict) => void;
}) {
  const [isPreparing, setIsPreparing] = useState(false);
  const option = question.options[cardIndex] ?? question.options[0];
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    question.options.forEach((climateOption) => {
      if (climateOption.imageSrc) {
        void preloadLp1ClimateImage(climateOption.imageSrc);
      }
    });
  }, [question.options]);

  useEffect(() => {
    setDirection(null);
    setDragX(0);
    setShowConfetti(false);
    setIsPreparing(false);
  }, [option?.value]);

  if (!option) return null;

  const verdict = verdicts[option.value];
  const choose = (nextVerdict: Lp1CartaVerdict) => {
    if (direction || isPreparing) return;

    const nextOption = question.options[cardIndex + 1];
    const commitChoice = () => {
      setIsPreparing(false);
      setDirection(nextVerdict === "nao" ? "left" : "right");
      if (nextVerdict === "sim") {
        navigator.vibrate?.(12);
        setShowConfetti(true);
        window.setTimeout(() => setShowConfetti(false), 420);
      }
      window.setTimeout(() => onVerdict(option.value, nextVerdict), 220);
    };

    if (nextOption?.imageSrc) {
      setIsPreparing(true);
      void preloadLp1ClimateImage(nextOption.imageSrc).then(commitChoice);
      return;
    }

    commitChoice();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (direction) return;
    pointerStart.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null || direction) return;
    setDragX(event.clientX - pointerStart.current);
  };

  const handlePointerUp = () => {
    if (pointerStart.current === null || direction) return;
    const currentDrag = dragX;
    pointerStart.current = null;
    setDragX(0);
    if (Math.abs(currentDrag) >= 56) {
      choose(currentDrag < 0 ? "nao" : "sim");
    }
  };

  return (
    <section className="lp1-climate-screen" data-section-name={question.id}>
      {question.eyebrow ? (
        <p className="lp1-quiz-eyebrow">{question.eyebrow}</p>
      ) : null}
      <h1 className="lp1-quiz-title">{question.title}</h1>
      {question.subtitle ? (
        <p className="lp1-quiz-subtitle">{question.subtitle}</p>
      ) : null}
      <div
        className={`lp1-climate-card ${
          direction ? `is-leaving-${direction}` : ""
        }`}
        style={
          dragX
            ? {
                transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`,
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {option.imageSrc ? (
          <img
            className="lp1-climate-card-image"
            src={option.imageSrc}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div
          className={`lp1-climate-card-fallback ${
            option.imageSrc ? "has-image" : ""
          }`}
          aria-hidden="true"
        >
          <span>{option.icon}</span>
        </div>
        <div className="lp1-climate-card-scrim" aria-hidden="true" />
        <div className="lp1-climate-card-copy">
          <strong>
            {option.icon} {option.label}
          </strong>
          <span>{option.description}</span>
        </div>
      </div>
      <div className="lp1-climate-verdicts" aria-label={`Avaliar clima ${option.label}`}>
        {(
          [
            ["nao", "← Outro clima"],
            ["talvez", "Talvez"],
            ["sim", "Esse clima →"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`lp1-climate-verdict ${
              verdict === value ? "is-selected" : ""
            }`}
            onClick={() => choose(value)}
            aria-pressed={verdict === value}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="lp1-climate-count">
        {cardIndex + 1} de {question.options.length} climas
      </p>
      {showConfetti ? <Lp1Confetti /> : null}
    </section>
  );
}

function Lp1QuestionOptions({
  question,
  selectedValue,
  onSelect,
}: {
  question: Lp1Question;
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  const selectedValues = selectedValue.split(",").filter(Boolean);
  const isMulti = question.format === "multi";
  const isImageCardQuestion =
    question.id === "s03-tempo" || question.id === "s09-desejo-noite";

  return (
    <div className={`lp1-quiz-options lp1-quiz-format-${question.format}`}>
      {question.format === "slider" ? (
        <>
          <input
            type="range"
            min={1}
            max={question.options.length}
            step={1}
            value={selectedValue || 3}
            className="lp1-quiz-slider"
            onChange={(event) => onSelect(event.target.value)}
            aria-label={question.title}
          />
          <div className="lp1-quiz-slider-labels">
            <span>{question.options[0]?.label}</span>
            <span>{question.options[question.options.length - 1]?.label}</span>
          </div>
        </>
      ) : question.format === "scale" ? (
        <div className="lp1-scale-wrap">
          <div className="lp1-scale-buttons">
            {question.options.map((option, index) => {
              const isSelected = selectedValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`lp1-scale-block ${isSelected ? "is-selected" : ""}`}
                  onClick={() => onSelect(option.value)}
                  aria-pressed={isSelected}
                  aria-label={option.label}
                  data-testid={`button-lp1-quiz-${question.key}-${option.value}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="lp1-scale-labels">
            <span>{question.scaleEnds?.[0] ?? question.options[0]?.label}</span>
            <span>
              {question.scaleEnds?.[1] ??
                question.options[question.options.length - 1]?.label}
            </span>
          </div>
        </div>
      ) : (
        question.options.map((option) => {
          const isSelected = isMulti
            ? selectedValues.includes(option.value)
            : selectedValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`lp1-quiz-option ${isSelected ? "is-selected" : ""}`}
              onClick={() => onSelect(option.value)}
              data-testid={`button-lp1-quiz-${question.key}-${option.value}`}
              aria-pressed={isSelected}
            >
              {isImageCardQuestion ? (
                <span className="lp1-quiz-option-visual" aria-hidden="true">
                  {option.imageSrc ? (
                    <>
                      <img
                        className="lp1-thumb"
                        src={option.imageSrc}
                        alt=""
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const fallback = event.currentTarget
                            .nextElementSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = "grid";
                        }}
                      />
                      {option.icon ? (
                        <span
                          className="lp1-quiz-option-icon lp1-image-fallback"
                          aria-hidden="true"
                        >
                          {option.icon}
                        </span>
                      ) : null}
                    </>
                  ) : option.icon ? (
                    <span className="lp1-quiz-option-icon">{option.icon}</span>
                  ) : null}
                </span>
              ) : option.imageSrc ? (
                <>
                  <img
                    className="lp1-thumb"
                    src={option.imageSrc}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                      const fallback = event.currentTarget
                        .nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "grid";
                    }}
                  />
                  {option.icon ? (
                    <span
                      className="lp1-quiz-option-icon lp1-image-fallback"
                      aria-hidden="true"
                    >
                      {option.icon}
                    </span>
                  ) : null}
                </>
              ) : question.emoji && option.icon ? (
                <span className="lp1-quiz-option-icon" aria-hidden="true">
                  {option.icon}
                </span>
              ) : null}
              <span className="lp1-quiz-option-label">{option.label}</span>
              {isMulti ? <span className="lp1-multi-label-bar">{option.label}</span> : null}
              {isSelected ? (
                <Check className="lp1-quiz-option-check" size={18} aria-hidden="true" />
              ) : null}
              {isSelected && option.expand ? (
                <span className="lp1-quiz-option-expand">{option.expand}</span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}

const CAROUSEL_ROUNDS: {
  theme: string;
  kind: "tema" | "vibe";
  text: string;
}[][] = [
  [
    {
      theme: "lá atrás",
      kind: "tema",
      text: "Que lembrança da sua infância ainda molda quem você é hoje?",
    },
    {
      theme: "faísca",
      kind: "vibe",
      text: "Qual é uma coisa que te excita em mim e que poucas pessoas sabem?",
    },
    {
      theme: "em voz alta",
      kind: "tema",
      text: "Se nada fosse impossível, como você imagina nossa vida daqui a 5 anos?",
    },
  ],
  [
    {
      theme: "porto seguro",
      kind: "tema",
      text: "Qual foi a última vez que você se sentiu completamente em casa comigo?",
    },
    {
      theme: "livro aberto",
      kind: "tema",
      text: "Qual medo você tem sobre nós que ainda não me disse?",
    },
    {
      theme: "modo leve",
      kind: "tema",
      text: "Qual foi a coisa mais boba que já rimos juntos até hoje?",
    },
  ],
  [
    {
      theme: "você não sabia",
      kind: "tema",
      text: "Existe algo que você sempre quis me contar e nunca teve coragem?",
    },
    {
      theme: "viagens",
      kind: "tema",
      text: "Qual lugar você ainda sonha em conhecer comigo?",
    },
    {
      theme: "depois da tempestade",
      kind: "tema",
      text: "O que você aprendeu sobre nós depois da nossa pior briga?",
    },
  ],
  [
    {
      theme: "carreira & dinheiro",
      kind: "tema",
      text: "Como você imagina que vamos dividir as contas daqui a 10 anos?",
    },
    {
      theme: "luzes baixas",
      kind: "vibe",
      text: "O que você faria se soubesse que eu não ia julgar?",
    },
    {
      theme: "mesmo longe",
      kind: "vibe",
      text: "O que mais faz falta em nós quando estamos distantes?",
    },
  ],
  [
    {
      theme: "perto de novo",
      kind: "vibe",
      text: "Qual gesto meu, mesmo pequeno, ainda te desarma?",
    },
    {
      theme: "fogo alto",
      kind: "vibe",
      text: "Existe algum desejo seu que você ainda não teve coragem de dividir comigo?",
    },
    {
      theme: "em voz alta",
      kind: "tema",
      text: "Se pudéssemos recomeçar do zero, o que você mudaria em nós?",
    },
  ],
];

function QuestionCarousel() {
  const [round, setRound] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const goTo = (next: number) => {
    if (spinning) return;
    setSpinning(true);
    window.setTimeout(() => {
      setRound(
        ((next % CAROUSEL_ROUNDS.length) + CAROUSEL_ROUNDS.length) %
          CAROUSEL_ROUNDS.length,
      );
      setSpinning(false);
    }, 260);
  };

  return (
    <div className="lp-carousel">
      <button
        type="button"
        onClick={() => goTo(round - 1)}
        className="lp-carousel-arrow"
        aria-label="Perguntas anteriores"
        data-testid="button-carousel-prev"
      >
        <ChevronLeft size={20} />
      </button>
      <div className={`lp-carousel-track ${spinning ? "is-spinning" : ""}`}>
        {CAROUSEL_ROUNDS[round].map((card, index) => (
          <div
            key={`${round}-${index}`}
            className={`lp-mock-card lp-carousel-card ${card.kind === "vibe" ? "lp-mock-card-back" : ""}`}
          >
            <span
              className={`lp-mock-tag ${card.kind === "vibe" ? "lp-mock-tag-vibe" : ""}`}
            >
              {card.theme}
            </span>
            <p className="lp-mock-text">"{card.text}"</p>
            <Heart size={15} className="lp-carousel-heart" />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => goTo(round + 1)}
        className="lp-carousel-arrow"
        aria-label="Próximas perguntas"
        data-testid="button-carousel-next"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

function QuestionCarouselSection() {
  return (
    <section className="lp-carousel-section">
      <div className="lp-container">
        <p className="lp-eyebrow lp-eyebrow-center">
          algumas perguntas que vocês vão encontrar
        </p>
        <QuestionCarousel />
        <p className="lp-solution-note">
          Mais de 459 perguntas originais esperando por vocês.
        </p>
      </div>
    </section>
  );
}

function TestimonialCarousel({ variant = "default" }: { variant?: "lp1" | "default" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const move = (direction: -1 | 1, step = 1) => {
    setActiveIndex(
      (current) =>
        (current + direction * step + testimonialImages.length) %
        testimonialImages.length,
    );
  };

  const selectTestimonial = (index: number) => {
    setActiveIndex(index);
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartX.current = null;

    if (startX === null || endX === undefined) return;

    const distance = endX - startX;
    if (Math.abs(distance) < 44) return;

    move(distance < 0 ? 1 : -1);
  };

  const visibleIndexes = [
    activeIndex,
    (activeIndex + 1) % testimonialImages.length,
  ];

  return (
    <section
      className="lp-social"
      id={variant === "lp1" ? "lp1-depoimentos" : undefined}
      data-section-name="depoimentos"
    >
      <div className="lp-container">
        <p className="lp-eyebrow lp-eyebrow-center">o que dizem</p>
        <h2 className="lp-h2">
          Casais que já usaram
          <br />
          <em>e voltaram para mais uma.</em>
        </h2>
        <div
          className="lp-testimonial-carousel"
          aria-roledescription="carrossel"
          aria-label="Depoimentos de casais"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStartX.current = null;
          }}
        >
          <button
            type="button"
            className="lp-testimonial-arrow"
            onClick={() => move(-1, 2)}
            aria-label="Depoimento anterior"
            data-testid="button-testimonial-previous"
          >
            <ChevronLeft size={20} />
          </button>
          <div
            className="lp-testimonial-slides"
            aria-live="polite"
          >
            {visibleIndexes.map((index) => (
              <div className="lp-testimonial lp-testimonial-active" key={index}>
                <img
                  className="lp-testimonial-image"
                  src={testimonialImages[index]}
                  alt={`Depoimento de casal ${index + 1}`}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="lp-testimonial-arrow"
            onClick={() => move(1, 2)}
            aria-label="Próximo depoimento"
            data-testid="button-testimonial-next"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div
          className="lp-testimonial-dots"
          role="tablist"
          aria-label="Escolher depoimento"
        >
          {testimonialImages.map((image, index) => (
            <button
              key={image}
              type="button"
              className={`lp-testimonial-dot ${index === activeIndex ? "is-active" : ""}`}
              onClick={() => selectTestimonial(index)}
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Ver depoimento ${index + 1}`}
              data-testid={`button-testimonial-dot-${index + 1}`}
            />
          ))}
        </div>
        <p className="lp-tiny-note">
          Histórias de casais que começaram uma conversa por aqui.
        </p>
      </div>
    </section>
  );
}

function LandingV2Quiz({
  onBuy,
  onHeroBuy,
  onThemePeek,
  checkoutOpen,
  onStartQuiz,
}: {
  onBuy: () => void;
  onHeroBuy: () => void;
  onThemePeek: (themeId: string) => void;
  checkoutOpen: boolean;
  onStartQuiz: () => void;
}) {
  const pricing = usePricing();
  const [peekThemeId, setPeekThemeId] = useState<string | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(true);
  const themePointerRef = useRef<{
    x: number;
    y: number;
    dragged: boolean;
  } | null>(null);
  const themes: Array<[string, string, string, string]> = [
    ["Porto Seguro", "As conversas que parecem casa.", "31 cartas", "porto-seguro"],
    ["Livro Aberto", "Sem filtro, cara a cara.", "31 cartas", "livro-aberto"],
    ["Você Não Sabia", "Descobertas que ainda cabem entre vocês.", "32 cartas", "voce-nao-sabia"],
    ["Em Voz Alta", "A vida que os dois querem construir.", "30 cartas", "em-voz-alta"],
    ["Lá Atrás", "O que formou quem você é hoje.", "28 cartas", "la-atras"],
    ["Modo Leve", "Pra rir e não levar tão a sério.", "31 cartas", "modo-leve"],
    ["Viagens", "Lugares que já foram e ainda vão ser.", "30 cartas", "viagens"],
    ["Carreira & Dinheiro", "Como pensam o lado prático.", "30 cartas", "carreira-dinheiro"],
    ["Depois da Tempestade", "O caminho de volta.", "30 cartas", "depois-da-tempestade"],
    ["Faísca", "O lado mais provocante de vocês.", "31 cartas", "faisca"],
    ["Luzes Baixas", "Quando a noite pede mais coragem. 18+", "35 cartas", "luzes-baixas"],
    ["Fogo Alto", "Desejos, curiosidades, limites. 18+", "30 cartas", "fogo-alto"],
    ["Sem Freio", "O mais ousado. Só pra quem topa. 18+", "30 cartas", "sem-freio"],
    ["Mesmo Longe", "Quando rotina ou distância afastam.", "30 cartas", "mesmo-longe"],
    ["Perto de Novo", "Esquentar o espaço entre vocês.", "30 cartas", "perto-de-novo"],
  ];
  const handleThemePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    themePointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      dragged: false,
    };
  };
  const handleThemePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = themePointerRef.current;
    if (!pointer || pointer.dragged) return;
    if (
      Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 8
    ) {
      pointer.dragged = true;
    }
  };
  const openThemePeek = (themeId: string) => {
    if (themePointerRef.current?.dragged) {
      themePointerRef.current = null;
      return;
    }
    themePointerRef.current = null;
    setPeekThemeId(themeId);
    onThemePeek(themeId);
  };

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-section-name="hero"], [data-section-name="quiz"], [data-section-name="precos"], [data-section-name="final"]',
      ),
    );
    if (sections.length === 0) return;

    const hiddenSections = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            hiddenSections.add(entry.target as HTMLElement);
          } else {
            hiddenSections.delete(entry.target as HTMLElement);
          }
        });
        setShowStickyCta(hiddenSections.size === 0);
      },
      { threshold: 0.12 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span
        id="como-funciona"
        className="lp-anchor-target"
        aria-hidden="true"
      />
      <span id="lp-precos" className="lp-anchor-target" aria-hidden="true" />
      <span id="lp2-quiz" className="lp-quiz-route-marker" aria-hidden="true" />
      <section className="lp-hero lp2-hero" data-section-name="hero">
        <div className="lp-hero-inner">
          <span className="lp-eyebrow lp2-hero-eyebrow">
            baralho digital de perguntas · para casais
          </span>
          <picture className="lp-hero-foto">
            <source
              media="(min-width: 700px)"
              srcSet="/hero/hero-casal-novo-desktop.webp"
            />
            <source
              media="(max-width: 699px)"
              srcSet="/hero/hero-casal-novo-mobile.webp"
            />
            <img
              src="/hero/hero-casal-novo-mobile.webp"
              alt="Um casal conversando à noite, com o baralho aberto no celular"
              width={900}
              height={600}
              fetchPriority="high"
              loading="eager"
            />
          </picture>
          <div className="lp-hero-copy">
            <h1 className="lp-hero-h1">
              E se ele responder{" "}
              <span className="lp2-hero-emphasis">"sei lá"</span>?
            </h1>
            <p className="lp-hero-sub">
              Você quer a conversa. Ele responde "sei lá", e morre ali. O problema
              nunca foi ele: era a pergunta. São 459 perguntas escritas pra abrir
              sozinhas. Vocês leem uma carta em voz alta e escutam.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartQuiz}
            className="lp-cta-primary lp-cta-big lp2-hero-cta"
            data-testid="button-hero-cta-v2"
          >
            Fazer o teste grátis de 1 minuto <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={onHeroBuy}
            className="lp-cta-secondary-link"
            data-testid="link-hero-quiz"
          >
            Já sei o que quero: comprar agora →
          </button>
          <p className="lp2-hero-security">
            🔒 {pricing.pixAvailable ? "Pix e cartão" : "Cartão"} · 7 dias de
            garantia. Não gostou, devolvo. Você decide.
          </p>
        </div>
      </section>
      <Lp1MechanismSection />
      <section className="lp2-story" data-section-name="historia">
        <div className="lp-container lp2-story-narrow">
          <p className="lp-eyebrow">a real sobre o que acontece</p>
          <div className="lp2-story-body">
            <p className="lp2-story-lead">
              <strong>Você já tentou.</strong>
            </p>
            <p>
              Você escolheu a hora, criou coragem e disse: "vamos conversar."
            </p>
            <p>
              E veio o <strong>"sei lá"</strong>. Ou o "sobre o quê?". Ou o
              "tá tudo bem, por quê?". Ou o silêncio de quem não entendeu que
              era pra ser sério.
            </p>
            <div className="lp2-story-pull">
              "Nem precisei ler pra saber que a resposta dele pra todas seria:
              não sei."
            </div>
            <p>
              Aí você desiste um pouco. Da próxima vez você já não tenta,
              porque sabe como termina. E o silêncio deixa de ser uma noite ruim
              e vira o normal de vocês.
            </p>
            <p>
              <strong>Só que ele não estava fugindo de você.</strong>
            </p>
            <p>
              "Vamos conversar" não é uma pergunta — <strong>é uma cobrança</strong>.
              Ela pede que o outro traga alguma coisa sem dizer o quê. Ninguém
              sabe responder isso. Nem você saberia, se ele perguntasse primeiro.
            </p>
            <p>Agora repara na diferença:</p>
            <p className="lp2-story-example">
              <em>"Você se arrepende de algo sobre a nossa história até aqui?"</em>
            </p>
            <p>
              Essa tem resposta. Ela chega com o assunto pronto, ninguém precisa
              inventar por onde começar, e ela abre uma porta que os dois
              queriam abrir há meses.
            </p>
            <p>
              <strong>O problema nunca foi ele. Era a pergunta.</strong>
            </p>
            <p>
              <strong>Vocês não são um casal que parou de conversar.</strong>
            </p>
            <p>
              São um casal que ficou sem as perguntas certas. É isso que a gente
              construiu.
            </p>
            <p>
              E quando a pergunta certa aparece, a conversa volta. Depois dela
              costuma sobrar uma paz meio esquisita de boa: a de quem foi
              escutado de verdade.
            </p>
          </div>
        </div>
      </section>
      <Lp1ComparisonSection />
      <div className="lp-benefit-marquee" aria-label="Destaques do baralho">
        <div className="lp-benefit-marquee-track">
          <div className="lp-benefit-marquee-group">
            <span className="lp-benefit-marquee-item">459 perguntas</span>
            <span className="lp-benefit-marquee-item">15 baralhos</span>
            <span className="lp-benefit-marquee-item">jogo a distância</span>
            <span className="lp-benefit-marquee-item">acesso vitalício</span>
            <span className="lp-benefit-marquee-item">garantia 7 dias</span>
          </div>
          <div
            className="lp-benefit-marquee-group"
            aria-hidden="true"
          >
            <span className="lp-benefit-marquee-item">459 perguntas</span>
            <span className="lp-benefit-marquee-item">15 baralhos</span>
            <span className="lp-benefit-marquee-item">jogo a distância</span>
            <span className="lp-benefit-marquee-item">acesso vitalício</span>
            <span className="lp-benefit-marquee-item">garantia 7 dias</span>
          </div>
        </div>
      </div>
      <section
        className="lp-solution lp2-proposta"
        data-section-name="proposta"
      >
        <div className="lp-container">
          <p className="lp-eyebrow lp-eyebrow-center">a proposta</p>
          <h2 className="lp-h2">
            São perguntas prontas que vocês podem
            <br />
            <em>transformar em ritual começando hoje.</em>
          </h2>
          <p className="lp-solution-lede">
            459 perguntas escritas pra tirar a conversa do automático. Sem
            clichê, sem "qual seu animal favorito".
          </p>
          <p className="lp-solution-lede">
            Vocês abrem uma carta, leem em voz alta e escutam.
          </p>
          <p className="lp-solution-lede">
            Separem 10 minutos e vejam onde a conversa vai.
          </p>
          <div className="lp-solution-pillars lp1-two-pillars">
            <div className="lp-pillar">
              <div className="lp-pillar-icon">
                <Timer aria-hidden="true" size={30} strokeWidth={1.6} />
              </div>
              <div className="lp-pillar-copy">
                <strong>10 minutos por noite</strong>
                <p>
                  Não exige terapia, retiro nem fim de semana livre. Só uma carta
                  por vez.
                </p>
              </div>
            </div>
            <div className="lp-pillar">
              <div className="lp-pillar-icon">
                <HeartHandshake
                  aria-hidden="true"
                  size={30}
                  strokeWidth={1.6}
                />
              </div>
              <div className="lp-pillar-copy">
                <strong>Funciona à distância</strong>
                <p>
                  Namoro à distância, viagem a trabalho ou cada um no seu canto:
                  <strong> vocês respondem ao mesmo tempo, cada um no seu celular.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        className="lp-themes lp2-themes"
        id="lp2-pacotes"
        data-section-name="pacotes"
      >
        <div className="lp-container">
          <p className="lp-eyebrow lp-eyebrow-center">o que tem dentro</p>
          <h2 className="lp-h2">
            15 baralhos + o bônus do dia,
            <br />
            <em>para escolher o assunto da noite.</em>
          </h2>
          <p className="lp-themes-scroll-hint" aria-hidden="true">
            Deslize para ver todos os baralhos →
          </p>
          <div
            className="lp-themes-carousel"
            aria-label="Baralhos disponíveis"
            onPointerDown={handleThemePointerDown}
            onPointerMove={handleThemePointerMove}
          >
            {themes.map(([name, description, count, themeId], index) => (
              <button
                key={name}
                type="button"
                className={`lp-theme-card ${index > 8 ? "lp-theme-vibe" : ""}`}
                onClick={() => openThemePeek(themeId)}
                data-testid={`button-lp-theme-${themeId}`}
              >
                <img
                  className="lp-theme-card-photo"
                  src={themeBackgroundUrl(themeId) ?? ""}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  width="736"
                  height="920"
                />
                <span className="lp-theme-card-shade" aria-hidden="true" />
                <span className="lp-theme-card-body">
                  <strong>{name}</strong>
                  <p>{description}</p>
                  <span>{count}</span>
                </span>
              </button>
            ))}
            <div className="lp-theme-card lp-theme-bonus">
              <span className="lp-theme-bonus-badge">bônus</span>
              <span className="lp-theme-card-body">
                <strong>Baralho do Dia</strong>
                <p>
                  Um baralho montado na hora, de acordo com o que vocês estão
                  sentindo hoje.
                </p>
                <span>novo todo dia</span>
              </span>
            </div>
          </div>
          <p className="lp-themes-note">
            <strong>459 perguntas no total.</strong> Novos baralhos entram de
            tempos em tempos. O acesso é vitalício.
          </p>
        </div>
      </section>
      <TestimonialCarousel variant="lp1" />
      <section className="lp-price" id="lp2-precos" data-section-name="precos">
        <div className="lp-container">
          <p className="lp-eyebrow lp-eyebrow-center">acesso vitalício</p>
          <h2 className="lp-h2">
            Hoje pode ser mais uma noite
            <br />
            <em>cada um no seu celular.</em>
          </h2>
          <p className="lp2-section-lede lp1-price-context">
            Ou vocês podem estar tendo a conversa de verdade daqui a dez
            minutos. São 3 passos:
          </p>
          <p className="lp1-price-proof">212 mil salvamentos no TikTok</p>
          <div className="lp1-price-stack">
            <div className="lp-price-card lp1-price-card lp1-price-steps-card">
              <ol className="lp1-price-steps">
                <li>
                  <span className="lp1-price-step-number" aria-hidden="true">
                    1
                  </span>
                  <span className="lp1-price-step-copy">
                    <strong>Você paga.</strong>{" "}
                    {pricing.pixAvailable
                      ? "Pix cai na hora e o acesso abre sozinho."
                      : "O acesso abre sozinho, na hora."}
                  </span>
                </li>
                <li>
                  <span className="lp1-price-step-number" aria-hidden="true">
                    2
                  </span>
                  <span className="lp1-price-step-copy">
                    <strong>Convida ele(a).</strong> Um link. A pessoa entra sem
                    pagar de novo.
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
            <Lp1PriceCard
              fullPricing={pricing}
              onBuy={onBuy}
              testId="button-price-cta-v2"
              showBenefits
              className="lp1-price-benefits-card"
            />
          </div>
        </div>
      </section>
      <section className="lp-faq" id="lp2-faq" data-section-name="faq">
        <div className="lp-container">
          <p className="lp-eyebrow lp-eyebrow-center">dúvidas frequentes</p>
          <h2 className="lp-h2">Antes que você pergunte</h2>
          <div className="lp-faq-list">
            {[
              [
                "E se eu é que não souber responder?",
                'Acontece com todo mundo, e é por isso que a primeira carta de cada baralho é leve. Você não precisa de resposta pronta: pode dizer "nunca pensei nisso" e pensar em voz alta junto. Metade das boas conversas nasce aí.',
              ],
              [
                "Isso substitui terapia de casal?",
                "Não, e nem promete isso. É um empurrão pra vocês conversarem sozinhos. Não substitui acompanhamento se a relação precisa. Mas pra sair do piloto automático, resolve hoje à noite.",
              ],
              [
                'Por que não só "vamos conversar"?',
                'Porque "vamos conversar" trava: ninguém sabe por onde começar. O baralho já traz a pergunta certa, na ordem certa, do leve ao profundo.',
              ],
              [
                "Precisa instalar algum aplicativo?",
                "Não. É 100% online, roda no navegador do celular ou do computador.",
              ],
              [
                "E se meu parceiro achar estranho?",
                "É o mais comum. Por isso os baralhos começam leves: você escolhe o clima. Ninguém é obrigado a abrir nada antes de querer.",
              ],
              [
                "Funciona à distância?",
                "Sim. Vocês criam uma sala online e jogam sincronizados, cada um no seu aparelho.",
              ],
              [
                "É vitalício mesmo?",
                "Sim. Paga uma vez, usa pra sempre, incluindo os baralhos novos que entram depois.",
              ],
              [
                "Como recebo depois de pagar?",
                pricing.pixAvailable
                  ? "Na hora. Você paga com Pix ou cartão, e o acesso abre automaticamente assim que a confirmação chega. O Pix cai na hora."
                  : "Na hora. Você paga com cartão e o acesso abre automaticamente assim que a confirmação chega.",
              ],
              [
                `Por que ${pricing.display}?`,
                `459 perguntas escritas e testadas uma a uma, ao longo de meses. O servidor que mantém o jogo no ar e sincroniza vocês dois. E as perguntas novas que entram sem você pagar de novo. Você paga uma vez e fica com tudo. ${pricing.unitNote}.`,
              ],
            ].map(([question, answer]) => (
              <details key={question} className="lp-faq-item">
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <footer className="lp-footer">
        <div className="lp-container">
          <p className="lp-footer-brand">Perguntas de Conexão</p>
          <p className="lp-footer-legal">
            Perguntas de Conexão · CNPJ 57.412.420/0001-00
          </p>
          <nav className="lp-footer-links" aria-label="Links legais">
            <Link href="/termos">Termos de uso</Link>
            <Link href="/privacidade">Privacidade</Link>
            <a href="mailto:perguntasdeconexao@gmail.com">Contato</a>
          </nav>
        </div>
      </footer>
      {showStickyCta && !peekThemeId && !checkoutOpen ? (
        <div className="lp-sticky-cta" aria-label="Começar agora">
          <button
            type="button"
            onClick={onBuy}
            className="lp-cta-primary lp-sticky-cta-button"
            data-testid="button-sticky-cta-v2"
          >
            Começar hoje à noite <ArrowRight size={18} />
          </button>
          <span>Acesso imediato · Pagamento seguro · Garantia de 7 dias</span>
        </div>
      ) : null}
      {peekThemeId
        ? (() => {
            const peek = getThemePeek(peekThemeId);
            return peek ? (
              <ThemePeekDialog
                peek={peek}
                onClose={() => setPeekThemeId(null)}
                onBuy={() => {
                  setPeekThemeId(null);
                  onBuy();
                }}
              />
            ) : null;
          })()
        : null}
    </>
  );
}

function Shell({
  children,
  dark = false,
  showSiteFooter = true,
  supportAction,
}: {
  children: ReactNode;
  dark?: boolean;
  showSiteFooter?: boolean;
  supportAction?: {
    label: string;
    onClick: () => void;
  };
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`site-shell ${dark ? "shell-dark" : ""}`}>
      <header className="site-header">
        <BrandLogo inverse={dark} />
        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`}>
        </nav>
        <Link
          href="/login"
          className="header-cta"
          data-testid="link-header-cta"
        >
          Abrir meu baralho <ArrowRight size={16} />
        </Link>
        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menu"
          data-testid="button-menu"
        >
          <Menu size={22} />
        </button>
      </header>
      {children}
      {showSiteFooter ? (
        <SiteFooter supportAction={supportAction} />
      ) : null}
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function InstallAppPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (
      isStandaloneApp() ||
      safeGetItem("conexao-install-dismissed") === "true"
    )
      return;

    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(iosDevice);
    if (iosDevice) setVisible(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const dismiss = () => {
    safeSetItem("conexao-install-dismissed", "true");
    setVisible(false);
  };

  const install = async () => {
    if (isIos || !installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setInstallEvent(null);
  };

  if (!visible) return null;

  return (
    <aside className="app-install-prompt" data-testid="card-install-app">
      <div className="app-install-icon">
        <Download size={17} />
      </div>
      <div className="app-install-copy">
        <strong>Abra direto no app</strong>
        {isIos ? (
          <small>
            Toque em Compartilhar e depois em “Adicionar à Tela de Início”.
          </small>
        ) : (
          <small>
            Adicione à tela de início para voltar sem passar pela página de
            vendas.
          </small>
        )}
      </div>
      {!isIos && (
        <button
          onClick={install}
          className="app-install-action"
          data-testid="button-install-app"
        >
          Adicionar
        </button>
      )}
      <button
        onClick={dismiss}
        className="app-install-dismiss"
        aria-label="Fechar convite de instalação"
        data-testid="button-dismiss-install"
      >
        Agora não
      </button>
    </aside>
  );
}

function StoredAccessGate() {
  const [, navigate] = useLocation();
  const storedSessionId = safeGetItem("conexao-session")?.trim() || "";
  const storedGuestToken = safeGetItem("conexao-guest-token")?.trim() || "";
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
  const hasStoredAccess = !!storedSessionId || !!storedGuestToken;
  const isChecking =
    (storedSessionId && sessionQuery.isPending) ||
    (storedGuestToken && guestQuery.isPending);

  useEffect(() => {
    const wantsToBuy =
      typeof window !== "undefined" &&
      (window.location.hash === "#pacotes" ||
        new URLSearchParams(window.location.search).get("comprar") === "1");
    if (wantsToBuy) return;
    const ownerReady =
      sessionQuery.isSuccess && sessionQuery.data.accessGranted;
    const guestReady = guestQuery.isSuccess && guestQuery.data.hasAccess;
    if (!ownerReady && !guestReady) return;
    const onboardingDone = storedGuestToken
      ? Boolean(
          (guestQuery.data as { onboardingComplete?: boolean } | undefined)
            ?.onboardingComplete,
        )
      : Boolean(
          (sessionQuery.data as { onboardingComplete?: boolean } | undefined)
            ?.onboardingComplete,
        );
    navigate(onboardingDone ? "/app" : "/onboarding", { replace: true });
  }, [
    guestQuery.data,
    guestQuery.isSuccess,
    navigate,
    sessionQuery.data,
    sessionQuery.isSuccess,
    storedGuestToken,
  ]);

  const wantsToBuy =
    typeof window !== "undefined" &&
    (window.location.hash === "#pacotes" ||
      new URLSearchParams(window.location.search).get("comprar") === "1");
  if (wantsToBuy) return null;
  if (
    !hasStoredAccess ||
    (!isChecking &&
      !(
        (sessionQuery.isSuccess && sessionQuery.data.accessGranted) ||
        (guestQuery.isSuccess && guestQuery.data.hasAccess)
      ))
  ) {
    return null;
  }

  return (
    <div className="access-gate-overlay" role="status" aria-live="polite">
      <div className="access-gate">
        <span className="access-gate-mark">
          <Feather size={18} />
        </span>
        <p>Abrindo seu espaço de conexão…</p>
      </div>
    </div>
  );
}

type LandingCtaSource =
  | "hero_quiz"
  | "hero_comprar"
  | "lp3_offer"
  | `theme_peek:${string}`;

function useLpTracking(
  lpId: "v1" | "v2" | "lp3",
  experimentAssignment?: StoredExperimentAssignment,
) {
  const visitorKeyRef = useRef<string>("");
  const clarityUserIdRef = useRef("");
  const claritySessionIdRef = useRef("");
  const lcpMsRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const lastSectionRef = useRef("hero");
  const exitSentRef = useRef(false);

  useEffect(() => {
    syncInternalTrackingFromUrl();
    const visitorKey = getOrCreateVisitorKey();
    visitorKeyRef.current = visitorKey;
    startedAtRef.current = Date.now();
    const clarityScriptId = "microsoft-clarity-script";
    if (!document.getElementById(clarityScriptId)) {
      window.clarity =
        window.clarity ||
        ((...args: unknown[]) => {
          (window.clarity as unknown as { q?: unknown[] }).q =
            (window.clarity as unknown as { q?: unknown[] }).q || [];
          (window.clarity as unknown as { q: unknown[] }).q.push(args);
        });
      const script = document.createElement("script");
      script.id = clarityScriptId;
      script.async = true;
      script.src = "https://www.clarity.ms/tag/y7zh9f1ygk";
      document.head.appendChild(script);
    }
    window.clarity?.("identify", visitorKey);
    window.clarity?.("set", "lp", lpId);
    if (experimentAssignment?.experimentVariantId) {
      window.clarity?.(
        "set",
        "variante",
        experimentAssignment.experimentVariantId,
      );
    }
    const readClarityIds = () => {
      const cookies = Object.fromEntries(
        document.cookie
          .split(";")
          .map((cookie) => cookie.trim().split("="))
          .filter(([key, value]) => key && value)
          .map(([key, value]) => [key, decodeURIComponent(value)]),
      );
      const userId = cookies._clck?.split("|")[0] || "";
      const sessionId = cookies._clsk?.split("|")[0] || "";
      if (userId) clarityUserIdRef.current = userId;
      if (sessionId) claritySessionIdRef.current = sessionId;
    };
    const track = (
      eventType: "view" | "cta_click" | "exit",
      extra: Record<string, unknown> = {},
    ) => {
      const payload = JSON.stringify({
        lpId,
        visitorKey,
        eventType,
        experimentId: experimentAssignment?.experimentId,
        experimentVariantId: experimentAssignment?.experimentVariantId,
        internal: isInternalTrackingEnabled(),
        clarityUserId: clarityUserIdRef.current || undefined,
        claritySessionId: claritySessionIdRef.current || undefined,
        lcpMs:
          lcpMsRef.current == null ? undefined : Math.round(lcpMsRef.current),
        ...extra,
      });
      if (eventType === "exit") {
        navigator.sendBeacon(
          apiUrl("/api/track/page-event"),
          new Blob([payload], { type: "application/json" }),
        );
      } else {
        void fetch(apiUrl("/api/track/page-event"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => undefined);
      }
    };
    readClarityIds();
    let lcpObserver: PerformanceObserver | null = null;
    if ("PerformanceObserver" in window) {
      try {
        lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const latest = entries[entries.length - 1];
          if (latest) lcpMsRef.current = latest.startTime;
        });
        lcpObserver.observe({
          type: "largest-contentful-paint",
          buffered: true,
        });
      } catch {
        lcpObserver = null;
      }
    }
    let viewSent = false;
    const sendView = () => {
      if (viewSent) return;
      viewSent = true;
      track("view");
    };
    const clarityPoll = window.setInterval(() => {
      readClarityIds();
      if (clarityUserIdRef.current && claritySessionIdRef.current) {
        sendView();
        window.clearInterval(clarityPoll);
      }
    }, 500);
    const viewFallback = window.setTimeout(() => {
      sendView();
      window.clearInterval(clarityPoll);
    }, 2500);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const section = entry.target.getAttribute("data-section-name");
            if (section) lastSectionRef.current = section;
          }
        });
      },
      { threshold: 0.25 },
    );
    const observedSections = new WeakSet<Element>();
    const observeSections = () => {
      document.querySelectorAll("[data-section-name]").forEach((element) => {
        if (observedSections.has(element)) return;
        observedSections.add(element);
        observer.observe(element);
      });
    };
    observeSections();
    const sectionMutationObserver = new MutationObserver(observeSections);
    sectionMutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    const sendExit = () => {
      if (exitSentRef.current) return;
      exitSentRef.current = true;
      sendView();
      track("exit", {
        timeOnPageMs: Date.now() - startedAtRef.current,
        lastSection: lastSectionRef.current,
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendExit();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", sendExit);
    return () => {
      observer.disconnect();
      sectionMutationObserver.disconnect();
      lcpObserver?.disconnect();
      window.clearInterval(clarityPoll);
      window.clearTimeout(viewFallback);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", sendExit);
    };
  }, [experimentAssignment, lpId]);

  return (ctaSource?: LandingCtaSource) => {
    syncInternalTrackingFromUrl();
    void fetch(apiUrl("/api/track/page-event"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lpId,
        visitorKey: visitorKeyRef.current,
        eventType: "cta_click",
        experimentId: experimentAssignment?.experimentId,
        experimentVariantId: experimentAssignment?.experimentVariantId,
        internal: isInternalTrackingEnabled(),
        ctaSource,
        clarityUserId: clarityUserIdRef.current || undefined,
        claritySessionId: claritySessionIdRef.current || undefined,
      }),
      keepalive: true,
    }).catch(() => undefined);
  };
}

type CheckoutState =
  | "idle"
  | "email"
  | "sending"
  | "confirming"
  | "native-payment"
  | "card-sending"
  | "card-payment"
  | "card-confirming"
  | "card-error"
  | "error"
  | "waiting-manual";

type CheckoutSourceLp = "v1" | "v2" | "lp3";

function useCheckout({
  sourceLp,
  onCtaClick,
  experimentAssignment,
}: {
  sourceLp: CheckoutSourceLp;
  onCtaClick?: (ctaSource?: LandingCtaSource) => void;
  experimentAssignment?: StoredExperimentAssignment;
}) {
  const pricing = usePricing();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOfferState, setCheckoutOfferState] =
    useState<CheckoutOfferState | null>(null);
  const [checkoutOfferNow, setCheckoutOfferNow] = useState(() => Date.now());
  const [selectedPackage, setSelectedPackage] = useState<"couple" | "family">(
    "couple",
  );
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [buyerName, setBuyerName] = useState(
    () => safeGetItem("conexao-pending-buyer-name") || "",
  );
  const [buyerEmail, setBuyerEmail] = useState(
    () => safeGetItem("conexao-pending-buyer-email") || "",
  );
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [nativeCheckout, setNativeCheckout] =
    useState<NativeCheckoutData | null>(null);
  const [cardCheckout, setCardCheckout] = useState<CardCheckoutData | null>(
    null,
  );
  const [cardAvailable, setCardAvailable] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "pix" | "card"
  >("pix");
  const [cardError, setCardError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [paymentCreating, setPaymentCreating] = useState<"pix" | "card" | null>(
    null,
  );
  const [pixExpired, setPixExpired] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [accessChecking, setAccessChecking] = useState(false);
  const [accessCheckNote, setAccessCheckNote] = useState<string | null>(null);
  const [confirmingLong, setConfirmingLong] = useState(false);
  const [sendingLong, setSendingLong] = useState(false);
  const checkoutCtaSourceRef = useRef<LandingCtaSource | null>(null);
  const checkoutOpenRef = useRef(false);
  const checkoutHistoryPushedRef = useRef(false);

  useEffect(() => {
    checkoutOpenRef.current = checkoutOpen;
  }, [checkoutOpen]);

  const openCheckout = () => {
    if (!checkoutHistoryPushedRef.current) {
      try {
        window.history.pushState(
          { ...(window.history.state ?? {}), conexaoCheckout: true },
          "",
          window.location.href,
        );
      } catch {
        // The modal still opens if the browser blocks history updates.
      }
      checkoutHistoryPushedRef.current = true;
    }
    setCheckoutOpen(true);
  };

  useEffect(() => {
    const handlePopState = () => {
      if (!checkoutOpenRef.current) return;
      checkoutHistoryPushedRef.current = false;
      setCheckoutOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!checkoutOpen) return;

    const visitorKey = getOrCreateVisitorKey();
    let cancelled = false;
    fetch(apiUrl(`/api/offer/state${getPricingRegionQuery()}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorKey }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("offer state request failed");
        return (await response.json()) as CheckoutOfferState;
      })
      .then((state) => {
        if (!cancelled) {
          setCheckoutOfferState(state);
          setCheckoutOfferNow(Date.now());
        }
      })
      .catch(() => {
        if (!cancelled) setCheckoutOfferState(null);
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutOpen]);

  useEffect(() => {
    if (!checkoutOfferState?.deadline) return;
    const timer = window.setInterval(() => setCheckoutOfferNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [checkoutOfferState?.deadline]);

  const checkoutDiscountActive = Boolean(
    checkoutOfferState?.discountActive &&
      new Date(checkoutOfferState.deadline).getTime() > checkoutOfferNow,
  );
  const checkoutOfferRemainingSeconds = checkoutOfferState
    ? Math.max(
        0,
        Math.ceil(
          (new Date(checkoutOfferState.deadline).getTime() - checkoutOfferNow) /
            1000,
        ),
      )
    : 0;
  const checkoutPricing =
    checkoutOfferState && checkoutDiscountActive
      ? checkoutOfferState.offer
      : checkoutOfferState?.full ?? pricing;

  useEffect(() => {
    if (!pricing.pixAvailable) {
      setSelectedPaymentMethod("card");
    }
  }, [pricing.pixAvailable]);
  const checkoutReviewsQuery = useListPublicReviews({
    query: {
      enabled:
        nativeCheckoutEnabled &&
        Boolean(nativeCheckout) &&
        (checkoutState === "email" || checkoutState === "native-payment"),
      queryKey: getListPublicReviewsQueryKey(),
    },
  });
  const checkoutReviews: CheckoutReview[] = (
    checkoutReviewsQuery.data?.reviews ?? []
  )
    .filter((review) => Boolean(review.displayName?.trim()))
    .slice(0, 2);

  useEffect(() => {
    let cancelled = false;
    if (!stripePromise) {
      setCardAvailable(false);
      return;
    }

    fetch(apiUrl("/api/checkout/availability"))
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { card?: boolean };
      })
      .then((availability) => {
        if (!cancelled) setCardAvailable(Boolean(availability?.card));
      })
      .catch(() => {
        if (!cancelled) setCardAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checkoutState !== "confirming") {
      setConfirmingLong(false);
      return;
    }

    const timer = window.setTimeout(() => setConfirmingLong(true), 15000);
    return () => window.clearTimeout(timer);
  }, [checkoutState]);

  useEffect(() => {
    if (checkoutState !== "sending") {
      setSendingLong(false);
      return;
    }

    const timer = window.setTimeout(() => setSendingLong(true), 4000);
    return () => window.clearTimeout(timer);
  }, [checkoutState]);

  useEffect(() => {
    if (sourceLp === "lp3") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("comprar") !== "1") return;

    setNameError("");
    setEmailError("");
    setCheckoutState("email");
    openCheckout();
    params.delete("comprar");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }, [sourceLp]);

  useEffect(() => {
    const pendingPix = safeGetItem("conexao-pending-pix");
    if (pendingPix && pricing.pixAvailable) {
      try {
        const parsed = JSON.parse(pendingPix) as NativeCheckoutData;
        if (
          parsed.sessionId &&
          parsed.brCode &&
          parsed.brCodeBase64 &&
          parsed.chargeId &&
          parsed.startedAt
        ) {
          if (
            nativeCheckoutEnabled &&
            Date.now() - parsed.startedAt < PENDING_CHECKOUT_MAX_AGE_MS
          ) {
            setNativeCheckout(parsed);
            setCheckoutState("email");
            openCheckout();
            return;
          }
          clearPendingCheckoutStorage();
        }
      } catch {
        clearPendingCheckoutStorage();
      }
    } else if (pendingPix) {
      safeRemoveItem("conexao-pending-pix");
      setNativeCheckout(null);
      setPixExpired(false);
      setCheckoutState("idle");
      setCheckoutOpen(false);
    }

    const pendingCard = safeGetItem("conexao-pending-card");
    if (stripePromise && pendingCard) {
      try {
        const parsed = JSON.parse(pendingCard) as CardCheckoutData;
        if (
          parsed.sessionId &&
          parsed.clientSecret &&
          parsed.startedAt &&
          Date.now() - parsed.startedAt < PENDING_CHECKOUT_MAX_AGE_MS
        ) {
          setCardCheckout(parsed);
          setSelectedPaymentMethod("card");
          setCheckoutState("email");
          openCheckout();
          return;
        }
        clearPendingCheckoutStorage();
      } catch {
        clearPendingCheckoutStorage();
      }
    }

    if (!pricing.pixAvailable) return;

    const params = new URLSearchParams(window.location.search);
    const sessionIdFromUrl = params.get("session");
    const pendingSession = safeGetItem("conexao-pending-session");
    const sessionId = sessionIdFromUrl || pendingSession;
    const checkoutCancelled = params.get("checkout") === "cancelado";
    if (checkoutCancelled) {
      clearPendingCheckoutStorage();
      setCheckoutState("error");
      openCheckout();
      return;
    }
    if (!sessionId) return;

    if (!sessionIdFromUrl) {
      const pendingAt = Number(safeGetItem("conexao-pending-at"));
      if (
        !Number.isFinite(pendingAt) ||
        pendingAt <= 0 ||
        Date.now() - pendingAt >= PENDING_CHECKOUT_MAX_AGE_MS
      ) {
        clearPendingCheckoutStorage();
        return;
      }
    }

    const billId = safeGetItem("conexao-pending-bill");
    const startedAt = sessionIdFromUrl
      ? Date.now()
      : Number(safeGetItem("conexao-pending-at"));
    setCheckoutState("confirming");
    openCheckout();
    let timeoutId: number | null = null;
    let cancelled = false;

    const checkPayment = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= HOSTED_CHECKOUT_MAX_WAIT_MS) {
        setCheckoutState("waiting-manual");
        return;
      }
      try {
        const sessionUrl = billId
          ? `/api/access/sessions/${encodeURIComponent(sessionId)}?bill=${encodeURIComponent(billId)}`
          : `/api/access/sessions/${encodeURIComponent(sessionId)}`;
        const response = await fetch(apiUrl(sessionUrl));
        if (response.ok) {
          const session = (await response.json()) as {
            accessGranted?: boolean;
          };
          if (!cancelled && session.accessGranted) {
            safeSetItem("conexao-session", sessionId);
            safeSetItem("conexao-role", "owner");
            clearCompletedCheckoutStorage();
            window.location.href = "/post-purchase";
            return;
          }
        }
      } catch {
        // Keep polling while the hosted checkout and API settle.
      }

      if (cancelled) return;
      if (Date.now() - startedAt < HOSTED_CHECKOUT_MAX_WAIT_MS) {
        timeoutId = window.setTimeout(
          checkPayment,
          HOSTED_CHECKOUT_POLL_INTERVAL_MS,
        );
      } else {
        setCheckoutState("waiting-manual");
      }
    };

    void checkPayment();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [pricing.pixAvailable]);

  useEffect(() => {
    if (
      !checkoutOpen ||
      !nativeCheckout ||
      (checkoutState !== "email" && checkoutState !== "native-payment")
    )
      return;

    let cancelled = false;
    const checkPayment = async () => {
      if (Date.now() - nativeCheckout.startedAt >= PIX_LIFETIME_MS) {
        setNativeCheckout(null);
        setPixExpired(true);
        clearPendingCheckoutStorage();
        return;
      }

      try {
        const response = await fetch(
          apiUrl(
            `/api/access/sessions/${encodeURIComponent(nativeCheckout.sessionId)}`,
          ),
        );
        if (!response.ok || cancelled) return;
        const session = (await response.json()) as { accessGranted?: boolean };
        if (session.accessGranted && !cancelled) {
          safeSetItem("conexao-session", nativeCheckout.sessionId);
          safeSetItem("conexao-role", "owner");
          clearCompletedCheckoutStorage();
          window.location.href = "/post-purchase";
        }
      } catch {
        // The next interval retries while the payment provider settles.
      }
    };

    void checkPayment();
    const intervalId = window.setInterval(() => void checkPayment(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [checkoutOpen, checkoutState, nativeCheckout]);

  useEffect(() => {
    if (!checkoutOpen || checkoutState !== "card-confirming" || !cardCheckout)
      return;

    let cancelled = false;
    let timeoutId: number | null = null;
    const checkPayment = async () => {
      if (cancelled) return;
      if (Date.now() - cardCheckout.startedAt >= CARD_CHECKOUT_MAX_WAIT_MS) {
        setCardError(
          "O pagamento foi enviado, mas a confirmação ainda não chegou. Aguarde um pouco e tente verificar novamente.",
        );
        setCheckoutState("email");
        return;
      }

      try {
        const response = await fetch(
          apiUrl(
            `/api/access/sessions/${encodeURIComponent(cardCheckout.sessionId)}`,
          ),
        );
        if (response.ok && !cancelled) {
          const session = (await response.json()) as {
            accessGranted?: boolean;
          };
          if (session.accessGranted) {
            safeSetItem("conexao-session", cardCheckout.sessionId);
            safeSetItem("conexao-role", "owner");
            clearCompletedCheckoutStorage();
            window.location.href = "/post-purchase";
            return;
          }
        }
      } catch {
        // Keep polling while Stripe's webhook and the API settle.
      }

      if (!cancelled) {
        timeoutId = window.setTimeout(
          checkPayment,
          CARD_CHECKOUT_POLL_INTERVAL_MS,
        );
      }
    };

    void checkPayment();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [checkoutOpen, checkoutState, cardCheckout]);

  const checkAccessNow = async () => {
    if (!nativeCheckout || accessChecking) return;
    setAccessChecking(true);
    setAccessCheckNote(null);
    try {
      const response = await fetch(
        apiUrl(
          `/api/access/sessions/${encodeURIComponent(nativeCheckout.sessionId)}`,
        ),
      );
      if (!response.ok) throw new Error("access-check");
      const session = (await response.json()) as { accessGranted?: boolean };
      if (session.accessGranted) {
        safeSetItem("conexao-session", nativeCheckout.sessionId);
        safeSetItem("conexao-role", "owner");
        clearCompletedCheckoutStorage();
        window.location.href = "/post-purchase";
        return;
      }
      setAccessCheckNote(
        "Ainda não caiu aqui. Se você acabou de pagar, o banco pode levar até 2 minutos — pode deixar esta tela aberta que ela abre sozinha.",
      );
    } catch (error) {
      console.error("verificação de acesso falhou", error);
      setAccessCheckNote(
        "Não consegui verificar agora. Tenta de novo em alguns segundos.",
      );
    } finally {
      setAccessChecking(false);
    }
  };

  const checkout = async (
    packageId: "couple" | "family" = selectedPackage,
    email = buyerEmail,
    name = buyerName,
    inline = false,
  ) => {
    openCheckout();
    setPaymentError("");
    setAccessCheckNote(null);
    if (!pricing.pixAvailable) {
      await createCardCheckout(inline);
      return;
    }
    if (inline) {
      setPaymentCreating("pix");
    } else {
      setCheckoutState("sending");
    }
    try {
      syncInternalTrackingFromUrl();
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = getCheckoutBuyerName(normalizedEmail, name);
      const response = await fetch(
        apiUrl(`/api/checkout/create${getPricingRegionQuery()}`),
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          buyerName: normalizedName,
          mode: "native",
          method: "pix",
          buyerEmail: normalizedEmail || undefined,
          sourceLp,
          ctaSource: checkoutCtaSourceRef.current || undefined,
          visitorKey: getStoredVisitorKey() || undefined,
          internal: isInternalTrackingEnabled(),
          ...(experimentAssignment
            ? {
                experimentId: experimentAssignment.experimentId,
                experimentVariantId: experimentAssignment.experimentVariantId,
              }
            : {}),
        }),
        },
      );
      const data = (await response.json()) as {
        sessionId?: string;
        brCode?: string;
        brCodeBase64?: string;
        chargeId?: string;
      };
      if (
        !response.ok ||
        !data.sessionId ||
        !data.brCode ||
        !data.brCodeBase64 ||
        !data.chargeId
      ) {
        throw new Error("checkout failed");
      }
      safeSetItem("conexao-pending-session", data.sessionId);
      safeSetItem("conexao-pending-source-lp", sourceLp);
      safeSetItem("conexao-pending-buyer-name", normalizedName);
      safeSetItem("conexao-pending-buyer-email", normalizedEmail);
      const checkoutStartedAt = Date.now();
      safeSetItem("conexao-pending-at", String(checkoutStartedAt));
      const pix: NativeCheckoutData = {
        sessionId: data.sessionId,
        brCode: data.brCode,
        brCodeBase64: data.brCodeBase64,
        chargeId: data.chargeId,
        startedAt: checkoutStartedAt,
      };
      setNativeCheckout(pix);
      setPixExpired(false);
      safeSetItem("conexao-pending-pix", JSON.stringify(pix));
      setSelectedPaymentMethod("pix");
      if (!inline) setCheckoutState("email");
    } catch (error) {
      console.error("checkout/create falhou", error);
      if (inline) {
        setPaymentError(
          "Não foi possível abrir o Pix aqui agora. Tente novamente.",
        );
      } else {
        setCheckoutState("error");
      }
    } finally {
      if (inline) setPaymentCreating(null);
    }
  };

  const createCardCheckout = async (inline = false) => {
    if (!cardAvailable || !stripePromise) {
      const message =
        pricing.pixAvailable
          ? "O pagamento com cartão está indisponível agora. Tente o Pix ou recarregue a página."
          : "O pagamento com cartão está indisponível agora. Recarregue a página e tente de novo.";
      setCardError(message);
      setPaymentError(message);
      return;
    }
    if (cardCheckout) {
      setCardError("");
      setSelectedPaymentMethod("card");
      if (!inline) setCheckoutState("email");
      return;
    }

    setSelectedPaymentMethod("card");
    setCardError("");
    setPaymentError("");
    if (inline) {
      setPaymentCreating("card");
    } else {
      setCheckoutState("card-sending");
    }
    try {
      syncInternalTrackingFromUrl();
      const normalizedEmail = buyerEmail.trim().toLowerCase();
      const normalizedName = getCheckoutBuyerName(normalizedEmail, buyerName);
      const response = await fetch(
        apiUrl(`/api/checkout/create${getPricingRegionQuery()}`),
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: "couple",
          buyerName: normalizedName,
          method: "card",
          buyerEmail: normalizedEmail || undefined,
          sourceLp,
          ctaSource: checkoutCtaSourceRef.current || undefined,
          visitorKey: getStoredVisitorKey() || undefined,
          internal: isInternalTrackingEnabled(),
          ...(experimentAssignment
            ? {
                experimentId: experimentAssignment.experimentId,
                experimentVariantId: experimentAssignment.experimentVariantId,
              }
            : {}),
        }),
        },
      );
      const data = (await response.json()) as {
        sessionId?: string;
        clientSecret?: string;
      };
      if (!response.ok || !data.sessionId || !data.clientSecret) {
        throw new Error("card checkout failed");
      }

      const checkoutStartedAt = Date.now();
      const card: CardCheckoutData = {
        sessionId: data.sessionId,
        clientSecret: data.clientSecret,
        startedAt: checkoutStartedAt,
      };
      safeSetItem("conexao-pending-session", data.sessionId);
      safeSetItem("conexao-pending-source-lp", sourceLp);
      safeSetItem("conexao-pending-buyer-name", normalizedName);
      safeSetItem("conexao-pending-buyer-email", normalizedEmail);
      safeSetItem("conexao-pending-at", String(checkoutStartedAt));
      safeSetItem("conexao-pending-card", JSON.stringify(card));
      setCardCheckout(card);
      if (!inline) setCheckoutState("email");
    } catch {
      const message =
        pricing.pixAvailable
          ? "Não foi possível abrir o pagamento com cartão. Tente novamente ou escolha o Pix."
          : "Não foi possível abrir o pagamento com cartão. Tente novamente.";
      setCardError(message);
      if (inline) {
        setPaymentError(message);
      } else {
        setCheckoutState("card-error");
      }
    } finally {
      if (inline) setPaymentCreating(null);
    }
  };

  const selectPaymentMethod = (method: "pix" | "card") => {
    if (method === "pix" && !pricing.pixAvailable) return;
    if (method === "card") {
      void createCardCheckout();
      return;
    }
    setCardError("");
    setSelectedPaymentMethod("pix");
    if (nativeCheckout) setCheckoutState("email");
  };

  const handleCardPaymentSubmitted = () => {
    setCardError("");
    setCheckoutState("card-confirming");
  };

  const startCheckout = (
    packageId: "couple" | "family" = selectedPackage,
    ctaSource?: LandingCtaSource,
  ) => {
    checkoutCtaSourceRef.current = ctaSource || null;
    onCtaClick?.(ctaSource);
    setSelectedPackage(packageId);
    setPixExpired(false);
    safeSetItem("conexao-pending-source-lp", sourceLp);
    const pendingPix = safeGetItem("conexao-pending-pix");
    if (nativeCheckoutEnabled && pricing.pixAvailable && pendingPix) {
      try {
        const parsed = JSON.parse(pendingPix) as NativeCheckoutData;
        if (
          parsed.sessionId &&
          parsed.brCode &&
          parsed.brCodeBase64 &&
          parsed.chargeId &&
          parsed.startedAt &&
          Date.now() - parsed.startedAt < PENDING_CHECKOUT_MAX_AGE_MS
        ) {
          setNativeCheckout(parsed);
          setCopiedCode(false);
          setCheckoutState("email");
          openCheckout();
          return;
        }
        clearPendingCheckoutStorage();
      } catch {
        clearPendingCheckoutStorage();
      }
    }
    if (!pricing.pixAvailable && pendingPix) {
      safeRemoveItem("conexao-pending-pix");
    }
    setNameError("");
    setEmailError("");
    setCheckoutState("email");
    openCheckout();
  };

  const restartCheckout = () => {
    clearPendingCheckoutStorage();
    setNativeCheckout(null);
    setPixExpired(false);
    setCardCheckout(null);
    setCardError("");
    setPaymentCreating(null);
    setPaymentError("");
    setAccessChecking(false);
    setAccessCheckNote(null);
    setSelectedPaymentMethod(pricing.pixAvailable ? "pix" : "card");
    setCopiedCode(false);
    setNameError("");
    setEmailError("");
    setCheckoutState("email");
    openCheckout();
  };

  return {
    checkoutOpen,
    checkoutState,
    checkoutPricing,
    checkoutDiscountActive,
    checkoutOfferRemainingSeconds,
    checkoutFullPrice: checkoutOfferState?.full ?? null,
    buyerName,
    setBuyerName,
    buyerEmail,
    setBuyerEmail,
    nameError,
    setNameError,
    emailError,
    setEmailError,
    nativeCheckout,
    pixExpired,
    cardCheckout,
    cardAvailable,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    cardError,
    setCardError,
    copiedCode,
    setCopiedCode,
    paymentCreating,
    paymentError,
    setPaymentError,
    accessChecking,
    accessCheckNote,
    checkAccessNow,
    confirmingLong,
    sendingLong,
    checkoutReviews,
    checkout,
    createCardCheckout,
    selectPaymentMethod,
    handleCardPaymentSubmitted,
    startCheckout,
    restartCheckout,
  };
}

type CheckoutController = ReturnType<typeof useCheckout>;

function CheckoutPaymentTabs({
  selectedPaymentMethod,
  cardAvailable,
  pixAvailable = true,
  onSelect,
  pixContent,
  cardContent,
}: {
  selectedPaymentMethod: "pix" | "card";
  cardAvailable: boolean;
  pixAvailable?: boolean;
  onSelect: (method: "pix" | "card") => void;
  pixContent?: ReactNode;
  cardContent?: ReactNode;
}) {
  const renderPaymentItem = (
    method: "pix" | "card",
    icon: ReactNode,
    title: string,
    description: string,
    content?: ReactNode,
  ) => {
    const selected = selectedPaymentMethod === method;
    const disabled =
      method === "card" ? !cardAvailable : !pixAvailable;

    return (
      <div className={`checkout-payment-item ${selected ? "is-selected" : ""}`}>
        <button
          className={`${selected ? "active" : ""} ${disabled ? "disabled" : ""}`}
          type="button"
          role="tab"
          aria-selected={selected}
          aria-expanded={selected}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => onSelect(method)}
          data-testid={`button-payment-${method}`}
        >
          <span className="payment-tab-icon" aria-hidden="true">
            {icon}
          </span>
          <span className="payment-tab-copy">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <span className="payment-tab-check" aria-hidden="true">
            {selected && <Check size={13} strokeWidth={2.5} />}
          </span>
        </button>
        {selected && content && (
          <div className="checkout-payment-panel" role="tabpanel">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="checkout-payment-tabs"
      role="tablist"
      aria-label="Método de pagamento"
      data-testid="payment-method-selector"
    >
      {pixAvailable
        ? renderPaymentItem(
            "pix",
            <QrCode size={18} strokeWidth={1.8} />,
            "Pix",
            "cai na hora · acesso imediato",
            pixContent,
          )
        : null}
      {renderPaymentItem(
        "card",
        <CreditCard size={18} strokeWidth={1.8} />,
        "Cartão de crédito",
        cardAvailable
          ? "Apple Pay e Google Pay disponíveis"
          : "indisponível agora",
        cardContent,
      )}
    </div>
  );
}

type CardPaymentFormHandle = {
  submit: () => void;
};

const CardPaymentForm = forwardRef<
  CardPaymentFormHandle,
  {
    onPaymentSubmitted: () => void;
    showSubmitButton?: boolean;
    priceDisplay: string;
  }
>(function CardPaymentForm(
  { onPaymentSubmitted, showSubmitButton = true, priceDisplay },
  ref,
) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError("");
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setError(
        result.error.message ||
          "Não foi possível confirmar o pagamento. Confira os dados e tente novamente.",
      );
      setSubmitting(false);
      return;
    }

    onPaymentSubmitted();
  };

  useImperativeHandle(ref, () => ({
    submit: () => void handleSubmit(),
  }));

  return (
    <div className="checkout-card-form">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && (
        <p className="checkout-card-error" role="alert">
          {error}
        </p>
      )}
      {showSubmitButton && (
        <button
          className="button button-primary button-full checkout-card-submit"
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!stripe || !elements || submitting}
        >
          {submitting ? "Confirmando pagamento…" : `Pagar ${priceDisplay}`}
          {!submitting && <ArrowRight size={16} />}
        </button>
      )}
      <p className="checkout-card-note">
        Pagamento seguro. Cartão, Apple Pay, Google Pay e Link.
      </p>
    </div>
  );
});

function CheckoutModal({ checkout }: { checkout: CheckoutController }) {
  const {
    checkoutOpen,
    checkoutState,
    checkoutPricing,
    checkoutDiscountActive,
    checkoutOfferRemainingSeconds,
    checkoutFullPrice,
    buyerName,
    setBuyerName,
    buyerEmail,
    setBuyerEmail,
    nameError,
    setNameError,
    emailError,
    setEmailError,
    nativeCheckout,
    pixExpired,
    cardCheckout,
    cardAvailable,
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    cardError,
    setCardError,
    copiedCode,
    setCopiedCode,
    paymentCreating,
    paymentError,
    setPaymentError,
    accessChecking,
    accessCheckNote,
    checkAccessNow,
    confirmingLong,
    sendingLong,
    checkoutReviews,
    checkout: createCheckout,
    createCardCheckout,
    selectPaymentMethod,
    handleCardPaymentSubmitted,
    restartCheckout,
  } = checkout;

  const cardPaymentFormRef = useRef<CardPaymentFormHandle>(null);

  const hasValidBuyerDetails =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim());

  const focusCheckoutEmail = () => {
    window.requestAnimationFrame(() => {
      document.getElementById("checkout-email")?.focus();
    });
  };

  const handlePaymentMethodSelect = (method: "pix" | "card") => {
    setCardError("");
    setPaymentError("");
    setSelectedPaymentMethod(method);

    if (!checkoutOpen || checkoutState !== "email") {
      return;
    }

    if (!hasValidBuyerDetails) {
      setEmailError("Digite seu e-mail para abrir o pagamento.");
      setPaymentError("Digite seu e-mail para abrir o pagamento.");
      focusCheckoutEmail();
      return;
    }

    const normalizedEmail = buyerEmail.trim().toLowerCase();

    if (method === "pix" && !nativeCheckout && !paymentCreating) {
      void createCheckout("couple", normalizedEmail, "", true);
    } else if (
      method === "card" &&
      cardAvailable &&
      !cardCheckout &&
      !paymentCreating
    ) {
      void createCardCheckout(true);
    }
  };

  useEffect(() => {
    if (
      !checkoutOpen ||
      checkoutState !== "email" ||
      !hasValidBuyerDetails ||
      paymentCreating
    ) {
      return;
    }

    const normalizedEmail = buyerEmail.trim().toLowerCase();

    if (selectedPaymentMethod === "pix" && !nativeCheckout) {
      void createCheckout("couple", normalizedEmail, "", true);
    } else if (
      selectedPaymentMethod === "card" &&
      cardAvailable &&
      !cardCheckout
    ) {
      void createCardCheckout(true);
    }
  }, [
    buyerEmail,
    buyerName,
    cardAvailable,
    cardCheckout,
    checkoutOpen,
    checkoutState,
    createCardCheckout,
    createCheckout,
    hasValidBuyerDetails,
    nativeCheckout,
    paymentCreating,
    selectedPaymentMethod,
  ]);

  const handleInitialCheckout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = buyerEmail.trim().toLowerCase();
    let valid = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const digitado = buyerEmail.trim();
      setEmailError(
        !digitado
          ? "Falta o e-mail pra liberar seu acesso."
          : !digitado.includes("@")
            ? "Falta o @ no e-mail."
            : "Falta o final do e-mail, depois do @ (ex.: gmail.com).",
      );
      const emailField = document.getElementById("checkout-email");
      emailField?.scrollIntoView({ behavior: "smooth", block: "center" });
      (emailField as HTMLInputElement | null)?.focus({ preventScroll: true });
      valid = false;
    }
    if (!valid) return;

    setEmailError("");
    setBuyerEmail(normalizedEmail);
    if (selectedPaymentMethod === "card") {
      if (cardCheckout) {
        cardPaymentFormRef.current?.submit();
      } else {
        void createCardCheckout(true);
      }
    } else {
      if (!nativeCheckout) {
        void createCheckout("couple", normalizedEmail, "", true);
      }
    }
  };

  const pixPaymentContent = nativeCheckout ? (
    <div className="checkout-pix-inline">
      <div className="checkout-qr-wrap">
        <img
          src={
            nativeCheckout.brCodeBase64.startsWith("data:")
              ? nativeCheckout.brCodeBase64
              : `data:image/png;base64,${nativeCheckout.brCodeBase64}`
          }
          alt="QR Code do Pix"
        />
      </div>
      <p className="checkout-pix-hint">
        Escaneie o QR ou copie o código.
        <br />
        <strong>Assim que cair, seu acesso abre sozinho.</strong>
      </p>
      {checkoutState === "email" || checkoutState === "native-payment" ? (
        <p className="checkout-pix-auto-check" role="status" aria-live="polite">
          <span aria-hidden="true">●</span> verificando seu pagamento a cada
          poucos segundos
        </p>
      ) : null}
      <div className="checkout-pix-copybox">
        <code>{nativeCheckout.brCode}</code>
        <button
          className="checkout-copy-button"
          type="button"
          onClick={async () => {
            const copied = await copyPixCode(nativeCheckout.brCode);
            if (copied) {
              setCopiedCode(true);
              window.setTimeout(() => setCopiedCode(false), 2200);
            } else {
              setCopiedCode(false);
            }
          }}
          data-testid="button-copy-pix"
        >
          {copiedCode ? <Check size={16} /> : <Copy size={16} />}
          {copiedCode ? "Copiado!" : "Copiar"}
        </button>
        <button
          className="button button-primary checkout-pix-check"
          type="button"
          disabled={accessChecking}
          onClick={checkAccessNow}
          data-testid="button-check-access"
        >
          {accessChecking
            ? "Verificando seu acesso…"
            : "Já paguei — abrir meu baralho"}
        </button>
        {accessCheckNote ? (
          <p className="checkout-pix-check-note" role="status" aria-live="polite">
            {accessCheckNote}
          </p>
        ) : null}
      </div>
    </div>
  ) : pixExpired ? (
    <div className="checkout-pix-expired" role="status" aria-live="polite">
      <p className="checkout-pix-expired-title">O código Pix expirou.</p>
      <p>
        Ele vale 15 minutos. Toque em <strong>“Começar hoje à noite”</strong> aqui
        embaixo que eu gero outro na hora — seus dados continuam preenchidos.
      </p>
      <p className="checkout-pix-expired-alt">
        Ou pague no <strong>cartão</strong>, na aba ao lado. Aí não tem prazo.
      </p>
    </div>
  ) : paymentCreating === "pix" ? (
    <div className="checkout-pix-inline" role="status" aria-live="polite">
      <div className="checkout-qr-wrap checkout-qr-skeleton" aria-hidden="true" />
      <p className="checkout-pix-hint">
        Gerando seu código Pix…
        <br />
        <strong>Leva uns segundos. Não feche esta tela.</strong>
      </p>
    </div>
  ) : paymentError ? (
    <div className="checkout-payment-preview checkout-inline-error" role="alert">
      <p>{paymentError}</p>
      <div className="checkout-error-actions">
        <button
          type="button"
          className="button button-primary button-full"
          onClick={() => {
            void createCheckout("couple", buyerEmail, buyerName, true);
          }}
          disabled={paymentCreating !== null}
          data-testid="button-retry-pix"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  ) : (
    <p className="checkout-payment-preview">
      Preencha seu e-mail acima e o QR aparece aqui.
    </p>
  );

  const cardPaymentContent = cardCheckout ? (
    <div className="checkout-card-inline">
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret: cardCheckout.clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#7a2e46",
              colorBackground: "#ffffff",
              colorText: "#2a2233",
              colorTextSecondary: "#756b78",
              colorDanger: "#a2384b",
              borderRadius: "12px",
              fontFamily: "var(--app-font-sans)",
            },
            rules: {
              ".Input": {
                backgroundColor: "#ffffff",
                borderColor: "#d9d1dc",
              },
              ".Input:focus": {
                borderColor: "#7a2e46",
                boxShadow: "0 0 0 3px rgba(122, 46, 70, 0.14)",
              },
              ".Label": {
                color: "#2a2233",
              },
            },
          },
        }}
      >
        <CardPaymentForm
          ref={cardPaymentFormRef}
          onPaymentSubmitted={handleCardPaymentSubmitted}
          showSubmitButton={checkoutState !== "email"}
          priceDisplay={checkoutPricing.display}
        />
      </Elements>
    </div>
  ) : paymentCreating === "card" ? (
    <p className="checkout-payment-preview" role="status" aria-live="polite">
      Abrindo o pagamento com cartão aqui…
    </p>
  ) : paymentError ? (
    <p className="checkout-payment-preview checkout-inline-error" role="alert">
      {paymentError}
    </p>
  ) : (
    <p className="checkout-payment-preview">
      Preencha seus dados para abrir o pagamento com cartão aqui.
    </p>
  );

  if (!checkoutOpen) return null;

  return (
    <div
      className={`modal-backdrop ${checkoutState === "sending" || checkoutState === "confirming" || checkoutState === "card-sending" || checkoutState === "card-confirming" ? "modal-backdrop-loading" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Finalizar compra"
    >
      <div
        className={`checkout-modal ${checkoutState === "sending" || checkoutState === "confirming" || checkoutState === "card-sending" || checkoutState === "card-confirming" ? "checkout-modal-loading" : ""}`}
      >
        {checkoutOfferRemainingSeconds > 0 &&
        checkoutState !== "sending" &&
        checkoutState !== "confirming" &&
        checkoutState !== "card-sending" &&
        checkoutState !== "card-confirming" ? (
          <div className="checkout-offer-bar" role="status" aria-live="polite">
            <span>Seu preço especial termina em</span>
            <strong>{formatOfferRemaining(checkoutOfferRemainingSeconds)}</strong>
          </div>
        ) : null}
        {checkoutState === "email" ? (
          <form
            className="checkout-email-form checkout-store-form"
            onSubmit={handleInitialCheckout}
            noValidate
          >
            <div className="checkout-store-grid checkout-store-grid-clean">
              <section className="checkout-order-column">
                <div className="checkout-form-card checkout-details-card">
                  <div className="checkout-access-heading">
                    <h3>Pra onde eu mando o acesso?</h3>
                  </div>
                  <div className="checkout-fields-inline">
                    <label className="checkout-field">
                      <span className="sr-only">E-mail</span>
                      <input
                        id="checkout-email"
                        className="checkout-email-input"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="seu@email.com"
                        value={buyerEmail}
                        autoFocus
                        aria-invalid={emailError ? true : undefined}
                        onChange={(event) => {
                          setBuyerEmail(event.target.value);
                          safeSetItem(
                            "conexao-pending-buyer-email",
                            event.target.value,
                          );
                          if (emailError) setEmailError("");
                          if (paymentError) setPaymentError("");
                        }}
                        required
                        data-testid="input-checkout-email"
                      />
                      {emailError && (
                        <small className="checkout-email-error" role="alert">
                          {emailError}
                        </small>
                      )}
                    </label>
                    <p className="checkout-access-note">
                      <strong>
                        Digite seu e-mail acima para liberar{" "}
                        {checkoutPricing.pixAvailable ? "Pix e cartão" : "o cartão"}.
                      </strong>
                      Só pra liberar seu acesso e guardar sua compra. Sem spam,
                      sem lista.
                    </p>
                  </div>
                </div>
                <div className="checkout-form-card checkout-payment-card">
                  <div className="checkout-card-heading checkout-payment-heading">
                    <h3>Como você prefere pagar?</h3>
                    <p>
                      {hasValidBuyerDetails
                        ? "Uma única cobrança. Sem assinatura."
                        : "Digite seu e-mail acima para abrir as opções de pagamento."}
                    </p>
                  </div>
                  <CheckoutPaymentTabs
                    selectedPaymentMethod={selectedPaymentMethod}
                    cardAvailable={cardAvailable}
                    pixAvailable={checkoutPricing.pixAvailable}
                    onSelect={handlePaymentMethodSelect}
                    pixContent={pixPaymentContent}
                    cardContent={cardPaymentContent}
                  />
                </div>
                <div
                  className="checkout-summary-card"
                  data-testid="summary-checkout"
                >
                  <div className="checkout-card-heading">
                    <h3>Resumo</h3>
                  </div>
                  <div>
                    <div className="checkout-summary-row">
                      <span>Perguntas de Conexão</span>
                      <span className="checkout-summary-price">
                        {checkoutDiscountActive && checkoutFullPrice ? (
                          <del>{checkoutFullPrice.display}</del>
                        ) : null}
                        {checkoutPricing.display}
                      </span>
                    </div>
                    <div className="checkout-summary-row checkout-summary-row-guarantee">
                      <span>Garantia de 7 dias</span>
                      <span className="checkout-summary-included">
                        incluída
                      </span>
                    </div>
                    <div className="checkout-summary-total">
                      <strong>Total</strong>
                        <strong>{checkoutPricing.display}</strong>
                    </div>
                  </div>
                </div>
                <p className="checkout-payment-access-note">
                  Assim que o pagamento cair,{" "}
                  <strong>o acesso abre sozinho nesta tela.</strong> Não
                  precisa mandar comprovante nem esperar e-mail.
                </p>
              </section>
            </div>
            {!(selectedPaymentMethod === "pix" && nativeCheckout) ? (
              <div className="checkout-purchase-bar">
                {emailError ? (
                  <p className="checkout-purchase-error" role="alert">
                    ↑ Preencha o e-mail ali em cima pra continuar.
                  </p>
                ) : null}
                <div className="checkout-purchase-total">
                  <span>Total</span>
                  <strong>{checkoutPricing.display}</strong>
                </div>
                <button
                  className="button button-primary checkout-purchase-button"
                  type="submit"
                  disabled={paymentCreating !== null}
                  data-testid="button-continue-checkout"
                >
                  {paymentCreating !== null ? (
                    checkoutPricing.pixAvailable && selectedPaymentMethod === "pix"
                      ? "Gerando seu Pix…"
                      : "Abrindo pagamento…"
                  ) : (
                    <>
                      Começar hoje à noite <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </form>
        ) : checkoutState === "native-payment" && nativeCheckout ? (
          <div className="checkout-native-payment">
            <CheckoutPaymentTabs
              selectedPaymentMethod={selectedPaymentMethod}
              cardAvailable={cardAvailable}
              pixAvailable={checkoutPricing.pixAvailable}
              onSelect={selectPaymentMethod}
              pixContent={pixPaymentContent}
              cardContent={cardPaymentContent}
            />
          </div>
        ) : checkoutState === "card-payment" && cardCheckout ? (
          <div className="checkout-card-payment">
            <CheckoutPaymentTabs
              selectedPaymentMethod={selectedPaymentMethod}
              cardAvailable={cardAvailable}
              pixAvailable={checkoutPricing.pixAvailable}
              onSelect={selectPaymentMethod}
              pixContent={pixPaymentContent}
              cardContent={cardPaymentContent}
            />
          </div>
        ) : checkoutState === "card-sending" ? (
          <div className="checkout-confirming" role="status" aria-live="polite">
            <div className="confirming-deck" aria-hidden="true">
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
            </div>
            <p className="conf-kicker">preparando seu pagamento</p>
            <h2>
              Abrindo o pagamento
              <br />
              <em>com cartão.</em>
            </h2>
            <p>Seu pagamento seguro vai aparecer aqui em instantes.</p>
          </div>
        ) : checkoutState === "card-confirming" ? (
          <div className="checkout-confirming" role="status" aria-live="polite">
            <div className="confirming-deck" aria-hidden="true">
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
            </div>
            <p className="conf-kicker">Confirmando pagamento…</p>
            <h2>
              Pagamento enviado
              <br />
              <em>liberando seu baralho.</em>
            </h2>
            <p>
              Assim que a confirmação chegar, seu acesso será liberado
              automaticamente. Não feche esta tela.
            </p>
          </div>
        ) : checkoutState === "card-error" ? (
          <div className="checkout-error-state" role="alert">
            <CheckoutPaymentTabs
              selectedPaymentMethod="card"
              cardAvailable={cardAvailable}
              pixAvailable={checkoutPricing.pixAvailable}
              onSelect={selectPaymentMethod}
            />
            <p className="section-kicker">pagamento indisponível</p>
            <h2>
              Tente o cartão
              <br />
              <em>mais uma vez.</em>
            </h2>
            <p className="checkout-error">
              {cardError ||
                "Não foi possível iniciar o pagamento com cartão agora."}
            </p>
            <button
              onClick={() => void createCardCheckout()}
              className="button button-primary button-full"
            >
              Tentar novamente <ArrowRight size={16} />
            </button>
            {checkoutPricing.pixAvailable ? (
              <button
                type="button"
                className="checkout-secondary-action"
                onClick={() => selectPaymentMethod("pix")}
              >
                Pagar com Pix
              </button>
            ) : null}
          </div>
        ) : checkoutState === "waiting-manual" ? (
          <div className="checkout-confirming">
            <div className="success-seal">
              <Check size={22} />
            </div>
            <p className="section-kicker">pagamento recebido?</p>
            <h2>
              Estamos verificando
              <br />
              <em>com a Abacate Pay.</em>
            </h2>
            <p>
              Não recebemos a confirmação do pagamento. Se você já pagou,
              aguarde mais um pouco. Se ainda não pagou, gere um novo código.
            </p>
            <button
              onClick={() => {
                const pendingSessionId = safeGetItem("conexao-pending-session");
                if (pendingSessionId)
                  window.location.href = `/?session=${encodeURIComponent(pendingSessionId)}`;
              }}
              className="button button-primary button-full"
            >
              Já paguei — verificar de novo <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="checkout-secondary-action"
              onClick={restartCheckout}
            >
              Ainda não paguei — gerar um novo código
            </button>
          </div>
        ) : checkoutState === "confirming" ? (
          <div className="checkout-confirming">
            <div className="confirming-deck" aria-hidden="true">
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
            </div>
            <p className="conf-kicker">preparando seu baralho</p>
            <h2>
              {confirmingLong ? (
                <>
                  Quase lá…
                  <br />
                  <em>as cartas estão chegando.</em>
                </>
              ) : (
                <>
                  Suas cartas estão
                  <br />
                  <em>entrando no baralho.</em>
                </>
              )}
            </h2>
            <p>
              {confirmingLong
                ? "Tá demorando um pouco mais que o normal — é a confirmação da Abacate Pay chegando. Não feche esta tela."
                : "Assim que o pagamento for confirmado (geralmente em segundos), seu baralho abre automaticamente."}
            </p>
            <button
              type="button"
              className="checkout-secondary-action"
              onClick={restartCheckout}
            >
              Ainda não paguei — gerar um novo código
            </button>
          </div>
        ) : checkoutState === "sending" ? (
          <div className="checkout-confirming" role="status" aria-live="polite">
            <div className="confirming-deck" aria-hidden="true">
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
              <span className="conf-card" />
            </div>
            <p className="conf-kicker">preparando seu pagamento</p>
            <h2>
              {sendingLong ? (
                <>
                  Só mais um instante…
                  <br />
                  <em>seu Pix tá quase pronto.</em>
                </>
              ) : (
                <>
                  Gerando seu Pix
                  <br />
                  <em>de pagamento seguro.</em>
                </>
              )}
            </h2>
            <p>
              {sendingLong
                ? "Tá demorando um pouco mais que o normal — não feche esta tela."
                : "O código Pix vai aparecer aqui, sem sair deste site."}
            </p>
          </div>
        ) : (
          <div className="checkout-error-state" role="alert">
            <p className="section-kicker">não foi possível abrir</p>
            <h2>
              Tente novamente
              <br />
              <em>em alguns instantes.</em>
            </h2>
            <p className="checkout-error">
              Não deu para iniciar o pagamento agora.
            </p>
            <button
              onClick={() => {
                if (nativeCheckoutEnabled) {
                  if (buyerName.trim() && buyerEmail.trim()) {
                    void createCheckout("couple", buyerEmail, buyerName);
                  } else {
                    restartCheckout();
                  }
                } else {
                  void createCheckout();
                }
              }}
              className="button button-primary button-full"
              data-testid="button-retry-checkout"
            >
              Tentar novamente <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SUPPORT_TOPIC_OPTIONS = [
  { value: "sem_acesso", label: "Comprei e não consigo entrar" },
  { value: "email_nao_chegou", label: "Paguei e não recebi o e-mail" },
  { value: "convite", label: "Recebi um convite e não abre" },
  { value: "pagamento", label: "Problema no pagamento" },
  { value: "outro", label: "Outro assunto / sugestão" },
] as const;

function supportTopicNeedsPurchaseEmail(topic: string): boolean {
  return (
    topic === "sem_acesso" ||
    topic === "email_nao_chegou" ||
    topic === "pagamento"
  );
}

function isSupportEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function SupportDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [purchaseEmail, setPurchaseEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accessStatus, setAccessStatus] = useState("não verificado");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleOpen = () => {
      setEmail(
        safeGetItem("conexao-pending-buyer-email") ||
          safeGetItem("conexao-login-email") ||
          "",
      );
      setTopic("");
      setPurchaseEmail(
        safeGetItem("conexao-pending-buyer-email") ||
          safeGetItem("conexao-login-email") ||
          "",
      );
      setPaymentMethod("");
      setInviteLink("");
      setMessage("");
      setStep(1);
      setAccessStatus("não verificado");
      setStatus("idle");
      setError("");
      setOpen(true);
    };
    window.addEventListener(SUPPORT_DIALOG_EVENT, handleOpen);
    return () => window.removeEventListener(SUPPORT_DIALOG_EVENT, handleOpen);
  }, []);

  if (!open) return null;

  const purchaseEmailRequired = supportTopicNeedsPurchaseEmail(topic);
  const sendSupportMessage = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPurchaseEmail = purchaseEmail.trim().toLowerCase();
    const typedMessage = message.trim();
    const emailForAccessCheck = normalizedPurchaseEmail || normalizedEmail;
    if (
      !normalizedEmail ||
      !isSupportEmail(normalizedEmail)
    ) {
      setError("Digite um e-mail válido para eu te responder.");
      return;
    }
    if (!topic) {
      setError("Escolha um assunto.");
      setStep(1);
      return;
    }
    if (
      purchaseEmailRequired &&
      (!normalizedPurchaseEmail ||
        !isSupportEmail(normalizedPurchaseEmail))
    ) {
      setError("Digite o e-mail usado na compra.");
      setStep(2);
      return;
    }
    if (topic === "outro" && !typedMessage) {
      setError("Escreva uma mensagem antes de enviar.");
      setStep(3);
      return;
    }

    setStatus("sending");
    setError("");

    let resolvedAccessStatus:
      | "tem_acesso"
      | "so_convite"
      | "sem_acesso"
      | "desconhecido" = "desconhecido";
    try {
      const accessResponse = await fetch(
        apiUrl(
          `/api/access/check-email?email=${encodeURIComponent(emailForAccessCheck)}`,
        ),
      );
      if (accessResponse.ok) {
        const access = (await accessResponse.json()) as {
          asOwner?: boolean;
          asGuest?: boolean;
        };
        resolvedAccessStatus = access.asOwner
          ? "tem_acesso"
          : access.asGuest
            ? "so_convite"
            : "sem_acesso";
      }
    } catch {
      resolvedAccessStatus = "desconhecido";
    }
    setAccessStatus(resolvedAccessStatus);

    try {
      const response = await fetch(apiUrl("/api/suggestions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          message: typedMessage,
          topic,
          purchaseEmail: normalizedPurchaseEmail || undefined,
          paymentMethod: paymentMethod || undefined,
          inviteLink: inviteLink.trim() || undefined,
          accessStatus: resolvedAccessStatus,
          page: window.location.pathname,
          userAgent: navigator.userAgent,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        }),
      });
      if (!response.ok) {
        throw new Error(`support request failed: ${response.status}`);
      }
      setStatus("sent");
      setMessage("");
    } catch (requestError) {
      console.error("Support message failed", requestError);
      setStatus("error");
      setError("Não consegui enviar agora. Tente de novo.");
    }
  };

  const close = () => {
    setOpen(false);
    setStatus("idle");
    setStep(1);
    setError("");
  };

  const nextStep = () => {
    setError("");
    if (step === 1 && !topic) {
      setError("Escolha um assunto para continuar.");
      return;
    }
    if (step === 2) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !isSupportEmail(normalizedEmail)) {
        setError("Digite um e-mail válido para eu te responder.");
        return;
      }
      const normalizedPurchaseEmail = purchaseEmail.trim().toLowerCase();
      if (
        purchaseEmailRequired &&
        (!normalizedPurchaseEmail ||
          !isSupportEmail(normalizedPurchaseEmail))
      ) {
        setError("Digite o e-mail usado na compra.");
        return;
      }
    }
    setStep((current) => (current < 3 ? ((current + 1) as 2 | 3) : current));
  };

  return (
    <div
      className="app-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-title"
    >
      <div className="app-modal">
        <button
          className="app-modal-close"
          onClick={close}
          aria-label="Fechar suporte"
          data-testid="button-close-support"
        >
          <X size={18} />
        </button>
        {status === "sent" ? (
          <>
            <p className="modal-eyebrow">mensagem recebida</p>
            <h2 id="support-title">Precisa de ajuda?</h2>
            <p>
              Recebi sua mensagem. Te respondo nesse e-mail, normalmente no
              mesmo dia.
            </p>
            <button
              type="button"
              className="app-primary-button"
              onClick={close}
              data-testid="button-close-support-sent"
            >
              Fechar
            </button>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void sendSupportMessage();
            }}
          >
            <p className="modal-eyebrow">fale comigo</p>
            <h2 id="support-title">Precisa de ajuda?</h2>
            <p className="support-step-label">Passo {step} de 3</p>
            {step === 1 && (
              <>
                <p>Escolha o assunto para eu te encaminhar mais rápido.</p>
                 <div className="support-topic-options" role="group" aria-label="Assunto">
                   {SUPPORT_TOPIC_OPTIONS.map((option) => (
                     <button
                       key={option.value}
                       type="button"
                       className={`support-topic-option ${topic === option.value ? "is-selected" : ""}`}
                       aria-pressed={topic === option.value}
                       onClick={() => {
                         setTopic(option.value);
                         setError("");
                       }}
                       data-testid={`button-support-topic-${option.value}`}
                     >
                       {option.label}
                     </button>
                   ))}
                 </div>
              </>
            )}
            {step === 2 && (
              <>
                <p>Agora me passe o dado que ajuda a localizar o caso.</p>
                <label className="support-field-label" htmlFor="support-email">
                  E-mail para resposta
                </label>
                <input
                  id="support-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Seu e-mail"
                  className="app-text-input"
                  autoComplete="email"
                  data-testid="input-support-email"
                />
                 {purchaseEmailRequired && (
                  <>
                    <label
                      className="support-field-label"
                      htmlFor="support-purchase-email"
                    >
                      E-mail usado na compra
                    </label>
                    <input
                      id="support-purchase-email"
                      type="email"
                      value={purchaseEmail}
                      onChange={(event) => setPurchaseEmail(event.target.value)}
                      placeholder="E-mail da compra"
                      className="app-text-input"
                      autoComplete="email"
                       required
                      data-testid="input-support-purchase-email"
                    />
                     <p className="support-field-hint">
                       Pode ser diferente do seu e-mail de contato.
                     </p>
                  </>
                )}
                 {purchaseEmailRequired && (
                  <>
                    <label
                      className="support-field-label"
                      htmlFor="support-payment-method"
                    >
                      Como você pagou?
                    </label>
                    <select
                      id="support-payment-method"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      className="app-text-input support-select"
                      data-testid="select-support-payment-method"
                    >
                      <option value="">Selecione uma opção</option>
                      <option value="pix">Pix</option>
                       <option value="card">Cartão</option>
                       <option value="unknown">Não lembro</option>
                    </select>
                  </>
                )}
                {topic === "convite" && (
                  <>
                    <label
                      className="support-field-label"
                      htmlFor="support-invite-link"
                    >
                      Cole aqui o link do convite que te mandaram (opcional)
                    </label>
                    <input
                      id="support-invite-link"
                       type="text"
                      value={inviteLink}
                      onChange={(event) => setInviteLink(event.target.value)}
                      placeholder="Cole o link que recebeu"
                      className="app-text-input"
                      data-testid="input-support-invite-link"
                    />
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <p>
                  {topic === "outro"
                    ? "Escreva o que aconteceu para eu conseguir te ajudar."
                    : "Se quiser, deixe mais detalhes. Os dados acima já ajudam a localizar seu caso."}
                </p>
                <label className="support-field-label" htmlFor="support-message">
                  Me conta com suas palavras{" "}
                  {topic === "outro" ? "(obrigatório)" : "(opcional)"}
                </label>
                <textarea
                  required={topic === "outro"}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                   placeholder="O que apareceu na tela?"
                  className="app-textarea"
                  rows={5}
                  data-testid="input-support-message"
                />
              </>
            )}
            {error && (
              <p className="checkout-error" role="alert">
                {error}
              </p>
            )}
            <div className="support-dialog-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="app-secondary-button"
                  onClick={() => {
                    setError("");
                    setStep((current) => (current - 1) as 1 | 2);
                  }}
                  data-testid="button-back-support"
                >
                  Voltar
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="app-primary-button"
                  onClick={nextStep}
                  data-testid="button-next-support"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="app-primary-button"
                  data-testid="button-send-support"
                >
                  {status === "sending" ? "Enviando…" : "Enviar"}
                </button>
              )}
            </div>
            {status === "error" && (
              <button
                type="button"
                className="app-secondary-button"
                onClick={() => void sendSupportMessage()}
                data-testid="button-retry-support"
              >
                Tentar de novo
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function Home({
  variant = "v1",
  experimentAssignment,
}: {
  variant?: "v1" | "v2";
  experimentAssignment?: StoredExperimentAssignment;
}) {
  const pricing = usePricing();
  const trackCtaClick = useLpTracking(variant, experimentAssignment);
  const [peekThemeId, setPeekThemeId] = useState<string | null>(null);
  const sourceFromUrl = new URLSearchParams(window.location.search).get(
    "source",
  );
  const storedSourceLp = safeGetItem("conexao-pending-source-lp");
  const checkoutSourceLp: "v1" | "v2" | "lp3" =
    sourceFromUrl === "lp3"
      ? "lp3"
      : storedSourceLp === "v1" || storedSourceLp === "v2"
        ? storedSourceLp
        : variant;
  const [landingQuizStep, setLandingQuizStep] = useState(0);
  const [landingQuizAnswers, setLandingQuizAnswers] =
    useState<LandingQuizAnswers>({});
  const checkoutController = useCheckout({
    sourceLp: checkoutSourceLp,
    onCtaClick: trackCtaClick,
    experimentAssignment,
  });
  const { startCheckout } = checkoutController;
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isStandaloneApp()) return;
    // If access is stored, StoredAccessGate handles redirecting to /app.
    if (safeGetItem("conexao-session") || safeGetItem("conexao-guest-token"))
      return;
    // An installed app without access sees the sales page; onboarding now requires access.
    if (
      window.location.pathname !== "/" &&
      window.location.pathname !== "/lp1"
    ) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const advanceLandingQuiz = (key: LandingQuizAnswerKey, value: string) => {
    setLandingQuizAnswers((current) => ({ ...current, [key]: value }));
    setLandingQuizStep((current) => Math.min(current + 1, 3));
  };
  return (
    <Shell
      dark
      showSiteFooter={variant !== "v2"}
      supportAction={
        variant !== "v2" && !checkoutController.checkoutOpen
          ? { label: "Preciso de ajuda", onClick: openSupportDialog }
          : undefined
      }
    >
      <StoredAccessGate />
      <main className={`lp-main ${variant === "v1" ? "lp2-rebuild" : ""}`}>
        {variant === "v2" ? (
          <LandingV2Quiz
            onBuy={() => startCheckout("couple")}
            onHeroBuy={() => startCheckout("couple", "hero_comprar")}
            onThemePeek={(themeId) => trackCtaClick(`theme_peek:${themeId}`)}
            checkoutOpen={checkoutController.checkoutOpen}
            onStartQuiz={() => {
              trackCtaClick("hero_quiz");
              navigate("/quiz?from=lp1");
            }}
          />
        ) : (
          <>
            <section className="lp-hero lp2-rebuild-hero" data-section-name="hero">
              <div className="lp-hero-inner">
                <div className="lp-hero-copy">
                  <span className="lp-eyebrow">
                    baralho digital de perguntas · para casais
                  </span>
                  <h1 className="lp-hero-h1">
                    Você quer a conversa.
                    <br />
                    Ele responde <strong className="lp2-hero-emphasis">"sei lá"</strong>.
                  </h1>
                  <p className="lp-hero-sub">
                    459 perguntas escritas pra abrir conversa de verdade — uma por
                    vez. Você abre, lê em voz alta, escuta. O resto acontece entre
                    vocês.
                  </p>
                  <p className="lp2-hero-support">
                    Responde 3 perguntas rápidas e recebe, na hora, 3 perguntas
                    feitas pro momento de vocês. Leva 1 minuto e é grátis — você
                    decide se quer o resto depois.
                  </p>
                  <div className="lp-hero-actions lp2-hero-actions">
                    <button
                      type="button"
                      className="lp-cta-primary lp-cta-big"
                      onClick={() => {
                        trackCtaClick("hero_quiz");
                        document
                          .getElementById("lp-quiz")
                          ?.scrollIntoView({
                            behavior: window.matchMedia(
                              "(prefers-reduced-motion: reduce)",
                            ).matches
                              ? "auto"
                              : "smooth",
                          });
                      }}
                      data-testid="button-hero-quiz-start"
                    >
                      Começar o teste grátis <ArrowRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startCheckout("couple", "hero_comprar")}
                      className="lp-cta-secondary-link"
                      data-testid="link-hero-buy"
                    >
                      Já sei o que quero: comprar agora →
                    </button>
                  </div>
                  <p className="lp2-hero-security">
                    🔒 Pagamento seguro · 7 dias de garantia. Não gostou, devolvo.
                  </p>
                </div>
                <div className="lp-hero-mockups" aria-hidden="true">
                  <div className="lp-mockup-mac">
                    <div className="lp-mockup-mac-bar">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="lp-mockup-mac-screen">
                      <div className="lp-mock-card lp-mock-card-front">
                        <span className="lp-mock-tag">porto seguro</span>
                        <p className="lp-mock-text">
                          "Qual foi a última vez que você se sentiu{" "}
                          <em>completamente</em> em casa comigo?"
                        </p>
                        <span className="lp-mock-num">03 / 31</span>
                      </div>
                    </div>
                  </div>
                  <div className="lp-mockup-phone">
                    <div className="lp-mockup-phone-notch" />
                    <div className="lp-mockup-phone-screen">
                      <div className="lp-mock-card lp-mock-card-back">
                        <span className="lp-mock-tag lp-mock-tag-vibe">
                          faísca
                        </span>
                        <p className="lp-mock-text">
                          "O que em mim ainda te <em>surpreende?</em>"
                        </p>
                        <span className="lp-mock-num">07 / 31</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="lp2-hero-strip">
                459 perguntas · 15 baralhos · jogo a distância · acesso vitalício
              </p>
            </section>
            <section className="lp2-simple-section lp2-sei-la" data-section-name="sei-la">
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">a pergunta que todo mundo faz</p>
                <h2 className="lp-h2">E se ele responder <em>"sei lá"</em>?</h2>
                <p className="lp2-section-lede">
                  É o medo de todo mundo. É por isso que o baralho começa leve.
                  Ninguém abre o jogo numa pergunta pesada. As primeiras são fáceis
                  de responder até pra quem trava. A profundidade vem depois, quando
                  os dois já estão dentro da conversa.
                </p>
                <div className="lp2-intensity-grid">
                  {[
                    ["Leve", "Que talento inútil você tem orgulho secreto de ter?"],
                    ["Honesta", "Tem algo que você precisa e ainda não pediu?"],
                    ["Profunda", "Que peso você carrega que nunca dividiu com ninguém?"],
                  ].map(([label, question]) => (
                    <article className="lp2-intensity-card" key={label}>
                      <span>{label}</span>
                      <p>“{question}”</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
            <section
              className="lp-quiz-section"
              id="lp-quiz"
              data-section-name="quiz"
            >
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">
                  experimente agora, de graça
                </p>
                <h2 className="lp-h2">
                  Responda 3 perguntas rápidas e receba
                  <br />
                  <em>3 perguntas feitas pro momento de vocês.</em>
                </h2>
                <p className="lp-solution-lede lp2-quiz-lede">
                  Leva menos de 1 minuto. A gente monta na hora um mini-baralho
                  com a cara da fase que vocês estão vivendo.
                </p>
                <LandingQuiz
                  onFinish={() => startCheckout("couple")}
                  step={landingQuizStep}
                  answers={landingQuizAnswers}
                  onAnswer={advanceLandingQuiz}
                />
              </div>
            </section>
            <section className="lp-pain" data-section-name="dor">
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">quem tá aí sabe</p>
                <h2 className="lp-h2">
                  Você olha pra ele(a) e pensa:
                  <br />
                  <em>"onde a gente se perdeu?"</em>
                </h2>
                <ul className="lp-pain-list">
                  <li>
                    <span className="lp-pain-icon">◌</span>
                    <div>
                      <strong>As conversas viraram logística.</strong>
                      <p>
                        "Buscou pão?" "Que horas vem?" "Feriado a gente vai onde?"
                        E então o assunto acaba.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className="lp-pain-icon">◌</span>
                    <div>
                      <strong>Cada um no próprio celular.</strong>
                      <p>
                        Sentados no mesmo sofá, quilômetros de distância um do outro,
                        por isso a noite passa sem encontro.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span className="lp-pain-icon">◌</span>
                    <div>
                      <strong>Você tentou "vamos conversar".</strong>
                      <p>
                        Deu silêncio, resposta seca, ou desviou pro Netflix. Mas
                        ninguém ensinou por onde começar.
                      </p>
                    </div>
                  </li>
                </ul>
                <p className="lp-pain-close">
                  Não é falta de amor. É que{" "}
                  <strong>ninguém ensinou a fazer as perguntas certas.</strong>
                </p>
              </div>
            </section>
            <section className="lp2-comparison-section" data-section-name="comparativo">
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">a diferença</p>
                <h2 className="lp-h2">O que muda numa noite.</h2>
                <div className="lp2-comparison" role="table" aria-label="Comparação de uma noite sem e com o baralho">
                  <div className="lp2-comparison-column lp2-comparison-without" role="rowgroup">
                    <h3>Sem o baralho</h3>
                    {[
                      '"E aí, como foi o dia?" — "Normal."',
                      "Cada um rolando o próprio celular",
                      "Você quer conversar e não sabe começar",
                      'A conversa morre no "sei lá"',
                      "Amanhã é igual",
                    ].map((item) => (
                      <p key={item} role="row">
                        <X className="lp2-comparison-mark" size={22} aria-hidden="true" />
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                  <div className="lp2-comparison-column lp2-comparison-with" role="rowgroup">
                    <h3>Com o baralho</h3>
                    {[
                      "Uma pergunta que ele nunca ouviu antes",
                      "Um celular entre os dois — ou cada um no seu",
                      "A pergunta já está pronta, é só ler",
                      "Começa leve, e vocês escolhem até onde vai",
                      "Amanhã tem mais 458",
                    ].map((item) => (
                      <p key={item} role="row">
                        <Check className="lp2-comparison-mark" size={22} aria-hidden="true" />
                        <span>{item}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <section className="lp2-simple-section lp2-vergonha" data-section-name="vergonha">
              <div className="lp-container lp2-narrow">
                <p className="lp-eyebrow lp-eyebrow-center">e antes que você pense nisso</p>
                <h2 className="lp-h2">Não precisa ficar sem jeito.</h2>
                <p className="lp2-section-lede">
                  Ninguém quer parecer intenso demais, nem começar do nada com
                  "me diz uma coisa profunda". O baralho faz a pergunta por você —
                  você só lê em voz alta. A pergunta é dele, o mérito é seu.
                </p>
              </div>
            </section>
            <section className="lp2-distance-section" data-section-name="proposta">
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">longe também conta</p>
                <h2 className="lp-h2">Respondam juntos, cada um no seu celular.</h2>
                <p className="lp2-section-lede">
                  Namoro à distância, viagem a trabalho, ou cada um no seu quarto:
                  você cria uma sala, manda o código, e os dois ficam na mesma
                  pergunta ao mesmo tempo.
                </p>
              </div>
            </section>
            <section
              className="lp-themes"
              id="pacotes"
              data-section-name="pacotes"
            >
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">o que tem dentro</p>
                <h2 className="lp-h2">
                  15 baralhos temáticos,
                  <br />
                  <em>pra cada momento de vocês.</em>
                </h2>
                <div className="lp-themes-grid">
                  {[
                    ["Porto Seguro", "As conversas que parecem casa.", 31, "porto-seguro"],
                    ["Livro Aberto", "Sem filtro, cara a cara.", 31, "livro-aberto"],
                    [
                      "Você Não Sabia",
                      "Descobertas que ainda cabem entre vocês.",
                      32,
                      "voce-nao-sabia",
                    ],
                    ["Em Voz Alta", "A vida que os dois querem construir.", 30, "em-voz-alta"],
                    ["Lá Atrás", "O que formou quem você é hoje.", 28, "la-atras"],
                    ["Modo Leve", "Pra rir e não levar tão a sério.", 31, "modo-leve"],
                    ["Viagens", "Lugares que já foram e ainda vão ser.", 30, "viagens"],
                    ["Carreira & Dinheiro", "Como pensam o lado prático.", 30, "carreira-dinheiro"],
                    ["Depois da Tempestade", "O caminho de volta.", 30, "depois-da-tempestade"],
                    ["Faísca", "O lado mais provocante de vocês.", 31, "faisca"],
                    [
                      "Luzes Baixas",
                      "Quando a noite pede mais coragem. 18+",
                      35,
                      "luzes-baixas",
                    ],
                    ["Fogo Alto", "Desejos, curiosidades, limites. 18+", 30, "fogo-alto"],
                    ["Sem Freio", "O mais ousado. Só pra quem topa. 18+", 30, "sem-freio"],
                    ["Mesmo Longe", "Quando rotina ou distância afastam.", 30, "mesmo-longe"],
                    ["Perto de Novo", "Esquentar o espaço entre vocês.", 30, "perto-de-novo"],
                  ].map(([name, description, count, themeId], index) => (
                    <button
                      key={String(name)}
                      type="button"
                      className={`lp-theme-card ${index > 8 ? "lp-theme-vibe" : ""}`}
                      onClick={() => {
                        setPeekThemeId(String(themeId));
                        trackCtaClick(`theme_peek:${String(themeId)}`);
                      }}
                      data-testid={`button-lp-theme-${String(themeId)}`}
                    >
                      <strong>{name}</strong>
                      <p>{description}</p>
                      <span>{count} cartas</span>
                    </button>
                  ))}
                </div>
                <p className="lp-themes-note">
                  <strong>459 perguntas no total.</strong> Novos baralhos
                  entram de tempos em tempos — o acesso é vitalício.
                </p>
              </div>
            </section>
            <Lp3Testimonials />
            <section
              className="lp-price lp2-offer-section"
              id="lp-precos"
              data-section-name="precos"
            >
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">acesso vitalício</p>
                <h2 className="lp-h2">
                  Hoje vira mais uma noite cada um no seu celular.
                </h2>
                <p className="lp2-offer-sub">
                  Ou vocês podem estar tendo a conversa de verdade daqui a dez
                  minutos. São 3 passos:
                </p>
                <div className="lp2-offer-card">
                  <p className="lp2-offer-anchor">
                    459 perguntas · 15 baralhos · 212 mil salvamentos no TikTok
                  </p>
                  <ol className="lp2-offer-steps">
                    <li>
                      <strong>Você paga.</strong>{" "}
                      {pricing.pixAvailable
                        ? "Pix cai na hora e o acesso abre sozinho."
                        : "O acesso abre sozinho, na hora."}
                    </li>
                    <li>
                      <strong>Convida ele(a).</strong> Um link. A pessoa entra sem
                      pagar de novo.
                    </li>
                    <li>
                      <strong>Escolhem um baralho.</strong> Leem a primeira pergunta
                      em voz alta. Pronto.
                    </li>
                  </ol>
                  <p className="lp2-offer-price">
                    <span>459 perguntas por</span> {pricing.display}
                  </p>
                  <p className="lp2-offer-price-note">uma vez, pra sempre — sem mensalidade</p>
                  <button
                    onClick={() => startCheckout("couple")}
                    className="lp-cta-primary lp-cta-full lp2-offer-cta"
                    data-testid="button-price-cta"
                  >
                    Começar hoje à noite <ArrowRight size={18} />
                  </button>
                  <p className="lp2-offer-micro">
                    Acesso imediato · Pagamento seguro · Garantia de 7 dias
                  </p>
                  <p className="lp2-offer-guarantee">
                    Uma por noite, dá mais de um ano de conversa — e fica com vocês
                    pra sempre. 7 dias de garantia: se não mexer com vocês, eu
                    devolvo. Você não arrisca nada.
                  </p>
                </div>
              </div>
            </section>
            <section className="lp-faq" data-section-name="faq">
              <div className="lp-container">
                <p className="lp-eyebrow lp-eyebrow-center">
                  antes que você pergunte
                </p>
                <h2 className="lp-h2">Ainda em dúvida?</h2>
                <div className="lp-faq-list">
                  {[
                    [
                      "Isso substitui terapia de casal?",
                      "Não, e nem promete isso. É um empurrão pra vocês conversarem sozinhos. Não substitui acompanhamento se a relação precisa. Mas pra sair do piloto automático, resolve hoje à noite.",
                    ],
                    [
                      'Por que não só "vamos conversar"?',
                      '"Vamos conversar" trava: ninguém sabe por onde começar. O baralho já traz a pergunta certa, na ordem certa, do leve ao profundo.',
                    ],
                    [
                      "E se a gente não terminar?",
                      "Não tem tempo nem ordem obrigatória. Uma pergunta por noite já muda a conversa. O acesso é vitalício — dá pra voltar quando quiser.",
                    ],
                  ].map(([question, answer]) => (
                    <details key={question} className="lp-faq-item">
                      <summary>{question}</summary>
                      <p>{answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      {variant === "v1" && peekThemeId
        ? (() => {
            const peek = getThemePeek(peekThemeId);
            return peek ? (
              <ThemePeekDialog
                peek={peek}
                onClose={() => setPeekThemeId(null)}
                onBuy={() => {
                  setPeekThemeId(null);
                  startCheckout("couple");
                }}
              />
            ) : null;
          })()
        : null}
      <CheckoutModal checkout={checkoutController} />
    </Shell>
  );
}

function TrackedLp3({
  experimentAssignment,
}: {
  experimentAssignment?: StoredExperimentAssignment;
}) {
  const trackCtaClick = useLpTracking("lp3", experimentAssignment);
  const checkout = useCheckout({
    sourceLp: "lp3",
    experimentAssignment,
  });

  return (
    <>
      <Lp3
        onCtaClick={(ctaSource) => trackCtaClick(ctaSource)}
        onCheckout={() => checkout.startCheckout("couple")}
        showSupportAction={!checkout.checkoutOpen}
      />
      <CheckoutModal checkout={checkout} />
    </>
  );
}

function TrackedQuiz({
  experimentAssignment,
}: {
  experimentAssignment?: StoredExperimentAssignment;
}) {
  const trackCtaClick = useLpTracking("v2", experimentAssignment);
  const checkout = useCheckout({
    sourceLp: "v2",
    onCtaClick: trackCtaClick,
    experimentAssignment,
  });
  const [, navigate] = useLocation();
  const quizOrigin = new URLSearchParams(window.location.search).get("from");
  const quizReturnPath = quizOrigin === "lp1" ? "/lp1" : "/";

  useEffect(() => {
    const handlePopState = () => {
      if (checkout.checkoutOpen) return;
      navigate(quizReturnPath, { replace: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [checkout.checkoutOpen, navigate, quizReturnPath]);

  return (
    <>
      <Lp1Quiz
        onFinish={() => checkout.startCheckout("couple")}
        onBackToLanding={() => navigate(quizReturnPath)}
        experimentAssignment={experimentAssignment}
      />
      <CheckoutModal checkout={checkout} />
    </>
  );
}

const PRIMARY_LANDING_CACHE_KEY = "conexao-primary-landing";

function readCachedPrimaryLanding(): LandingPageId {
  if (typeof window === "undefined") return DEFAULT_PRIMARY_LANDING_PAGE_ID;
  try {
    const cached = window.localStorage.getItem(PRIMARY_LANDING_CACHE_KEY);
    const landing = cached ? getLandingPageById(cached) : undefined;
    return landing?.id ?? DEFAULT_PRIMARY_LANDING_PAGE_ID;
  } catch {
    return DEFAULT_PRIMARY_LANDING_PAGE_ID;
  }
}

function PrimaryLandingPageRoute() {
  const [landingPageId, setLandingPageId] = useState<LandingPageId>(
    readCachedPrimaryLanding,
  );

  useEffect(() => {
    let mounted = true;
    fetch(apiUrl("/api/landing-pages/primary"))
      .then(async (response) => {
        if (!response.ok) throw new Error("primary-landing-page");
        return (await response.json()) as { primaryLandingPage?: string };
      })
      .then((data) => {
        if (!mounted) return;
        const landing = data.primaryLandingPage
          ? getLandingPageById(data.primaryLandingPage)
          : undefined;
        const resolved = landing?.id ?? DEFAULT_PRIMARY_LANDING_PAGE_ID;
        try {
          window.localStorage.setItem(PRIMARY_LANDING_CACHE_KEY, resolved);
        } catch {
          // Sem localStorage a página continua funcionando com o padrão.
        }
        setLandingPageId((current) => (current === resolved ? current : resolved));
      })
      .catch(() => {
        // A pessoa já está vendo o cache ou o padrão. Não faz nada.
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (landingPageId === "lp3") return <TrackedLp3 />;
  return <Home variant={landingPageId === "v2" ? "v2" : "v1"} />;
}

function ExperimentUnavailable() {
  return (
    <main className="experiment-link-state" role="status">
      <div className="experiment-link-state-mark">
        <FlaskConical size={22} />
      </div>
      <p className="lp-eyebrow">link de experimento</p>
      <h1>Este experimento não está disponível.</h1>
      <p>
        O link pode estar em rascunho, pausado ou já ter sido encerrado. Tente
        novamente mais tarde.
      </p>
      <Link href="/" className="button button-primary">
        Conhecer o projeto
      </Link>
    </main>
  );
}

function ExperimentLinkRoute() {
  const { experimentSlug = "" } = useParams<{ experimentSlug: string }>();
  const [state, setState] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [landingPage, setLandingPage] = useState("");
  const [experimentAssignment, setExperimentAssignment] =
    useState<StoredExperimentAssignment>();

  useEffect(() => {
    let mounted = true;
    const visitorKey = getOrCreateVisitorKey();
    const encodedSlug = encodeURIComponent(experimentSlug);
    fetch(
      apiUrl(
        `/api/experiments/link/${encodedSlug}?visitorKey=${encodeURIComponent(visitorKey)}`,
      ),
    )
      .then(async (response) => {
        const data = (await response.json()) as StoredExperimentAssignment & {
          landingPage?: string;
        };
        const landing = data.landingPage
          ? data.landingPage === "/"
            ? getLandingPageById("v2")
            : getLandingPageByPath(data.landingPage)
          : undefined;
        if (!response.ok || !landing) {
          throw new Error(response.status === 404 ? "unavailable" : "error");
        }
        return { assignment: data, landing };
      })
      .then(({ assignment, landing }) => {
        if (!mounted) return;
        storeExperimentAssignment(assignment);
        setExperimentAssignment(assignment);
        setLandingPage(landing.path);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setState(
          error instanceof Error && error.message === "unavailable"
            ? "unavailable"
            : "error",
        );
      });
    return () => {
      mounted = false;
    };
  }, [experimentSlug]);

  if (state === "loading") {
    return (
      <main className="experiment-link-state" role="status" aria-live="polite">
        <div className="experiment-link-state-mark">
          <FlaskConical size={22} />
        </div>
        <p>Preparando seu experimento…</p>
      </main>
    );
  }
  if (state !== "ready") return <ExperimentUnavailable />;
  if (landingPage === "/lp3") {
    return <TrackedLp3 experimentAssignment={experimentAssignment} />;
  }
  return (
    <Home
      variant={landingPage === "/lp1" || landingPage === "/" ? "v2" : "v1"}
      experimentAssignment={experimentAssignment}
    />
  );
}

function AccessPill({ access }: { access: any }) {
  return (
    <div className="access-pill" data-testid="status-access">
      <span className="access-dot" />
      {access?.hasAccess
        ? `${access.packageName || "Acesso ativo"}`
        : "Modo demonstração"}
    </div>
  );
}

function useDeviceViewport() {
  useEffect(() => {
    const standalone = isStandaloneApp();

    const updateViewport = () => {
      const width = Math.max(document.documentElement.clientWidth, 1);
      // In an installed PWA, keep the app on the stable layout viewport.
      // visualViewport changes as browser chrome/keyboard animates and makes
      // the deck jump even when the user is only scrolling.
      const height = Math.max(
        standalone
          ? window.innerHeight
          : window.visualViewport?.height || window.innerHeight,
        1,
      );
      const availableCardHeight = Math.max(250, height - 210);
      const maxCardWidth = Math.min(width * 0.88, 384);
      const cardHeight = Math.min(availableCardHeight, (maxCardWidth * 4) / 3);
      const cardWidth = cardHeight * 0.75;
      const availableThemeHeight = Math.max(220, height - 270);
      const compactScreen = width <= 380;
      const themeWidth = Math.min(
        width * (compactScreen ? 0.64 : 0.72),
        320,
        availableThemeHeight * (compactScreen ? 0.68 : 0.75),
      );

      document.documentElement.style.setProperty(
        "--device-width",
        `${width}px`,
      );
      document.documentElement.style.setProperty(
        "--device-height",
        `${height}px`,
      );
      document.documentElement.style.setProperty(
        "--device-vh",
        `${height * 0.01}px`,
      );
      document.documentElement.style.setProperty(
        "--question-card-width",
        `${cardWidth}px`,
      );
      document.documentElement.style.setProperty(
        "--question-card-height",
        `${(cardWidth * 4) / 3}px`,
      );
      document.documentElement.style.setProperty(
        "--theme-card-width",
        `${themeWidth}px`,
      );
      document.documentElement.style.setProperty(
        "--theme-card-height",
        `${(themeWidth * 4) / 3}px`,
      );
    };

    updateViewport();
    window.addEventListener("orientationchange", updateViewport);
    if (!standalone) {
      window.addEventListener("resize", updateViewport);
      window.visualViewport?.addEventListener("resize", updateViewport);
    }

    return () => {
      window.removeEventListener("orientationchange", updateViewport);
      if (!standalone) {
        window.removeEventListener("resize", updateViewport);
        window.visualViewport?.removeEventListener("resize", updateViewport);
      }
    };
  }, []);
}

function AppExperience() {
  const queryClientRef = useQueryClient();
  const {
    data: themesData,
    isLoading: themesLoading,
    isError: themesError,
  } = useListQuestionThemes({
    query: { queryKey: getListQuestionThemesQueryKey() },
  });
  const themes = themesData?.length ? themesData : fallbackThemes;
  const [themeId, setThemeId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState(
    () => safeGetItem("conexao-session") || "",
  );
  const [welcomeOpen, setWelcomeOpen] = useState(
    !safeGetItem("conexao-name") && !safeGetItem("conexao-guest-token"),
  );
  const [buyerName, setBuyerName] = useState(
    () => safeGetItem("conexao-name") || "",
  );
  const role = safeGetItem("conexao-role");
  const isGuest = role === "guest" || !!safeGetItem("conexao-guest-token");
  const isOwner = !isGuest;
  const guestDisplayName = safeGetItem("conexao-guest-name") || "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const accessQuery = useGetAccessPreview({
    query: { queryKey: ["access-preview"] },
  });
  const sessionQuery = useGetQuestionSession(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetQuestionSessionQueryKey(sessionId),
    },
  });
  const questionParams = { theme: themeId || undefined };
  const questionsQuery = useListQuestions(questionParams, {
    query: {
      enabled: !!themeId,
      queryKey: getListQuestionsQueryKey(questionParams),
    },
  });
  const createSession = useCreateQuestionSession();
  const createInvite = useCreateInvite();
  const questions = themeId
    ? questionsQuery.data?.length
      ? questionsQuery.data
      : fallbackQuestions.filter((q) => q.themeId === themeId).length
        ? fallbackQuestions.filter((q) => q.themeId === themeId)
        : fallbackQuestions
    : [];
  const currentQuestion = questions.length
    ? questions[questionIndex % questions.length]
    : null;
  const questionAt = (offset: number) =>
    questions[
      (questionIndex + offset + questions.length) %
        Math.max(questions.length, 1)
    ] || fallbackQuestions[0];
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data
    ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit
    : !!accessQuery.data?.canInvite;
  const inviteLimit =
    sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed =
    sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;
  const invitesList: InviteListItem[] = [];
  const cancelInvite = (_invite: InviteListItem) => {};

  const changeTheme = (id: string) => {
    setThemeId(id);
    setQuestionIndex(0);
  };
  const nextQuestion = () => {
    setQuestionIndex((i) => (i + 1) % Math.max(questions.length, 1));
  };
  const startSession = () => {
    if (!buyerName.trim()) return;
    safeSetItem("conexao-name", buyerName.trim());
    createSession.mutate(
      { data: { buyerName: buyerName.trim(), packageId: "couple" } },
      {
        onSuccess: (session) => {
          setSessionId(session.id);
          safeSetItem("conexao-session", session.id);
          setWelcomeOpen(false);
          queryClientRef.invalidateQueries({
            queryKey: getGetQuestionSessionQueryKey(session.id),
          });
        },
        onError: () => setWelcomeOpen(false),
      },
    );
  };
  const makeInvite = () => {
    if (!isOwner || !sessionId || !guestName.trim()) return;
    createInvite.mutate(
      { sessionId, data: { guestName: guestName.trim() } },
      {
        onSuccess: (result) => {
          setInviteResult(result);
          queryClientRef.invalidateQueries({
            queryKey: getGetQuestionSessionQueryKey(sessionId),
          });
          queryClientRef.invalidateQueries({
            queryKey: getListInvitesQueryKey(sessionId),
          });
        },
      },
    );
  };
  const copyInvite = () => {
    if (!inviteResult?.token) return;
    const clipboardWrite = navigator.clipboard?.writeText(
      inviteUrlFromToken(inviteResult.token),
    );
    if (!clipboardWrite) return;
    clipboardWrite
      .then(() => {
        setCopiedInvite(true);
        window.setTimeout(() => setCopiedInvite(false), 2000);
      })
      .catch(() => {});
  };
  const selectedTheme = themes.find((theme) => theme.id === themeId);
  const dailyTotal = selectedTheme?.count || questions.length || 1;
  const dailyPosition = questions.length
    ? (questionIndex % questions.length) + 1
    : 1;
  return (
    <Shell dark>
      <main className="experience-page experience-page-stories ritual-app">
        <div className="experience-top stories-top ritual-top">
          <div>
            <p className="stories-kicker">o ritual de hoje</p>
            <h1>
              Escolha uma <em>intenção.</em>
            </h1>
          </div>
          <AccessPill access={activeAccess} />
        </div>
        {!themeId ? (
          <section className="intention-gate" aria-labelledby="intention-title">
            <div className="intention-intro">
              <p className="ritual-label">antes da primeira carta</p>
              <h2 id="intention-title">
                De onde vocês
                <br />
                <em>querem se encontrar?</em>
              </h2>
              <p>
                Escolha o que merece espaço hoje. A pergunta chega depois — uma
                só, no tempo de vocês.
              </p>
            </div>
            <div className="intention-wheel" aria-label="Objetivos de conexão">
              <div className="wheel-core">
                <span className="wheel-core-mark">
                  <Heart size={19} />
                </span>
                <span>
                  uma pausa
                  <br />
                  <em>para nós</em>
                </span>
              </div>
              <div className="wheel-ring" />
              {themesLoading ? (
                <div className="wheel-loading">
                  <span />
                  <span />
                  <span />
                </div>
              ) : (
                themes.map((theme, index) => (
                  <button
                    key={theme.id}
                    onClick={() => changeTheme(theme.id)}
                    className={`intention-card intention-card-${index % 5}`}
                    data-testid={`button-intention-${theme.id}`}
                  >
                    <span className="intention-index">0{index + 1}</span>
                    <strong>{theme.title}</strong>
                    <small>{theme.description}</small>
                    <span className="intention-topics">
                      {theme.count} tópicos
                    </span>
                  </button>
                ))
              )}
            </div>
            {themesError && (
              <div className="intention-error">
                <span>Mostrando uma seleção essencial.</span>
                <button
                  onClick={() =>
                    queryClientRef.invalidateQueries({
                      queryKey: getListQuestionThemesQueryKey(),
                    })
                  }
                  data-testid="button-retry-themes"
                >
                  Tentar novamente <RotateCw size={13} />
                </button>
              </div>
            )}
            <p className="intention-hint">
              <Sparkles size={14} /> O baralho se adapta à intenção que
              escolherem.
            </p>
          </section>
        ) : (
          <div className="ritual-deck-layout">
            <aside className="ritual-sidebar">
              <button
                className="change-intention"
                onClick={() => setThemeId(null)}
                data-testid="button-change-intention"
              >
                <ChevronLeft size={15} /> mudar intenção
              </button>
              <div className="selected-intention">
                <span className="ritual-label">intenção de hoje</span>
                <h2>{selectedTheme?.title || "Presença"}</h2>
                <p>{selectedTheme?.description}</p>
              </div>
              <div className="daily-curation">
                <div className="curation-heading">
                  <span>curadoria diária</span>
                  <strong>
                    {dailyPosition} <i>/ {dailyTotal}</i>
                  </strong>
                </div>
                <div className="curation-bar">
                  <span
                    style={{
                      width: `${Math.min((dailyPosition / dailyTotal) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p>
                  Uma seleção feita para chegar devagar, sem pressa de terminar.
                </p>
              </div>
              <div className="saved-summary">
                <BookmarkCheck size={16} />
                <span>
                  {saved.length
                    ? `${saved.length} salva${saved.length === 1 ? "" : "s"} para depois`
                    : "salve uma pergunta para voltar a ela"}
                </span>
              </div>
            </aside>
            <section className="ritual-question-area">
              <div className="deck-heading">
                <div>
                  <span className="ritual-label">baralho de hoje</span>
                  <strong>
                    {String(dailyPosition).padStart(2, "0")}{" "}
                    <i>
                      de{" "}
                      {String(questions.length || dailyTotal).padStart(2, "0")}
                    </i>
                  </strong>
                </div>
                <span className="deck-theme-dot">
                  <span /> {selectedTheme?.title}
                </span>
              </div>
              <div className="ritual-question-stage">
                {questionsQuery.isLoading ? (
                  <div className="ritual-question-card ritual-loading-card">
                    <div className="skeleton-line short" />
                    <div className="skeleton-line wide" />
                    <div className="skeleton-line" />
                  </div>
                ) : questionsQuery.isError ? (
                  <div className="ritual-empty-card">
                    <p>Reconectando…</p>
                    <button
                      onClick={() => questionsQuery.refetch()}
                      className="text-link"
                      data-testid="button-retry-questions"
                    >
                      Tentar agora <RotateCw size={15} />
                    </button>
                  </div>
                ) : currentQuestion ? (
                  <article
                    key={currentQuestion.id}
                    className={`ritual-question-card intensity-${currentQuestion.intensity}`}
                    data-testid={`card-question-${currentQuestion.id}`}
                  >
                    <div className="ritual-card-top">
                      <span>{selectedTheme?.title}</span>
                      <button
                        className={
                          saved.includes(currentQuestion.id) ? "is-saved" : ""
                        }
                        onClick={() =>
                          setSaved((s) =>
                            s.includes(currentQuestion.id)
                              ? s.filter((id) => id !== currentQuestion.id)
                              : [...s, currentQuestion.id],
                          )
                        }
                        aria-label={
                          saved.includes(currentQuestion.id)
                            ? "Remover dos salvos"
                            : "Salvar pergunta para depois"
                        }
                        data-testid={`button-save-card-${currentQuestion.id}`}
                      >
                        <Bookmark
                          size={18}
                          fill={
                            saved.includes(currentQuestion.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </div>
                    <div className="ritual-question-copy">
                      <Quote size={29} />
                      <p>{currentQuestion.text}</p>
                    </div>
                  </article>
                ) : null}
              </div>
              <div className="ritual-question-actions">
                <button
                  onClick={() =>
                    setQuestionIndex(
                      (i) =>
                        (i - 1 + questions.length) %
                        Math.max(questions.length, 1),
                    )
                  }
                  className="round-button ritual-nav-button"
                  aria-label="Pergunta anterior"
                  data-testid="button-previous-question"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={nextQuestion}
                  className="button ritual-next-button"
                  data-testid="button-next-question"
                >
                  Próxima pergunta <ArrowRight size={16} />
                </button>
                <button
                  onClick={() =>
                    currentQuestion &&
                    setSaved((s) =>
                      s.includes(currentQuestion.id)
                        ? s.filter((id) => id !== currentQuestion.id)
                        : [...s, currentQuestion.id],
                    )
                  }
                  className={`ritual-save-button ${currentQuestion && saved.includes(currentQuestion.id) ? "is-saved" : ""}`}
                  data-testid="button-save-question"
                >
                  {currentQuestion && saved.includes(currentQuestion.id) ? (
                    <BookmarkCheck size={17} />
                  ) : (
                    <Bookmark size={17} />
                  )}{" "}
                  {currentQuestion && saved.includes(currentQuestion.id)
                    ? "Salva para depois"
                    : "Salvar para depois"}
                </button>
              </div>
            </section>
          </div>
        )}
        {themeId && isOwner && (
          <aside className="invite-panel ritual-invite-panel">
            <div className="invite-icon">
              <Users size={20} />
            </div>
            <div>
              <p className="section-kicker">para esta conversa</p>
              <h3>Traga alguém</h3>
            </div>
            <p className="invite-copy">
              Uma pergunta pode encontrar vocês em qualquer lugar.
            </p>
            <button
              onClick={() => setInviteOpen(true)}
              className="button ritual-invite-button"
              disabled={!canInvite && !!sessionId}
              data-testid="button-open-invite"
            >
              Traga alguém <Send size={15} />
            </button>
            <span className="invite-limit">
              {activeAccess
                ? `${inviteLimit - invitesUsed} convites disponíveis`
                : "Convites disponíveis após o acesso"}
            </span>
          </aside>
        )}
      </main>
      {welcomeOpen && (
        <div className="modal-backdrop">
          <div className="welcome-modal">
            <button
              className="modal-close"
              onClick={() => setWelcomeOpen(false)}
              data-testid="button-close-welcome"
            >
              <X size={18} />
            </button>
            <div className="welcome-flourish">
              <Feather size={22} />
            </div>
            <p className="section-kicker">antes de começar</p>
            <h2>
              Como podemos
              <br />
              <em>te chamar?</em>
            </h2>
            <p>
              É só para deixar este espaço um pouco mais seu. Você pode entrar
              sem preencher nada.
            </p>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startSession()}
              placeholder="Seu nome"
              className="text-input"
              data-testid="input-buyer-name"
            />
            <button
              onClick={startSession}
              className="button button-primary button-full"
              data-testid="button-enter-experience"
            >
              {createSession.isPending
                ? "Abrindo seu espaço…"
                : "Entrar na experiência"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
      {inviteOpen && isOwner && (
        <div className="modal-backdrop" onClick={() => setInviteOpen(false)}>
          <div
            className="invite-modal invite-modal-hub"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setInviteOpen(false)}
              data-testid="button-close-invite"
            >
              <X size={18} />
            </button>
            <p className="section-kicker">quem joga com você</p>
            <h2>
              Convidados
              <br />
              <em>desse baralho.</em>
            </h2>
            <div className="invite-hub-stats">
              <div>
                <strong>
                  {invitesList.filter((invite) => invite.isUsed).length}
                </strong>
                <small>entraram</small>
              </div>
              <div>
                <strong>
                  {invitesList.filter((invite) => !invite.isUsed).length}
                </strong>
                <small>aguardando</small>
              </div>
              <div>
                <strong>{Math.max(0, inviteLimit - invitesList.length)}</strong>
                <small>cadeiras livres</small>
              </div>
            </div>
            {invitesList.length > 0 && (
              <ul className="invite-hub-list" aria-label="Convites">
                {invitesList.map((invite) => {
                  const initial = (invite.guestName || "?")
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <li
                      key={invite.token}
                      className={`invite-hub-row${invite.isUsed ? " is-active" : ""}`}
                      data-testid={`companion-${invite.token}`}
                    >
                      <div
                        className={`invite-hub-avatar${invite.isUsed ? " is-active" : ""}`}
                      >
                        {initial}
                      </div>
                      <div className="invite-hub-main">
                        <span className="invite-hub-name">
                          {invite.guestName}
                        </span>
                        <span className="invite-hub-status">
                          {invite.isUsed && invite.usedAt
                            ? `entrou em ${new Date(invite.usedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                            : "aguardando aceitar"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelInvite(invite)}
                        className="invite-hub-remove"
                        aria-label={`Desconvidar ${invite.guestName}`}
                        data-testid={`button-cancel-invite-${invite.token}`}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {canInvite ? (
              inviteResult ? (
                <div className="invite-hub-success">
                  <div className="success-seal">
                    <Check size={22} />
                  </div>
                  <p className="section-kicker">convite criado</p>
                  <h3>
                    Compartilhe com <em>{inviteResult.guestName}</em>
                  </h3>
                  <div className="invite-share-block invite-share-block-light">
                    <button
                      onClick={copyInvite}
                      className="invite-share-button"
                      data-testid="button-copy-invite"
                    >
                      <Copy size={18} />{" "}
                      {copiedInvite ? "Copiado!" : "Copiar link do convite"}
                    </button>
                    <details className="invite-share-details">
                      <summary>Ver o link</summary>
                      <input
                        readOnly
                        value={
                          inviteResult.token
                            ? inviteUrlFromToken(inviteResult.token)
                            : ""
                        }
                        className="text-input"
                        data-testid="input-invite-url"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    </details>
                  </div>
                  <button
                    onClick={() => {
                      setInviteResult(null);
                      setGuestName("");
                      setCopiedInvite(false);
                    }}
                    className="text-link"
                    data-testid="button-new-invite"
                  >
                    Criar outro convite <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="invite-hub-form">
                  <p className="section-kicker">novo convite</p>
                  <label className="invite-hub-label" htmlFor="guest-name">
                    Nome de quem vai receber
                  </label>
                  <input
                    id="guest-name"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    className="text-input"
                    placeholder="Ex: Ana"
                    data-testid="input-guest-name"
                  />
                  <button
                    onClick={makeInvite}
                    className="button button-primary button-full"
                    disabled={!guestName.trim() || createInvite.isPending}
                    data-testid="button-create-invite"
                  >
                    {createInvite.isPending ? "Criando…" : "Gerar convite"}{" "}
                    <LinkIcon size={16} />
                  </button>
                  {createInvite.isError && (
                    <p className="form-error">
                      Não foi possível gerar agora. Tente novamente.
                    </p>
                  )}
                </div>
              )
            ) : (
              <div className="invite-hub-full">
                <p>
                  <strong>Cadeiras cheias.</strong> Desconvide alguém acima pra
                  liberar espaço.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

function AppExperienceReference() {
  useDeviceViewport();
  const [, navigate] = useLocation();
  const queryClientRef = useQueryClient();
  const {
    data: themesData,
    isLoading: themesLoading,
    isError: themesError,
  } = useListQuestionThemes({
    query: { queryKey: getListQuestionThemesQueryKey() },
  });
  const themes: QuestionTheme[] = themesData?.length
    ? themesData
    : fallbackThemes;
  const [themeId, setThemeId] = useState<string | null>(null);
  const [adultThemePrompt, setAdultThemePrompt] =
    useState<QuestionTheme | null>(null);
  const [adultThemeConfirmed, setAdultThemeConfirmed] = useState(
    () => safeGetItem(ADULT_THEME_CONFIRMATION_STORAGE_KEY) === "true",
  );
  const [dailyMode, setDailyMode] = useState(false);
  const [favoriteMode, setFavoriteMode] = useState(false);
  const [dailyDeck, setDailyDeck] = useState<string[]>([]);
  const [personalizedDecks, setPersonalizedDecks] = useState<
    PersonalizedDeck[]
  >(() => readStoredDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [deckMenuId, setDeckMenuId] = useState<string | null>(null);
  const [deckMenuView, setDeckMenuView] = useState<
    "menu" | "rename" | "cover" | "delete"
  >("menu");
  const [deckRenameValue, setDeckRenameValue] = useState("");
  const [isUploadingDeckCover, setIsUploadingDeckCover] = useState(false);
  const [deckCoverUploadError, setDeckCoverUploadError] = useState("");
  const deckCoverInputRef = useRef<HTMLInputElement | null>(null);
  const [dailyFormOpen, setDailyFormOpen] = useState(false);
  const [isPreparingDeck, setIsPreparingDeck] = useState(false);
  const [dailyMood, setDailyMood] = useState("");
  const [dailyVibe, setDailyVibe] = useState("");
  const [dailyCount, setDailyCount] = useState(10);
  const [dailyStep, setDailyStep] = useState(0);
  const [dailyCountCustom, setDailyCountCustom] = useState(false);
  const [dailyCustomCount, setDailyCustomCount] = useState("10");
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
  const [questionSwipeExit, setQuestionSwipeExit] = useState<
    "left" | "right" | null
  >(null);
  const questionDragStartX = useRef<number | null>(null);
  const questionDragDelta = useRef(0);
  const questionPointerCaptured = useRef(false);
  const questionSwipeLocked = useRef(false);
  const questionSwipeTimer = useRef<number | null>(null);
  const [activeNav, setActiveNav] = useState("todos");
  const [saved, setSaved] = useState<string[]>(() =>
    readStoredArray(SAVED_QUESTIONS_STORAGE_KEY),
  );
  const [favoriteThemeIds, setFavoriteThemeIds] = useState<string[]>(() =>
    readStoredArray(FAVORITE_THEMES_STORAGE_KEY),
  );
  const [seenByTheme, setSeenByTheme] = useState<Record<string, string[]>>(() =>
    readStoredRecord(SEEN_BY_THEME_STORAGE_KEY),
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const questionHistory = useRef<number[]>([]);
  const [randomMode, setRandomMode] = useState(true);
  const [writingOpen, setWritingOpen] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState(
    () => safeGetItem("conexao-session") || "",
  );
  const [welcomeOpen, setWelcomeOpen] = useState(
    !safeGetItem("conexao-name") && !safeGetItem("conexao-guest-token"),
  );
  const [buyerName, setBuyerName] = useState(
    () => safeGetItem("conexao-name") || "",
  );
  const role = safeGetItem("conexao-role");
  const isGuest = role === "guest" || !!safeGetItem("conexao-guest-token");
  const isOwner = !isGuest;
  const guestDisplayName = safeGetItem("conexao-guest-name") || "";
  const storedGuestToken = safeGetItem("conexao-guest-token") || "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionEmail, setSuggestionEmail] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewName, setReviewName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewStatus, setReviewStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  const [editRelationship, setEditRelationship] = useState(
    () => safeGetItem("conexao-relationship") || "",
  );
  const [editPronoun, setEditPronoun] = useState(
    () => safeGetItem("conexao-partner-pronoun") || "",
  );
  const [expandedField, setExpandedField] = useState<
    "relationship" | "pronoun" | null
  >(null);
  useEffect(() => {
    fetchPreferences(sessionId || null, storedGuestToken || null).then(
      (preferences) => {
        if (!preferences) return;
        if (preferences.relationshipType) {
          safeSetItem("conexao-relationship", preferences.relationshipType);
          setEditRelationship(preferences.relationshipType);
        }
        if (preferences.partnerPronoun) {
          safeSetItem("conexao-partner-pronoun", preferences.partnerPronoun);
          setEditPronoun(preferences.partnerPronoun);
        }
      },
    );
  }, [sessionId, storedGuestToken]);
  useEffect(() => {
    if (settingsOpen) {
      setEditRelationship(safeGetItem("conexao-relationship") || "");
      setEditPronoun(safeGetItem("conexao-partner-pronoun") || "");
    }
  }, [settingsOpen]);
  useEffect(() => {
    if (!settingsOpen) setExpandedField(null);
  }, [settingsOpen]);

  useEffect(() => {
    const currentSessionId = safeGetItem("conexao-session")?.trim();
    if (!currentSessionId) return;
    fetch(
      `${apiBase}/api/admin/check?sessionId=${encodeURIComponent(currentSessionId)}`,
    )
      .then((response) => (response.ok ? response.json() : { isAdmin: false }))
      .then((data) => setIsAdminAccount(Boolean(data.isAdmin)))
      .catch(() => setIsAdminAccount(false));
  }, []);
  const [navCollapsed, setNavCollapsed] = useState(
    () => safeGetItem("conexao-nav-collapsed") === "true",
  );
  const toggleNavCollapsed = () =>
    setNavCollapsed((current) => {
      const next = !current;
      safeSetItem("conexao-nav-collapsed", String(next));
      return next;
    });
  const [guestName, setGuestName] = useState("");
  const [inviteResult, setInviteResult] = useState<any>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [savedMoments, setSavedMoments] = useState<SavedMoment[]>([]);
  const sendSuggestion = async () => {
    if (!suggestionMessage.trim()) return;
    setSuggestionStatus("sending");
    try {
      const response = await fetch(apiUrl("/api/suggestions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: suggestionEmail.trim() || undefined,
          message: suggestionMessage.trim(),
        }),
      });
      if (!response.ok) throw new Error("failed");
      setSuggestionStatus("sent");
      setSuggestionMessage("");
    } catch {
      setSuggestionStatus("error");
    }
  };
  const sendReview = async () => {
    if (!reviewRating || !reviewMessage.trim()) return;
    setReviewStatus("sending");
    try {
      const response = await fetch(apiUrl("/api/reviews"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: reviewRating,
          message: reviewMessage.trim(),
          displayName: reviewName.trim() || undefined,
          email: reviewEmail.trim() || undefined,
        }),
      });
      if (!response.ok) throw new Error("failed");
      setReviewStatus("sent");
      setReviewMessage("");
    } catch {
      setReviewStatus("error");
    }
  };
  const handleLogout = () => {
    const keysToRemove = [
      "conexao-session",
      "conexao-guest-token",
      "conexao-guest-name",
      "conexao-guest-email",
      "conexao-name",
      "conexao-role",
      "conexao-onboarding-complete",
      "conexao-onboarding-step",
      "conexao-onboarding-name",
      "conexao-onboarding-pronoun",
      "conexao-onboarding-relationship",
      "conexao-onboarding-date",
      "conexao-onboarding-curiosity",
      "conexao-onboarding-feeling",
      "conexao-relationship",
      "conexao-curiosity",
      "conexao-feeling",
      "conexao-partner-pronoun",
      "conexao-pending-session",
      "conexao-pending-bill",
    ];
    keysToRemove.forEach((key) => {
      try {
        window.localStorage?.removeItem(key);
      } catch {
        /* noop */
      }
    });
    navigate("/login", { replace: true });
  };
  const visibleThemes = useMemo(
    () =>
      activeNav === "temas"
        ? themes.filter((theme) => theme.kind === "tema")
        : activeNav === "vibes"
          ? themes.filter((theme) => theme.kind === "vibe")
          : themes,
    [activeNav, themes],
  );
  const accessQuery = useGetAccessPreview({
    query: { queryKey: ["access-preview"] },
  });
  const sessionQuery = useGetQuestionSession(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getGetQuestionSessionQueryKey(sessionId),
    },
  });
  const guestQuery = useGetInvite(storedGuestToken, {
    query: {
      enabled: !!storedGuestToken,
      queryKey: getGetInviteQueryKey(storedGuestToken),
    },
  });
  const invitesQuery = useListInvites(sessionId, {
    query: {
      enabled: !!sessionId && isOwner,
      queryKey: getListInvitesQueryKey(sessionId),
    },
  });
  const allQuestionsMode = dailyMode || favoriteMode;
  const questionParams = {
    theme: themeId && !allQuestionsMode ? themeId : undefined,
  };
  const questionsQuery = useListQuestions(questionParams, {
    query: {
      enabled: !!themeId,
      queryKey: getListQuestionsQueryKey(questionParams),
    },
  });
  const onboardingComplete = Boolean(
    (sessionQuery.data as { onboardingComplete?: boolean } | undefined)
      ?.onboardingComplete ||
    (guestQuery.data as { onboardingComplete?: boolean } | undefined)
      ?.onboardingComplete,
  );
  const welcomeDeckDone =
    safeGetItem(ONBOARDING_WELCOME_DECK_DONE_KEY) === "true";
  const openWelcomeDeck =
    safeGetItem(ONBOARDING_OPEN_WELCOME_DECK_KEY) === "true";
  const welcomeDeckId = safeGetItem(ONBOARDING_WELCOME_DECK_ID_KEY) || "";
  const onboardingRelationship = safeGetItem("conexao-relationship") || "";
  const onboardingFeeling = safeGetItem("conexao-feeling") || "";
  const relationshipWeights = useMemo(
    () => getStageWeights(onboardingRelationship),
    [onboardingRelationship],
  );
  const allQuestionsQuery = useListQuestions(
    {},
    {
      query: {
        enabled:
          activeNav === "eu" ||
          allQuestionsMode ||
          (onboardingComplete && !welcomeDeckDone),
        queryKey: getListQuestionsQueryKey({}),
      },
    },
  );
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
  const availableQuestions = useMemo(
    () =>
      (allQuestionsQuery.data?.length
        ? allQuestionsQuery.data
        : fallbackQuestions) as Question[],
    [allQuestionsQuery.data],
  );
  useEffect(() => {
    const sid = safeGetItem("conexao-session");
    const tok = safeGetItem("conexao-guest-token") || "";
    if (!sid && !tok) {
      setSavedMoments([]);
      return;
    }
    const qs = sid
      ? `sessionId=${encodeURIComponent(sid)}`
      : `guestToken=${encodeURIComponent(tok)}`;
    fetch(apiUrl(`/api/moments?${qs}`))
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ moments?: SavedMoment[] }>)
          : null,
      )
      .then((data) => {
        if (data?.moments) setSavedMoments(data.moments);
      })
      .catch(() => {
        // Keep the existing list visible when the moments endpoint is temporarily unavailable.
      });
  }, [activeNav]);
  const deleteMoment = async (id: string) => {
    const sid = safeGetItem("conexao-session");
    const tok = safeGetItem("conexao-guest-token") || "";
    const qs = sid
      ? `sessionId=${encodeURIComponent(sid)}`
      : `guestToken=${encodeURIComponent(tok)}`;
    try {
      const response = await fetch(
        apiUrl(`/api/moments/${encodeURIComponent(id)}?${qs}`),
        { method: "DELETE" },
      );
      if (!response.ok) return;
      setSavedMoments((current) =>
        current.filter((moment) => moment.id !== id),
      );
    } catch {
      // Keep the moment visible when deletion fails.
    }
  };
  const dailyQuestions = useMemo(
    () =>
      dailyDeck
        .map((id) => availableQuestions.find((question) => question.id === id))
        .filter((question): question is Question => Boolean(question)),
    [availableQuestions, dailyDeck],
  );
  const favoriteQuestions = useMemo(
    () =>
      saved
        .map((id) => availableQuestions.find((question) => question.id === id))
        .filter((question): question is Question => Boolean(question)),
    [availableQuestions, saved],
  );
  const inProgressThemes = useMemo(
    () =>
      themes.filter((theme) => {
        const count = seenByTheme[theme.id]?.length || 0;
        return count > 0 && count < theme.count;
      }),
    [themes, seenByTheme],
  );
  const continueThemes = inProgressThemes.length
    ? inProgressThemes
    : themes.slice(0, 2);
  const themeQuestions = useMemo(() => {
    if (!themeId) return [];
    if (questionsQuery.data?.length) return questionsQuery.data;
    const fallbackThemeQuestions = fallbackQuestions.filter(
      (question) => question.themeId === themeId,
    );
    return fallbackThemeQuestions.length
      ? fallbackThemeQuestions
      : fallbackQuestions;
  }, [questionsQuery.data, themeId]);
  const questions = useMemo(() => {
    if (favoriteMode) return favoriteQuestions;
    if (dailyMode) return dailyQuestions;
    if (!themeId) return [];
    return weightByStage(
      themeQuestions,
      `${themeId}-${onboardingRelationship}`,
      relationshipWeights,
    );
  }, [
    dailyQuestions,
    dailyMode,
    favoriteMode,
    favoriteQuestions,
    onboardingRelationship,
    relationshipWeights,
    themeId,
    themeQuestions,
  ]);
  const currentQuestion = questions.length
    ? questions[questionIndex % questions.length]
    : null;
  const activeAccess = sessionQuery.data || accessQuery.data;
  const canInvite = sessionQuery.data
    ? sessionQuery.data.invitesUsed < sessionQuery.data.inviteLimit
    : !!accessQuery.data?.canInvite;
  const inviteLimit =
    sessionQuery.data?.inviteLimit ?? accessQuery.data?.invitesLimit ?? 0;
  const invitesUsed =
    sessionQuery.data?.invitesUsed ?? accessQuery.data?.invitesUsed ?? 0;
  const showInvitePrompt =
    !!themeId &&
    !!sessionId &&
    invitesUsed === 0 &&
    canInvite &&
    !inviteResult &&
    isOwner;
  const selectedTheme = themes.find(
    (theme) =>
      theme.id === (allQuestionsMode ? currentQuestion?.themeId : themeId),
  );
  const dailyTotal = favoriteMode
    ? questions.length || 1
    : selectedTheme?.count || questions.length || 1;
  const dailyPosition = questions.length
    ? (questionIndex % questions.length) + 1
    : 1;
  const isQuestionView = Boolean(themeId || dailyMode || favoriteMode);
  const cancelInvite = async (invite: InviteListItem) => {
    const confirmMsg = invite.isUsed
      ? `Cancelar o acesso de ${invite.guestName}? Isso vai retirar o acesso e liberar 1 vaga.`
      : `Cancelar o convite para ${invite.guestName}? A vaga volta pra você.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const response = await fetch(
        apiUrl(
          `/api/access/sessions/${encodeURIComponent(sessionId)}/invites/${encodeURIComponent(invite.token)}`,
        ),
        { method: "DELETE" },
      );
      if (!response.ok) return;
      setInvitesList((current) =>
        current.filter((item) => item.token !== invite.token),
      );
      queryClientRef.invalidateQueries({
        queryKey: getGetQuestionSessionQueryKey(sessionId),
      });
    } catch {
      // Keep the invite visible when the cancellation request fails.
    }
  };
  const markQuestionSeen = (question: Question | null) => {
    if (!question) return;
    setSeenByTheme((current) => {
      const previous = current[question.themeId] || [];
      const next = {
        ...current,
        [question.themeId]: [
          ...previous.filter((id) => id !== question.id),
          question.id,
        ],
      };
      safeSetItem(SEEN_BY_THEME_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (activeDeckId) {
      setPersonalizedDecks((current) => {
        const deck = current.find((item) => item.id === activeDeckId);
        if (!deck || !deck.ids.includes(question.id)) return current;
        const seenIds = [
          ...deck.seenIds.filter((id) => id !== question.id),
          question.id,
        ];
        const nextDecks =
          seenIds.length >= deck.ids.length && deck.ids.length > 0
            ? current.filter((item) => item.id !== activeDeckId)
            : current.map((item) =>
                item.id === activeDeckId ? { ...item, seenIds } : item,
              );
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
    const theme = themes.find((item) => item.id === id);
    if (theme?.audience === "18+" && !adultThemeConfirmed) {
      setAdultThemePrompt(theme);
      return;
    }
    applyTheme(id);
  };
  const confirmAdultTheme = () => {
    if (!adultThemePrompt) return;
    safeSetItem(ADULT_THEME_CONFIRMATION_STORAGE_KEY, "true");
    setAdultThemeConfirmed(true);
    applyTheme(adultThemePrompt.id);
    setAdultThemePrompt(null);
  };
  const openDailyForm = () => {
    setDailyMood("");
    setDailyVibe("");
    setDailyCount(10);
    setDailyStep(0);
    setDailyCountCustom(false);
    setDailyCustomCount("10");
    setDailyFormOpen(true);
  };
  const closeDailyForm = () => {
    setDailyFormOpen(false);
    setDailyStep(0);
  };
  const continueDailyForm = () => {
    if (dailyStep === 0 && !dailyMood) return;
    if (dailyStep === 1 && !dailyVibe) return;
    setDailyStep((step) => Math.min(2, step + 1));
  };
  const chooseCustomDailyCount = () => {
    setDailyCountCustom(true);
    setDailyCustomCount(String(Math.min(30, Math.max(3, dailyCount))));
  };
  const updateDailyCustomCount = (value: string) => {
    if (!value) {
      setDailyCustomCount("");
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
        const mood = dailyMoodOptions.find(
          (option) => option.value === selectedMood,
        );
        const vibe = dailyVibeOptions.find(
          (option) => option.value === selectedVibe,
        );
        const createdAt = new Date().toISOString();
        const dateLabel = new Intl.DateTimeFormat("pt-BR", {
          day: "numeric",
          month: "short",
        }).format(new Date(createdAt));
        const deck: PersonalizedDeck = {
          id:
            typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `deck-${Date.now()}`,
          createdAt,
          label: `${vibe?.label || mood?.label || "Perguntas pra hoje"} · ${dateLabel}`,
          ids: selectPersonalizedQuestionIds(
            availableQuestions,
            selectedMood,
            selectedVibe,
            selectedCount,
            `${createdAt}-${selectedMood}-${selectedVibe}-${selectedCount}`,
            relationshipWeights,
          ),
          cover:
            deckCoverByVibe[selectedVibe] ||
            deckCoverOptions[
              Math.floor(Math.random() * deckCoverOptions.length)
            ].id,
          seenIds: [],
        };
        const nextDecks = [deck, ...personalizedDecks];
        setPersonalizedDecks(nextDecks);
        safeSetItem(PERSONALIZED_DECKS_STORAGE_KEY, JSON.stringify(nextDecks));
        setDailyDeck(deck.ids);
        setActiveDeckId(deck.id);
        setActiveNav("eu");
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
    if (
      !onboardingComplete ||
      welcomeDeckDone ||
      !onboardingRelationship ||
      !onboardingFeeling
    )
      return;
    if (allQuestionsQuery.isLoading) return;

    const mood = onboardingRelationshipToMood[onboardingRelationship];
    const requestedVibe = onboardingFeelingToVibe[onboardingFeeling];
    if (!mood || !requestedVibe) return;

    const hasAdultTheme = themes.some(
      (theme) => theme.audience === "18+" || theme.id === "luzes-baixas",
    );
    const vibe =
      requestedVibe === "esquentar" && !hasAdultTheme ? "fundo" : requestedVibe;
    const createdAt = new Date().toISOString();
    const deckId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `deck-${Date.now()}`;
    const deck: PersonalizedDeck = {
      id: deckId,
      createdAt,
      label: "Seu primeiro baralho",
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

    safeSetItem(ONBOARDING_WELCOME_DECK_DONE_KEY, "true");
    safeSetItem(ONBOARDING_WELCOME_DECK_ID_KEY, deck.id);
    safeSetItem(PERSONALIZED_DECKS_STORAGE_KEY, JSON.stringify(nextDecks));
    setPersonalizedDecks(nextDecks);
    setDailyDeck(deck.ids);
    setActiveDeckId(deck.id);
    setActiveNav("eu");
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
    setActiveNav("eu");
    setFavoriteMode(false);
    setDailyMode(true);
    setThemeId(null);
    setQuestionIndex(0);
    resetQuestionHistory();
  };
  useEffect(() => {
    if (!openWelcomeDeck || !welcomeDeckDone) return;
    const deck =
      personalizedDecks.find((item) => item.id === welcomeDeckId) ||
      personalizedDecks.find((item) => item.label === "Seu primeiro baralho") ||
      personalizedDecks[0];
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
    setDeckMenuView("menu");
    setDeckRenameValue(deck.label);
  };
  const closeDeckMenu = () => {
    setDeckMenuId(null);
    setDeckMenuView("menu");
  };
  const renamePersonalizedDeck = (id: string, newLabel: string) => {
    const label = newLabel.trim();
    if (!label) return;
    persistPersonalizedDecks(
      personalizedDecks.map((deck) =>
        deck.id === id ? { ...deck, label } : deck,
      ),
    );
    closeDeckMenu();
  };
  const updatePersonalizedDeckCover = (id: string, coverId: string) => {
    if (!isDeckCoverValue(coverId)) return;
    persistPersonalizedDecks(
      personalizedDecks.map((deck) =>
        deck.id === id ? { ...deck, cover: coverId } : deck,
      ),
    );
    closeDeckMenu();
  };
  const handleDeckCoverUpload = async (file: File | undefined) => {
    if (!file || !deckMenu) return;
    setIsUploadingDeckCover(true);
    setDeckCoverUploadError("");
    try {
      const cover = await resizeCoverImage(file);
      updatePersonalizedDeckCover(deckMenu.id, cover);
    } catch (error) {
      setDeckCoverUploadError(
        error instanceof Error
          ? error.message
          : "Não foi possível usar essa imagem.",
      );
    } finally {
      setIsUploadingDeckCover(false);
      if (deckCoverInputRef.current) deckCoverInputRef.current.value = "";
    }
  };
  const deletePersonalizedDeck = (id: string) => {
    persistPersonalizedDecks(
      personalizedDecks.filter((deck) => deck.id !== id),
    );
    if (activeDeckId === id) setActiveDeckId(null);
    closeDeckMenu();
  };
  const openFavoritesDeck = () => {
    resetQuestionHistory();
    setActiveDeckId(null);
    setActiveNav("eu");
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
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
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
    const isDesktopRow =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1180px)").matches;
    if (isDesktopRow) {
      changeTheme(visibleThemes[index]?.id);
      return;
    }
    if (index === themeIndex) changeTheme(visibleThemes[index]?.id);
    else moveThemeIndex(index);
  };
  const navigateThemeCarousel = (direction: 1 | -1) => {
    if (!visibleThemes.length) return;
    const nextIndex =
      (themeIndex + direction + visibleThemes.length) % visibleThemes.length;
    moveThemeIndex(nextIndex);
    window.requestAnimationFrame(() => {
      themeCarouselRef.current
        ?.querySelector<HTMLElement>(`[data-theme-index="${nextIndex}"]`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
    });
  };
  const handleThemePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
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
    if (
      Math.abs(themeDragDelta.current) >= 8 &&
      !themePointerCaptured.current
    ) {
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
      const nextIndex =
        (themeIndex + direction + visibleThemes.length) % visibleThemes.length;
      suppressThemeClick.current = true;
      moveThemeIndex(nextIndex);
    }
    themeDragStartX.current = null;
    themeDragDelta.current = 0;
    setThemeDragOffset(0);
    setIsThemeDragging(false);
    if (
      themePointerCaptured.current &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    themePointerCaptured.current = false;
  };
  const handleThemePointerCancel = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (themeDragStartX.current === null) return;
    themeDragStartX.current = null;
    themeDragDelta.current = 0;
    setThemeDragOffset(0);
    setIsThemeDragging(false);
    if (
      themePointerCaptured.current &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    themePointerCaptured.current = false;
  };
  const getAdjacentQuestionIndex = (index: number, direction: 1 | -1) => {
    if (questions.length < 2 || allQuestionsMode || !randomMode)
      return (
        (index + direction + questions.length) % Math.max(questions.length, 1)
      );
    const questionId = questions[index]?.id || String(index);
    const randomOffset =
      Math.floor(
        seededValue(`${questionId}-${direction}`)() * (questions.length - 1),
      ) + 1;
    return (
      (index + randomOffset * direction + questions.length * 2) %
      questions.length
    );
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
  const nextQuestionIndex =
    questions.length > 1 ? getAdjacentQuestionIndex(questionIndex, 1) : null;
  const nextStackQuestion =
    nextQuestionIndex === null ? null : questions[nextQuestionIndex];
  const nextStackTheme = nextStackQuestion
    ? themes.find((theme) => theme.id === nextStackQuestion.themeId)
    : null;
  const secondStackQuestionIndex =
    nextQuestionIndex === null
      ? null
      : getAdjacentQuestionIndex(nextQuestionIndex, 1);
  const secondStackQuestion =
    secondStackQuestionIndex === null
      ? null
      : questions[secondStackQuestionIndex];
  const secondStackTheme = secondStackQuestion
    ? themes.find((theme) => theme.id === secondStackQuestion.themeId)
    : null;
  useEffect(
    () => markQuestionSeen(currentQuestion),
    [currentQuestion?.id, activeDeckId],
  );
  useEffect(() => {
    safeSetItem(SAVED_QUESTIONS_STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    safeSetItem(FAVORITE_THEMES_STORAGE_KEY, JSON.stringify(favoriteThemeIds));
  }, [favoriteThemeIds]);
  useEffect(
    () => () => {
      if (questionSwipeTimer.current !== null)
        window.clearTimeout(questionSwipeTimer.current);
    },
    [],
  );
  const toggleThemeFavorite = (id: string) =>
    setFavoriteThemeIds((current) =>
      current.includes(id)
        ? current.filter((themeIdValue) => themeIdValue !== id)
        : [...current, id],
    );
  const toggleSaved = (id: string) =>
    setSaved((current) =>
      current.includes(id)
        ? current.filter((questionId) => questionId !== id)
        : [...current, id],
    );
  const handleQuestionPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (questionSwipeLocked.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, textarea, input, a")) return;
    questionDragStartX.current = event.clientX;
    questionDragDelta.current = 0;
    questionPointerCaptured.current = false;
    setQuestionDragOffset(0);
    setIsQuestionDragging(true);
  };
  const handleQuestionPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (questionDragStartX.current === null || questionSwipeLocked.current)
      return;
    questionDragDelta.current = event.clientX - questionDragStartX.current;
    if (
      Math.abs(questionDragDelta.current) >= 8 &&
      !questionPointerCaptured.current
    ) {
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
      setQuestionSwipeExit(delta < 0 ? "left" : "right");
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
    if (
      questionPointerCaptured.current &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    questionPointerCaptured.current = false;
  };
  const handleQuestionPointerCancel = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (questionSwipeLocked.current) return;
    if (questionDragStartX.current === null) return;
    questionDragStartX.current = null;
    questionDragDelta.current = 0;
    setQuestionDragOffset(0);
    setIsQuestionDragging(false);
    if (
      questionPointerCaptured.current &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    questionPointerCaptured.current = false;
  };
  const toggleQuestionMode = () => {
    resetQuestionHistory();
    setRandomMode((mode) => !mode);
  };
  const currentResponse = currentQuestion
    ? responses[currentQuestion.id] || ""
    : "";
  const [unstuckOpen, setUnstuckOpen] = useState(false);
  useEffect(() => {
    setWritingOpen(false);
    setUnstuckOpen(false);
  }, [currentQuestion?.id]);
  const startSession = () => {
    if (!buyerName.trim()) {
      setWelcomeOpen(false);
      return;
    }
    safeSetItem("conexao-name", buyerName.trim());
    createSession.mutate(
      { data: { buyerName: buyerName.trim(), packageId: "couple" } },
      {
        onSuccess: (session) => {
          setSessionId(session.id);
          safeSetItem("conexao-session", session.id);
          setWelcomeOpen(false);
          queryClientRef.invalidateQueries({
            queryKey: getGetQuestionSessionQueryKey(session.id),
          });
        },
        onError: () => setWelcomeOpen(false),
      },
    );
  };
  const makeInvite = () => {
    if (!isOwner || !sessionId || !guestName.trim()) return;
    createInvite.mutate(
      { sessionId, data: { guestName: guestName.trim() } },
      {
        onSuccess: (result) => {
          setInviteResult(result);
          queryClientRef.invalidateQueries({
            queryKey: getGetQuestionSessionQueryKey(sessionId),
          });
          queryClientRef.invalidateQueries({
            queryKey: getListInvitesQueryKey(sessionId),
          });
        },
      },
    );
  };
  const copyInvite = () => {
    if (!inviteResult?.token) return;
    const clipboardWrite = navigator.clipboard?.writeText(
      inviteUrlFromToken(inviteResult.token),
    );
    if (!clipboardWrite) return;
    clipboardWrite
      .then(() => {
        setCopiedInvite(true);
        window.setTimeout(() => setCopiedInvite(false), 2000);
      })
      .catch(() => {});
  };
  const navItems = [
    { id: "todos", label: "Todos", icon: House },
    { id: "temas", label: "Temas", icon: Layers3 },
    { id: "vibes", label: "Vibes", icon: WandSparkles },
    { id: "eu", label: "Meu espaço", icon: UserRound },
  ];
  const deckMenu =
    personalizedDecks.find((deck) => deck.id === deckMenuId) || null;

  return (
    <div className="app-viewport">
      <main
        className={`connection-app ${isQuestionView ? "is-question-view" : "is-deck-view"} ${writingOpen ? "is-writing-mode" : ""} ${navCollapsed ? "is-nav-collapsed" : ""}`}
      >
        {!isQuestionView ? (
          <>
            <header className="app-header" data-testid="header-decks">
              <div className="app-wordmark" data-testid="text-app-brand">
                <span className="app-logo-orb">
                  <span />
                </span>
                <span>
                  Perguntas
                  <br />
                  <b>de Conexão</b>
                </span>
              </div>
              <div className="app-header-context">
                <span className="app-header-overline">
                  seu espaço de conversa
                </span>
                <strong>
                  {navItems.find((item) => item.id === activeNav)?.label ||
                    "Descobrir"}
                </strong>
              </div>
              <div className="app-header-actions">
                <span className="app-access-note">
                  <span className="app-access-note-dot" /> acesso ativo
                </span>
                <button
                  className="app-icon-button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Abrir ajustes"
                  data-testid="button-open-settings"
                >
                  <Settings2 size={19} />
                </button>
              </div>
            </header>
            {activeNav === "eu" ? (
              <section
                className="deck-home eu-home"
                aria-labelledby="eu-home-title"
              >
                <div className="eu-heading">
                  <div>
                    <p className="eu-kicker">seu espaço</p>
                    <h1 id="eu-home-title">Olá, {buyerName || "por aqui"}.</h1>
                  </div>
                  <time className="eu-date" dateTime={localDateKey()}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(new Date())}
                  </time>
                </div>
                <section
                  className="eu-daily-card"
                  onClick={openDailyForm}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) =>
                    event.key === "Enter" && openDailyForm()
                  }
                  data-testid="card-daily-deck"
                >
                  <div className="eu-daily-glow" />
                  <div className="eu-daily-copy">
                    <p className="eu-kicker">seus decks</p>
                    <h2>
                      Perguntas de hoje
                      <br />
                      <em>para vocês.</em>
                    </h2>
                    <p>
                      Conte como vocês estão e receba um baralho feito para
                      agora.
                    </p>
                    <span className="eu-open-link">
                      Criar meu deck <ArrowRight size={16} />
                    </span>
                  </div>
                  <div className="eu-daily-art">
                    <span className="daily-orbit daily-orbit-one" />
                    <span className="daily-orbit daily-orbit-two" />
                    <div className="daily-mini-card daily-mini-back" />
                    <div className="daily-mini-card daily-mini-front">
                      <span>seu deck</span>
                      <Quote size={24} />
                      <strong>
                        uma pergunta
                        <br />
                        de cada vez
                      </strong>
                    </div>
                  </div>
                </section>
                {isOwner && (
                  <section
                    className="eu-section eu-online-section"
                    aria-labelledby="online-title"
                  >
                    <div className="eu-section-heading">
                      <div>
                        <p className="eu-kicker">jogar online</p>
                        <h2 id="online-title">Uma sala pra vocês</h2>
                      </div>
                    </div>
                    <Link
                      href="/play"
                      className="eu-play-hero"
                      data-testid="link-play-online"
                    >
                      <div className="eu-play-hero-glow" aria-hidden="true" />
                      <div className="eu-play-hero-content">
                        <div className="eu-play-hero-icon">
                          <Wifi size={26} />
                        </div>
                        <div>
                          <h2>
                            Uma sala pra vocês,
                            <br />
                            <em>mesmo de longe.</em>
                          </h2>
                          <p className="eu-play-hero-note">
                            Crie uma sala, mande o código, e joguem juntos em
                            tempo real de qualquer lugar.
                          </p>
                          <span className="eu-play-hero-cta">
                            Criar ou entrar com código <ArrowRight size={16} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </section>
                )}
                <section
                  className="eu-section eu-invite-section"
                  aria-labelledby="companions-title"
                >
                  <div className="eu-section-heading">
                    <div>
                      <p className="eu-kicker">
                        {isOwner
                          ? "quem joga com você"
                          : "acesso compartilhado"}
                      </p>
                      <h2 id="companions-title">
                        {isOwner ? "Convidados" : "Este baralho"}
                      </h2>
                    </div>
                  </div>
                  {!isOwner && (
                    <div
                      className="eu-empty-state"
                      data-testid="card-guest-access"
                    >
                      <span>
                        <Users size={16} />
                      </span>
                      <div>
                        <strong>
                          {guestDisplayName
                            ? `Oi, ${guestDisplayName} — você é convidado aqui`
                            : "Você entrou como convidado"}
                        </strong>
                        {guestQuery.data?.ownerName && (
                          <p className="guest-invited-by">
                            Você foi convidado por{" "}
                            <strong>{guestQuery.data.ownerName}</strong>
                          </p>
                        )}
                        <p>
                          Este baralho é de quem te convidou. Você pode jogar,
                          responder e salvar — só não pode convidar outras
                          pessoas.
                        </p>
                        <Link
                          href="/#pacotes"
                          className="app-secondary-button"
                          data-testid="link-own-deck"
                        >
                          Quero meu próprio baralho <ArrowRight size={15} />
                        </Link>
                      </div>
                    </div>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setInviteOpen(true)}
                      className="eu-invite-hub"
                      data-testid="button-open-invite-eu"
                    >
                      <div className="eu-invite-hub-icon">
                        <UserPlus size={22} />
                      </div>
                      <div className="eu-invite-hub-text">
                        <strong>Convidar alguém</strong>
                        <small>
                          {invitesList.length === 0
                            ? `${inviteLimit} cadeiras livres para gente próxima`
                            : `${invitesList.filter((invite) => invite.isUsed).length} entraram · ${invitesList.length}/${inviteLimit} cadeiras usadas`}
                        </small>
                      </div>
                      <ArrowRight size={18} className="eu-invite-hub-arrow" />
                    </button>
                  )}
                </section>
                {personalizedDecks.length > 0 && (
                  <section
                    className="eu-deck-history"
                    aria-labelledby="deck-history-title"
                  >
                    <div className="eu-section-heading">
                      <div>
                        <p className="eu-kicker">seu histórico</p>
                        <h2 id="deck-history-title">
                          Perguntas que você criou
                        </h2>
                      </div>
                      <span>
                        {personalizedDecks.length}{" "}
                        {personalizedDecks.length === 1
                          ? "baralho"
                          : "baralhos"}
                      </span>
                    </div>
                    <div className="eu-deck-history-row">
                      {personalizedDecks.map((deck) => (
                        <article key={deck.id} className="eu-history-card">
                          <button
                            className="eu-history-card-open"
                            onClick={() => openSavedDailyDeck(deck)}
                            data-testid={`button-open-daily-deck-${deck.id}`}
                          >
                            <span
                              className={`eu-history-art deck-cover-${isDeckCoverId(deck.cover) ? deck.cover : "custom"}`}
                              style={deckCoverStyle(deck.cover)}
                              aria-hidden="true"
                            >
                              <span className="deck-cover-orbit" />
                              <span className="deck-cover-spark" />
                            </span>
                            <span className="eu-history-card-shade" />
                            <span className="eu-history-copy">
                              <strong>{deck.label}</strong>
                              <small>
                                {deck.ids.length} perguntas · reabrir
                              </small>
                            </span>
                          </button>
                          <button
                            className="eu-history-menu-button"
                            onClick={() => openDeckMenu(deck)}
                            aria-label={`Ações para ${deck.label}`}
                            data-testid={`button-menu-daily-deck-${deck.id}`}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                <section
                  className="eu-section eu-continue-section"
                  aria-labelledby="continue-title"
                >
                  <div className="eu-section-heading">
                    <div>
                      <p className="eu-kicker">continue jogando</p>
                      <h2 id="continue-title" className="sr-only">
                        Continue jogando
                      </h2>
                    </div>
                    <span>
                      {inProgressThemes.length
                        ? `${inProgressThemes.length} em andamento`
                        : "comece por aqui"}
                    </span>
                  </div>
                  <div className="eu-progress-row">
                    {continueThemes.map((theme) => {
                      const seenCount = seenByTheme[theme.id]?.length || 0;
                      const lastQuestionId = seenByTheme[theme.id]?.at(-1);
                      const themeQuestions = availableQuestions.filter(
                        (question) => question.themeId === theme.id,
                      );
                      const resumeIndex = Math.max(
                        0,
                        themeQuestions.findIndex(
                          (question) => question.id === lastQuestionId,
                        ),
                      );
                      return (
                        <button
                          key={theme.id}
                          className="eu-progress-card"
                          onClick={() => {
                            changeTheme(theme.id);
                            setQuestionIndex(resumeIndex);
                          }}
                          data-testid={`button-continue-theme-${theme.id}`}
                        >
                          <div
                            className={`eu-progress-cover theme-cover-${themes.indexOf(theme) % 5}`}
                          >
                              {themeBackgroundUrl(theme.id) && (
                                <img
                                  className="theme-cover-photo"
                                  src={themeBackgroundUrl(theme.id) as string}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                />
                              )}
                            <span className="eu-progress-number">
                              {String(seenCount).padStart(2, "0")}
                            </span>
                            <Heart
                              className="eu-progress-heart"
                              size={20}
                              fill={
                                favoriteThemeIds.includes(theme.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </div>
                          <div className="eu-progress-copy">
                            <strong>{theme.title}</strong>
                            <small>
                              {seenCount
                                ? `${seenCount} de ${theme.count} perguntas`
                                : "comece agora"}
                            </small>
                            <span className="eu-progress-bar">
                              <i
                                style={{
                                  width: `${Math.min(100, (seenCount / Math.max(theme.count, 1)) * 100)}%`,
                                }}
                              />
                            </span>
                            <em>
                              Retomar <ArrowRight size={13} />
                            </em>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {continueThemes.length === 0 && (
                    <div className="eu-empty-state">
                      <span>
                        <Sparkles size={16} />
                      </span>
                      <p>
                        Quando uma pergunta ficar pelo caminho, ela aparece aqui
                        para você continuar.
                      </p>
                    </div>
                  )}
                </section>
                <section
                  className="eu-section eu-favorites-section"
                  aria-labelledby="favorites-title"
                >
                  <div className="eu-section-heading">
                    <div>
                      <p className="eu-kicker">salvos</p>
                      <h2 id="favorites-title">Salvos</h2>
                    </div>
                    <span>{saved.length + favoriteThemeIds.length} salvos</span>
                  </div>
                  <div className="eu-saved-row">
                    <button
                      className={`eu-collection-card eu-collection-cards ${saved.length ? "has-content" : ""}`}
                      onClick={openFavoritesDeck}
                      disabled={!saved.length}
                      data-testid="button-favorite-cards"
                    >
                      <span className="eu-collection-shade" />
                      <span className="eu-collection-title">
                        Cartas favoritas <b>{saved.length}</b>
                      </span>
                      {!saved.length && (
                        <small>suas perguntas salvas aparecem aqui</small>
                      )}
                    </button>
                    <div className="eu-favorite-topics">
                      <p className="eu-favorite-label">Temas favoritos</p>
                      <div className="eu-topic-row">
                        {favoriteThemeIds.length ? (
                          favoriteThemeIds.map((id) => {
                            const theme = themes.find((item) => item.id === id);
                            return theme ? (
                              <button
                                key={id}
                                className={`eu-topic-card theme-cover-${themes.indexOf(theme) % 5}`}
                                onClick={() => changeTheme(id)}
                                data-testid={`button-favorite-theme-${id}`}
                              >
                                {themeBackgroundUrl(theme.id) && (
                                  <img
                                    className="theme-cover-photo"
                                    src={themeBackgroundUrl(theme.id) as string}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                  />
                                )}
                                <span className="eu-topic-shade" />
                                <strong>{theme.title}</strong>
                                <ArrowRight size={15} />
                              </button>
                            ) : null;
                          })
                        ) : (
                          <div className="eu-topic-empty">
                            Favorite um tema para encontrá-lo aqui.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
                <section
                  className="eu-section eu-moments-section"
                  aria-labelledby="moments-title"
                >
                  <div className="eu-section-heading">
                    <div>
                      <p className="eu-kicker">momentos</p>
                      <h2 id="moments-title">Respostas guardadas</h2>
                    </div>
                    <span>
                      {savedMoments.length}{" "}
                      {savedMoments.length === 1 ? "momento" : "momentos"}
                    </span>
                  </div>
                  {savedMoments.length === 0 ? (
                    <div
                      className="eu-empty-state"
                      data-testid="empty-saved-moments"
                    >
                      <span>
                        <Bookmark size={16} />
                      </span>
                      <p>
                        Quando alguém responder algo que você quer guardar,
                        salve por aqui. Fica só pra você.
                      </p>
                    </div>
                  ) : (
                    <div className="eu-moments-list">
                      {savedMoments.map((moment) => {
                        const theme = themes.find(
                          (item) => item.id === moment.themeId,
                        );
                        const question = availableQuestions.find(
                          (item) => item.id === moment.questionId,
                        );
                        return (
                          <article
                            key={moment.id}
                            className="eu-moment-card"
                            data-testid={`moment-${moment.id}`}
                          >
                            <div className="eu-moment-header">
                              <div>
                                <p className="eu-moment-kicker">
                                  {theme?.title || "Tema"}
                                </p>
                                <p className="eu-moment-question">
                                  {question?.text || "Pergunta"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteMoment(moment.id)}
                                className="eu-moment-delete"
                                aria-label="Remover momento"
                                data-testid={`button-delete-moment-${moment.id}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p className="eu-moment-answer">
                              “{moment.answerText}”
                            </p>
                            <p className="eu-moment-attribution">
                              — {moment.fromPlayerName} ·{" "}
                              {new Date(moment.createdAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </section>
            ) : (
              <section className="deck-home" aria-labelledby="deck-home-title">
                <div className="deck-home-heading">
                  <h1
                    id="deck-home-title"
                    className={
                      activeNav === "todos"
                        ? "deck-home-title deck-home-title-all"
                        : "deck-home-title"
                    }
                    data-testid="text-deck-title"
                  >
                    {activeNav === "temas"
                      ? "Escolha um assunto pra começar"
                      : activeNav === "vibes"
                        ? "Escolha uma vibe pra agora"
                        : "Escolha um objetivo para começar"}
                  </h1>
                  {activeNav !== "todos" && (
                    <p className="deck-home-subtitle">
                      {activeNav === "temas"
                        ? "Conversas sobre as histórias e planos que fazem parte de vocês"
                        : "Encontrem o clima que combina com este momento"}
                    </p>
                  )}
                </div>
                <div className="theme-carousel-wrap">
                  <button
                    className="theme-carousel-arrow theme-carousel-arrow-previous"
                    onClick={() => navigateThemeCarousel(-1)}
                    disabled={!visibleThemes.length}
                    aria-label="Objetivo anterior"
                    title="Objetivo anterior"
                    data-testid="button-previous-theme"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div
                    ref={themeCarouselRef}
                    className={`theme-carousel ${isThemeDragging ? "is-dragging" : ""}`}
                    aria-label={
                      activeNav === "temas"
                        ? "Assuntos de conexão"
                        : activeNav === "vibes"
                          ? "Vibes de conexão"
                          : "Objetivos de conexão"
                    }
                    onPointerDown={handleThemePointerDown}
                    onPointerMove={handleThemePointerMove}
                    onPointerUp={finishThemePointer}
                    onPointerCancel={handleThemePointerCancel}
                    style={
                      {
                        "--theme-drag-offset": `${themeDragOffset}px`,
                      } as CSSProperties
                    }
                  >
                    {themesLoading && (
                      <div
                        className="theme-skeleton"
                        data-testid="loading-themes"
                      />
                    )}
                    {visibleThemes.map((theme, index) => {
                      const offset = Math.max(
                        -2,
                        Math.min(2, index - themeIndex),
                      );
                      return (
                        <div
                          key={theme.id}
                          className={`theme-cover theme-cover-${index % 5} theme-offset-${offset} ${index === themeIndex ? "is-active" : ""}`}
                          onClick={() => selectThemeCard(index)}
                          onKeyDown={(event) =>
                            event.key === "Enter" && selectThemeCard(index)
                          }
                          role="button"
                          tabIndex={0}
                          data-theme-index={index}
                          data-testid={`button-theme-card-${theme.id}`}
                        >
                          {themeBackgroundUrl(theme.id) && (
                            <img
                              className="theme-cover-photo"
                              src={themeBackgroundUrl(theme.id) as string}
                              alt=""
                              aria-hidden="true"
                              loading="lazy"
                            />
                          )}
                          <span className="theme-cover-shade" />
                          <span className="theme-cover-top">
                            <span className="theme-cover-meta">
                              <span>{theme.count} perguntas</span>
                              {theme.audience === "18+" && (
                                <span
                                  className="theme-cover-audience"
                                  role="img"
                                  aria-label="Conteúdo para maiores de 18 anos"
                                  title="Maiores de 18 anos"
                                >
                                  <Flame
                                    size={13}
                                    strokeWidth={2.2}
                                    aria-hidden="true"
                                  />
                                </span>
                              )}
                              {theme.audience === "casais" && (
                                <span className="theme-cover-audience">
                                  casais
                                </span>
                              )}
                            </span>
                            <button
                              className={`theme-cover-heart ${favoriteThemeIds.includes(theme.id) ? "is-favorite" : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleThemeFavorite(theme.id);
                              }}
                              aria-label={
                                favoriteThemeIds.includes(theme.id)
                                  ? `Remover ${theme.title} dos favoritos`
                                  : `Favoritar ${theme.title}`
                              }
                              data-testid={`button-favorite-theme-card-${theme.id}`}
                            >
                              <Heart
                                size={20}
                                strokeWidth={1.8}
                                fill={
                                  favoriteThemeIds.includes(theme.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          </span>
                          <span className="theme-cover-copy">
                            <b>{theme.title}</b>
                            <small>{theme.description}</small>
                            <i>
                              {index === themeIndex
                                ? "Toque novamente para abrir"
                                : "ver objetivo"}
                            </i>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="theme-carousel-arrow theme-carousel-arrow-next"
                    onClick={() => navigateThemeCarousel(1)}
                    disabled={!visibleThemes.length}
                    aria-label="Próximo objetivo"
                    title="Próximo objetivo"
                    data-testid="button-next-theme"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <div
                    className="carousel-dots"
                    aria-label="Posição do objetivo"
                  >
                    {visibleThemes.map((theme, index) => (
                      <button
                        key={theme.id}
                        className={index === themeIndex ? "is-active" : ""}
                        onClick={() => moveThemeIndex(index)}
                        aria-label={`Selecionar ${theme.title}`}
                        data-testid={`button-theme-dot-${theme.id}`}
                      />
                    ))}
                  </div>
                </div>
                {themesError && (
                  <div
                    className="app-inline-error"
                    data-testid="status-themes-error"
                  >
                    <span>Reconectando…</span>
                    <button
                      onClick={() =>
                        queryClientRef.invalidateQueries({
                          queryKey: getListQuestionThemesQueryKey(),
                        })
                      }
                      data-testid="button-retry-themes"
                    >
                      Tentar agora <RotateCw size={13} />
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <header className="question-header" data-testid="header-question">
              <button
                className="decks-back-pill"
                onClick={() => {
                  resetQuestionHistory();
                  setActiveDeckId(null);
                  setFavoriteMode(false);
                  setDailyMode(false);
                  setThemeId(null);
                }}
                data-testid="button-back-decks"
              >
                <ChevronLeft size={17} /> Decks
              </button>
              <div
                className="question-header-count"
                data-testid="text-question-position"
              >
                {String(dailyPosition).padStart(2, "0")}{" "}
                <span>
                  / {String(questions.length || dailyTotal).padStart(2, "0")}
                </span>
              </div>
            </header>
            <section
              className={`question-view-stage ${showInvitePrompt ? "has-invite-prompt" : ""}`}
            >
              <div
                className="question-navigation"
                aria-label="Navegação entre perguntas"
              >
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
                    <button
                      className={`question-mode-button ${!writingOpen ? "is-active" : ""}`}
                      onClick={toggleQuestionMode}
                      aria-label={
                        randomMode
                          ? "Alternar para perguntas sequenciais"
                          : "Alternar para perguntas aleatórias"
                      }
                      data-testid="button-random-question"
                    >
                      <Shuffle size={13} />{" "}
                      {randomMode ? "Aleatória" : "Sequencial"}
                    </button>
                    <button
                      className={`question-mode-button ${writingOpen ? "is-active" : ""}`}
                      onClick={() => setWritingOpen((open) => !open)}
                      aria-pressed={writingOpen}
                      data-testid="button-writing-mode"
                    >
                      <Feather size={13} />{" "}
                      {writingOpen ? "Escrevendo" : "Escrever"}
                    </button>
                  </div>
                  {(
                    allQuestionsMode
                      ? allQuestionsQuery.isLoading
                      : questionsQuery.isLoading
                  ) ? (
                    <div
                      className="question-card question-card-loading"
                      data-testid="loading-questions"
                    >
                      <div className="loading-pill" />
                      <div className="loading-copy" />
                      <div className="loading-copy short" />
                    </div>
                  ) : (
                      allQuestionsMode
                        ? allQuestionsQuery.isError
                        : questionsQuery.isError
                    ) ? (
                    <div
                      className="question-error"
                      data-testid="status-questions-error"
                    >
                      <p>Reconectando…</p>
                      <button
                        onClick={() =>
                          allQuestionsMode
                            ? allQuestionsQuery.refetch()
                            : questionsQuery.refetch()
                        }
                        data-testid="button-retry-questions"
                      >
                        Tentar agora <RotateCw size={14} />
                      </button>
                    </div>
                  ) : (
                    currentQuestion && (
                      <div
                        className={`question-card-layers ${questionSwipeExit ? "is-swiping" : ""}`}
                      >
                        {secondStackQuestion && (
                          <article
                            key={`underlay-${secondStackQuestion.id}`}
                            className={`question-card question-card-underlay question-gradient-${secondStackQuestionIndex! % 4}`}
                            aria-hidden="true"
                          >
                            <div className="question-card-grain" />
                            <div className="question-card-top">
                              <span>{secondStackTheme?.title}</span>
                              <div className="question-card-brand-side">
                                <strong>
                                  Perguntas
                                  <br />
                                  <i>de Conexão</i>
                                </strong>
                              </div>
                            </div>
                          </article>
                        )}
                        {nextStackQuestion && (
                          <article
                            key={`back-${nextStackQuestion.id}`}
                            className={`question-card question-card-back question-gradient-${nextQuestionIndex! % 4}`}
                            aria-hidden="true"
                          >
                            <div className="question-card-grain" />
                            <div className="question-card-top">
                              <span>{nextStackTheme?.title}</span>
                              <div className="question-card-brand-side">
                                <strong>
                                  Perguntas
                                  <br />
                                  <i>de Conexão</i>
                                </strong>
                              </div>
                            </div>
                            <div className="question-card-copy">
                              <p>{nextStackQuestion.text}</p>
                            </div>
                            <div className="question-card-foot">
                              <span>não existe resposta certa</span>
                              <span className="question-card-progress">
                                <i />
                                <i />
                                <i />
                              </span>
                            </div>
                          </article>
                        )}
                        <article
                          key={currentQuestion.id}
                          className={`question-card question-card-front question-gradient-${questionIndex % 4} ${writingOpen ? "is-writing" : ""} ${isQuestionDragging ? "is-dragging" : ""} ${questionSwipeExit ? `is-swiping-out-${questionSwipeExit}` : ""}`}
                          onPointerDown={handleQuestionPointerDown}
                          onPointerMove={handleQuestionPointerMove}
                          onPointerUp={finishQuestionPointer}
                          onPointerCancel={handleQuestionPointerCancel}
                          style={
                            {
                              "--question-drag-offset": `${questionDragOffset}px`,
                            } as CSSProperties
                          }
                          data-testid={`card-question-${currentQuestion.id}`}
                        >
                          <div className="question-card-grain" />
                          <div className="question-card-top">
                            <span data-testid="text-question-theme">
                              {selectedTheme?.title}
                            </span>
                            <div className="question-card-brand-side">
                              <strong data-testid="text-card-brand">
                                Perguntas
                                <br />
                                <i>de Conexão</i>
                              </strong>
                            </div>
                          </div>
                          <div className="question-card-copy">
                            <p
                              data-testid={`text-question-${currentQuestion.id}`}
                            >
                              {currentQuestion.text}
                            </p>
                          </div>
                          <div className="question-unstuck">
                            {unstuckOpen ? (
                              <div
                                className="question-unstuck-panel"
                                data-testid="panel-unstuck"
                              >
                                <p className="question-unstuck-title">
                                  Sem pressa. Se ajudar:
                                </p>
                                <ul>
                                  <li>
                                    Responde a primeira coisa que veio à cabeça
                                    — sem editar.
                                  </li>
                                  <li>
                                    Reformula a pergunta com suas próprias
                                    palavras.
                                  </li>
                                  <li>
                                    Pega só um pedacinho: uma cena, uma
                                    sensação, uma palavra.
                                  </li>
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
                          {writingOpen && (
                            <div className="question-response">
                              <textarea
                                value={currentResponse}
                                onChange={(event) =>
                                  setResponses((current) => ({
                                    ...current,
                                    [currentQuestion.id]: event.target.value,
                                  }))
                                }
                                placeholder="Escreva aqui, se quiser..."
                                aria-label="Sua resposta para esta pergunta"
                                data-testid={`textarea-response-${currentQuestion.id}`}
                              />
                            </div>
                          )}
                          <div className="question-card-foot">
                            <span>não existe resposta certa</span>
                            <span className="question-card-progress">
                              <i />
                              <i />
                              <i />
                            </span>
                          </div>
                          <button
                            className={`question-favorite-button ${saved.includes(currentQuestion.id) ? "is-saved" : ""}`}
                            onClick={() => toggleSaved(currentQuestion.id)}
                            aria-label={
                              saved.includes(currentQuestion.id)
                                ? "Remover dos favoritos"
                                : "Adicionar aos favoritos"
                            }
                            aria-pressed={saved.includes(currentQuestion.id)}
                            data-testid={`button-favorite-question-${currentQuestion.id}`}
                          >
                            <Star
                              size={16}
                              fill={
                                saved.includes(currentQuestion.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </article>
                      </div>
                    )
                  )}
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
              {showInvitePrompt && (
                <aside
                  className="invite-prompt-card"
                  aria-labelledby="invite-prompt-title"
                  data-testid="card-invite-prompt"
                >
                  <div className="invite-prompt-icon">
                    <Users size={16} />
                  </div>
                  <div className="invite-prompt-copy">
                    <span>traga alguém</span>
                    <strong id="invite-prompt-title">
                      Uma pergunta fica melhor com outra pessoa.
                    </strong>
                    <small>Convide alguém para jogar com você.</small>
                  </div>
                  <button
                    className="invite-prompt-action"
                    onClick={() => setInviteOpen(true)}
                    data-testid="button-open-invite-prompt"
                  >
                    Convidar <Send size={14} />
                  </button>
                </aside>
              )}
              {writingOpen && (
                <button
                  className="writing-done-button"
                  onClick={() => setWritingOpen(false)}
                  data-testid="button-writing-done"
                >
                  <Check size={16} /> Concluído
                </button>
              )}
            </section>
            <p className="question-hint" data-testid="text-question-hint">
              deslize ou use as setas para continuar
            </p>
          </>
        )}
        <nav
          className="app-bottom-nav"
          aria-label="Navegação principal"
          data-testid="nav-bottom"
        >
          <div className="app-nav-identity">
            <span className="app-nav-identity-mark">
              <Feather size={15} />
            </span>
            <span className="app-nav-identity-copy">
              <strong>Perguntas</strong>
              <small>de Conexão</small>
            </span>
          </div>
          <button
            type="button"
            className="app-nav-toggle"
            onClick={toggleNavCollapsed}
            aria-label={
              navCollapsed ? "Mostrar menu lateral" : "Esconder menu lateral"
            }
            aria-pressed={navCollapsed}
            title={
              navCollapsed ? "Mostrar menu lateral" : "Esconder menu lateral"
            }
            data-testid="button-toggle-nav"
          >
            <span className="nav-toggle-icon">
              {navCollapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </span>
          </button>
          <p className="app-nav-label">Navegação</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeNav === item.id ? "is-active" : ""}
                onClick={() => openDeckTab(item.id)}
                data-testid={`button-nav-${item.id}`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span className="nav-item-label">{item.label}</span>
                <span className={`nav-dot nav-dot-${item.id}`} />
              </button>
            );
          })}
          <div className="app-nav-footer">
            <span className="app-nav-status">
              <span /> pronto para a próxima conversa
            </span>
            <div className="app-nav-feedback-group">
              <button
                type="button"
                className="app-nav-feedback"
                onClick={() => setSuggestionOpen(true)}
                data-testid="button-open-suggestion"
              >
                Sugestões
              </button>
              <button
                type="button"
                className="app-nav-feedback"
                onClick={() => setReviewOpen(true)}
                data-testid="button-open-review"
              >
                Avaliar
              </button>
            </div>
            <span className="app-nav-version">PC · 01</span>
          </div>
        </nav>
      </main>
      <InstallAppPrompt />
      {dailyFormOpen && (
        <div
          className="app-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-form-title"
        >
          <div className="app-modal daily-form-modal">
            <button
              className="app-modal-close"
              onClick={closeDailyForm}
              aria-label="Fechar perguntas pra hoje"
              data-testid="button-close-daily-form"
            >
              <X size={18} />
            </button>
            <p className="modal-eyebrow">perguntas pra hoje</p>
            <div
              className="daily-form-progress"
              aria-label={`Passo ${dailyStep + 1} de 3`}
            >
              <div className="onboarding-progress">
                <span style={{ width: `${((dailyStep + 1) / 3) * 100}%` }} />
              </div>
              <span className="onboarding-progress-value">
                Passo {dailyStep + 1} de 3
              </span>
            </div>
            <h2 id="daily-form-title">
              {dailyStep === 0 ? (
                <>
                  Como vocês estão <em>agora?</em>
                </>
              ) : dailyStep === 1 ? (
                <>
                  O que combina <em>com agora?</em>
                </>
              ) : (
                <>
                  Quantas perguntas <em>vocês querem?</em>
                </>
              )}
            </h2>
            <p>
              {dailyStep === 0
                ? "Escolha o que melhor descreve o momento de vocês."
                : dailyStep === 1
                  ? "Escolha o clima que combina com esta conversa."
                  : "Definam o tamanho do baralho para hoje."}
            </p>
            {dailyStep === 0 && (
              <fieldset className="daily-form-group">
                <legend>Como vocês estão hoje?</legend>
                <div className="daily-option-grid">
                  {dailyMoodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`daily-option ${dailyMood === option.value ? "is-selected" : ""}`}
                      onClick={() => setDailyMood(option.value)}
                      aria-pressed={dailyMood === option.value}
                      data-testid={`button-daily-mood-${option.value}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={continueDailyForm}
                  disabled={!dailyMood}
                  className="app-primary-button daily-form-submit"
                  data-testid="button-daily-continue-mood"
                >
                  Continuar <ArrowRight size={16} />
                </button>
              </fieldset>
            )}
            {dailyStep === 1 && (
              <fieldset className="daily-form-group">
                <legend>O que combina mais com agora?</legend>
                <div className="daily-option-grid">
                  {dailyVibeOptions
                    .filter(
                      (option) =>
                        option.value !== "esquentar" ||
                        themes.some((theme) => theme.audience === "18+"),
                    )
                    .map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`daily-option ${dailyVibe === option.value ? "is-selected" : ""}`}
                        onClick={() => setDailyVibe(option.value)}
                        aria-pressed={dailyVibe === option.value}
                        data-testid={`button-daily-vibe-${option.value}`}
                      >
                        {option.label}
                      </button>
                    ))}
                </div>
                <div className="daily-step-actions">
                  <button
                    onClick={() =>
                      setDailyStep((step) => Math.max(0, step - 1))
                    }
                    className="app-secondary-button"
                    data-testid="button-daily-back-vibe"
                  >
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button
                    onClick={continueDailyForm}
                    disabled={!dailyVibe}
                    className="app-primary-button"
                    data-testid="button-daily-continue-vibe"
                  >
                    Continuar <ArrowRight size={16} />
                  </button>
                </div>
              </fieldset>
            )}
            {dailyStep === 2 && (
              <fieldset className="daily-form-group">
                <legend>Quantas perguntas vocês querem?</legend>
                <div className="daily-option-grid daily-count-grid">
                  {dailyCountOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`daily-option ${!dailyCountCustom && dailyCount === option ? "is-selected" : ""}`}
                      onClick={() => {
                        setDailyCountCustom(false);
                        setDailyCount(option);
                      }}
                      aria-pressed={!dailyCountCustom && dailyCount === option}
                      data-testid={`button-daily-count-${option}`}
                    >
                      {option} perguntas
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`daily-option ${dailyCountCustom ? "is-selected" : ""}`}
                    onClick={chooseCustomDailyCount}
                    aria-pressed={dailyCountCustom}
                    data-testid="button-daily-count-custom"
                  >
                    Outro número
                  </button>
                </div>
                {dailyCountCustom && (
                  <label className="daily-custom-count">
                    Quantidade personalizada
                    <input
                      type="number"
                      min={3}
                      max={30}
                      step={1}
                      value={dailyCustomCount}
                      onChange={(event) =>
                        updateDailyCustomCount(event.target.value)
                      }
                      aria-label="Quantidade personalizada de perguntas"
                      data-testid="input-daily-custom-count"
                    />
                    <small>Escolha entre 3 e 30 perguntas.</small>
                  </label>
                )}
                <div className="daily-step-actions">
                  <button
                    onClick={() =>
                      setDailyStep((step) => Math.max(0, step - 1))
                    }
                    className="app-secondary-button"
                    data-testid="button-daily-back-count"
                  >
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button
                    onClick={generateDailyDeck}
                    disabled={!dailyMood || !dailyVibe || dailyCount < 3}
                    className="app-primary-button"
                    data-testid="button-generate-daily-deck"
                  >
                    Montar meu baralho <ArrowRight size={16} />
                  </button>
                </div>
              </fieldset>
            )}
          </div>
        </div>
      )}
      {deckMenu && (
        <div
          className="app-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deck-menu-title"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeDeckMenu()
          }
        >
          <div className="app-modal deck-menu-modal">
            <button
              className="app-modal-close"
              onClick={closeDeckMenu}
              aria-label="Fechar ações do baralho"
              data-testid="button-close-deck-menu"
            >
              <X size={18} />
            </button>
            {deckMenuView === "menu" && (
              <>
                <p className="modal-eyebrow">seu baralho</p>
                <h2 id="deck-menu-title">
                  O que você quer <em>mudar?</em>
                </h2>
                <p>Personalize este baralho ou retire-o do seu histórico.</p>
                <div className="deck-menu-actions">
                  <button
                    className="deck-menu-action"
                    onClick={() => {
                      setDeckRenameValue(deckMenu.label);
                      setDeckMenuView("rename");
                    }}
                    data-testid="button-rename-daily-deck"
                  >
                    <span className="deck-menu-action-icon">
                      <Feather size={16} />
                    </span>
                    <span>
                      <strong>Mudar o nome</strong>
                      <small>Escolha como ele aparece para você</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                  <button
                    className="deck-menu-action"
                    onClick={() => {
                      setDeckCoverUploadError("");
                      setDeckMenuView("cover");
                    }}
                    data-testid="button-change-daily-deck-cover"
                  >
                    <span
                      className={`deck-menu-action-icon deck-cover-${isDeckCoverId(deckMenu.cover) ? deckMenu.cover : "custom"}`}
                      style={deckCoverStyle(deckMenu.cover)}
                    >
                      <span className="deck-cover-swatch" />
                    </span>
                    <span>
                      <strong>Mudar a imagem</strong>
                      <small>Escolha uma nova capa ou foto</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                  <button
                    className="deck-menu-action deck-menu-action-danger"
                    onClick={() => setDeckMenuView("delete")}
                    data-testid="button-delete-daily-deck"
                  >
                    <span className="deck-menu-action-icon">
                      <X size={16} />
                    </span>
                    <span>
                      <strong>Apagar</strong>
                      <small>Remover do seu histórico</small>
                    </span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
            {deckMenuView === "rename" && (
              <>
                <p className="modal-eyebrow">mudar o nome</p>
                <h2 id="deck-menu-title">
                  Dê um nome <em>para este momento.</em>
                </h2>
                <p>Esse nome fica salvo junto com o seu baralho.</p>
                <input
                  autoFocus
                  value={deckRenameValue}
                  onChange={(event) => setDeckRenameValue(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" &&
                    renamePersonalizedDeck(deckMenu.id, deckRenameValue)
                  }
                  className="app-text-input"
                  aria-label="Nome do baralho"
                  data-testid="input-rename-daily-deck"
                />
                <div className="deck-menu-footer">
                  <button
                    className="app-secondary-button"
                    onClick={() => setDeckMenuView("menu")}
                    data-testid="button-cancel-rename-daily-deck"
                  >
                    Voltar
                  </button>
                  <button
                    className="app-primary-button"
                    onClick={() =>
                      renamePersonalizedDeck(deckMenu.id, deckRenameValue)
                    }
                    disabled={!deckRenameValue.trim()}
                    data-testid="button-save-rename-daily-deck"
                  >
                    Salvar <Check size={16} />
                  </button>
                </div>
              </>
            )}
            {deckMenuView === "cover" && (
              <>
                <p className="modal-eyebrow">mudar a imagem</p>
                <h2 id="deck-menu-title">
                  Escolha outra <em>capa.</em>
                </h2>
                <p>A imagem ajuda a reconhecer o clima de cada baralho.</p>
                <div
                  className="deck-cover-picker"
                  role="radiogroup"
                  aria-label="Capas disponíveis"
                >
                  {deckCoverOptions.map((option) => (
                    <button
                      key={option.id}
                      className={`deck-cover-option deck-cover-${option.id} ${deckMenu.cover === option.id ? "is-selected" : ""}`}
                      onClick={() =>
                        updatePersonalizedDeckCover(deckMenu.id, option.id)
                      }
                      role="radio"
                      aria-checked={deckMenu.cover === option.id}
                      aria-label={option.label}
                      data-testid={`button-select-deck-cover-${option.id}`}
                    >
                      <span className="deck-cover-orbit" />
                      <span className="deck-cover-spark" />
                      <small>{option.label}</small>
                      {deckMenu.cover === option.id && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <input
                  ref={deckCoverInputRef}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleDeckCoverUpload(event.target.files?.[0])
                  }
                  data-testid="input-upload-deck-cover"
                />
                <button
                  className="deck-upload-cover-button"
                  onClick={() => deckCoverInputRef.current?.click()}
                  disabled={isUploadingDeckCover}
                  data-testid="button-upload-deck-cover"
                >
                  <Upload size={16} />{" "}
                  {isUploadingDeckCover
                    ? "Preparando imagem…"
                    : "Usar uma foto do celular"}
                </button>
                {deckCoverUploadError && (
                  <p className="deck-cover-upload-error" role="alert">
                    {deckCoverUploadError}
                  </p>
                )}
                <button
                  className="app-secondary-button deck-cover-back-button"
                  onClick={() => setDeckMenuView("menu")}
                  data-testid="button-cancel-cover-change"
                >
                  Voltar
                </button>
              </>
            )}
            {deckMenuView === "delete" && (
              <>
                <div className="deck-delete-mark">
                  <X size={20} />
                </div>
                <p className="modal-eyebrow">apagar baralho</p>
                <h2 id="deck-menu-title">
                  Apagar este <em>baralho?</em>
                </h2>
                <p>
                  “{deckMenu.label}” será removido do seu histórico. Essa ação
                  não pode ser desfeita.
                </p>
                <div className="deck-menu-footer">
                  <button
                    className="app-secondary-button"
                    onClick={() => setDeckMenuView("menu")}
                    data-testid="button-cancel-delete-daily-deck"
                  >
                    Voltar
                  </button>
                  <button
                    className="app-primary-button deck-delete-confirm"
                    onClick={() => deletePersonalizedDeck(deckMenu.id)}
                    data-testid="button-confirm-delete-daily-deck"
                  >
                    Apagar <X size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {isPreparingDeck && (
        <div
          className="app-modal-backdrop preparing-deck-backdrop"
          role="status"
          aria-live="polite"
        >
          <div className="deck-preparing">
            <div className="deck-preparing-stack" aria-hidden="true">
              <span className="preparing-card preparing-card-back" />
              <span className="preparing-card preparing-card-middle" />
              <span className="preparing-card preparing-card-front" />
            </div>
            <p className="modal-eyebrow">um momento só</p>
            <h2>
              Preparando seu <em>baralho…</em>
            </h2>
            <p>Separando perguntas para o momento de vocês.</p>
            <div className="preparing-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
      {adultThemePrompt && (
        <div
          className="app-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adult-theme-title"
        >
          <div className="app-modal adult-theme-modal">
            <button
              className="app-modal-close"
              onClick={() => setAdultThemePrompt(null)}
              aria-label="Fechar aviso"
              data-testid="button-cancel-adult-theme"
            >
              <X size={18} />
            </button>
            <div
              className="adult-theme-mark"
              role="img"
              aria-label="Conteúdo para maiores de 18 anos"
            >
              <Flame size={19} strokeWidth={2.1} aria-hidden="true" />
            </div>
            <p className="modal-eyebrow">um espaço para dois</p>
            <h2 id="adult-theme-title">
              {adultThemePrompt.title}
              <em>.</em>
            </h2>
            <p>
              Este espaço tem perguntas mais ousadas, pensadas para casais. Quer
              continuar?
            </p>
            <button
              onClick={confirmAdultTheme}
              className="app-primary-button"
              data-testid="button-confirm-adult-theme"
            >
              Quero continuar <ArrowRight size={16} />
            </button>
            <button
              onClick={() => setAdultThemePrompt(null)}
              className="app-secondary-button"
              data-testid="button-cancel-adult-theme-secondary"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
      {welcomeOpen && (
        <div className="app-modal-backdrop">
          <div className="app-modal welcome-app-modal">
            <button
              className="app-modal-close"
              onClick={() => setWelcomeOpen(false)}
              aria-label="Fechar apresentação"
              data-testid="button-close-welcome"
            >
              <X size={18} />
            </button>
            <div className="welcome-app-mark">
              <Feather size={19} />
            </div>
            <p className="modal-eyebrow">antes da primeira carta</p>
            <h2>
              Como podemos
              <br />
              <em>te chamar?</em>
            </h2>
            <p>
              É só para deixar este espaço um pouco mais seu. Você pode entrar
              sem preencher nada.
            </p>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startSession()}
              placeholder="Seu nome"
              className="app-text-input"
              data-testid="input-buyer-name"
            />
            <button
              onClick={startSession}
              className="app-primary-button"
              data-testid="button-enter-experience"
            >
              {createSession.isPending
                ? "Abrindo seu espaço…"
                : "Entrar na experiência"}{" "}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="app-modal-backdrop">
          <div className="app-modal settings-app-modal">
            <button
              className="app-modal-close"
              onClick={() => setSettingsOpen(false)}
              aria-label="Fechar ajustes"
              data-testid="button-close-settings"
            >
              <X size={18} />
            </button>
            <p className="modal-eyebrow">seu espaço</p>
            <h2>
              Ajustes da
              <br />
              <em>experiência.</em>
            </h2>
            <div className="settings-row">
              <span>Perfil</span>
              <strong data-testid="text-settings-name">{`${isGuest ? guestDisplayName || buyerName || "Visitante" : buyerName || "Visitante"} · ${isOwner ? "Dono" : "Convidado"}`}</strong>
            </div>
            <div className="settings-row">
              <span>Acesso</span>
              <strong data-testid="text-settings-access">
                {sessionQuery.data?.accessGranted || accessQuery.data?.hasAccess
                  ? activeAccess?.packageName || "Ativo"
                  : "Demonstração"}
              </strong>
            </div>
            <div className="settings-row">
              <span>Salvas</span>
              <strong data-testid="text-settings-saved">
                {saved.length} pergunta{saved.length === 1 ? "" : "s"}
              </strong>
            </div>
            <div
              className="settings-row settings-row-clickable"
              onClick={() =>
                setExpandedField(
                  expandedField === "relationship" ? null : "relationship",
                )
              }
              data-testid="row-relationship"
            >
              <span>Tipo de relacionamento</span>
              <strong>
                {editRelationship || "Não definido"}{" "}
                <ChevronRight
                  size={14}
                  className={`settings-chevron ${expandedField === "relationship" ? "is-open" : ""}`}
                />
              </strong>
            </div>
            {expandedField === "relationship" && (
              <div className="settings-choices-inline">
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setEditRelationship(opt);
                      safeSetItem("conexao-relationship", opt);
                      patchPreferences(
                        sessionId || null,
                        storedGuestToken || null,
                        { relationshipType: opt },
                      );
                      setExpandedField(null);
                    }}
                    className={`settings-choice ${editRelationship === opt ? "is-selected" : ""}`}
                    data-testid={`button-relationship-${opt}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <div
              className="settings-row settings-row-clickable"
              onClick={() =>
                setExpandedField(expandedField === "pronoun" ? null : "pronoun")
              }
              data-testid="row-pronoun"
            >
              <span>Pronome do parceiro</span>
              <strong>
                {editPronoun || "Não definido"}{" "}
                <ChevronRight
                  size={14}
                  className={`settings-chevron ${expandedField === "pronoun" ? "is-open" : ""}`}
                />
              </strong>
            </div>
            {expandedField === "pronoun" && (
              <div className="settings-choices-inline">
                {PRONOUN_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setEditPronoun(opt);
                      safeSetItem("conexao-partner-pronoun", opt);
                      patchPreferences(
                        sessionId || null,
                        storedGuestToken || null,
                        { partnerPronoun: opt },
                      );
                      setExpandedField(null);
                    }}
                    className={`settings-choice ${editPronoun === opt ? "is-selected" : ""}`}
                    data-testid={`button-pronoun-${opt}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setSettingsOpen(false);
                setWelcomeOpen(true);
              }}
              className="app-secondary-button"
              data-testid="button-edit-name"
            >
              Editar como te chamar
            </button>
            {isAdminAccount && (
              <Link
                href="/admin"
                className="app-secondary-button admin-panel-link"
                data-testid="button-open-admin-panel"
                onClick={() => setSettingsOpen(false)}
              >
                <LayoutTemplate size={15} /> Painel Admin
              </Link>
            )}
            <button
              onClick={() => {
                setSettingsOpen(false);
                handleLogout();
              }}
              className="app-secondary-button app-logout-button"
              data-testid="button-logout"
            >
              Sair da conta
            </button>
          </div>
        </div>
      )}
      {suggestionOpen && (
        <div
          className="app-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestion-title"
        >
          <div className="app-modal">
            <button
              className="app-modal-close"
              onClick={() => {
                setSuggestionOpen(false);
                setSuggestionStatus("idle");
              }}
              aria-label="Fechar sugestões"
              data-testid="button-close-suggestion"
            >
              <X size={18} />
            </button>
            {suggestionStatus === "sent" ? (
              <>
                <p className="modal-eyebrow">obrigado</p>
                <h2 id="suggestion-title">
                  Sua sugestão
                  <br />
                  <em>chegou até nós.</em>
                </h2>
                <p>Lemos todas, prometido.</p>
                <button
                  onClick={() => {
                    setSuggestionOpen(false);
                    setSuggestionStatus("idle");
                  }}
                  className="app-primary-button"
                  data-testid="button-close-suggestion-sent"
                >
                  Fechar
                </button>
              </>
            ) : (
              <>
                <p className="modal-eyebrow">ideias e sugestões</p>
                <h2 id="suggestion-title">
                  O que podemos
                  <br />
                  <em>melhorar?</em>
                </h2>
                <p>
                  Conta pra gente o que faltou, o que travou, ou o que você
                  adoraria ver aqui.
                </p>
                <textarea
                  value={suggestionMessage}
                  onChange={(e) => setSuggestionMessage(e.target.value)}
                  placeholder="Sua sugestão"
                  className="app-textarea"
                  rows={4}
                  data-testid="input-suggestion-message"
                />
                <input
                  type="email"
                  value={suggestionEmail}
                  onChange={(e) => setSuggestionEmail(e.target.value)}
                  placeholder="Seu email (opcional, pra gente poder responder)"
                  className="app-text-input"
                  data-testid="input-suggestion-email"
                />
                {suggestionStatus === "error" && (
                  <p className="checkout-error">
                    Não deu pra enviar agora. Tenta de novo em instantes.
                  </p>
                )}
                <button
                  onClick={() => void sendSuggestion()}
                  disabled={
                    suggestionStatus === "sending" || !suggestionMessage.trim()
                  }
                  className="app-primary-button"
                  data-testid="button-send-suggestion"
                >
                  {suggestionStatus === "sending"
                    ? "Enviando…"
                    : "Enviar sugestão"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {reviewOpen && (
        <div
          className="app-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-title"
        >
          <div className="app-modal">
            <button
              className="app-modal-close"
              onClick={() => {
                setReviewOpen(false);
                setReviewStatus("idle");
              }}
              aria-label="Fechar avaliação"
              data-testid="button-close-review"
            >
              <X size={18} />
            </button>
            {reviewStatus === "sent" ? (
              <>
                <p className="modal-eyebrow">muito obrigado</p>
                <h2 id="review-title">
                  Sua avaliação
                  <br />
                  <em>significa muito.</em>
                </h2>
                <p>
                  Pode ser que a gente entre em contato pra pedir permissão de
                  usar seu depoimento na página de vendas.
                </p>
                <button
                  onClick={() => {
                    setReviewOpen(false);
                    setReviewStatus("idle");
                  }}
                  className="app-primary-button"
                  data-testid="button-close-review-sent"
                >
                  Fechar
                </button>
              </>
            ) : (
              <>
                <p className="modal-eyebrow">sua opinião</p>
                <h2 id="review-title">
                  Como está sendo
                  <br />
                  <em>sua experiência?</em>
                </h2>
                <div
                  className="review-stars"
                  role="radiogroup"
                  aria-label="Nota de 1 a 5"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={reviewRating === value}
                      onClick={() => setReviewRating(value)}
                      className={`review-star-button ${value <= reviewRating ? "is-filled" : ""}`}
                      data-testid={`button-review-star-${value}`}
                    >
                      <Star
                        size={26}
                        fill={value <= reviewRating ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  placeholder="Conta como foi usar o Perguntas de Conexão"
                  className="app-textarea"
                  rows={4}
                  data-testid="input-review-message"
                />
                <input
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder="Seu nome (opcional)"
                  className="app-text-input"
                  data-testid="input-review-name"
                />
                <input
                  type="email"
                  value={reviewEmail}
                  onChange={(e) => setReviewEmail(e.target.value)}
                  placeholder="Seu email (opcional)"
                  className="app-text-input"
                  data-testid="input-review-email"
                />
                {reviewStatus === "error" && (
                  <p className="checkout-error">
                    Não deu pra enviar agora. Tenta de novo em instantes.
                  </p>
                )}
                <button
                  onClick={() => void sendReview()}
                  disabled={
                    reviewStatus === "sending" ||
                    !reviewRating ||
                    !reviewMessage.trim()
                  }
                  className="app-primary-button"
                  data-testid="button-send-review"
                >
                  {reviewStatus === "sending"
                    ? "Enviando…"
                    : "Enviar avaliação"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {inviteOpen && isOwner && (
        <div
          className="app-modal-backdrop"
          onClick={() => setInviteOpen(false)}
        >
          <div
            className="app-modal invite-app-modal invite-modal-hub"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="app-modal-close"
              onClick={() => setInviteOpen(false)}
              aria-label="Fechar convite"
              data-testid="button-close-invite"
            >
              <X size={18} />
            </button>
            <p className="modal-eyebrow">quem joga com você</p>
            <h2>
              Convidados
              <br />
              <em>desse baralho.</em>
            </h2>
            <div className="invite-hub-stats">
              <div>
                <strong>
                  {invitesList.filter((invite) => invite.isUsed).length}
                </strong>
                <small>entraram</small>
              </div>
              <div>
                <strong>
                  {invitesList.filter((invite) => !invite.isUsed).length}
                </strong>
                <small>aguardando</small>
              </div>
              <div>
                <strong>{Math.max(0, inviteLimit - invitesList.length)}</strong>
                <small>cadeiras livres</small>
              </div>
            </div>
            {invitesList.length > 0 && (
              <ul className="invite-hub-list" aria-label="Convites">
                {invitesList.map((invite) => {
                  const initial = (invite.guestName || "?")
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <li
                      key={invite.token}
                      className={`invite-hub-row${invite.isUsed ? " is-active" : ""}`}
                      data-testid={`companion-${invite.token}`}
                    >
                      <div
                        className={`invite-hub-avatar${invite.isUsed ? " is-active" : ""}`}
                      >
                        {initial}
                      </div>
                      <div className="invite-hub-main">
                        <span className="invite-hub-name">
                          {invite.guestName}
                        </span>
                        <span className="invite-hub-status">
                          {invite.isUsed && invite.usedAt
                            ? `entrou em ${new Date(invite.usedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                            : "aguardando aceitar"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelInvite(invite)}
                        className="invite-hub-remove"
                        aria-label={`Desconvidar ${invite.guestName}`}
                        data-testid={`button-cancel-invite-${invite.token}`}
                      >
                        <X size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {canInvite ? (
              inviteResult ? (
                <div className="invite-hub-success">
                  <div className="invite-success-mark">
                    <Check size={21} />
                  </div>
                  <p className="modal-eyebrow">convite criado</p>
                  <h3>
                    Compartilhe com <em>{inviteResult.guestName}</em>
                  </h3>
                  <div className="invite-share-block">
                    <button
                      onClick={copyInvite}
                      className="invite-share-button"
                      data-testid="button-copy-invite"
                    >
                      <Copy size={18} />{" "}
                      {copiedInvite ? "Copiado!" : "Copiar link do convite"}
                    </button>
                    <details className="invite-share-details">
                      <summary>Ver o link</summary>
                      <input
                        readOnly
                        value={
                          inviteResult.token
                            ? inviteUrlFromToken(inviteResult.token)
                            : ""
                        }
                        className="app-text-input"
                        data-testid="input-invite-url"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    </details>
                  </div>
                  <button
                    onClick={() => {
                      setInviteResult(null);
                      setGuestName("");
                      setCopiedInvite(false);
                    }}
                    className="app-text-button"
                    data-testid="button-new-invite"
                  >
                    Criar outro convite <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="invite-hub-form">
                  <p className="modal-eyebrow">novo convite</p>
                  <label className="invite-hub-label" htmlFor="guest-name-app">
                    Nome de quem vai receber
                  </label>
                  <input
                    id="guest-name-app"
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    className="app-text-input"
                    placeholder="Ex: Ana"
                    data-testid="input-guest-name"
                  />
                  <button
                    onClick={makeInvite}
                    className="app-primary-button"
                    disabled={!guestName.trim() || createInvite.isPending}
                    data-testid="button-create-invite"
                  >
                    {createInvite.isPending
                      ? "Criando convite…"
                      : "Gerar convite"}{" "}
                    <LinkIcon size={16} />
                  </button>
                  {createInvite.isError && (
                    <p
                      className="app-form-error"
                      data-testid="status-invite-error"
                    >
                      Não foi possível gerar agora. Tente novamente.
                    </p>
                  )}
                </div>
              )
            ) : (
              <div className="invite-hub-full">
                <p>
                  <strong>Cadeiras cheias.</strong> Desconvide alguém acima pra
                  liberar espaço.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PostPurchaseInvite() {
  const [, navigate] = useLocation();
  const queryClientRef = useQueryClient();
  const sessionId = safeGetItem("conexao-session")?.trim() || "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    token?: string;
    guestName?: string;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const createInvite = useCreateInvite();

  const makeInvite = () => {
    const normalizedGuestName = guestName.trim();
    if (!sessionId || !normalizedGuestName) return;

    createInvite.mutate(
      { sessionId, data: { guestName: normalizedGuestName } },
      {
        onSuccess: (result) => {
          setInviteResult(result);
          queryClientRef.invalidateQueries({
            queryKey: getGetQuestionSessionQueryKey(sessionId),
          });
          queryClientRef.invalidateQueries({
            queryKey: getListInvitesQueryKey(sessionId),
          });
        },
      },
    );
  };

  const inviteUrl = inviteResult?.token
    ? inviteUrlFromToken(inviteResult.token)
    : "";

  const copyInvite = async () => {
    if (!inviteUrl || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setCopiedInvite(false);
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Perguntas de Conexão",
          text: "Vem abrir esse baralho comigo.",
          url: inviteUrl,
        });
      } else {
        await copyInvite();
      }
    } catch {
      // Sharing can be dismissed without an error state.
    }
  };

  return (
    <main className="post-purchase-shell">
      <section className="post-purchase-content" aria-labelledby="post-purchase-title">
        <span className="post-purchase-badge">BARALHO LIBERADO</span>
        <h1 id="post-purchase-title">
          Pronto. O baralho de vocês foi liberado.
        </h1>
        <p className="post-purchase-lead">
          Acesso vitalício liberado. Agora falta uma coisa só: chamar ele ou
          ela.
        </p>

        {!inviteOpen && !inviteResult ? (
          <button
            type="button"
            className="post-purchase-invite-button"
            onClick={() => setInviteOpen(true)}
            data-testid="button-post-purchase-invite"
          >
            Convidar ele(a) <Send size={18} aria-hidden="true" />
          </button>
        ) : null}

        {inviteOpen && !inviteResult ? (
          <div className="post-purchase-invite-form">
            <label htmlFor="post-purchase-guest-name">
              Nome de quem vai receber
            </label>
            <input
              id="post-purchase-guest-name"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              className="text-input"
              placeholder="Ex: Ana"
              autoComplete="name"
              data-testid="input-post-purchase-guest-name"
            />
            <button
              type="button"
              className="post-purchase-invite-button"
              onClick={makeInvite}
              disabled={!guestName.trim() || createInvite.isPending}
              data-testid="button-post-purchase-create-invite"
            >
              {createInvite.isPending ? "Criando convite…" : "Gerar convite"}{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            {createInvite.isError ? (
              <p className="post-purchase-invite-error">
                Não foi possível gerar o convite agora. Tente novamente.
              </p>
            ) : null}
          </div>
        ) : null}

        {inviteResult && inviteUrl ? (
          <div className="post-purchase-invite-result">
            <p>
              Convite criado para{" "}
              <strong>{inviteResult.guestName || "ele(a)"}</strong>.
            </p>
            <div className="post-purchase-invite-actions">
              <button
                type="button"
                className="post-purchase-share-button"
                onClick={() => void copyInvite()}
                data-testid="button-post-purchase-copy-invite"
              >
                <Copy size={17} aria-hidden="true" />
                {copiedInvite ? "Link copiado!" : "Copiar link"}
              </button>
              <button
                type="button"
                className="post-purchase-share-button"
                onClick={() => void shareInvite()}
                data-testid="button-post-purchase-share-invite"
              >
                <Send size={17} aria-hidden="true" />
                Compartilhar
              </button>
            </div>
            <details className="post-purchase-invite-link">
              <summary>Ver o link do convite</summary>
              <input
                readOnly
                value={inviteUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="text-input"
                data-testid="input-post-purchase-invite-url"
              />
            </details>
          </div>
        ) : null}

        <div className="post-purchase-question-card">
          <span>COMEÇEM POR ESTA, HOJE À NOITE</span>
          <p>Qual parte da nossa rotina você não trocaria por nada?</p>
        </div>

        <button
          type="button"
          className="post-purchase-later"
          onClick={() => navigate("/onboarding")}
          data-testid="button-post-purchase-later"
        >
          Convidar depois <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}

function InvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const inviteQuery = useGetInvite(token, {
    query: { enabled: !!token, queryKey: getGetInviteQueryKey(token) },
  });
  const invite = inviteQuery.data;
  const acceptInvite = () => {
    if (invite && token) {
      const keysToRemove = [
        "conexao-session",
        "conexao-onboarding-complete",
        "conexao-onboarding-step",
        "conexao-onboarding-name",
        "conexao-onboarding-pronoun",
        "conexao-onboarding-relationship",
        "conexao-onboarding-date",
        "conexao-onboarding-curiosity",
        "conexao-onboarding-feeling",
        "conexao-relationship",
        "conexao-curiosity",
        "conexao-feeling",
        "conexao-partner-pronoun",
        "conexao-guest-email",
      ];
      keysToRemove.forEach((key) => {
        try {
          window.localStorage?.removeItem(key);
        } catch {
          /* noop */
        }
      });
      safeSetItem("conexao-guest-token", token);
      safeSetItem("conexao-guest-name", invite.guestName);
      safeSetItem("conexao-name", invite.guestName);
      safeSetItem("conexao-role", "guest");
      fetch(apiUrl(`/api/access/invites/${encodeURIComponent(token)}/accept`), {
        method: "POST",
      }).catch(() => {});
    }
  };
  return (
    <div className="invite-page-shell">
      <main className="invite-entry">
        <div className="invite-entry-orbit" />
        <div className="invite-entry-card">
          {inviteQuery.isLoading ? (
            <>
              <div className="skeleton-line short" />
              <div className="skeleton-line wide" />
              <div className="skeleton-line" />
            </>
          ) : invite ? (
            <>
              <div className="invite-symbol">
                <Feather size={23} />
              </div>
              <p className="section-kicker light-kicker">
                um convite para você
              </p>
              <h1>
                <em>{invite.guestName}</em>, tem uma
                <br />
                conversa te esperando.
              </h1>
              {invite.ownerName && (
                <p className="guest-invited-by">
                  Você foi convidado por <strong>{invite.ownerName}</strong>
                </p>
              )}
              <p className="invite-entry-copy">
                Você foi convidado para participar de{" "}
                <strong>{invite.packageName}</strong>. Aqui, convidados podem
                responder e descobrir — só não podem criar novos convites.
              </p>
              <Link
                href="/onboarding"
                onClick={acceptInvite}
                className="button button-salmon"
                data-testid="link-accept-invite"
              >
                Aceitar convite <ArrowRight size={16} />
              </Link>
              <span className="guest-note">
                <Users size={14} /> Você entra como convidado
              </span>
            </>
          ) : (
            <>
              <div className="invite-symbol">
                <X size={23} />
              </div>
              <p className="section-kicker light-kicker">
                convite não encontrado
              </p>
              <h1>
                Este endereço
                <br />
                <em>já mudou de lugar.</em>
              </h1>
              <p className="invite-entry-copy">
                Peça a quem te convidou para enviar um novo acesso.
              </p>
              <Link
                href="/app"
                className="button button-salmon"
                data-testid="link-open-demo"
              >
                Conhecer a experiência <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function AccessLinkRoute({ params }: { params: { sessionId: string } }) {
  useEffect(() => {
    if (!params.sessionId) return;
    safeSetItem("conexao-session", params.sessionId);
    safeSetItem("conexao-role", "owner");
    window.location.href = "/onboarding";
  }, [params.sessionId]);
  return null;
}

function ProtectedExperienceRoute() {
  const [, navigate] = useLocation();
  const storedSessionId = safeGetItem("conexao-session")?.trim() || "";
  const storedGuestToken = safeGetItem("conexao-guest-token")?.trim() || "";
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
  const hasAccess =
    sessionQuery.data?.accessGranted || guestQuery.data?.hasAccess;
  const isChecking =
    (storedSessionId && sessionQuery.isPending) ||
    (storedGuestToken && guestQuery.isPending);
  const inviteRevoked = !!storedGuestToken && guestQuery.isError;
  const sessionRevoked = !!storedSessionId && sessionQuery.isError;

  useEffect(() => {
    if (!storedSessionId && !storedGuestToken) {
      navigate("/", { replace: true });
      return;
    }
    if (!isChecking && !hasAccess && !inviteRevoked && !sessionRevoked) {
      navigate("/", { replace: true });
    }
  }, [
    hasAccess,
    inviteRevoked,
    isChecking,
    navigate,
    sessionRevoked,
    storedGuestToken,
    storedSessionId,
  ]);

  if (inviteRevoked || sessionRevoked) {
    const clearAndGo = () => {
      [
        "conexao-session",
        "conexao-guest-token",
        "conexao-guest-name",
        "conexao-name",
        "conexao-role",
        "conexao-onboarding-complete",
      ].forEach((key) => {
        try {
          window.localStorage?.removeItem(key);
        } catch {
          /* noop */
        }
      });
      navigate("/", { replace: true });
    };
    return (
      <div className="access-gate-overlay" role="status">
        <div className="access-gate access-gate-denied">
          <span className="access-gate-mark">
            <X size={20} />
          </span>
          <h2>Seu acesso foi encerrado.</h2>
          <p>
            {inviteRevoked
              ? "Quem te convidou removeu seu acesso a este baralho."
              : "Sua sessão não é mais válida."}
          </p>
          <p className="access-gate-hint">
            Fale com quem te convidou pra receber um novo convite, ou compre seu
            próprio baralho.
          </p>
          <div className="access-gate-actions">
            <button
              onClick={clearAndGo}
              className="button button-primary"
              data-testid="button-clear-revoked"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isChecking || !hasAccess) {
    return (
      <div className="access-gate-overlay" role="status" aria-live="polite">
        <div className="access-gate">
          <span className="access-gate-mark">
            <Feather size={18} />
          </span>
          <p>Verificando seu acesso…</p>
        </div>
      </div>
    );
  }

  return <AppExperienceReference />;
}

function RouteLoading() {
  return (
    <main className="primary-landing-loading" role="status" aria-live="polite">
      <span className="brand-symbol" aria-hidden="true">
        <Feather size={18} strokeWidth={1.6} />
      </span>
      <p>Carregando…</p>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
        <Switch>
          <Route path="/">
            <PrimaryLandingPageRoute />
          </Route>
          <Route path="/lp2">
            <Home />
          </Route>
          <Route path="/lp1">
            <Home variant="v2" />
          </Route>
          <Route path="/lp3">
            <TrackedLp3 />
          </Route>
          <Route path="/quiz">
            <TrackedQuiz />
          </Route>
          <Route path="/e/:experimentSlug" component={ExperimentLinkRoute} />
          <Route path="/onboarding" component={Onboarding} />
          <Route path="/post-purchase" component={PostPurchaseInvite} />
          <Route path="/acesso/:sessionId" component={AccessLinkRoute} />
          <Route path="/login" component={Login} />
          <Route path="/play" component={Play} />
          <Route path="/app" component={ProtectedExperienceRoute} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route path="/admin" component={Admin} />
          <Route path="/termos" component={Termos} />
          <Route path="/privacidade" component={Privacidade} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </RoutedErrorBoundary>
  );
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function RouteAwareSplash() {
  const [location] = useLocation();
  const isLandingPage =
    location === "/" ||
    location === "/lp1" ||
    location === "/lp2" ||
    location === "/lp3" ||
    location === "/quiz" ||
    location.startsWith("/e/");

  const isAppRoute =
    location === "/admin" ||
    location === "/login" ||
    location === "/onboarding" ||
    location === "/post-purchase" ||
    location.startsWith("/acesso/") ||
    location === "/play" ||
    location === "/app" ||
    location.startsWith("/invite/");

  const isLegalRoute = location === "/termos" || location === "/privacidade";

  return isLandingPage || isAppRoute || isLegalRoute ? null : <SplashScreen />;
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <RouteAwareSplash />
          <SupportDialog />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;
