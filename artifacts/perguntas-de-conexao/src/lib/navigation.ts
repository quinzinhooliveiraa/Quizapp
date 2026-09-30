const QUIZ_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

export function getQuizHref(extraParams: Record<string, string> = {}) {
  if (typeof window === "undefined") {
    const fallback = new URLSearchParams(extraParams);
    return `/quiz${fallback.toString() ? `?${fallback.toString()}` : ""}`;
  }

  const current = new URLSearchParams(window.location.search);
  const next = new URLSearchParams();

  for (const key of QUIZ_ATTRIBUTION_KEYS) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }

  for (const [key, value] of Object.entries(extraParams)) {
    if (value) next.set(key, value);
  }

  const query = next.toString();
  return `/quiz${query ? `?${query}` : ""}`;
}