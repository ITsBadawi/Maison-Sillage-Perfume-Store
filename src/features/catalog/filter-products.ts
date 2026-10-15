import type {CatalogFilters, CatalogProduct, Locale} from './types';

export function filterProducts(
  products: CatalogProduct[],
  filters: CatalogFilters,
  locale: Locale,
): CatalogProduct[] {
  const normalize = (value: string) => value.toLocaleLowerCase(locale).normalize('NFKC').replace(/\p{M}/gu, '');
  const query = normalize(filters.query?.trim() ?? '');

  return products.filter((product) => {
    if (filters.category && product.category?.slug !== filters.category) return false;
    if (filters.family && product.family !== filters.family) return false;
    if (filters.season && !product.seasons.includes(filters.season)) return false;
    if (filters.occasion && !product.occasions.includes(filters.occasion)) return false;
    if (filters.gender && product.gender !== filters.gender) return false;
    if (filters.availability === 'available' && !product.inStock) return false;
    if (filters.availability === 'unavailable' && product.inStock) return false;
    const lowestPrice = product.variants.reduce<bigint | null>((lowest, variant) => {
      const price = BigInt(variant.price_minor);
      return lowest === null || price < lowest ? price : lowest;
    }, null);
    if ((filters.minPrice || filters.maxPrice) && lowestPrice === null) return false;
    if (filters.minPrice && lowestPrice !== null && lowestPrice < BigInt(filters.minPrice) * BigInt(1000)) return false;
    if (filters.maxPrice && lowestPrice !== null && lowestPrice > BigInt(filters.maxPrice) * BigInt(1000)) return false;
    if (!query) return true;

    const searchable = normalize([product.brand, product.name_ar, product.name_en, product.family].join(' '));
    return searchable.includes(query);
  });
}
