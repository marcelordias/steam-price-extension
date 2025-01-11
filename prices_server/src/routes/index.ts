import { Router } from "express";
import pricesRoutes from "./prices.routes";

const router = Router();

router.use(pricesRoutes);

export default router;
