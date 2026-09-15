const mechanismCards = [
  ["LEVE", "Que talento inútil você tem orgulho secreto de ter?"],
  ["HONESTA", "Tem algo que você precisa e ainda não pediu?"],
  ["PROFUNDA", "Que peso você carrega que nunca dividiu com ninguém?"],
] as const;

export function Lp1MechanismSection() {
  return (
    <section
      className="lp2-simple-section lp2-sei-la lp1-mechanism-section"
      data-section-name="sei-la"
    >
      <div className="lp-container lp2-narrow">
        <p className="lp-eyebrow lp-eyebrow-center">
          a pergunta que todo mundo faz
        </p>
        <h2 className="lp-h2">
          Ninguém abre o jogo <em>numa pergunta pesada.</em>
        </h2>
        <p className="lp2-section-lede">
          É o medo de todo mundo. É por isso que o baralho começa leve. Ninguém
          abre o jogo numa pergunta pesada. As primeiras são fáceis de responder
          até pra quem trava. A profundidade vem depois, quando os dois já estão
          dentro da conversa. E ninguém vai achar que você virou filósofo: quem
          faz a pergunta é a carta, não você. Vale pros dois, aliás. Você também
          não precisa chegar com resposta pronta: "nunca pensei nisso" já é um
          começo.
        </p>
        <div className="lp2-intensity-grid">
          {mechanismCards.map(([label, question]) => (
            <article className="lp2-intensity-card" key={label}>
              <span>{label}</span>
              <p>
                <em>{question}</em>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}