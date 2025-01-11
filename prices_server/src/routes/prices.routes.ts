import { Router } from "express";
import { getPrices } from "../controllers/prices.controller";
import { validateRequestMiddleware } from "../middlewares/validateRequest.middleware";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";

const router = Router();

router.post("/api/prices", apiKeyMiddleware, validateRequestMiddleware, getPrices);

export default router;
