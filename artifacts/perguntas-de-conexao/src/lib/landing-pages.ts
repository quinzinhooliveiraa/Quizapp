export type LandingPageId = "v1" | "v2" | "lp3";

export type LandingPage = {
  id: LandingPageId;
  name: string;
  path: "/" | "/lp2" | "/lp3";
  description: string;
};

/**
 * The single registry of landing pages that can participate in experiments.
 * Add a new entry here when a new existing landing page becomes eligible.
 */
export const EXPERIMENT_LANDING_PAGES: LandingPage[] = [
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
];

export function getLandingPageById(id: string) {
  return EXPERIMENT_LANDING_PAGES.find((landing) => landing.id === id);
}

export function getLandingPageByPath(path: string) {
  return EXPERIMENT_LANDING_PAGES.find((landing) => landing.path === path);
}
