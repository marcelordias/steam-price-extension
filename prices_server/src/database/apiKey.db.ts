interface ApiKeyRecord {
  apiKey: string;
  clientId?: string;
  createdAt: Date;
  expiresAt: Date;
}

const apiKeyStore: ApiKeyRecord[] = [];

/**
 * Adiciona uma nova API Key com duração especificada.
 */
export const addApiKey = (apiKey: string, durationInHours: number): ApiKeyRecord => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationInHours * 60 * 60 * 1000);
  const record: ApiKeyRecord = { apiKey, createdAt: now, expiresAt };
  apiKeyStore.push(record);
  return record;
};

/**
 * Vincula um identificador único (clientId) a uma API Key.
 */
export const bindClientId = (apiKey: string, clientId: string): boolean => {
  const record = getApiKey(apiKey);
  if (record && !record.clientId) {
    record.clientId = clientId;
    return true;
  }
  return false;
};

/**
 * Recupera um registro pelo valor da API Key.
 */
export const getApiKey = (apiKey: string): ApiKeyRecord | undefined => {
  return apiKeyStore.find((record) => record.apiKey === apiKey);
};

/**
 * Valida se uma API Key é válida, vinculada ao clientId correto e não expirou.
 */
export const validateApiKey = (apiKey: string, clientId: string): boolean => {
  const record = getApiKey(apiKey);

  if (!record) return false;
  if (record.clientId !== clientId) return false;

  const now = new Date();
  return record.expiresAt > now;
};
