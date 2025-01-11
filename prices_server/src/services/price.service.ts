import { createAllkeyshopService } from "./allkeyshop.service";
import { isValidOffer, formatPrice } from "../utils/price.util";

export const fetchPrices = async (gameTitle: string, filterOptions: any) => {
  const service = createAllkeyshopService(
    filterOptions?.currency || "eur",
    filterOptions?.platform || "pc"
  );

  const result = await service.search(gameTitle);

  if (!result.success) {
    throw new Error("Game not found");
  }

  const { offers, editions, merchants, regions } = result;

  const filteredOffers = offers
    .map((offer) => {
      const price = (offer.price as any)?.eur?.priceWithoutCoupon || 0;
      return {
        id: offer.id.toString(),
        price,
        merchantName: merchants[offer.merchant]?.name || "",
        edition: editions[offer.edition]?.name || "",
        region: regions[offer.region]?.name || "",
        platform: offer.platform,
        redirectUrl: `https://www.allkeyshop.com/redirection/offer/eur/${offer.id}`,
      };
    })
    .filter((offer) => isValidOffer(offer, filterOptions));

  return filteredOffers.sort((a, b) => a.price - b.price).map((offer) => ({
    ...offer,
    priceFormatted: formatPrice(offer.price),
  }));
};
