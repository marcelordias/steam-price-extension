import { Router } from "express";
import authRoutes from "./auth.routes";
import pricesRoutes from "./prices.routes";

const router = Router();

router.use(authRoutes);
router.use(pricesRoutes);

export default router;
