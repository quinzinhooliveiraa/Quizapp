import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { landingTestimonials } from "@/lib/testimonials";

export function Lp3Testimonials() {
  const testimonials = landingTestimonials.filter(
    ({ name }) => name === "Caio" || name === "Fernanda" || name === "Marina",
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const activeTestimonial = testimonials[activeIndex];

  const move = (direction: -1 | 1) => {
    setActiveIndex(
      (current) => (current + direction + testimonials.length) % testimonials.length,
    );
  };

  const selectTestimonial = (index: number) => {
    setActiveIndex(index);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0]?.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 42) return;
    move(distance < 0 ? 1 : -1);
  };

  return (
    <section className="lp3-testimonials" aria-labelledby="lp3-testimonials-title">
      <h2 id="lp3-testimonials-title" className="lp3-testimonials-title">
        Não fomos os únicos a perceber isso.
      </h2>
      <div
        className="lp3-testimonial-carousel"
        aria-roledescription="carrossel"
        aria-label="Depoimentos de casais"
      >
        <button
          type="button"
          className="lp3-testimonial-arrow"
          onClick={() => move(-1)}
          aria-label="Depoimento anterior"
          data-testid="button-lp3-testimonial-previous"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <blockquote
          className="lp3-testimonial-card lp3-testimonial-card-active"
          aria-live="polite"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <p>“{activeTestimonial.quote}”</p>
          <footer>
            <div className="lp3-testimonial-attribution">
              <cite>{activeTestimonial.name}</cite>
              <span className="lp3-testimonial-stars" role="img" aria-label="5 de 5 estrelas">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star key={index} size={14} strokeWidth={1.8} fill="currentColor" aria-hidden="true" />
                ))}
              </span>
            </div>
            <span className="lp3-testimonial-detail">{activeTestimonial.detail}</span>
          </footer>
        </blockquote>
        <button
          type="button"
          className="lp3-testimonial-arrow"
          onClick={() => move(1)}
          aria-label="Próximo depoimento"
          data-testid="button-lp3-testimonial-next"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
      <div
        className="lp3-testimonial-dots"
        role="tablist"
        aria-label="Escolher depoimento"
      >
        {testimonials.map((testimonial, index) => (
          <button
            key={`${testimonial.name}-${testimonial.detail}`}
            type="button"
            className={`lp3-testimonial-dot ${index === activeIndex ? "is-active" : ""}`}
            onClick={() => selectTestimonial(index)}
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Ver depoimento ${index + 1}`}
            data-testid={`button-lp3-testimonial-dot-${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}