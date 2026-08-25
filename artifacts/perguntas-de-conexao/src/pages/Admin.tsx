import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Bell,
  Check,
  Copy,
  ChevronDown,
  ExternalLink,
  LayoutTemplate,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { apiBaseUrl } from "@/config";

type LandingEntry = {
  id: string;
  label: string;
  path: string;
  description: string;
};
type SuggestionEntry = {
  id: string;
  email: string | null;
  message: string;
  createdAt: string;
};
type ReviewEntry = {
  id: string;
  displayName: string | null;
  email: string | null;
  rating: number;
  message: string;
  createdAt: string;
};
type BuyerEntry = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  packageName: string;
  accessGranted: boolean;
  invitesUsed: number;
  inviteLimit: number;
  createdAt: string;
};
type RecordingLookup = {
  available?: boolean;
  url?: string;
  visitorKey?: string;
  reason?: "sem-rastreio" | "sem-gravacao";
};
type LpSession = {
  visitorKey: string;
  firstSeenAt: string;
  timeOnPageSeconds: number | null;
  lastSection: string | null;
  status: "comprou" | "aguardando_pagamento" | "so_visitou";
  buyerName: string | null;
  packageName: string | null;
  hasRecording: boolean;
};
type BuyersResponse = {
  buyers?: BuyerEntry[];
  total?: number;
  totalWithAccess?: number;
};
type AnalyticsEntry = {
  lpId: string;
  views: number;
  ctaClicks: number;
  checkoutsStarted: number;
  purchasesConfirmed: number;
  avgTimeOnPageSeconds: number | null;
  topExitSections: Array<{ section: string; count: number }>;
};
type LpSessionsResponse = { sessions?: LpSession[] };

const LANDINGS: LandingEntry[] = [
  {
    id: "v1",
    label: "LP1 — Storytelling + Quiz",
    path: "/",
    description:
      "Headline de promessa direta, storytelling da dor, quiz de 3 perguntas e 16 baralhos.",
  },
  {
    id: "v2",
    label: "LP2 — Estática (variedade de baralhos)",
    path: "/lp2",
    description:
      "Hero + dor + solução + temas + prova social + preço + FAQ, tudo em scroll, sem quiz.",
  },
];

