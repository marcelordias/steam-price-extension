export const formatPrice = (price: number): string => {
    return price.toLocaleString("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };
  