import type { ConnectionQuestion } from "@workspace/connection-content";
import { RecommendedQuestionCarousel } from "@/components/RecommendedQuestionCarousel";

type PlanToActionProps = {
  recommendationBridge: string;
  questions: ConnectionQuestion[];
  themeTitle: string;
};

export function PlanToAction({
  recommendationBridge,
  questions,
  themeTitle,
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
    </section>
  );
}