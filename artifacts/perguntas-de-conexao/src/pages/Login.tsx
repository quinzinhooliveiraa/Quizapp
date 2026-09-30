import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, Feather, Mail } from "lucide-react";
import { apiBaseUrl } from "@/config";
import { getQuizHref } from "@/lib/navigation";
import { openSupportDialog } from "@/lib/support";

const apiBase = apiBaseUrl;
const apiUrl = (path: string) => `${apiBase}${path}`;

type Stage = "email" | "code" | "picker" | "support";
type SupportPaymentMethod = "" | "pix" | "card";
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

function safeGet(key: string): string {
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

export default function Login() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState(
    () => safeGet("conexao-login-email") || safeGet("conexao-pending-buyer-email"),
  );
  const [code, setCode] = useState("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [noPurchase, setNoPurchase] = useState(false);
  const [supportEmail, setSupportEmail] = useState(email);
  const [supportPaymentDate, setSupportPaymentDate] = useState("");
  const [supportPaymentTime, setSupportPaymentTime] = useState("");
  const [supportPaymentMethod, setSupportPaymentMethod] =
    useState<SupportPaymentMethod>("");

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
    setNoPurchase(false);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Digite um email válido.");
      return;
    }
    safeSet("conexao-login-email", trimmed);
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
        setNoPurchase(true);
        setError("");
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

  function formatSupportDetails() {
    return [
      "Olá! Paguei e não recebi meu acesso ao Perguntas de Conexão.",
      `E-mail usado: ${supportEmail.trim() || "não informado"}`,
      `Data aproximada: ${supportPaymentDate || "não informado"}`,
      `Hora aproximada: ${supportPaymentTime || "não informado"}`,
      `Forma de pagamento: ${
        supportPaymentMethod === "pix"
          ? "Pix"
          : supportPaymentMethod === "card"
            ? "Cartão"
            : "não informado"
      }`,
    ].join("\n");
  }

  function openPaymentSupport() {
    const message = formatSupportDetails();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function startSupportFlow() {
    setSupportEmail(email);
    setStage("support");
    setError("");
    setNoPurchase(false);
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setNoPurchase(false);
                }}
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
            {noPurchase && (
              <div className="login-no-purchase" data-testid="text-login-no-purchase">
                <p>
                  Não achamos compra com esse e-mail. Pagou e não recebeu?{" "}
                  <button type="button" onClick={startSupportFlow}>
                    Toque aqui
                  </button>
                </p>
                <Link
                  href={getQuizHref()}
                  className="login-quiz-cta"
                  data-testid="link-login-free-test"
                >
                  Fazer o teste e ver seu baralho <ArrowRight size={16} />
                </Link>
              </div>
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
              <Link
                href={getQuizHref()}
                className="login-quiz-cta"
                data-testid="link-login-quiz"
              >
                Ainda não tem? Fazer o teste grátis <ArrowRight size={15} />
              </Link>
            </p>
          </>
        )}

        {stage === "support" && (
          <>
            <button
              type="button"
              className="login-back login-inline-back"
              onClick={() => setStage("email")}
            >
              ← voltar para o login
            </button>
            <h1>
              Pagou e não <em>recebeu?</em>
            </h1>
            <p className="login-copy">
              Preencha o que souber. A gente usa esses dados para localizar o
              pagamento e liberar seu acesso.
            </p>
            <div className="login-support-form">
              <label>
                E-mail usado no pagamento <span>(opcional)</span>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  data-testid="input-support-email"
                />
              </label>
              <div className="login-support-date-grid">
                <label>
                  Data aproximada
                  <input
                    type="date"
                    value={supportPaymentDate}
                    onChange={(event) => setSupportPaymentDate(event.target.value)}
                    data-testid="input-support-date"
                  />
                </label>
                <label>
                  Hora aproximada
                  <input
                    type="time"
                    value={supportPaymentTime}
                    onChange={(event) => setSupportPaymentTime(event.target.value)}
                    data-testid="input-support-time"
                  />
                </label>
              </div>
              <label>
                Forma de pagamento
                <select
                  value={supportPaymentMethod}
                  onChange={(event) =>
                    setSupportPaymentMethod(
                      event.target.value as SupportPaymentMethod,
                    )
                  }
                  data-testid="select-support-payment-method"
                >
                  <option value="">Selecione</option>
                  <option value="pix">Pix</option>
                  <option value="card">Cartão</option>
                </select>
              </label>
            </div>
            <div className="login-support-actions">
              <button
                type="button"
                className="login-primary"
                onClick={openPaymentSupport}
                data-testid="button-support-whatsapp"
              >
                Enviar comprovante pelo WhatsApp <ArrowRight size={16} />
              </button>
              <a
                className="login-secondary login-mail-link"
                href={`mailto:perguntasdeconexao@gmail.com?subject=${encodeURIComponent(
                  "Paguei e não recebi",
                )}&body=${encodeURIComponent(formatSupportDetails())}`}
                data-testid="link-support-email"
              >
                Enviar por e-mail
              </a>
            </div>
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
        <p className="login-support">
          Não está conseguindo entrar?{" "}
          <button type="button" onClick={openSupportDialog}>
            Preciso de ajuda
          </button>
        </p>
      </main>
    </div>
  );
}
