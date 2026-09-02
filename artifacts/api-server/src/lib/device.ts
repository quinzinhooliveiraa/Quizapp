export type DeviceType = "mobile" | "desktop" | "tablet";

export function detectDevice(userAgent: string | undefined): DeviceType {
  const normalized = (userAgent || "").toLowerCase();

  if (
    /ipad|tablet|playbook|silk|kindle|android(?!.*mobile)/i.test(normalized)
  ) {
    return "tablet";
  }

  if (
    /mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/i.test(
      normalized,
    )
  ) {
    return "mobile";
  }

  return "desktop";
}