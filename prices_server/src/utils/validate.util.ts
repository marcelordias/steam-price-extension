export const normalizeString = (str: string): string =>
  str?.toLowerCase().trim() ?? "";

export const validateGameTitle = (gameTitle: string): string | null => {
  if (!gameTitle || typeof gameTitle !== "string" || gameTitle.trim() === "") {
    return "Valid game title is required";
  }
  return null;
};

export const isValidOffer = ({
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
  filterOptions?: {
    stores?: string[];
    priceRange?: { min: number; max: number };
    editions?: string[];
    regions?: string[];
  };
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
