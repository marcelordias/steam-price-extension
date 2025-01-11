import cors from "cors";

export const corsOptions = {
  origin: "*", // Configuração de origem
  methods: ["GET", "POST"],
};

export const corsMiddleware = cors(corsOptions);
