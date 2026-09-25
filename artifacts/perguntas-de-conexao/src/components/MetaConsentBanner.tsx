import { useState } from "react";
import { useLocation } from "wouter";
import {
  acceptMetaConsent,
  hasMetaConsent,
  isMetaTrackingExcluded,
  META_CONSENT_CHANGE_EVENT,
} from "@/lib/meta-pixel";

export function MetaConsentBanner() {
  const [location] = useLocation();
  const [accepted, setAccepted] = useState(hasMetaConsent);

  if (accepted || isMetaTrackingExcluded(location)) return null;

  const accept = () => {
    acceptMetaConsent();
    setAccepted(hasMetaConsent());
    window.dispatchEvent(new Event(META_CONSENT_CHANGE_EVENT));
  };

  return (
    <aside className="meta-consent-banner" aria-label="Aviso de cookies">
      <span>Usamos cookies pra melhorar sua experiência.</span>
      <button type="button" onClick={accept}>
        Ok
      </button>
    </aside>
  );
}