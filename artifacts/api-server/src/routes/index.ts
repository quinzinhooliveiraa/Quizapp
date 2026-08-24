import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectionRouter from "./connection";
import authRouter from "./auth";
import momentsRouter from "./moments";
import preferencesRouter from "./preferences";
import adminRouter from "./admin";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connectionRouter);
router.use(authRouter);
router.use(momentsRouter);
router.use(preferencesRouter);
router.use(adminRouter);
router.use(feedbackRouter);

export default router;
