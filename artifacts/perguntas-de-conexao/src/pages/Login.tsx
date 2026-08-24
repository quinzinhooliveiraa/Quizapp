import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Feather, Mail } from "lucide-react";
import { apiBaseUrl } from "@/config";

const apiBase = apiBaseUrl;
const apiUrl = (path: string) => `${apiBase}${path}`;

type Stage = "email" | "code" | "picker";
type SessionSummary = {
  id: string;
  buyerName: string;
  packageName: string;
  createdAt: string;
  onboardingComplete?: boolean;
};
type InviteSummary = {
  token: string;
  guestName: string;
  ownerName: string;
  createdAt: string;
  onboardingComplete?: boolean;
};

function safeSet(key: string, value: string) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    /* noop */
  }
}

export default function Login() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(
      () => setResendCooldown((current) => current - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function requestCode() {
    setError("");
    setNotice("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Digite um email válido.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/request-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          ok: boolean;
          adminBypass?: boolean;
          sessionId?: string;
          onboardingComplete?: boolean;
        };
        if (data.adminBypass && data.sessionId) {
          completeLoginAsOwner({
            id: data.sessionId,
            buyerName: "Admin",
            packageName: "Admin",
            createdAt: new Date().toISOString(),
            onboardingComplete: data.onboardingComplete ?? false,
          });
          return;
        }
        setEmail(trimmed);
        setStage("code");
        setNotice(
          `Enviamos um código de 6 dígitos para ${trimmed}. Verifique sua caixa de entrada (e o spam).`,
        );
        setResendCooldown(60);
        setLoading(false);
        return;
      }

      if (response.status === 404) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          data.error ||
            "Nenhuma conta encontrada com este email. Verifique se digitou certo ou compre um baralho.",
        );
        setLoading(false);
        return;
      }

      if (response.status === 429) {
        setError("Aguarde um instante antes de pedir outro código.");
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError("O código não foi enviado. Tente daqui a pouco.");
        setLoading(false);
        return;
      }
      setError("O código não foi enviado. Tente daqui a pouco.");
    } catch {
      setError("Não deu para conectar. Confira sua internet e tente de novo.");
    }
    setLoading(false);
  }

  async function resendCode() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/request-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setNotice(
          `Reenviamos o código para ${email}. Confere seu email (e o spam).`,
        );
        setResendCooldown(60);
      } else if (response.status === 429) {
        setError("Aguarde um pouco antes de pedir outro código.");
      } else {
        setError("Não foi possível reenviar agora. Tente daqui a pouco.");
      }
    } catch {
      setError("Não deu para conectar. Confira sua internet e tente de novo.");
    }
    setLoading(false);
  }

  async function verifyCode() {
    setError("");
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError("O código tem 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/verify-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: trimmedCode }),
      });
      if (response.status === 401) {
        setError("Código inválido ou expirado.");
        setLoading(false);
        return;
      }
      if (response.status === 404) {
        setError("Nenhum acesso encontrado para este email.");
        setLoading(false);
        return;
      }
      if (response.status === 429) {
        setError("Muitas tentativas. Peça um novo código.");
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError("Não conseguimos confirmar esse código agora. Tente de novo.");
        setLoading(false);
        return;
      }
      const data = (await response.json()) as {
        sessions?: SessionSummary[];
        invites?: InviteSummary[];
      };
      const allSessions = data.sessions || [];
      const allInvites = data.invites || [];
      if (allSessions.length === 0 && allInvites.length === 0) {
        setError("Nenhum acesso encontrado para este email.");
        setLoading(false);
        return;
      }
      if (allSessions.length === 1 && allInvites.length === 0) {
        completeLoginAsOwner(allSessions[0]);
        return;
      }
      if (allSessions.length === 0 && allInvites.length === 1) {
        completeLoginAsGuest(allInvites[0]);
        return;
      }
      setSessions(allSessions);
      setInvites(allInvites);
      setStage("picker");
    } catch {
      setError("Não deu para conectar. Confira sua internet e tente de novo.");
    }
    setLoading(false);
  }

  function completeLoginAsOwner(session: SessionSummary) {
    safeSet("conexao-session", session.id);
    safeSet("conexao-name", session.buyerName);
    safeSet("conexao-role", "owner");
    try {
      window.localStorage?.removeItem("conexao-guest-token");
    } catch {
      /* noop */
    }
    try {
      window.localStorage?.removeItem("conexao-onboarding-complete");
    } catch {
      /* noop */
    }
    navigate(session.onboardingComplete ? "/app" : "/onboarding", {
      replace: true,
    });
  }

  function completeLoginAsGuest(invite: InviteSummary) {
    safeSet("conexao-guest-token", invite.token);
    safeSet("conexao-name", invite.guestName);
    safeSet("conexao-role", "guest");
    safeSet("conexao-guest-name", invite.guestName);
    try {
      window.localStorage?.removeItem("conexao-session");
    } catch {
      /* noop */
    }
    try {
      window.localStorage?.removeItem("conexao-onboarding-complete");
    } catch {
      /* noop */
    }
    navigate(invite.onboardingComplete ? "/app" : "/onboarding", {
      replace: true,
    });
  }

  return (
    <div className="login-shell">
      <main className="login-frame">
        <Link href="/" className="login-back" aria-label="Voltar">
          <span>← início</span>
        </Link>

        <div className="login-symbol">
          <Feather size={20} />
        </div>
        <p className="login-kicker">acessar meu baralho</p>

        {stage === "email" && (
          <>
            <h1>
              Entre com seu <em>email.</em>
            </h1>
            <p className="login-copy">
              Vamos mandar um código de 6 dígitos pra você entrar sem senha.
            </p>
            <div className="login-field">
              <Mail size={16} className="login-field-icon" />
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && requestCode()}
                className="login-input"
                data-testid="input-login-email"
                autoFocus
              />
            </div>
            {error && (
              <p className="login-error" data-testid="text-login-error">
                {error}
              </p>
            )}
            <button
              onClick={requestCode}
              disabled={loading}
              className="login-primary"
              data-testid="button-request-code"
            >
              {loading ? (
                "Enviando…"
              ) : (
                <>
                  Enviar código <ArrowRight size={16} />
                </>
              )}
            </button>
            <p className="login-alt">
              Ainda não tem baralho? <Link href="/#pacotes">Ver pacotes</Link>
            </p>
          </>
        )}

        {stage === "code" && (
          <>
            <h1>
              Confira seu <em>email.</em>
            </h1>
            <p className="login-copy">
              Enviamos um código de 6 dígitos para <strong>{email}</strong>. Ele
              expira em 15 minutos.
            </p>
            {notice && <p className="login-notice">{notice}</p>}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              className="login-code-input"
              data-testid="input-login-code"
              autoFocus
            />
            {error && (
              <p className="login-error" data-testid="text-login-error">
                {error}
              </p>
            )}
            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="login-primary"
              data-testid="button-verify-code"
            >
              {loading ? (
                "Verificando…"
              ) : (
                <>
                  Entrar <ArrowRight size={16} />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={resendCooldown > 0 || loading}
              className="login-secondary"
              data-testid="button-resend-code"
            >
              {resendCooldown > 0
                ? `Reenviar em ${resendCooldown}s`
                : "Reenviar código"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
                setError("");
                setNotice("");
                setResendCooldown(0);
              }}
              className="login-secondary"
              data-testid="button-change-email"
            >
              Trocar email
            </button>
          </>
        )}

        {stage === "picker" && (
          <>
            <h1>
              Qual espaço <em>abrir?</em>
            </h1>
            <p className="login-copy">
              Encontramos mais de um acesso vinculado a este email.
            </p>
            <div className="login-picker">
              {sessions.map((session) => (
                <button
                  key={`s-${session.id}`}
                  onClick={() => completeLoginAsOwner(session)}
                  className="login-picker-item"
                  data-testid={`button-select-session-${session.id}`}
                >
                  <span className="login-picker-name">{session.buyerName}</span>
                  <span className="login-picker-meta">
                    Meu baralho · {session.packageName} ·{" "}
                    {new Date(session.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              ))}
              {invites.map((invite) => (
                <button
                  key={`i-${invite.token}`}
                  onClick={() => completeLoginAsGuest(invite)}
                  className="login-picker-item"
                  data-testid={`button-select-invite-${invite.token}`}
                >
                  <span className="login-picker-name">
                    Convite de {invite.ownerName}
                  </span>
                  <span className="login-picker-meta">
                    Você entrou como {invite.guestName} ·{" "}
                    {new Date(invite.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
