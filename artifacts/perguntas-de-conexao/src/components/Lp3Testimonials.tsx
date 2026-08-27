import { landingTestimonials } from "@/lib/testimonials";

export function Lp3Testimonials() {
  return (
    <section className="lp3-testimonials" aria-labelledby="lp3-testimonials-title">
      <h2 id="lp3-testimonials-title" className="lp3-testimonials-title">
        Não fomos os únicos a perceber isso.
      </h2>
      <div className="lp3-testimonials-grid">
        {landingTestimonials
          .filter(
            ({ name }) =>
              name === "Caio" || name === "Fernanda" || name === "Marina",
          )
          .map((testimonial) => (
          <blockquote className="lp3-testimonial-card" key={testimonial.name}>
            <p>“{testimonial.quote}”</p>
            <footer>
              <cite>{testimonial.name}</cite>
              <span>{testimonial.detail}</span>
            </footer>
          </blockquote>
          ))}
      </div>
    </section>
  );
}