export const isValidOffer = (offer: any, filterOptions: any): boolean => {
  const { price, merchantName, edition, region } = offer;

  if (
    filterOptions?.priceRange &&
    (price < filterOptions.priceRange.min || price > filterOptions.priceRange.max)
  ) {
    return false;
  }

  if (
    filterOptions?.stores?.length &&
    !filterOptions.stores.includes(merchantName.toLowerCase())
  ) {
    return false;
  }

  if (
    filterOptions?.editions?.length &&
    !filterOptions.editions.includes(edition.toLowerCase())
  ) {
    return false;
  }

  if (
    filterOptions?.regions?.length &&
    !filterOptions.regions.includes(region.toLowerCase())
  ) {
    return false;
  }

  return true;
};

export const formatPrice = (price: number): string =>
  price.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
