import crypto from "crypto";
import { addApiKey, bindClientId, validateApiKey } from "../database/apiKey.db";

/**
 * Gera uma nova API Key com uma duração especificada (em horas).
 */
export const generateApiKey = (durationInHours: number): string => {
  const apiKey = crypto.randomBytes(16).toString("hex");
  addApiKey(apiKey, durationInHours); // Armazena a chave no banco
  return apiKey;
};

/**
 * Vincula o identificador único (clientId) à API Key.
 */
export const registerClientId = (apiKey: string, clientId: string): boolean => {
  return bindClientId(apiKey, clientId); // Vincula o clientId à API Key
};

/**
 * Valida a API Key e verifica seu vínculo com o clientId.
 */
export const isValidApiKey = (apiKey: string, clientId: string): boolean => {
  return validateApiKey(apiKey, clientId); // Valida a chave e o vínculo
};
