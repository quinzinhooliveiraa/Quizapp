import { Router, type IRouter } from "express";
import healthRouter from "./health";
import connectionRouter from "./connection";

const router: IRouter = Router();

router.use(healthRouter);
router.use(connectionRouter);

export default router;
