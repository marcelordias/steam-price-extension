import express from "express";
import { corsMiddleware } from "./config/cors";
import { loggerMiddleware } from "./config/logger";
import { errorHandlerMiddleware } from "./middlewares/errorHandler.middleware";
import routes from "./routes";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(corsMiddleware);

app.use(express.json());

app.use(loggerMiddleware);

app.use(routes);

app.use(errorHandlerMiddleware);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
