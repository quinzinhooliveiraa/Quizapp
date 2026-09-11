import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { landingTestimonials, testimonialImages } from "@/lib/testimonials";

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
    <section
      className="lp3-testimonials"
      data-section-name="depoimentos"
      aria-labelledby="lp3-testimonials-title"
    >
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
          <img
            className="lp3-testimonial-image"
            src={
              testimonialImages[
                Math.max(0, landingTestimonials.indexOf(activeTestimonial)) %
                  testimonialImages.length
              ]
            }
            alt={`Depoimento de casal ${activeTestimonial.name ?? activeIndex + 1}`}
          />
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