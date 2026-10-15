import {ProductCard} from './product-card';
import type {CatalogProduct, Locale} from '@/features/catalog/types';

export function ProductGrid({products, locale}: {products: CatalogProduct[]; locale: Locale}) {
  return <div className="catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product} locale={locale} />)}</div>;
}
