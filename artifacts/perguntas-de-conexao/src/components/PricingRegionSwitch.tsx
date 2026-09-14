type PricingRegion = "BR" | "PT";

export function PricingRegionSwitch({ region }: { region: PricingRegion }) {
  const nextRegion = region === "BR" ? "PT" : "BR";
  const params = new URLSearchParams(window.location.search);
  params.set("regiao", nextRegion);
  const query = params.toString();

  return (
    <a
      className="pricing-region-switch"
      href={`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`}
    >
      {region === "BR"
        ? "Está em Portugal? Pagar em euros →"
        : "Está no Brasil? Pagar em reais e Pix →"}
    </a>
  );
}