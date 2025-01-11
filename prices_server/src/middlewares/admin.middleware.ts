import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/dotenv";

/**
 * Middleware para autenticação de administrador.
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const adminKey = req.headers["x-admin-key"] as string;

  if (!adminKey || adminKey !== ENV.ADMIN_KEY) {
    res.status(403).json({ error: "Access forbidden: Invalid Admin Key" });
    return;
  }

  next();
};
