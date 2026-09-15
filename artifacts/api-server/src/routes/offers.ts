import { Router, type IRouter } from "express";
import { getOfferPricing, getOrCreateOfferWindow } from "../lib/offers";
import { resolveRegion } from "../lib/pricing";

const router: IRouter = Router();

router.post("/offer/state", async (req, res): Promise<void> => {
  const visitorKey =
    typeof req.body?.visitorKey === "string"
      ? req.body.visitorKey.trim().slice(0, 120)
      : "";
  if (!visitorKey) {
    res.status(400).json({ error: "visitorKey é obrigatório" });
    return;
  }

  const region = resolveRegion({
    headers: req.headers,
    query: req.query as Record<string, unknown>,
  });
  const window = await getOrCreateOfferWindow(visitorKey, region);
  if (!window) {
    res.status(500).json({ error: "Não foi possível abrir a oferta" });
    return;
  }

  const pricing = getOfferPricing(region);
  const deadline = window.deadline.toISOString();
  res.set("Cache-Control", "no-store");
  res.json({
    discountActive: window.deadline.getTime() > Date.now(),
    deadline,
    full: pricing.full,
    offer: pricing.offer,
  });
});

export default router;