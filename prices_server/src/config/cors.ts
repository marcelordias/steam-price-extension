import cors from "cors";

export const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
};

export const corsMiddleware = cors(corsOptions);
