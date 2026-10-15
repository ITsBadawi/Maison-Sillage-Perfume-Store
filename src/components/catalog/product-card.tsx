import Image from 'next/image';
import {Link} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import type {CatalogProduct, Locale} from '@/features/catalog/types';
import {getProductText} from '@/features/catalog/queries';
import {formatCatalogPrice} from '@/features/catalog/format-price';
import {bypassLocalImageOptimization} from '@/features/catalog/image-optimization';

export function ProductCard({product, locale}: {product: CatalogProduct; locale: Locale}) {
  const t = useTranslations('catalog');
  const text = getProductText(product, locale);
  const firstPrice = product.variants[0]?.price_minor;

  return <article className="catalog-card">
    <Link href={`/products/${product.slug}`} className="catalog-card-image" aria-label={`${t('viewProduct')}: ${text.name}`}>
      <Image src={product.image} alt={text.alt} fill sizes="(max-width: 640px) 88vw, (max-width: 980px) 44vw, 25vw" unoptimized={bypassLocalImageOptimization(product.image)} />
      {product.featured && <span className="catalog-featured">{t('featured')}</span>}
    </Link>
    <div className="catalog-card-copy">
      <p className="catalog-card-brand">{product.brand}</p>
      <h2><Link href={`/products/${product.slug}`}>{text.name}</Link></h2>
      <p className="catalog-card-description">{text.shortDescription}</p>
      <div className="catalog-card-bottom">
        <span>{firstPrice === undefined ? '—' : `${t('from')} ${formatCatalogPrice(firstPrice, locale)}`}</span>
        <span className={product.inStock ? 'stock-in' : 'stock-out'}>{product.inStock ? t('inStock') : t('outOfStock')}</span>
      </div>
    </div>
  </article>;
}
