import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  LayoutTemplate,
  ShieldAlert,
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
  { id: "analytics", label: "Analytics" },
  { id: "feedback", label: "Feedback" },
] as const;
type TabId = (typeof TABS)[number]["id"];

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

function AnalyticsTab({ analytics }: { analytics: AnalyticsEntry[] }) {
  return (
    <section className="admin-section" aria-labelledby="analytics-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">últimos 30 dias</p>
          <h2 id="analytics-title">Analytics por página</h2>
        </div>
      </div>
      <div className="admin-analytics-grid">
        {LANDINGS.map((landing) => {
          const data = analytics.find((item) => item.lpId === landing.id);
          const conversion =
            data && data.views > 0
              ? `${((data.purchasesConfirmed / data.views) * 100).toFixed(1)}%`
              : "—";
          return (
            <article className="admin-analytics-card" key={landing.id}>
              <div className="admin-analytics-card-heading">
                <div>
                  <p className="admin-eyebrow">{landing.id}</p>
                  <h3>{landing.label}</h3>
                </div>
                <span className="admin-conversion">{conversion}</span>
              </div>
              <div className="admin-metric-grid">
                <div>
                  <span>Visualizações</span>
                  <strong>{data?.views || 0}</strong>
                </div>
                <div>
                  <span>Cliques em comprar</span>
                  <strong>{data?.ctaClicks || 0}</strong>
                </div>
                <div>
                  <span>Checkouts iniciados</span>
                  <strong>{data?.checkoutsStarted || 0}</strong>
                </div>
                <div>
                  <span>Compras confirmadas</span>
                  <strong>{data?.purchasesConfirmed || 0}</strong>
                </div>
                <div>
                  <span>Tempo médio</span>
                  <strong>
                    {formatDuration(data?.avgTimeOnPageSeconds ?? null)}
                  </strong>
                </div>
              </div>
              <div className="admin-exit-sections">
                <span>Onde as pessoas saem</span>
                {data?.topExitSections.length ? (
                  data.topExitSections.map((exit) => (
                    <p key={exit.section}>
                      <strong>{exit.section}</strong> — {exit.count}{" "}
                      {exit.count === 1 ? "saída" : "saídas"}
                    </p>
                  ))
                ) : (
                  <p>Nenhum dado de saída ainda.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BuyersTab({
  buyers,
  total,
  totalWithAccess,
}: {
  buyers: BuyerEntry[];
  total: number;
  totalWithAccess: number;
}) {
  return (
    <section className="admin-section" aria-labelledby="buyers-title">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">base de clientes</p>
          <h2 id="buyers-title">Compradores</h2>
        </div>
        <span className="admin-count">
          {total} cadastros · {totalWithAccess} com acesso liberado
        </span>
      </div>
      {buyers.length === 0 ? (
        <p className="admin-footnote">Nenhum cadastro ainda.</p>
      ) : (
        <div className="admin-buyers-table-wrap">
          <table className="admin-buyers-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Pacote</th>
                <th>Status</th>
                <th>Data</th>
                <th>Convites</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((buyer) => (
                <tr key={buyer.id} data-testid={`row-buyer-${buyer.id}`}>
                  <td>{buyer.buyerName || "Sem nome"}</td>
                  <td>{buyer.buyerEmail || "Sem email"}</td>
                  <td>{buyer.packageName}</td>
                  <td>
                    <span
                      className={`admin-access-badge ${
                        buyer.accessGranted ? "is-granted" : "is-pending"
                      }`}
                    >
                      {buyer.accessGranted
                        ? "Acesso liberado"
                        : "Aguardando pagamento"}
                    </span>
                  </td>
                  <td>{formatDate(buyer.createdAt)}</td>
                  <td>
                    {buyer.invitesUsed}/{buyer.inviteLimit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PagesTab({
  origin,
  copiedId,
  copyLink,
}: {
  origin: string;
  copiedId: string | null;
  copyLink: (entry: LandingEntry) => void;
}) {
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
            className="admin-landing-card"
            data-testid={`card-landing-${entry.id}`}
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
  const [buyerTotalWithAccess, setBuyerTotalWithAccess] = useState(0);
  const [analytics, setAnalytics] = useState<AnalyticsEntry[]>([]);
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
          fetch(`${apiBaseUrl}/api/admin/analytics?${query}`).then(
            (response) =>
              response.ok
                ? (response.json() as Promise<{ analytics?: AnalyticsEntry[] }>)
                : Promise.resolve({} as { analytics?: AnalyticsEntry[] }),
          ),
        ])
          .then(([buyerData, suggestionData, reviewData, analyticsData]) => {
            setBuyers(buyerData.buyers || []);
            setBuyerTotal(buyerData.total || 0);
            setBuyerTotalWithAccess(buyerData.totalWithAccess || 0);
            setSuggestions(suggestionData.suggestions || []);
            setReviews(reviewData.reviews || []);
            setAnalytics(analyticsData.analytics || []);
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
    buyers: (
      <BuyersTab
        buyers={buyers}
        total={buyerTotal}
        totalWithAccess={buyerTotalWithAccess}
      />
    ),
    pages: <PagesTab origin={origin} copiedId={copiedId} copyLink={copyLink} />,
    feedback: <FeedbackTab reviews={reviews} suggestions={suggestions} />,
    analytics: <AnalyticsTab analytics={analytics} />,
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
