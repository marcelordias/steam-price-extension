import express, { Request, Response } from "express";
import { AllkeyshopService } from "allkeyshop-api";

const options = {
  currency: "eur",
  platform: "pc",
};
const allkeyshopService = new AllkeyshopService(options);

// Inicializa o servidor Express
const app = express();
const PORT = 3000;

// Middleware para interpretar JSON
app.use(express.json());

// Endpoint para executar código
app.get("/game?:name", async (req: Request, res: Response) => {
  const { name } = req.query;

  await allkeyshopService
    .search(name as string)
    .then((result) => {
      const { offers, editions, merchants, regions, success } = result;

      if (!success) {
        res.send("Jogo não encontrado");
      }

      // Group and find best offers per merchant
      let bestOffersByMerchant = offers
        // First sort all offers by price
        .slice()
        .sort((a, b) => a.price.eur.price - b.price.eur.price)
        // Group by merchant and take first (cheapest) offer for each
        .reduce(
          (acc, offer) => {
            const merchantName = merchants[offer.merchant]?.name;

            if (
              merchantName &&
              (merchantName === "Eneba" || merchantName === "Instant Gaming") &&
              !acc[merchantName]
            ) {
              const merchant = merchants[offer.merchant];
              const region = regions[offer.region];
              const edition = editions[offer.edition];

              acc[merchantName] = {
                ...offer,
                edition: edition,
                merchant: merchant,
                region: region,
                redirectUrl: `https://www.allkeyshop.com/redirection/offer/eur/${offer.id}?locale=en&merchant=${merchant.id}`,
              } as any;
            }
            return acc;
          },
          {} as Record<
            string,
            (typeof offers)[0] & {
              edition: (typeof editions)[string];
              merchant: (typeof merchants)[string];
              region: (typeof regions)[string];
            }
          >
        );

      // Convert to array
      res.send(bestOffersByMerchant);
    })
    .catch((err) => {
      res.send(err);
    });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
