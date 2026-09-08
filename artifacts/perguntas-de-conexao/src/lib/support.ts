export const SUPPORT_DIALOG_EVENT = "pdc:open-support-dialog";

export function openSupportDialog(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUPPORT_DIALOG_EVENT));
}