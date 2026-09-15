import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import type { Pricing } from "@/lib/pricing";

type Lp1PriceCardProps = {
  fullPricing: Pricing;
  offerPricing?: Pricing | null;
  discountActive?: boolean;
  onBuy: () => void;
  testId?: string;
  className?: string;
  showBenefits?: boolean;
};

function PriceText({ pricing }: { pricing: Pricing }) {
  return pricing.symbolPosition === "before" ? (
    <>
      <span className="lp-price-symbol">{pricing.symbol}</span> {pricing.amount}
    </>
  ) : (
    <>
      {pricing.amount} <span className="lp-price-symbol">{pricing.symbol}</span>
    </>
  );
}

export function Lp1PriceCard({
  fullPricing,
  offerPricing,
  discountActive = false,
  onBuy,
  testId = "button-price-cta-v2",
  className = "",
  showBenefits = false,
}: Lp1PriceCardProps) {
  const hasDiscount = Boolean(discountActive && offerPricing);
  const pricing =
    hasDiscount && offerPricing ? offerPricing : fullPricing;

  return (
    <div className={`lp-price-card lp1-price-card ${className}`.trim()}>
      {showBenefits ? (
        <>
          <p className="lp1-price-includes-title">O que vocês levam</p>
          <ul className="lp-price-includes">
            <li>
              <Check className="lp1-price-check" size={16} aria-hidden="true" />
              <span>Baralhos para cada momento de vocês + o bônus do dia</span>
            </li>
            <li>
              <Check className="lp1-price-check" size={16} aria-hidden="true" />
              <span>Baralho personalizado do dia, sempre novo</span>
            </li>
            <li>
              <Check className="lp1-price-check" size={16} aria-hidden="true" />
              <span>
                Acesso pra <strong>2 pessoas</strong> (você + convite)
              </span>
            </li>
            <li>
              <Check className="lp1-price-check" size={16} aria-hidden="true" />
              <span>Respondam juntos, mesmo à distância</span>
            </li>
            <li>
              <Check className="lp1-price-check" size={16} aria-hidden="true" />
              <span>Novos baralhos incluídos, pra sempre</span>
            </li>
            <li>
              <Check className="lp1-price-check" size={16} aria-hidden="true" />
              <span>Sem mensalidade. Paga uma vez.</span>
            </li>
          </ul>
        </>
      ) : null}
      <div className="lp-price-main">
        <p className="lp-price-value">
          459 perguntas por{" "}
          <span className="lp-price-figure">
            {hasDiscount ? (
              <>
                <del className="lp-price-old">{fullPricing.display}</del>{" "}
                <strong className="lp-price-discount">
                  <PriceText pricing={pricing} />
                </strong>
              </>
            ) : (
              <PriceText pricing={pricing} />
            )}
          </span>
        </p>
        <p className="lp-price-once">{pricing.unitNote}</p>
      </div>
      <button
        onClick={onBuy}
        className="lp-cta-primary lp-cta-full"
        data-testid={testId}
      >
        Começar hoje à noite <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="lp-price-payment">
        {pricing.pixAvailable ? "Pix ou cartão" : "Cartão"} · acesso na hora
      </p>
      <p className="lp-price-freedom">🔒 7 dias de garantia. Você decide.</p>
      <div className="lp-guarantee">
        <div className="lp-guarantee-seal" aria-hidden="true">
          <ShieldCheck size={28} strokeWidth={1.8} />
        </div>
        <div>
          <strong>Garantia incondicional de 7 dias.</strong>
          <p>Se não fizer sentido pra vocês, devolvemos 100%. Sem drama, sem perguntas.</p>
        </div>
      </div>
    </div>
  );
}