import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ConnectionTheme } from "@workspace/connection-content";

export type RecommendedTheme = ConnectionTheme & {
  backgroundUrl?: string;
};

type RecommendedThemeCarouselProps = {
  themes: RecommendedTheme[];
  onPeek: (themeId: string) => void;
};

export function RecommendedThemeCarousel({
  themes,
  onPeek,
}: RecommendedThemeCarouselProps) {
  const pointerDownX = useRef<number | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    pointerDownX.current = event.clientX;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>, themeId: string) => {
    const startX = pointerDownX.current;
    pointerDownX.current = null;
    if (startX === null || Math.abs(event.clientX - startX) <= 8) {
      onPeek(themeId);
    }
  };

  return (
    <div
      className="lp3-recommended-theme-carousel"
      role="region"
      tabIndex={0}
      aria-label="Outros baralhos da biblioteca"
    >
      {themes.map((theme, index) => (
        <button
          className={`lp3-recommended-theme-card theme-cover-${index % 5}`}
          key={theme.id}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={(event) => handlePointerUp(event, theme.id)}
          data-testid={`card-lp3-theme-${theme.id}`}
        >
          {theme.backgroundUrl ? (
            <img
              className="lp3-recommended-theme-image"
              src={theme.backgroundUrl}
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
        </button>
      ))}
    </div>
  );
}