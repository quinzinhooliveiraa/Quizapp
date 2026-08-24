import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Copy, ExternalLink, LayoutTemplate, ShieldAlert } from "lucide-react";
import { apiBaseUrl } from "@/config";

type LandingEntry = {
  id: string;
  label: string;
  path: string;
  description: string;
};
type SuggestionEntry = { id: string; email: string | null; message: string; createdAt: string };
type ReviewEntry = { id: string; displayName: string | null; email: string | null; rating: number; message: string; createdAt: string };

const LANDINGS: LandingEntry[] = [
  {
    id: "v1",
    label: "LP1 — Storytelling + Quiz",
    path: "/",
    description: "Headline de promessa direta, storytelling da dor, quiz de 3 perguntas e 16 baralhos (15 + bônus do dia).",
  },
  {
    id: "v2",
    label: "LP2 — Estática (variedade de baralhos)",
    path: "/lp2",
    description: "Hero + dor + solução + 15 temas + prova social + preço + FAQ, tudo em scroll, sem quiz.",
  },
];

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function Admin() {
  const [status, setStatus] = useState<"checking" | "denied" | "ok">("checking");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const sessionId = safeGetItem("conexao-session")?.trim();
    if (!sessionId) {
      setStatus("denied");
      return;
    }

    fetch(`${apiBaseUrl}/api/admin/check?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => (response.ok ? response.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => {
        setStatus(data.isAdmin ? "ok" : "denied");
        if (data.isAdmin) {
          fetch(`${apiBaseUrl}/api/admin/suggestions?sessionId=${encodeURIComponent(sessionId)}`)
            .then((response) => response.ok ? response.json() : { suggestions: [] })
            .then((data: { suggestions?: SuggestionEntry[] }) => setSuggestions(data.suggestions || []))
            .catch(() => setSuggestions([]));
          fetch(`${apiBaseUrl}/api/admin/reviews?sessionId=${encodeURIComponent(sessionId)}`)
            .then((response) => response.ok ? response.json() : { reviews: [] })
            .then((data: { reviews?: ReviewEntry[] }) => setReviews(data.reviews || []))
            .catch(() => setReviews([]));
        }
      })
      .catch(() => setStatus("denied"));
  }, []);

  const copyLink = async (entry: LandingEntry) => {
    const url = `${origin}${entry.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(entry.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === entry.id ? null : current));
      }, 1800);
    } catch {
      setCopiedId(null);
    }
  };

  if (status === "checking") {
    return (
      <main className="admin-page admin-loading" aria-live="polite">
        <div className="admin-status-mark"><LayoutTemplate size={22} /></div>
        <p>Verificando acesso…</p>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="admin-page admin-denied">
        <div className="admin-status-mark admin-status-mark-alert"><ShieldAlert size={26} /></div>
        <p className="admin-eyebrow">área protegida</p>
        <h1>Acesso restrito</h1>
        <p>Esta área é reservada para a conta administradora. Entre com sua conta para continuar.</p>
        <Link href="/login" className="button button-primary">Ir para o login</Link>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/app" className="admin-back"><ArrowLeft size={16} /> Voltar ao app</Link>
        <div className="admin-title-row">
          <div className="admin-title-mark"><LayoutTemplate size={22} /></div>
          <div>
            <p className="admin-eyebrow">gestão interna</p>
            <h1>Painel Admin</h1>
          </div>
        </div>
        <p className="admin-header-copy">Links das landing pages ativas, prontos para compartilhar ou revisar.</p>
      </header>

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
            <article key={entry.id} className="admin-landing-card" data-testid={`card-landing-${entry.id}`}>
              <div className="admin-landing-icon"><LayoutTemplate size={18} /></div>
              <div className="admin-landing-info">
                <strong>{entry.label}</strong>
                <p>{entry.description}</p>
                <code className="admin-landing-url">{origin}{entry.path}</code>
              </div>
              <div className="admin-landing-actions">
                <a href={`${origin}${entry.path}`} target="_blank" rel="noopener noreferrer" className="admin-icon-button" data-testid={`link-open-landing-${entry.id}`} aria-label={`Abrir ${entry.label}`}>
                  <ExternalLink size={16} />
                </a>
                <button type="button" onClick={() => copyLink(entry)} className="admin-icon-button" data-testid={`button-copy-landing-${entry.id}`} aria-label={`Copiar link de ${entry.label}`}>
                  {copiedId === entry.id ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="admin-footnote">O endereço acima acompanha automaticamente o domínio atual deste navegador.</p>
      </section>

      <section className="admin-section" aria-labelledby="reviews-title">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">prova social</p><h2 id="reviews-title">Avaliações</h2></div><span className="admin-count">{reviews.length}</span></div>
        {reviews.length === 0 ? <p className="admin-footnote">Nenhuma avaliação ainda.</p> : <div className="admin-feedback-list">{reviews.map((entry) => <article key={entry.id} className="admin-feedback-card" data-testid={`card-review-${entry.id}`}><div className="admin-feedback-top"><span className="admin-feedback-stars">{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</span><span className="admin-feedback-date">{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</span></div><p className="admin-feedback-message">{entry.message}</p><p className="admin-feedback-meta">{entry.displayName || "Sem nome"}{entry.email ? ` · ${entry.email}` : ""}</p></article>)}</div>}
      </section>

      <section className="admin-section" aria-labelledby="suggestions-title">
        <div className="admin-section-heading"><div><p className="admin-eyebrow">ideias</p><h2 id="suggestions-title">Sugestões</h2></div><span className="admin-count">{suggestions.length}</span></div>
        {suggestions.length === 0 ? <p className="admin-footnote">Nenhuma sugestão ainda.</p> : <div className="admin-feedback-list">{suggestions.map((entry) => <article key={entry.id} className="admin-feedback-card" data-testid={`card-suggestion-${entry.id}`}><div className="admin-feedback-top"><span /><span className="admin-feedback-date">{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</span></div><p className="admin-feedback-message">{entry.message}</p><p className="admin-feedback-meta">{entry.email || "Sem email"}</p></article>)}</div>}
      </section>
    </main>
  );
}