import { Request, Response } from "express";
import { generateApiKey } from "../services/auth.service";

/**
 * Gera e retorna uma nova API Key com duração especificada.
 */
export const createApiKey = (req: Request, res: Response): void => {
  const { durationInHours } = req.body;

  // Verifica se o parâmetro durationInHours é válido
  if (!durationInHours || typeof durationInHours !== "number" || durationInHours <= 0) {
    res.status(400).json({ error: "Invalid or missing durationInHours" });
    return;
  }

  try {
    const apiKey = generateApiKey(durationInHours);
    const expiresAt = new Date(Date.now() + durationInHours * 60 * 60 * 1000);

    res.json({
      apiKey,
      durationInHours,
      expiresAt,
    });
  } catch (error) {
    console.error("Error generating API Key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
