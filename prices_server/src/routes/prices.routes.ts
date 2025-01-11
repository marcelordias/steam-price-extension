import { Router } from "express";
import { getPrices } from "../controllers/prices.controller";
import { validateRequestMiddleware } from "../middlewares/validateRequest.middleware";

const router = Router();

router.post("/api/prices", validateRequestMiddleware, getPrices);

export default router;
