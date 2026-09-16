import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import type { Pricing } from "@/lib/pricing";

type Lp1PriceCardProps = {
  fullPricing: Pricing;
  offerPricing?: Pricing | null;
  discountActive?: boolean;
  discountLabel?: string | null;
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

function getDiscountPercent(fullPricing: Pricing, offerPricing: Pricing): number {
  if (fullPricing.amountCents <= 0 || offerPricing.amountCents >= fullPricing.amountCents) {
    return 0;
  }

  return Math.round(
    ((fullPricing.amountCents - offerPricing.amountCents) /
      fullPricing.amountCents) *
      100,
  );
}

export function Lp1PriceCard({
  fullPricing,
  offerPricing,
  discountActive = false,
  discountLabel = null,
  onBuy,
  testId = "button-price-cta-v2",
  className = "",
  showBenefits = false,
}: Lp1PriceCardProps) {
  const hasDiscount = Boolean(discountActive && offerPricing);
  const pricing =
    hasDiscount && offerPricing ? offerPricing : fullPricing;
  const discountPercent =
    hasDiscount && offerPricing
      ? getDiscountPercent(fullPricing, offerPricing)
      : 0;

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
        {hasDiscount && discountLabel ? (
          <p className="lp-price-discount-label" aria-live="polite">
            {discountLabel}
          </p>
        ) : null}
        <p className="lp-price-value">
          459 perguntas por{" "}
          <span className={`lp-price-figure ${hasDiscount ? "is-discount" : ""}`}>
            {hasDiscount ? (
              <>
                <del className="lp-price-old">
                  De <PriceText pricing={fullPricing} />
                </del>
                <strong className="lp-price-discount">
                  <span>Por </span>
                  <PriceText pricing={pricing} />
                  <span className="lp-price-off-badge">
                    {discountPercent}% OFF
                  </span>
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
      <p className="lp-price-lifetime">Paga uma vez. Pra sempre. Sem assinatura.</p>
    </div>
  );
}