export type LandingPageId = "v1" | "v2" | "lp3";

export type LandingPagePath = "/" | "/lp2" | "/lp3";

export type LandingPage = {
  id: LandingPageId;
  name: string;
  path: LandingPagePath;
  description: string;
};

export const DEFAULT_PRIMARY_LANDING_PAGE_ID: LandingPageId = "v2";

/**
 * The canonical registry for the published landing pages.
 *
 * Experiment assignment still chooses from explicit paths; this registry is
 * also used by the root route setting so the two systems keep stable IDs.
 */
export const LANDING_PAGES: readonly LandingPage[] = [
  {
    id: "v2",
    name: "Reacender a chama",
    path: "/",
    description:
      "A página principal com o hero de mockups e a experiência guiada de perguntas.",
  },
  {
    id: "v1",
    name: "Suas conversas viraram logística",
    path: "/lp2",
    description:
      "A alternativa com storytelling da dor, quiz de 3 perguntas e os baralhos temáticos.",
  },
  {
    id: "lp3",
    name: "Jornada de Conexão",
    path: "/lp3",
    description:
      "Landing baseada em quiz, narrativa personalizada e recomendação de baralho.",
  },
] as const;

export function getLandingPageById(id: string) {
  return LANDING_PAGES.find((landing) => landing.id === id);
}

export function getLandingPageByPath(path: string) {
  return LANDING_PAGES.find((landing) => landing.path === path);
}

export function isLandingPageId(
  value: string | null | undefined,
): value is LandingPageId {
  return Boolean(value && getLandingPageById(value));
}