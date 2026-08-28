export {
  DEFAULT_PRIMARY_LANDING_PAGE_ID,
  LANDING_PAGES,
  getLandingPageById,
  getLandingPageByPath,
  isLandingPageId,
  type LandingPage,
  type LandingPageId,
  type LandingPagePath,
} from "@workspace/landing-pages";

// Keep the experiment-facing name local to the app while sharing the same
// stable registry used by the API and the primary landing page setting.
export { LANDING_PAGES as EXPERIMENT_LANDING_PAGES };
