import { Router } from "express";
import { getPrices } from "../controllers/prices.controller";
import { validateRequestMiddleware } from "../middlewares/validateRequest.middleware";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";

const router = Router();
router.get("/api/validate-token", apiKeyMiddleware, (req, res) => {
  res.status(200).json({ valid: true });
});
router.post(
  "/api/prices",
  apiKeyMiddleware,
  validateRequestMiddleware,
  getPrices
);

export default router;
