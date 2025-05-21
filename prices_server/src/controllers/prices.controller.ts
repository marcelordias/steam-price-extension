import { Request, Response } from "express";
import { AllkeyshopService } from "allkeyshop-api";
import { isValidOffer } from "../utils/validate.util";
import { formatPrice } from "../utils/format.util";
import { getPriceAsNumber } from "../utils/price.util";

export const getPrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gameTitle, filterOptions } = req.body;

    const options = {
      currency: filterOptions?.currency ?? "eur",
      platform: filterOptions?.platform ?? "pc",
    };

    const allkeyshopService = new AllkeyshopService(options);

    const result = await allkeyshopService.search(gameTitle);

    if (!result.success) {
      res.status(404).json({ error: "Game not found" });
      return;
    }

    const { offers, editions, merchants, regions } = result;

    const filteredOffers = offers
      .slice()
      .sort(
        (a, b) =>
          (b.price as any)[options.currency].priceWithoutCoupon -
          (a.price as any)[options.currency].priceWithoutCoupon
      )
      .filter((offer) => {
        const store = merchants[offer.merchant];
        const edition = editions[offer.edition];
        const region = regions[offer.region];
        const price = (offer.price as any)[options.currency].priceWithoutCoupon;

        return isValidOffer({
          store: store?.name,
          price,
          edition: edition?.name,
          region: region?.name,
          filterOptions,
        });
      })
      .map((offer) => ({
        id: offer.id.toString(),
        price: (offer.price as any)[options.currency],
        merchantName: merchants[offer.merchant]?.name,
        edition: editions[offer.edition]?.name,
        region: regions[offer.region]?.name,
        platform: offer.platform,
        redirectUrl: `https://www.allkeyshop.com/redirection/offer/eur/${offer.id}?locale=en&merchant=${offer.merchant}`,
      }));

    const groupedOffers = Object.values(
      filteredOffers.reduce((acc: any, offer: any) => {
        const { merchantName } = offer;

        const isCheapestOffer =
          !acc[merchantName]?.cheapestOffer?.price?.priceWithoutCoupon ||
          getPriceAsNumber(
            acc[merchantName]?.cheapestOffer?.price?.priceWithoutCoupon
          ) > getPriceAsNumber(offer.price.priceWithoutCoupon);

        if (!acc[merchantName] || isCheapestOffer) {
          acc[merchantName] = {
            merchantName,
            cheapestOffer: {
              id: offer.id,
              price: {
                ...offer.price,
                priceCard: formatPrice(offer.price.priceCard),
                pricePaypal: formatPrice(offer.price.pricePaypal),
                price: formatPrice(offer.price.price),
                priceWithoutCoupon: formatPrice(offer.price.priceWithoutCoupon),
                priceWithoutCouponNumeric: parseFloat(
                  offer.price.priceWithoutCoupon
                ),
              },
              edition: offer.edition,
              region: offer.region,
              platform: offer.platform,
              redirectUrl: offer.redirectUrl,
            },
          };
        }

        return acc;
      }, {} as Record<string, any>)
    ).sort(
      (a: any, b: any) =>
        b.cheapestOffer.price.priceWithoutCouponNumeric -
        a.cheapestOffer.price.priceWithoutCouponNumeric
    );

    res.json(groupedOffers);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
