import { Request, Response, NextFunction } from "express";
import { validateGameTitle, normalizeString } from "../utils/validate.util";

export const validateRequestMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { gameTitle, filterOptions } = req.body;

  const titleError = validateGameTitle(gameTitle);
  if (titleError) {
    res.status(400).json({ error: titleError });
    return;
  }

  if (filterOptions) {
    ["editions", "regions", "stores"].forEach((key) => {
      if (filterOptions[key as keyof typeof filterOptions]) {
        filterOptions[key as keyof typeof filterOptions] = (
          filterOptions[key as keyof typeof filterOptions] as string[]
        ).map(normalizeString);
      }
    });

    if (filterOptions.currency) {
      filterOptions.currency = normalizeString(filterOptions.currency);
    }
    if (filterOptions.platform) {
      filterOptions.platform = normalizeString(filterOptions.platform);
    }
  }

  next();
};
