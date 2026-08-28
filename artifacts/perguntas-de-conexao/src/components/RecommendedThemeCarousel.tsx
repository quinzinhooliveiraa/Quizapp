import type { ConnectionTheme } from "@workspace/connection-content";

export type RecommendedTheme = ConnectionTheme & {
  imageUrl?: string;
};

type RecommendedThemeCarouselProps = {
  themes: RecommendedTheme[];
};

export function RecommendedThemeCarousel({
  themes,
}: RecommendedThemeCarouselProps) {
  return (
    <div
      className="lp3-recommended-theme-carousel"
      role="region"
      tabIndex={0}
      aria-label="Outros baralhos da biblioteca"
    >
      {themes.map((theme, index) => (
        <article
          className={`lp3-recommended-theme-card theme-cover-${index % 5}`}
          key={theme.id}
          data-testid={`card-lp3-theme-${theme.id}`}
        >
          {theme.imageUrl ? (
            <img
              className="lp3-recommended-theme-image"
              src={theme.imageUrl}
              alt={`Imagem do tema ${theme.title}`}
              loading="lazy"
            />
          ) : (
            <div
              className="lp3-recommended-theme-fallback"
              aria-hidden="true"
            />
          )}
          <div className="lp3-recommended-theme-shade" aria-hidden="true" />
          <div className="lp3-recommended-theme-top">
            <span>baralho</span>
            <span>{theme.count} perguntas</span>
          </div>
          <div className="lp3-recommended-theme-copy">
            <strong>{theme.title}</strong>
            <p>{theme.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}