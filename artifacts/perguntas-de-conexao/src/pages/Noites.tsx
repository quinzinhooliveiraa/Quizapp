import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, LockKeyhole, Share2 } from "lucide-react";
import { apiBaseUrl } from "@/config";

const apiBase = apiBaseUrl;
const apiUrl = (path: string) => `${apiBase}${path}`;

type Night = {
  n: number;
  semana: number;
  semanaTitulo: string;
  titulo: string;
  minutos: number;
  state: "done" | "open" | "locked";
  ritual?: string;
  perguntas?: string[];
  acao?: string;
  adulto?: boolean;
};
type NoitesResponse = {
  hasProgram: boolean;
  product?: "noites30" | "noites7";
  total?: number;
  unlocked?: number;
  done?: number[];
  nights?: Night[];
  unlocksAt?: string;
};

async function getNoites(sessionId: string): Promise<NoitesResponse> {
  const response = await fetch(apiUrl(`/api/noites?sessionId=${encodeURIComponent(sessionId)}`));
  if (!response.ok) throw new Error("noites-load-failed");
  return response.json() as Promise<NoitesResponse>;
}

function getSessionId() {
  try {
    return window.localStorage.getItem("conexao-session") || "";
  } catch {
    return "";
  }
}

function formatUnlock(value?: string) {
  if (!value) return "amanhã";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "amanhã";
  const saoPauloDate = (input: Date) => new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(input);
  const [year, month, day] = saoPauloDate(new Date()).split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrowKey = [
    tomorrow.getUTCFullYear(),
    String(tomorrow.getUTCMonth() + 1).padStart(2, "0"),
    String(tomorrow.getUTCDate()).padStart(2, "0"),
  ].join("-");
  if (saoPauloDate(date) === tomorrowKey) return "amanhã";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(date);
}

function shareCopy(night: Night) {
  return [
    `Noite ${night.n}: ${night.titulo}`,
    `Semana ${night.semana} — ${night.semanaTitulo}`,
    `${night.minutos} minutos`,
    ...(night.adulto ? ["Só se os dois quiserem. Qualquer um pode dizer não a qualquer momento."] : []),
    `RITUAL\n${night.ritual || ""}`,
    `PERGUNTAS\n${(night.perguntas || []).map((question, index) => `${index + 1}. ${question}`).join("\n")}`,
    `PARA AMANHÃ\n${night.acao || ""}`,
  ].join("\n\n");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const success = document.execCommand("copy");
  input.remove();
  if (!success) throw new Error("copy-failed");
}

