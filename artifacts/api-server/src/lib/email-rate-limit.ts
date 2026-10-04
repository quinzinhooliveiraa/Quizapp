const EMAIL_CHECK_RATE_WINDOW_MS = 60_000;
const EMAIL_CHECK_RATE_LIMIT = 20;

const emailRequestRateByIp = new Map<
  string,
  { windowStartedAt: number; requestCount: number }
>();

export function allowEmailRequest(ip: string, now: number): boolean {
  if (emailRequestRateByIp.size > 1000) {
    for (const [key, entry] of emailRequestRateByIp) {
      if (now - entry.windowStartedAt >= EMAIL_CHECK_RATE_WINDOW_MS) {
        emailRequestRateByIp.delete(key);
      }
    }
  }

  const current = emailRequestRateByIp.get(ip);
  if (!current || now - current.windowStartedAt >= EMAIL_CHECK_RATE_WINDOW_MS) {
    emailRequestRateByIp.set(ip, { windowStartedAt: now, requestCount: 1 });
    return true;
  }

  if (current.requestCount >= EMAIL_CHECK_RATE_LIMIT) return false;
  current.requestCount += 1;
  return true;
}