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
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const sessionId = safeGetItem("conexao-session")?.trim();
    if (!sessionId) {
      setStatus("denied");
      return;
    }

    fetch(`${apiBaseUrl}/api/admin/check?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => (response.ok ? response.json() : { isAdmin: false }))
      .then((data: { isAdmin?: boolean }) => setStatus(data.isAdmin ? "ok" : "denied"))
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
    </main>
  );
}