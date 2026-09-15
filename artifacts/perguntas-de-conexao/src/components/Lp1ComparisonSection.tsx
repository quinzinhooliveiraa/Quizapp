import { Check, X } from "lucide-react";

const withoutDeckItems = [
  '"E aí, como foi o dia?" — "Normal."',
  "Cada um rolando o próprio celular",
  'Você tenta e vem o "sei lá"',
  "Amanhã é igual",
];

const withDeckItems = [
  "Uma pergunta que ele nunca ouviu antes",
  "Um celular entre os dois — ou cada um no seu",
  "A pergunta já chega com o assunto pronto",
  "Amanhã tem mais 458",
];

export function Lp1ComparisonSection({
  className = "",
}: {
  className?: string;
}) {
  return (
    <section
      className={`lp2-comparison-section ${className}`.trim()}
      data-section-name="comparativo"
    >
      <div className="lp-container">
        <p className="lp-eyebrow lp-eyebrow-center">a diferença</p>
        <h2 className="lp-h2">
          O que muda <em>numa noite.</em>
        </h2>
        <div
          className="lp2-comparison"
          role="table"
          aria-label="Comparação de uma noite sem e com o baralho"
        >
          <div
            className="lp2-comparison-column lp2-comparison-without"
            role="rowgroup"
          >
            <h3>Sem o baralho</h3>
            {withoutDeckItems.map((item) => (
              <p key={item} role="row">
                <X className="lp2-comparison-mark" size={22} aria-hidden="true" />
                <span>{item}</span>
              </p>
            ))}
          </div>
          <div
            className="lp2-comparison-column lp2-comparison-with"
            role="rowgroup"
          >
            <h3>Com o baralho</h3>
            {withDeckItems.map((item) => (
              <p key={item} role="row">
                <Check className="lp2-comparison-mark" size={22} aria-hidden="true" />
                <span>{item}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}