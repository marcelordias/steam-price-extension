import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { AllkeyshopService } from "allkeyshop-api";

const app = express();
const PORT = process.env.PORT ?? 3000;

interface GroupedPriceResponse {
  merchantName: string;
  cheapestOffer: {
    id: string;
    price: number;
    edition: string;
    region: string;
    platform: string;
    redirectUrl: string;
  };
}

interface PriceRequest {
  gameTitle: string;
  filterOptions?: {
    priceRange?: { min: number; max: number };
    editions?: string[];
    regions?: string[];
    platform?: string;
    currency?: string;
    stores?: string[];
  };
}

interface PriceResponse {
  id: string;
  price: number;
  merchantName: string;
  edition: string;
  region: string;
  platform: string;
  redirectUrl: string;
}

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    details: err.message,
  });
  next();
});

const formatPrice = (price: number): number => {
  return Number(price.toFixed(2));
};

const normalizeString = (str: string): string =>
  str?.toLowerCase().trim() ?? "";

const validateGameTitle = (gameTitle: string): string | null => {
  if (!gameTitle || typeof gameTitle !== "string" || gameTitle.trim() === "") {
    return "Valid game title is required";
  }
  return null;
};

const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { gameTitle, filterOptions } = req.body as PriceRequest;

  const titleError = validateGameTitle(gameTitle);
  if (titleError) {
    res.status(400).json({ error: titleError });
    return;
  }

  if (filterOptions) {
    if (filterOptions.editions) {
      filterOptions.editions =
        filterOptions.editions.map(normalizeString) ?? [];
    }
    if (filterOptions.regions) {
      filterOptions.regions = filterOptions.regions.map(normalizeString) ?? [];
    }
    if (filterOptions.stores) {
      filterOptions.stores = filterOptions.stores.map(normalizeString) ?? [];
    }
    if (filterOptions.currency) {
      filterOptions.currency = normalizeString(filterOptions.currency);
    }
    if (filterOptions.platform) {
      filterOptions.platform = normalizeString(filterOptions.platform);
    }
  }

  next();
};

const isValidOffer = ({
  store,
  price,
  edition,
  region,

  filterOptions,
}: {
  store: string;
  price: number;
  edition: string;
  region: string;

  filterOptions?: PriceRequest["filterOptions"];
}): boolean => {
  // Normalize all strings
  const normalizedMerchant = normalizeString(store);
  const normalizedEdition = normalizeString(edition);
  const normalizedRegion = normalizeString(region);

  // Validate merchant
  if (
    filterOptions?.stores?.length &&
    !filterOptions.stores.map(normalizeString).includes(normalizedMerchant)
  ) {
    return false;
  }

  // Validate price range
  if (
    filterOptions?.priceRange &&
    (price < filterOptions.priceRange.min ||
      price > filterOptions.priceRange.max)
  ) {
    return false;
  }

  // Validate edition
  if (
    filterOptions?.editions?.length &&
    !filterOptions.editions.map(normalizeString).includes(normalizedEdition)
  ) {
    return false;
  }

  // Validate region
  if (
    filterOptions?.regions?.length &&
    !filterOptions.regions.map(normalizeString).includes(normalizedRegion)
  ) {
    return false;
  }

  return true;
};

app.post(
  "/api/prices",
  validateRequest,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { gameTitle, filterOptions } = req.body as PriceRequest;

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

      const { offers, editions, merchants, regions, success } = result;

      if (!success) {
        res.status(500).json({ error: "Failed to fetch prices" });
        return;
      }

      const filteredOffers: PriceResponse[] = offers
        .slice()
        .sort(
          (a, b) =>
            (a.price as any)[options.currency].price -
            (b.price as any)[options.currency].price
        )
        .filter((offer) => {
          const store = merchants[offer.merchant];
          const edition = editions[offer.edition];
          const region = regions[offer.region];
          const price = (offer.price as any)[options.currency].price;

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

      const groupedOffers: GroupedPriceResponse[] | any = Object.values(
        filteredOffers.reduce((acc: any, offer: any) => {
          const { merchantName } = offer;

          if (
            !acc[merchantName] ||
            acc[merchantName].cheapestOffer.price.price >
              offer.price.price
          ) {
            acc[merchantName] = {
              merchantName,
              cheapestOffer: {
                id: offer.id,
                price: {
                  ...offer.price,
                  priceCard: formatPrice(offer.price.priceCard),
                  pricePaypal: formatPrice(offer.price.pricePaypal),
                  price: formatPrice(offer.price.price),
                },
                edition: offer.edition,
                region: offer.region,
                platform: offer.platform,
                redirectUrl: offer.redirectUrl,
              },
            };
          }

          return acc;
        }, {} as Record<string, GroupedPriceResponse>)
      ).sort(
        (a: any, b: any) =>
          b.cheapestOffer.price.price - a.cheapestOffer.price.price
      );

      res.json(groupedOffers);
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
