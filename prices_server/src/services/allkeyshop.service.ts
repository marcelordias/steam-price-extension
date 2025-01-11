import { AllkeyshopService } from "allkeyshop-api";

export const createAllkeyshopService = (currency: string, platform: string) => {
  return new AllkeyshopService({ currency, platform });
};