export default function NoitesPage() {
  const params = useParams<{ sessionId?: string }>();
  const [, navigate] = useLocation();
  const [sessionId, setSessionId] = useState("");
  const [payload, setPayload] = useState<NoitesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [savingNight, setSavingNight] = useState<number | null>(null);

  useEffect(() => {
    const linkSession = params.sessionId?.trim();
    if (linkSession) {
      try {
        window.localStorage.setItem("conexao-session", linkSession);
        window.localStorage.setItem("conexao-role", "owner");
        window.localStorage.removeItem("conexao-guest-token");
      } catch {
        // API access still proceeds in restricted storage contexts.
      }
      setSessionId(linkSession);
      return;
    }
    try {
      if (window.localStorage.getItem("conexao-role") !== "owner") {
        navigate("/app", { replace: true });
        return;
      }
    } catch {
      navigate("/app", { replace: true });
      return;
    }
    const currentSessionId = getSessionId();
    if (!currentSessionId) {
      navigate("/app", { replace: true });
      return;
    }
    setSessionId(currentSessionId);
  }, [params.sessionId, navigate]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    setLoading(true);
    getNoites(sessionId).then((data) => {
      if (!active) return;
      if (!data.hasProgram) {
        navigate("/app", { replace: true });
        return;
      }
      setPayload(data);
      setFailed(false);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [sessionId, navigate]);

  const nights = payload?.nights || [];
  const unlocked = payload?.unlocked || 0;
  const total = payload?.total || 0;
  const done = payload?.done || [];
  const available = useMemo(() => nights.filter((night) => night.n <= unlocked), [nights, unlocked]);
  const activeNight = [...available].reverse().find((night) => night.state === "open") || available[available.length - 1];
  const previousNights = available.filter((night) => night.n !== activeNight?.n).sort((a, b) => b.n - a.n);
  const firstLocked = nights.find((night) => night.state === "locked");

  async function markDone(night: Night) {
    if (!sessionId || savingNight !== null) return;
    setSavingNight(night.n);
    setShareMessage("");
    try {
      const response = await fetch(apiUrl("/api/noites/done"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, night: night.n, done: night.state !== "done" }),
      });
      if (!response.ok) throw new Error("save-failed");
      const updated = await response.json() as { done?: number[] };
      const nextDone = updated.done || (night.state === "done" ? done.filter((n) => n !== night.n) : [...done, night.n]);
      setPayload((current) => current ? {
        ...current,
        done: nextDone,
        nights: current.nights?.map((item) => item.n === night.n ? { ...item, state: item.state === "done" ? "open" : "done" } : item),
      } : current);
    } catch {
      setShareMessage("Não foi possível atualizar agora. Tente novamente.");
    } finally {
      setSavingNight(null);
    }
  }

  async function shareNight(night: Night) {
    const text = shareCopy(night);
    setShareMessage("");
    try {
      if (navigator.share) await navigator.share({ title: `Noite ${night.n} — ${night.titulo}`, text });
      else {
        await copyText(text);
        setShareMessage("Texto copiado para compartilhar.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      try {
        await copyText(text);
        setShareMessage("Texto copiado para compartilhar.");
      } catch {
        setShareMessage("Não foi possível compartilhar agora.");
      }
    }
  }

  if (loading || !sessionId) {
    return <main className="noites-page"><div className="noites-loading"><span /><span /><span /><p>Preparando a trilha de vocês…</p></div></main>;
  }
  if (failed) {
    return <main className="noites-page"><section className="noites-error"><p className="noites-kicker">30 NOITES DE CONEXÃO</p><h1>A trilha não abriu agora.</h1><p>Confira sua conexão e tente novamente.</p><button type="button" className="noites-button" onClick={() => { setFailed(false); setLoading(true); getNoites(sessionId).then((data) => { if (data.hasProgram) setPayload(data); else navigate("/app"); }).catch(() => setFailed(true)).finally(() => setLoading(false)); }}>Tentar novamente</button></section></main>;
  }
  if (!payload || !activeNight) return <main className="noites-page" />;
  const progress = total ? Math.min(100, (done.length / total) * 100) : 0;

  return (
    <main className="noites-page">
      <div className="noites-shell">
        <Link href="/app" className="noites-back"><ArrowLeft size={16} /> Voltar para os baralhos</Link>
        <header className="noites-header">
          <p className="noites-kicker">30 NOITES DE CONEXÃO</p>
          <h1>Um pouco mais perto,<br /><em>uma noite por vez.</em></h1>
          <div className="noites-progress-meta"><strong>Noite {activeNight.n} de {total}</strong><span>{done.length} feitas</span></div>
          <div className="noites-progress-track" role="progressbar" aria-valuenow={done.length} aria-valuemin={0} aria-valuemax={total}><span style={{ width: `${progress}%` }} /></div>
        </header>

        <section className="noites-today" aria-labelledby="noites-today-title">
          <div className="noites-today-label"><span>HOJE</span><span><Clock3 size={14} /> {activeNight.minutos} min</span></div>
          <p className="noites-week">Semana {activeNight.semana} — {activeNight.semanaTitulo}</p>
          <h2 id="noites-today-title">{activeNight.titulo}</h2>
          {activeNight.adulto && <span className="noites-adult">18+</span>}
          {activeNight.adulto && <p className="noites-consent">Só se os dois quiserem. Qualquer um pode dizer não a qualquer momento.</p>}
          <div className="noites-section-copy"><span>RITUAL</span><p>{activeNight.ritual}</p></div>
          <div className="noites-questions"><span>PERGUNTAS</span>{activeNight.perguntas?.map((question, index) => <p key={`${activeNight.n}-${index}`}><b>0{index + 1}</b>{question}</p>)}</div>
          <div className="noites-section-copy noites-action-copy"><span>PARA AMANHÃ</span><p>{activeNight.acao}</p></div>
          <div className="noites-actions">
            <button type="button" className="noites-button" onClick={() => markDone(activeNight)} disabled={savingNight === activeNight.n}>
              {activeNight.state === "done" ? "Desmarcar noite" : savingNight === activeNight.n ? "Salvando…" : "Fizemos esta noite ✓"}
            </button>
            <button type="button" className="noites-share" onClick={() => shareNight(activeNight)}><Share2 size={16} /> Mandar para o meu par</button>
          </div>
          {shareMessage && <p className="noites-feedback" role="status">{shareMessage}</p>}
        </section>

        <section className="noites-timeline" aria-label="Linha do tempo das noites">
          <div className="noites-timeline-heading"><span>NA TRILHA</span><span>{total} noites</span></div>
          {previousNights.map((night) => (
            <article className={`noites-timeline-item ${night.state === "done" ? "is-done" : ""}`} key={night.n}>
              <span className="noites-timeline-dot">{night.state === "done" ? <Check size={13} /> : String(night.n).padStart(2, "0")}</span>
              <button type="button" className="noites-timeline-toggle" onClick={() => setExpanded((current) => current === night.n ? null : night.n)} aria-expanded={expanded === night.n}>
                <span><small>NOITE {night.n} · SEMANA {night.semana}</small><strong>{night.titulo}</strong></span><ChevronDown size={17} />
              </button>
              {expanded === night.n && <div className="noites-previous-detail">
                {night.adulto && <p className="noites-consent">Só se os dois quiserem. Qualquer um pode dizer não a qualquer momento.</p>}
                <p>{night.ritual}</p>
                <strong>PERGUNTAS</strong>
                {night.perguntas?.map((question, index) => <p key={`${night.n}-question-${index}`}>{question}</p>)}
                <strong>PARA AMANHÃ</strong>
                <p>{night.acao}</p>
                <button type="button" onClick={() => markDone(night)} disabled={savingNight === night.n}>{night.state === "done" ? "Desmarcar como feita" : "Marcar como feita"}</button>
              </div>}
            </article>
          ))}
          {nights.filter((night) => night.state === "locked").map((night) => (
            <div className="noites-timeline-item is-locked" key={night.n}>
              <span className="noites-timeline-dot"><LockKeyhole size={12} /></span>
              <div className="noites-locked-copy"><small>NOITE {night.n}</small><strong>{night.titulo}</strong>{night.n === firstLocked?.n && <span>Noite {night.n} libera {formatUnlock(payload.unlocksAt)}</span>}</div>
            </div>
          ))}
        </section>
        <footer className="noites-footer"><p>Mesma garantia de 7 dias. Dúvidas: responda o e-mail de acesso.</p><Link href="/app">Voltar para os baralhos <ArrowRight size={15} /></Link></footer>
      </div>
    </main>
  );
}

export function NoitesEntryCard() {
  const [entry, setEntry] = useState<{ night: number; total: number; title: string } | null>(null);
  useEffect(() => {
    let active = true;
    let id = "";
    try {
      if (window.localStorage.getItem("conexao-role") !== "owner") return;
      id = window.localStorage.getItem("conexao-session") || "";
    } catch {
      return;
    }
    if (!id) return;
    getNoites(id).then((data) => {
      if (!active || !data.hasProgram) return;
      const current = data.nights?.find((night) => night.n === data.unlocked) || data.nights?.[0];
      if (current) setEntry({ night: current.n, total: data.total || 0, title: current.titulo });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!entry) return null;
  return (
    <aside className="noites-entry-card">
      <div className="noites-entry-mark">30</div>
      <p><strong>Noite {entry.night} de {entry.total}</strong><span>Hoje: {entry.title}</span></p>
      <Link href="/noites" className="noites-entry-open">Abrir <ArrowRight size={15} /></Link>
    </aside>
  );
}
