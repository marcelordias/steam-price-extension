import { Request, Response, NextFunction } from "express";

export const loggerMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
};
