import type { ConnectionQuestion } from "@workspace/connection-content";
import { RecommendedQuestionCarousel } from "@/components/RecommendedQuestionCarousel";

type PlanToActionProps = {
  recommendationBridge: string;
  questions: ConnectionQuestion[];
  themeTitle: string;
  onAction: () => void;
};

export function PlanToAction({
  recommendationBridge,
  questions,
  themeTitle,
  onAction,
}: PlanToActionProps) {
  return (
    <section className="lp3-plan-to-action" aria-labelledby="lp3-first-step-title">
      <p className="lp3-recommendation-bridge">{recommendationBridge}</p>
      <div className="lp3-first-step">
        <h2 id="lp3-first-step-title" className="lp3-first-step-title">
          Comecem por uma pergunta.
        </h2>
        <RecommendedQuestionCarousel
          questions={questions}
          themeTitle={themeTitle}
        />
      </div>
      <div className="lp3-plan-cta">
        <button
          className="lp3-button lp3-button-primary"
          type="button"
          onClick={onAction}
          data-testid="button-lp3-start-conversation"
        >
          Quero começar essa conversa <span aria-hidden="true">→</span>
        </button>
        <p>Você começa escolhendo o seu nome e onde quer receber o acesso.</p>
      </div>
    </section>
  );
}