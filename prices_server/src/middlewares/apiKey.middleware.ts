import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/dotenv";
import { isValidApiKey, registerClientId } from "../services/auth.service";

export const apiKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers["x-api-key"] as string; // API Key
  const clientId = req.headers["x-client-id"] as string; // Client ID

  // Se a Admin Key for válida, permitir o acesso sem validação
  if (apiKey && apiKey === ENV.ADMIN_KEY && clientId === ENV.ADMIN_CLIENT_ID) {
    console.log("Admin access granted.");
    return next();
  }

  // Verifica se a API Key e o Client ID estão presentes
  if (!apiKey || !clientId) {
    res.status(401).json({ error: "API Key and Client ID are required" });
    return;
  }

  // Valida a API Key e o vínculo com o Client ID
  if (!isValidApiKey(apiKey, clientId)) {
    const bound = registerClientId(apiKey, clientId); // Vincula na primeira requisição
    if (!bound) {
      res
        .status(401)
        .json({ error: "Invalid or expired API Key or Client ID" });
      return;
    }
  }

  next();
};
