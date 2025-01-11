import { Router } from "express";
import { createApiKey } from "../controllers/auth.controller";
import { adminMiddleware } from "../middlewares/admin.middleware";

const router = Router();

// Apenas administradores podem criar API Keys
router.post("/api/auth/apikey", adminMiddleware, createApiKey);

export default router;
