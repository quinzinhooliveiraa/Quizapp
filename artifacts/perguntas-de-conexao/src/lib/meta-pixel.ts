export const META_PIXEL_ID = "1059096806597539";
export const META_CONSENT_STORAGE_KEY = "pdc-meta-consent";
export const META_CONSENT_CHANGE_EVENT = "pdc-meta-consent-change";

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    __pdcMetaPixelInitialized?: boolean;
  }
}

export function hasMetaConsent(): boolean {
  try {
    return localStorage.getItem(META_CONSENT_STORAGE_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function isMetaTrackingExcluded(pathname?: string): boolean {
  if (typeof window === "undefined") return true;

  const path = pathname || window.location.pathname;
  if (path.split("/").includes("admin")) return true;

  const urlFlag = new URLSearchParams(window.location.search).get("internal");
  if (urlFlag === "1") return true;
  if (urlFlag === "0") return false;

  try {
    return localStorage.getItem("pdc_internal") === "1";
  } catch {
    return false;
  }
}

export function isMetaTrackingAllowed(pathname?: string): boolean {
  return hasMetaConsent() && !isMetaTrackingExcluded(pathname);
}

export function acceptMetaConsent(): void {
  try {
    localStorage.setItem(META_CONSENT_STORAGE_KEY, "accepted");
  } catch {
    // Pixel tracking remains disabled if consent cannot be stored.
    return;
  }
  persistFbcFromFbclid();
}

export function createMetaEventId(eventName: string): string {
  const normalizedName = eventName.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `meta_${normalizedName}_${Date.now()}_${randomId}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return entry.slice(name.length + 1);
  }
}

function persistFbcFromFbclid(): void {
  if (typeof window === "undefined" || getCookie("_fbc")) return;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  if (!fbclid) return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `_fbc=${encodeURIComponent(
    `fb.1.${Date.now()}.${fbclid}`,
  )}; path=/; max-age=7776000; samesite=lax${secure}`;
}

export function getMetaAttributionCookies(): {
  fbp?: string;
  fbc?: string;
} {
  if (!isMetaTrackingAllowed()) return {};
  persistFbcFromFbclid();
  return {
    ...(getCookie("_fbp") ? { fbp: getCookie("_fbp")! } : {}),
    ...(getCookie("_fbc") ? { fbc: getCookie("_fbc")! } : {}),
  };
}

function initializeMetaPixel(): void {
  if (typeof window === "undefined" || !isMetaTrackingAllowed()) return;

  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue?.push(args);
      }
    }) as MetaPixelFunction;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
  }

  if (!document.getElementById("meta-pixel-script")) {
    const script = document.createElement("script");
    script.id = "meta-pixel-script";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  if (!window.__pdcMetaPixelInitialized) {
    window.fbq("init", META_PIXEL_ID);
    window.__pdcMetaPixelInitialized = true;
  }
}

export function trackMetaPixelEvent(
  eventName: string,
  parameters: Record<string, unknown> = {},
  eventId = createMetaEventId(eventName),
  custom = false,
): void {
  if (!isMetaTrackingAllowed()) return;
  initializeMetaPixel();
  window.fbq?.(
    custom ? "trackCustom" : "track",
    eventName,
    parameters,
    { eventID: eventId },
  );
}