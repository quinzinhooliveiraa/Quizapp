import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import type { ThemePeek } from "@/lib/theme-peek";

type ThemePeekDialogProps = {
  peek: ThemePeek;
  onClose: () => void;
  onBuy: () => void;
};

export function ThemePeekDialog({
  peek,
  onClose,
  onBuy,
}: ThemePeekDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="theme-peek-overlay"
      role="presentation"
      onClick={onClose}
      data-testid="overlay-theme-peek"
    >
      <div
        className="theme-peek-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-peek-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="theme-peek-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          data-testid="button-theme-peek-close"
        >
          <X size={18} />
        </button>

        {peek.backgroundUrl ? (
          <div className="theme-peek-cover" aria-hidden="true">
            <img
              src={peek.backgroundUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}

        <span className="theme-peek-kicker">
          baralho · {peek.count} perguntas
        </span>
        <h2 id="theme-peek-title" className="theme-peek-title">
          {peek.title}
        </h2>

        {peek.question ? (
          <blockquote
            className="theme-peek-question"
            data-testid="text-theme-peek-question"
          >
            “{peek.question}”
          </blockquote>
        ) : (
          <p className="theme-peek-adult">
            Este baralho é 18+. As perguntas dele não ficam à mostra por aqui.
          </p>
        )}

        <p className="theme-peek-lock">
          {peek.question
            ? `Essa é uma. As outras ${peek.count - 1} abrem quando o baralho for de vocês.`
            : `São ${peek.count} perguntas, e elas abrem quando o baralho for de vocês.`}
        </p>

        <button
          className="button button-primary theme-peek-cta"
          type="button"
          onClick={onBuy}
          data-testid="button-theme-peek-buy"
        >
          Quero esse baralho <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}