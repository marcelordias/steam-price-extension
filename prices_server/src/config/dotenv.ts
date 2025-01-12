import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT ?? 3000,
  DEFAULT_CURRENCY: process.env.CURRENCY ?? "eur",
  DEFAULT_PLATFORM: process.env.PLATFORM ?? "pc",
  ADMIN_KEY: process.env.ADMIN_KEY ?? "my-secure-admin-key",
  ADMIN_CLIENT_ID: process.env.ADMIN_CLIENT_ID ?? "my-secure-client-id",
};
