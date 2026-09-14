import { Router, type IRouter } from "express";
import { getPricing, resolveRegion } from "../lib/pricing";

const router: IRouter = Router();

router.get("/pricing", async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  const visitorKey =
    typeof req.query.visitorKey === "string"
      ? req.query.visitorKey.trim().slice(0, 120)
      : undefined;
  res.json(
    await getPricing(
      resolveRegion({
        headers: req.headers,
        query: req.query as Record<string, unknown>,
      }),
      visitorKey,
    ),
  );
});

export default router;