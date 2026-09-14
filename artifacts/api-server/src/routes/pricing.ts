import { Router, type IRouter } from "express";
import { getPricing, resolveRegion } from "../lib/pricing";

const router: IRouter = Router();

router.get("/pricing", (req, res): void => {
  res.set("Cache-Control", "no-store");
  res.json(
    getPricing(
      resolveRegion({
        headers: req.headers,
        query: req.query as Record<string, unknown>,
      }),
    ),
  );
});

export default router;