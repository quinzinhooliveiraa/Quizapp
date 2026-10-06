import { useEffect, useRef, useState } from "react";
import type { Stripe } from "@stripe/stripe-js";
import { ArrowRight, Check, ChevronDown, Copy, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { apiBaseUrl } from "@/config";

const apiBase = apiBaseUrl;
const apiUrl = (path: string) => `${apiBase}${path}`;

type UpsellStage = "upsell" | "downsell" | "done";
type UpsellProduct = { id: "noites30" | "noites7"; name: string; priceCents: number; priceLabel: string };
export type UpsellState = {
  eligible: boolean;
  stage: UpsellStage;
  product: UpsellProduct | null;
  pixAvailable: boolean;
  card: { available: boolean; brand: string; last4: string } | null;
};
type Props = {
  sessionId: string;
  initialState: UpsellState;
  stripePromise: Promise<Stripe | null>;
  onFallback: () => void;
};
type PixOrder = { orderId: string; brCode: string; brCodeBase64: string; expiresAt: string };
type PaymentResult = { ok: boolean; status?: "paid" | "requires_action"; orderId?: string; clientSecret?: string; reason?: string };

const PIX_LIFETIME_MS = 15 * 60 * 1000;

async function readJson<T>(response: Response): Promise<T> {
  const result = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || result === null) throw new Error("request-failed");
  return result;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);
  try {
    return await fetch(apiUrl(path), { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("copy-failed");
}

export default function UpsellOffer({ sessionId, initialState, stripePromise, onFallback }: Props) {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<UpsellStage>(initialState.stage);
  const [screen, setScreen] = useState<"offer" | "success">(initialState.stage === "done" ? "success" : "offer");
  const [pix, setPix] = useState<PixOrder | null>(null);
  const [pixExpired, setPixExpired] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const deadlineRef = useRef<number>(0);
  const productId = stage === "downsell" ? "noites7" : "noites30";
  const cardAvailable = Boolean(initialState.card?.available);
  const pixAvailable = initialState.pixAvailable;
  const isUpsell = stage === "upsell";
  const amount = isUpsell ? "R$ 40,00" : "R$ 15,00";

  useEffect(() => {
    if (screen === "success") return;
    let active = true;
    apiFetch("/api/upsell/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, stage }),
    }).then((response) => {
      if (!response.ok) throw new Error("seen-failed");
    }).catch(() => {
      if (active) onFallback();
    });
    return () => { active = false; };
  }, [sessionId, stage, screen, onFallback]);

  useEffect(() => {
    if (!pix || screen === "success") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const expiry = new Date(pix.expiresAt).getTime();
    deadlineRef.current = Number.isFinite(expiry) ? expiry : Date.now() + PIX_LIFETIME_MS;
    const verify = async () => {
      if (Date.now() >= deadlineRef.current) {
        if (active) setPixExpired(true);
        return;
      }
      try {
        const response = await apiFetch(`/api/upsell/orders/${encodeURIComponent(pix.orderId)}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const result = await readJson<{ status: string }>(response);
        if (!active) return;
        if (result.status === "paid") {
          setPix(null);
          setScreen("success");
          return;
        }
        if (result.status === "failed" || result.status === "expired") {
          setPixExpired(true);
          return;
        }
      } catch {
        if (active) onFallback();
        return;
      }
      if (active) timer = setTimeout(verify, 3000);
    };
    timer = setTimeout(verify, 3000);
    return () => { active = false; clearTimeout(timer); };
  }, [pix, sessionId, screen, onFallback]);

  async function decline() {
    try {
      const response = await apiFetch("/api/upsell/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, stage }),
      });
      if (!response.ok) throw new Error("decline-failed");
      if (stage === "upsell") {
        setPix(null);
        setPixExpired(false);
        setError("");
        setStage("downsell");
      } else {
        onFallback();
      }
    } catch {
      onFallback();
    }
  }

  async function createPix() {
    setError("");
    setPixExpired(false);
    try {
      const response = await apiFetch("/api/upsell/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, product: productId }),
      });
      const result = await readJson<PixOrder>(response);
      if (!result.orderId || !result.brCode) throw new Error("invalid-pix");
      setPix(result);
    } catch {
      onFallback();
    }
  }

  async function payByCard() {
    if (cardBusy) return;
    setCardBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/upsell/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, product: productId }),
      });
      const result = await readJson<PaymentResult>(response);
      if (!result.ok && result.reason === "declined") {
        setError("O cartão não aceitou esta cobrança. Se quiser, pague no Pix, mesmo preço.");
        setCardBusy(false);
        return;
      }
      if (!result.ok) throw new Error("card-failed");
      if (result.status === "paid") {
        setScreen("success");
        return;
      }
      if (result.status === "requires_action" && result.clientSecret && result.orderId) {
        const stripe = await stripePromise;
        if (!stripe) throw new Error("stripe-unavailable");
        const action = await stripe.handleNextAction({ clientSecret: result.clientSecret });
        if (action.error) throw new Error("authentication-failed");
        const verifiedResponse = await apiFetch(`/api/upsell/orders/${encodeURIComponent(result.orderId)}/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const verified = await readJson<{ status: string }>(verifiedResponse);
        if (verified.status === "paid") {
          setScreen("success");
          return;
        }
        throw new Error("payment-unconfirmed");
      }
      throw new Error("payment-failed");
    } catch {
      onFallback();
    } finally {
      setCardBusy(false);
    }
  }

  async function copyPix() {
    if (!pix) return;
    try {
      await copyText(pix.brCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o código. Selecione e copie manualmente.");
    }
  }

  const leaveLabel = isUpsell ? "Não, obrigado, quero abrir meu baralho" : "Não, quero abrir meu baralho";

  return (
    <main className="up-offer-page">
      {screen === "success" ? (
        <section className="up-offer-success">
          <div className="up-offer-success-mark"><Check size={27} /></div>
          <p className="up-offer-eyebrow">Pagamento confirmado</p>
          <h1>✓ Pronto! A noite 1 de {isUpsell ? 30 : 7} já está liberada.</h1>
          <p className="up-offer-lead">Uma noite nova libera por dia. Enviamos o link por e-mail.</p>
          <button className="up-offer-primary" type="button" onClick={() => navigate("/noites")}>
            Abrir as Noites <ArrowRight size={18} />
          </button>
          <button className="up-offer-text-button" type="button" onClick={onFallback}>Ir para o meu baralho</button>
        </section>
      ) : (
        <div className="up-offer-wrap">
          <div className="up-offer-paid">
            <span className="up-offer-check"><Check size={14} /></span>
            <div><p>Pagamento confirmado · link do baralho a caminho no e-mail</p></div>
          </div>
          {isUpsell && <div className="up-offer-hero"><img src="/hero/bridge-casal-sofa.webp" loading="eager" alt="" /><div /></div>}
          <section className={`up-offer-content ${isUpsell ? "up-offer-content--hero" : ""}`}>
            {isUpsell ? (
              <>
                <p className="up-offer-eyebrow">Um caminho para continuar</p>
                <h1>Antes de abrir o baralho: 1 coisa que só aparece <em>agora.</em></h1>
                <p className="up-offer-lead">Vocês compraram para conversar de verdade. Em 30 noites, isso vira hábito, não só uma noite boa.</p>
                <div className="up-offer-program">
                  <div className="up-offer-program-top"><span>PROGRAMA GUIADO · 30 DIAS</span></div>
                  <h2>30 Noites de Conexão</h2>
                  <p>1 noite por dia, de 5 a 30 minutos. 2 perguntas e 1 pequena ação.</p>
                  <ul className="up-offer-weeks">
                    <li><span>01</span><span>Reaproximar</span></li>
                    <li><span>02</span><span>Se conhecer de novo</span></li>
                    <li><span>03</span><span>Conversas difíceis</span></li>
                    <li><span>04</span><span>Desejo e futuro</span></li>
                  </ul>
                  <p className="up-offer-program-extra">+ 2 noites de fechamento</p>
                </div>
                <blockquote className="up-offer-example"><span>UMA NOITE, NA PRÁTICA</span><p>Noite 1: os 3 minutos sem celular. Sentar de frente, timer de 3 minutos, só presença. Parece pouco. Experimentem.</p></blockquote>
                <div className="up-offer-price"><strong>R$ 40,00</strong><span>pagamento único · R$ 1,33 por noite</span></div>
                <p className="up-offer-reassurance">Seu baralho já funciona sozinho. As 30 Noites são um caminho guiado para usá-lo todo dia, não uma peça que falta.</p>
                <p className="up-offer-guarantee"><ShieldCheck size={16} /> Mesma garantia de 7 dias: se não gostarem, devolvemos.</p>
                <p className="up-offer-fine">Só oferecemos isso para quem acabou de entrar. Não está à venda no site.</p>
              </>
            ) : (
              <>
                <p className="up-offer-eyebrow">Uma primeira semana, no ritmo de vocês</p>
                <h1>Tudo bem. Que tal começar só pela primeira semana?</h1>
                <div className="up-offer-program">
                  <div className="up-offer-program-top"><span>PROGRAMA GUIADO · 7 DIAS</span></div>
                  <h2>7 Noites de Conexão</h2>
                  <p>1 noite por dia, de 5 a 30 minutos. Um começo leve para reaproximar.</p>
                  <ul className="up-offer-weeks">
                    <li><span>01</span><span>Reaproximar</span></li>
                  </ul>
                </div>
                <div className="up-offer-price"><strong>R$ 15,00</strong><span>Pagamento único</span></div>
                <p className="up-offer-guarantee"><ShieldCheck size={16} /> Mesma garantia de 7 dias.</p>
              </>
            )}

            {error && <p className="up-offer-error" role="alert">{error}</p>}
            {!pix && !pixExpired && (
              <div className="up-offer-actions">
                {cardAvailable && (
                  <button className="up-offer-primary" type="button" onClick={payByCard} disabled={cardBusy}>
                    {cardBusy ? "Cobrando…" : `Sim, quero as ${isUpsell ? "30" : "7"} Noites — cobrar ${amount} no cartão ${initialState.card?.brand || ""} •••• ${initialState.card?.last4 || ""}`}
                    {!cardBusy && <ArrowRight size={18} />}
                  </button>
                )}
                {pixAvailable && (
                  <button className={cardAvailable ? "up-offer-pix-secondary" : "up-offer-primary"} type="button" onClick={createPix}>
                    {cardAvailable ? `Pagar ${amount} no Pix` : `Sim, quero as ${isUpsell ? "30" : "7"} Noites — gerar Pix de ${amount}`}
                    <QrCode size={17} />
                  </button>
                )}
              </div>
            )}
            {pix && !pixExpired && (
              <div className="checkout-pix-panel up-offer-pix-panel">
                <div className="checkout-pix-heading"><QrCode size={19} /><div><strong>Pix gerado</strong><span>aguardando confirmação do banco</span></div></div>
                <div className="checkout-pix-code">{pix.brCode}</div>
                <button className="checkout-pix-copy" type="button" onClick={copyPix}><Copy size={15} />{copied ? "Código copiado" : "Copiar código"}</button>
                <button className="up-offer-qr-toggle" type="button" onClick={() => setShowQr((value) => !value)}>
                  {showQr ? "Ocultar QR Code" : "Mostrar QR Code"} <ChevronDown size={15} />
                </button>
                {showQr && pix.brCodeBase64 && <img className="up-offer-qr" src={`data:image/png;base64,${pix.brCodeBase64}`} alt="QR Code Pix" />}
                <p className="up-offer-polling"><span /> aguardando confirmação do banco</p>
              </div>
            )}
            {pixExpired && (
              <div className="up-offer-expired"><p>Este Pix expirou.</p><button className="up-offer-primary" type="button" onClick={createPix}>Gerar outro Pix</button></div>
            )}
            <button className="up-offer-decline" type="button" onClick={decline} disabled={cardBusy}>{leaveLabel}</button>
            <p className="up-offer-secure"><LockKeyhole size={13} /> Pagamento único e seguro</p>
          </section>
        </div>
      )}
    </main>
  );
}
