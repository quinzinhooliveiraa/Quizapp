import { RecommendedQuestionCarousel } from "@/components/RecommendedQuestionCarousel";
import { PERGUNTAS_VIRAIS } from "@/lib/perguntas-virais";

export function PlanToAction() {
  return (
    <section className="lp3-plan-to-action" aria-labelledby="lp3-first-step-title">
      <p className="lp3-mono">o que vocês vão ter em mãos</p>
      <div className="lp3-first-step">
        <h2 id="lp3-first-step-title" className="lp3-first-step-title">
          Comecem por estas.
        </h2>
        <p className="lp3-section-intro">
          Não são exemplos. São perguntas dos nossos vídeos — as pessoas pararam para
          salvá-las mais de 200 mil vezes.
        </p>
        <RecommendedQuestionCarousel
          questions={PERGUNTAS_VIRAIS}
        />
      </div>
    </section>
  );
}