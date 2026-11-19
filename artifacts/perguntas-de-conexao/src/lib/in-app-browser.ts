export type InAppBrowser = "tiktok" | "instagram" | "facebook";

function readUserAgent(): string {
  try {
    return typeof navigator === "undefined" ? "" : navigator.userAgent || "";
  } catch {
    return "";
  }
}

export function getInAppBrowser(): InAppBrowser | null {
  try {
    const userAgent = readUserAgent();
    if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) {
      return "tiktok";
    }
    if (/Instagram/i.test(userAgent)) {
      return "instagram";
    }
    if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) {
      return "facebook";
    }
    return null;
  } catch {
    return null;
  }
}

export function isAndroid(): boolean {
  try {
    return /Android/i.test(readUserAgent());
  } catch {
    return false;
  }
}

export function isIos(): boolean {
  try {
    if (/(iPhone|iPad|iPod)/i.test(readUserAgent())) return true;
    return (
      typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    );
  } catch {
    return false;
  }
}

export function openInExternalBrowser(): void {
  try {
    if (!isAndroid() || typeof window === "undefined") return;
    const { location } = window;
    const fallbackUrl = encodeURIComponent(location.href);
    window.location.href =
      `intent://${location.host}${location.pathname}${location.search}` +
      `#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${fallbackUrl};end`;
  } catch {
    // Embedded browsers may block custom URL schemes.
  }
}
