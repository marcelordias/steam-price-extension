import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/dotenv";

/**
 * Middleware para autenticação de administrador.
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const adminKey = req.headers["x-api-key"] as string;
  const adminClientId = req.headers["x-client-id"] as string;

  if (!adminKey || adminKey !== ENV.ADMIN_KEY || adminClientId !== ENV.ADMIN_CLIENT_ID) {
    res.status(403).json({ error: "Access forbidden: Invalid Admin Key" });
    return;
  }

  next();
};
