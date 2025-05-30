import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: process.env.PORT ?? 3000,
  DEFAULT_CURRENCY: process.env.CURRENCY ?? "eur",
  DEFAULT_PLATFORM: process.env.PLATFORM ?? "pc",
};
