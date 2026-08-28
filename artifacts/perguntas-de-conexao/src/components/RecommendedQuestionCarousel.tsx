import type { ConnectionQuestion } from "@workspace/connection-content";

type RecommendedQuestionCarouselProps = {
  questions: ConnectionQuestion[];
  themeTitle: string;
};

export function RecommendedQuestionCarousel({
  questions,
  themeTitle,
}: RecommendedQuestionCarouselProps) {
  return (
    <div
      className="lp3-recommended-question-carousel"
      role="region"
      tabIndex={0}
      aria-label="Perguntas recomendadas"
    >
      {questions.map((question, index) => (
        <article
          className={`lp3-recommended-question-card question-gradient-${index % 4}`}
          key={question.id}
          data-testid={`card-lp3-recommended-question-${question.id}`}
        >
          <div className="lp3-recommended-question-grain" aria-hidden="true" />
          <div className="lp3-recommended-question-top">
            <span>{themeTitle}</span>
            <strong>
              Perguntas
              <br />
              <i>de Conexão</i>
            </strong>
          </div>
          <div className="lp3-recommended-question-copy">
            <p>{question.text}</p>
          </div>
          <div className="lp3-recommended-question-foot">
            <span>pergunta real</span>
            <span>
              {index + 1} / {questions.length}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}