const TABS = [
  { id: "buyers", label: "Compradores" },
  { id: "pages", label: "Páginas" },
  { id: "notifications", label: "Notificações" },
  { id: "feedback", label: "Feedback" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function NotificationsTab({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<
    "idle" | "loading" | "enabled" | "denied" | "unsupported" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription) setState("enabled");
      })
      .catch(() => {});
  }, []);

  const activate = async () => {
    setState("loading");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setMessage(
          "Permita notificações nas configurações do navegador ou do app para receber avisos de novas compras.",
        );
        return;
      }
      const keyResponse = await fetch(
        `${apiBaseUrl}/api/push/vapid-public-key`,
      );
      if (!keyResponse.ok) throw new Error("public-key");
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const response = await fetch(`${apiBaseUrl}/api/admin/push-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, subscription }),
      });
      if (!response.ok) throw new Error("subscribe");
      setState("enabled");
    } catch {
      setState("error");
      setMessage(
        "Não foi possível ativar agora. Tente novamente em instantes.",
      );
    }
  };

  return (
    <section className="admin-section" aria-labelledby="notifications-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">avisos em tempo real</p>
          <h2 id="notifications-title">Notificações</h2>
        </div>
        <div className="admin-notification-icon">
          <Bell size={18} />
        </div>
      </div>
      <p className="admin-notification-copy">
        Receba um aviso no seu celular sempre que alguém comprar.
      </p>
      <p className="admin-notification-note">
        No iPhone, isso só funciona se você tiver adicionado este app à tela de
        início (compartilhar → Adicionar à Tela de Início) e abrir por lá, não
        pelo Safari normal. No Android funciona direto pelo Chrome.
      </p>
      {state === "unsupported" ? (
        <p className="admin-notification-status">
          Seu navegador não suporta notificações push.
        </p>
      ) : state === "enabled" ? (
        <p className="admin-notification-status is-enabled">
          Notificações ativadas neste aparelho ✓
        </p>
      ) : (
        <button
          type="button"
          className="button button-primary admin-notification-button"
          onClick={activate}
          disabled={state === "loading"}
        >
          {state === "loading"
            ? "Ativando…"
            : "Ativar notificações neste aparelho"}
        </button>
      )}
      {message && <p className="admin-notification-message">{message}</p>}
    </section>
  );
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
}

function shortVisitorKey(visitorKey: string) {
  return `${visitorKey.slice(0, 8)}…`;
}

function LpSessionsList({
  lpId,
  sessions,
  sessionId,
}: {
  lpId: string;
  sessions: LpSession[];
  sessionId: string;
}) {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, RecordingLookup>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const openRecording = async (visitorKey: string) => {
    setLoadingKey(visitorKey);
    try {
      const query = `sessionId=${encodeURIComponent(sessionId)}&visitorKey=${encodeURIComponent(visitorKey)}`;
      const response = await fetch(
        `${apiBaseUrl}/api/admin/session-recording?${query}`,
      );
      const result = (await response.json()) as RecordingLookup;
      if (!response.ok) throw new Error("recording-lookup");
      setMessages((current) => ({ ...current, [visitorKey]: result }));
      if (result.available && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setMessages((current) => ({
        ...current,
        [visitorKey]: { available: false, reason: "sem-gravacao", visitorKey },
      }));
    } finally {
      setLoadingKey(null);
    }
  };

  const copyKey = async (visitorKey: string) => {
    try {
      await navigator.clipboard.writeText(visitorKey);
      setCopiedKey(visitorKey);
      window.setTimeout(
        () =>
          setCopiedKey((current) => (current === visitorKey ? null : current)),
        1800,
      );
    } catch {
      setCopiedKey(null);
    }
  };

  const statusLabels = {
    comprou: "Comprou",
    aguardando_pagamento: "Aguardando pagamento",
    so_visitou: "Só visitou",
  } as const;

  return (
    <div className="admin-lp-sessions">
      <div className="admin-lp-sessions-heading">
        <span>Sessões desta página</span>
        <strong>{sessions.length}</strong>
      </div>
      {sessions.length === 0 ? (
        <p className="admin-footnote">
          Nenhuma sessão registrada ainda nesta página.
        </p>
      ) : (
        <div className="admin-lp-sessions-table-wrap">
          <table className="admin-lp-sessions-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Visitante</th>
                <th>Entrou</th>
                <th>Tempo</th>
                <th>Gravação</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const message = messages[session.visitorKey];
                return (
                  <tr key={session.visitorKey}>
                    <td>
                      <span
                        className={`admin-session-status is-${session.status}`}
                      >
                        {statusLabels[session.status]}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {session.buyerName ||
                          shortVisitorKey(session.visitorKey)}
                      </strong>
                      {session.packageName && (
                        <small>{session.packageName}</small>
                      )}
                    </td>
                    <td>
                      {new Date(session.firstSeenAt).toLocaleString("pt-BR")}
                    </td>
                    <td>{formatDuration(session.timeOnPageSeconds)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-recording-button"
                        onClick={() => void openRecording(session.visitorKey)}
                        disabled={loadingKey === session.visitorKey}
                      >
                        {loadingKey === session.visitorKey
                          ? "Buscando…"
                          : "Ver gravação"}
                      </button>
                      {message?.reason === "sem-rastreio" && (
                        <span className="admin-recording-message">
                          Sem rastreamento disponível para esta sessão.
                        </span>
                      )}
                      {message?.reason === "sem-gravacao" && (
                        <span className="admin-recording-message">
                          Não achamos a gravação. Busque no Clarity por{" "}
                          <code>
                            {message.visitorKey || session.visitorKey}
                          </code>
                          .
                          <button
                            type="button"
                            className="admin-copy-key-button"
                            onClick={() =>
                              void copyKey(
                                message.visitorKey || session.visitorKey,
                              )
                            }
                          >
                            {copiedKey === session.visitorKey
                              ? "Copiado"
                              : "Copiar identificador"}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnalyticsPanel({
  landing,
  analytics,
  sessions,
  sessionId,
  loading,
}: {
  landing: LandingEntry;
  analytics: AnalyticsEntry | undefined;
  sessions: LpSession[];
  sessionId: string;
  loading: boolean;
}) {
  if (loading) {
    return <p className="admin-footnote">Carregando analytics desta página…</p>;
  }

  const conversion =
    analytics && analytics.views > 0
      ? `${((analytics.purchasesConfirmed / analytics.views) * 100).toFixed(1)}%`
      : "—";

  return (
    <div className="admin-analytics-panel">
      <div className="admin-analytics-card-heading">
        <div>
          <p className="admin-eyebrow">últimos 30 dias</p>
          <h3>{landing.label}</h3>
        </div>
        <span className="admin-conversion">{conversion}</span>
      </div>
      <div className="admin-metric-grid">
        <div>
          <span>Visualizações</span>
          <strong>{analytics?.views || 0}</strong>
        </div>
        <div>
          <span>Cliques em comprar</span>
          <strong>{analytics?.ctaClicks || 0}</strong>
        </div>
        <div>
          <span>Checkouts iniciados</span>
          <strong>{analytics?.checkoutsStarted || 0}</strong>
        </div>
        <div>
          <span>Compras confirmadas</span>
          <strong>{analytics?.purchasesConfirmed || 0}</strong>
        </div>
        <div>
          <span>Tempo médio</span>
          <strong>
            {formatDuration(analytics?.avgTimeOnPageSeconds ?? null)}
          </strong>
        </div>
      </div>
      <div className="admin-exit-sections">
        <span>Onde as pessoas saem</span>
        {analytics?.topExitSections.length ? (
          analytics.topExitSections.map((exit) => (
            <p key={exit.section}>
              <strong>{exit.section}</strong> — {exit.count}{" "}
              {exit.count === 1 ? "saída" : "saídas"}
            </p>
          ))
        ) : (
          <p>Nenhum dado de saída ainda.</p>
        )}
      </div>
      <LpSessionsList
        lpId={landing.id}
        sessions={sessions}
        sessionId={sessionId}
      />
    </div>
  );
}

function BuyersTab({ buyers }: { buyers: BuyerEntry[] }) {
  const [visibleBuyers, setVisibleBuyers] = useState(buyers);
  const [loadingBuyerId, setLoadingBuyerId] = useState<string | null>(null);
  const [deletingBuyerId, setDeletingBuyerId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [recordingMessages, setRecordingMessages] = useState<
    Record<string, RecordingLookup>
  >({});
  const [copiedVisitorKey, setCopiedVisitorKey] = useState<string | null>(null);
  useEffect(() => setVisibleBuyers(buyers), [buyers]);

  const openRecording = async (buyerId: string) => {
    const sessionId = safeGetItem("conexao-session")?.trim();
    if (!sessionId) return;
    setLoadingBuyerId(buyerId);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/admin/session-recording?sessionId=${encodeURIComponent(sessionId)}&buyerId=${encodeURIComponent(buyerId)}`,
      );
      const result = (await response.json()) as RecordingLookup;
      if (!response.ok) throw new Error("recording-lookup");
      setRecordingMessages((current) => ({ ...current, [buyerId]: result }));
      if (result.available && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setRecordingMessages((current) => ({
        ...current,
        [buyerId]: { available: false, reason: "sem-gravacao" },
      }));
    } finally {
      setLoadingBuyerId(null);
    }
  };

  const deleteBuyer = async (buyer: BuyerEntry) => {
    if (
      !window.confirm(
        `Apagar o cadastro de ${buyer.buyerName || "Sem nome"}? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    const sessionId = safeGetItem("conexao-session")?.trim();
    if (!sessionId) return;
    setDeletingBuyerId(buyer.id);
    setDeleteMessage("");
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/admin/buyers/${encodeURIComponent(buyer.id)}?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("delete-buyer");
      setVisibleBuyers((current) =>
        current.filter((item) => item.id !== buyer.id),
      );
    } catch {
      setDeleteMessage(
        "Não foi possível apagar este comprador. Tente novamente.",
      );
    } finally {
      setDeletingBuyerId(null);
    }
  };

  const copyVisitorKey = async (buyerId: string, visitorKey: string) => {
    try {
      await navigator.clipboard.writeText(visitorKey);
      setCopiedVisitorKey(buyerId);
      window.setTimeout(
        () =>
          setCopiedVisitorKey((current) =>
            current === buyerId ? null : current,
          ),
        1800,
      );
    } catch {
      setCopiedVisitorKey(null);
    }
  };

  return (
    <section className="admin-section" aria-labelledby="buyers-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">base de clientes</p>
          <h2 id="buyers-title">Compradores</h2>
        </div>
        <span className="admin-count">
          {visibleBuyers.length}{" "}
          {visibleBuyers.length === 1 ? "comprador" : "compradores"}
        </span>
      </div>
      {deleteMessage && (
        <p className="admin-notification-message">{deleteMessage}</p>
      )}
      {visibleBuyers.length === 0 ? (
        <p className="admin-footnote">Nenhum cadastro ainda.</p>
      ) : (
        <div className="admin-buyers-table-wrap">
          <table className="admin-buyers-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Pacote</th>
                <th>Data</th>
                <th>Convites</th>
                <th>Clarity</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleBuyers.map((buyer) => (
                <tr key={buyer.id} data-testid={`row-buyer-${buyer.id}`}>
                  <td>{buyer.buyerName || "Sem nome"}</td>
                  <td>{buyer.buyerEmail || "Sem email"}</td>
                  <td>{buyer.packageName}</td>
                  <td>{formatDate(buyer.createdAt)}</td>
                  <td>
                    {buyer.invitesUsed}/{buyer.inviteLimit}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-recording-button"
                      onClick={() => void openRecording(buyer.id)}
                      disabled={loadingBuyerId === buyer.id}
                    >
                      {loadingBuyerId === buyer.id
                        ? "Buscando…"
                        : "Ver gravação"}
                    </button>
                    {recordingMessages[buyer.id]?.reason === "sem-rastreio" && (
                      <span className="admin-recording-message">
                        Essa compra foi feita antes do rastreio, ou por convite
                        — sem gravação disponível.
                      </span>
                    )}
                    {recordingMessages[buyer.id]?.reason === "sem-gravacao" && (
                      <span className="admin-recording-message">
                        Não achamos a gravação automática. Busque no Clarity
                        pelo identificador{" "}
                        <code>{recordingMessages[buyer.id]?.visitorKey}</code>.
                        {recordingMessages[buyer.id]?.visitorKey && (
                          <button
                            type="button"
                            className="admin-copy-key-button"
                            onClick={() =>
                              void copyVisitorKey(
                                buyer.id,
                                recordingMessages[buyer.id]!.visitorKey!,
                              )
                            }
                          >
                            {copiedVisitorKey === buyer.id
                              ? "Copiado"
                              : "Copiar identificador"}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-delete-button"
                      aria-label={`Apagar cadastro de ${buyer.buyerName || "Sem nome"}`}
                      onClick={() => void deleteBuyer(buyer)}
                      disabled={deletingBuyerId === buyer.id}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-footnote">
        Gravações no Clarity ficam disponíveis por até 30 dias. Apagar o
        cadastro não estorna nem cancela o pagamento na Abacate Pay.
      </p>
    </section>
  );
}

function PagesTab({
  origin,
  copiedId,
  copyLink,
  sessionId,
}: {
  origin: string;
  copiedId: string | null;
  copyLink: (entry: LandingEntry) => void;
  sessionId: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [analytics, setAnalytics] = useState<AnalyticsEntry[]>([]);
  const [lpSessions, setLpSessions] = useState<Record<string, LpSession[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const toggleLanding = async (landing: LandingEntry) => {
    const isOpen = expanded[landing.id];
    setExpanded((current) => ({ ...current, [landing.id]: !isOpen }));
    if (isOpen || analytics.some((item) => item.lpId === landing.id)) return;

    setLoading((current) => ({ ...current, [landing.id]: true }));
    try {
      const query = `sessionId=${encodeURIComponent(sessionId)}`;
      const [analyticsResponse, sessionsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/admin/analytics?${query}`),
        fetch(
          `${apiBaseUrl}/api/admin/lp-sessions?${query}&lpId=${landing.id}`,
        ),
      ]);
      if (!analyticsResponse.ok || !sessionsResponse.ok)
        throw new Error("analytics");
      const analyticsData = (await analyticsResponse.json()) as {
        analytics?: AnalyticsEntry[];
      };
      const sessionsData =
        (await sessionsResponse.json()) as LpSessionsResponse;
      setAnalytics((current) => [
        ...current.filter((item) => item.lpId !== landing.id),
        ...(analyticsData.analytics || []).filter(
          (item) => item.lpId === landing.id,
        ),
      ]);
      setLpSessions((current) => ({
        ...current,
        [landing.id]: sessionsData.sessions || [],
      }));
    } catch {
      setLpSessions((current) => ({ ...current, [landing.id]: [] }));
    } finally {
      setLoading((current) => ({ ...current, [landing.id]: false }));
    }
  };

  return (
    <section className="admin-section" aria-labelledby="landing-pages-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">publicações</p>
          <h2 id="landing-pages-title">Landing pages</h2>
        </div>
        <span className="admin-count">{LANDINGS.length} ativas</span>
      </div>
      <div className="admin-landing-grid">
        {LANDINGS.map((entry) => (
          <article
            key={entry.id}
            className={`admin-landing-card ${expanded[entry.id] ? "is-expanded" : ""}`}
            data-testid={`card-landing-${entry.id}`}
          >
            <button
              type="button"
              className="admin-landing-card-body"
              onClick={() => void toggleLanding(entry)}
              aria-expanded={Boolean(expanded[entry.id])}
            >
              <div className="admin-landing-icon">
                <LayoutTemplate size={18} />
              </div>
              <div className="admin-landing-info">
                <strong>{entry.label}</strong>
                <p>{entry.description}</p>
                <code className="admin-landing-url">
                  {origin}
                  {entry.path}
                </code>
              </div>
              <ChevronDown className="admin-landing-chevron" size={18} />
            </button>
            <div className="admin-landing-actions">
              <a
                href={`${origin}${entry.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-icon-button"
                data-testid={`link-open-landing-${entry.id}`}
                aria-label={`Abrir ${entry.label}`}
              >
                <ExternalLink size={16} />
              </a>
              <button
                type="button"
                onClick={() => copyLink(entry)}
                className="admin-icon-button"
                data-testid={`button-copy-landing-${entry.id}`}
                aria-label={`Copiar link de ${entry.label}`}
              >
                {copiedId === entry.id ? (
                  <Check size={16} />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
            {expanded[entry.id] && (
              <AnalyticsPanel
                landing={entry}
                analytics={analytics.find((item) => item.lpId === entry.id)}
                sessions={lpSessions[entry.id] || []}
                sessionId={sessionId}
                loading={Boolean(loading[entry.id])}
              />
            )}
          </article>
        ))}
      </div>
      <p className="admin-footnote">
        O endereço acima acompanha automaticamente o domínio atual deste
        navegador.
      </p>
    </section>
  );
}

function FeedbackTab({
  reviews,
  suggestions,
}: {
  reviews: ReviewEntry[];
  suggestions: SuggestionEntry[];
}) {
  return (
    <>
      <section className="admin-section" aria-labelledby="reviews-title">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">prova social</p>
            <h2 id="reviews-title">Avaliações</h2>
          </div>
          <span className="admin-count">{reviews.length}</span>
        </div>
        {reviews.length === 0 ? (
          <p className="admin-footnote">Nenhuma avaliação ainda.</p>
        ) : (
          <div className="admin-feedback-list">
            {reviews.map((entry) => (
              <article
                key={entry.id}
                className="admin-feedback-card"
                data-testid={`card-review-${entry.id}`}
              >
                <div className="admin-feedback-top">
                  <span className="admin-feedback-stars">
                    {"★".repeat(entry.rating)}
                    {"☆".repeat(5 - entry.rating)}
                  </span>
                  <span className="admin-feedback-date">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <p className="admin-feedback-message">{entry.message}</p>
                <p className="admin-feedback-meta">
                  {entry.displayName || "Sem nome"}
                  {entry.email ? ` · ${entry.email}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="admin-section" aria-labelledby="suggestions-title">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">ideias</p>
            <h2 id="suggestions-title">Sugestões</h2>
          </div>
          <span className="admin-count">{suggestions.length}</span>
        </div>
        {suggestions.length === 0 ? (
          <p className="admin-footnote">Nenhuma sugestão ainda.</p>
        ) : (
          <div className="admin-feedback-list">
            {suggestions.map((entry) => (
              <article
                key={entry.id}
                className="admin-feedback-card"
                data-testid={`card-suggestion-${entry.id}`}
              >
                <div className="admin-feedback-top">
                  <span />
                  <span className="admin-feedback-date">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                <p className="admin-feedback-message">{entry.message}</p>
                <p className="admin-feedback-meta">
                  {entry.email || "Sem email"}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function Admin() {
  const [status, setStatus] = useState<"checking" | "denied" | "ok">(
    "checking",
  );
  const [activeTab, setActiveTab] = useState<TabId>("buyers");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [buyers, setBuyers] = useState<BuyerEntry[]>([]);
  const [buyerTotal, setBuyerTotal] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsEntry[]>([]);
  const [lpSessions, setLpSessions] = useState<Record<string, LpSession[]>>({});
  const sessionId = safeGetItem("conexao-session")?.trim() || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const sessionId = safeGetItem("conexao-session")?.trim();
    if (!sessionId) {
      setStatus("denied");
      return;
    }
    fetch(
      `${apiBaseUrl}/api/admin/check?sessionId=${encodeURIComponent(sessionId)}`,
    )
      .then((response) => (response.ok ? response.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => {
        setStatus(data.isAdmin ? "ok" : "denied");
        if (!data.isAdmin) return;
        const query = `sessionId=${encodeURIComponent(sessionId)}`;
        Promise.all([
          fetch(`${apiBaseUrl}/api/admin/buyers?${query}`).then((response) =>
            response.ok
              ? (response.json() as Promise<BuyersResponse>)
              : Promise.resolve({} as BuyersResponse),
          ),
          fetch(`${apiBaseUrl}/api/admin/suggestions?${query}`).then(
            (response) =>
              response.ok
                ? (response.json() as Promise<{
                    suggestions?: SuggestionEntry[];
                  }>)
                : Promise.resolve({} as { suggestions?: SuggestionEntry[] }),
          ),
          fetch(`${apiBaseUrl}/api/admin/reviews?${query}`).then((response) =>
            response.ok
              ? (response.json() as Promise<{ reviews?: ReviewEntry[] }>)
              : Promise.resolve({} as { reviews?: ReviewEntry[] }),
          ),
        ])
          .then(([buyerData, suggestionData, reviewData]) => {
            setBuyers(buyerData.buyers || []);
            setBuyerTotal(buyerData.total || 0);
            setSuggestions(suggestionData.suggestions || []);
            setReviews(reviewData.reviews || []);
          })
          .catch(() => {
            setBuyers([]);
            setSuggestions([]);
            setReviews([]);
          });
      })
      .catch(() => setStatus("denied"));
  }, []);

  const copyLink = async (entry: LandingEntry) => {
    try {
      await navigator.clipboard.writeText(`${origin}${entry.path}`);
      setCopiedId(entry.id);
      window.setTimeout(
        () => setCopiedId((current) => (current === entry.id ? null : current)),
        1800,
      );
    } catch {
      setCopiedId(null);
    }
  };

  if (status === "checking") {
    return (
      <main className="admin-page admin-loading" aria-live="polite">
        <div className="admin-status-mark">
          <LayoutTemplate size={22} />
        </div>
        <p>Verificando acesso…</p>
      </main>
    );
  }
  if (status === "denied") {
    return (
      <main className="admin-page admin-denied">
        <div className="admin-status-mark admin-status-mark-alert">
          <ShieldAlert size={26} />
        </div>
        <p className="admin-eyebrow">área protegida</p>
        <h1>Acesso restrito</h1>
        <p>
          Esta área é só para a conta administradora. Entre com essa conta para
          continuar.
        </p>
        <Link href="/login" className="button button-primary">
          Ir para o login
        </Link>
      </main>
    );
  }

  const tabContent = {
    buyers: <BuyersTab buyers={buyers} />,
    pages: (
      <PagesTab
        origin={origin}
        copiedId={copiedId}
        copyLink={copyLink}
        sessionId={sessionId}
      />
    ),
    feedback: <FeedbackTab reviews={reviews} suggestions={suggestions} />,
    notifications: <NotificationsTab sessionId={sessionId} />,
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/app" className="admin-back">
          <ArrowLeft size={16} /> Voltar ao app
        </Link>
        <div className="admin-title-row">
          <div className="admin-title-mark">
            <LayoutTemplate size={22} />
          </div>
          <div>
            <p className="admin-eyebrow">gestão interna</p>
            <h1>Painel Admin</h1>
          </div>
        </div>
        <p className="admin-header-copy">
          Acompanhe cadastros, páginas ativas e o retorno de quem usa o app.
        </p>
      </header>
      <nav className="admin-tabs" aria-label="Seções do painel">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab ${activeTab === tab.id ? "is-active" : ""}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-admin-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="admin-tab-content">{tabContent[activeTab]}</div>
    </main>
  );
}
