import { Router, type IRouter, type Request, type Response } from "express";
import { getOfferPricing, getOfferWindow, startOfferWindow } from "../lib/offers";
import { resolveRegion } from "../lib/pricing";

const router: IRouter = Router();

function readVisitorKey(req: Request): string {
  return typeof req.body?.visitorKey === "string"
    ? req.body.visitorKey.trim().slice(0, 120)
    : "";
}

async function sendOfferState(
  res: Response,
  visitorKey: string,
  region: ReturnType<typeof resolveRegion>,
): Promise<void> {
  const window = await getOfferWindow(visitorKey);
  const pricing = getOfferPricing(region);
  const active = Boolean(window);
  res.set("Cache-Control", "no-store");
  res.json({
    discountActive: active,
    deadline: window?.deadline.toISOString() ?? new Date(0).toISOString(),
    full: pricing.full,
    offer: pricing.offer,
  });
}

router.post("/offer/state", async (req, res): Promise<void> => {
  const visitorKey = readVisitorKey(req);
  if (!visitorKey) {
    res.status(400).json({ error: "visitorKey é obrigatório" });
    return;
  }

  const region = resolveRegion({
    headers: req.headers,
    query: req.query as Record<string, unknown>,
  });
  await sendOfferState(res, visitorKey, region);
});

router.post("/offer/start", async (req, res): Promise<void> => {
  const visitorKey = readVisitorKey(req);
  if (!visitorKey) {
    res.status(400).json({ error: "visitorKey é obrigatório" });
    return;
  }

  const region = resolveRegion({
    headers: req.headers,
    query: req.query as Record<string, unknown>,
  });
  const window = await startOfferWindow(visitorKey, region);
  if (!window) {
    res.status(500).json({ error: "Não foi possível abrir a oferta" });
    return;
  }

  await sendOfferState(res, visitorKey, region);
});

export default router;