import Image from 'next/image';
import {Link} from '@/i18n/navigation';
import {useTranslations} from 'next-intl';
import type {CatalogProduct, Locale} from '@/features/catalog/types';
import {getProductText} from '@/features/catalog/queries';
import {ProductPurchaseAction} from './product-purchase-action';
import {FavoriteAction} from './favorite-action';
import {formatCatalogPrice} from '@/features/catalog/format-price';
import {bypassLocalImageOptimization} from '@/features/catalog/image-optimization';

const familyArabic: Record<string, string> = {
  'amber floral':'عنبر زهري', 'woody green':'خشبي أخضر', 'floral chypre':'زهري شيبر', 'woody spicy':'خشبي متبّل',
  'citrus aquatic':'حمضيات مائية', 'leather spicy':'جلدي متبّل', 'musky floral':'زهري مسكي', 'gourmand amber':'عنبر حلو',
  'white floral':'زهور بيضاء', 'oud woody':'عود وأخشاب', 'aromatic green':'أخضر عطري', 'powdery woody':'خشبي بودري',
  'woody aromatic':'خشبي عطري', 'fruity amber':'عنبر فاكهي', 'citrus floral':'حمضيات وزهور', 'spicy woody':'خشبي متبّل',
  'floral spicy':'زهري متبّل', 'fruity leather':'فاكهي جلدي', 'aquatic woody':'مائي خشبي', 'woody gourmand':'خشبي حلو',
  'aromatic fougere':'فوچير عطري', 'floral fruity':'زهري فاكهي', 'green citrus':'حمضيات خضراء',
};

export function ProductDetails({product, locale}: {product: CatalogProduct; locale: Locale}) {
  const t = useTranslations('catalog');
  const text = getProductText(product, locale);
  const noteLayers = [
    ['top', 'topNotes'], ['heart', 'heartNotes'], ['base', 'baseNotes'],
  ] as const;
  const layers = noteLayers.map(([layer, label]) => ({label: t(label), notes: product.notes.filter((note) => note.layer === layer)}));
  const longevity = product.longevity_hours_min === null ? '—' : `${product.longevity_hours_min}–${product.longevity_hours_max ?? product.longevity_hours_min} ${locale === 'ar' ? 'س' : 'h'}`;
  const projection = product.projection === null ? '—' : `${product.projection}/5`;
  const family = locale === 'ar' ? familyArabic[product.family] ?? product.family : product.family;
  const gender = product.category ? (locale === 'ar' ? product.category.name_ar : product.category.name_en) : '—';
  const seasons = product.seasons.map((term) => t(`terms.${term}`)).join(' · ');
  const occasions = product.occasions.map((term) => t(`terms.${term}`)).join(' · ');

  return <main className="product-page">
    <Link href="/shop" className="catalog-back">← {t('backToShop')}</Link>
    <div className="product-detail-layout">
      <div className="product-detail-image"><Image src={product.image} alt={text.alt} fill sizes="(max-width: 760px) 92vw, 52vw" priority unoptimized={bypassLocalImageOptimization(product.image)} /></div>
      <section className="product-detail-copy">
        <p className="eyebrow">{product.brand}{text.category ? ` · ${text.category}` : ''}</p>
        <h1>{text.name}</h1>
        <p className="product-description">{text.description}</p>
        <FavoriteAction productId={product.id} initialFavorite={product.isFavorite} returnTo={`/products/${product.slug}`} />
        <div className="product-price-line"><strong>{product.variants[0] ? formatCatalogPrice(product.variants[0].price_minor, locale) : '—'}</strong><span>{product.inStock ? t('inStock') : t('outOfStock')}</span></div>
        <div className="variant-list" aria-label={t('size')}>
          {product.variants.map((variant) => <div className="variant-row" key={variant.id}><span>{variant.size_ml} ml</span><strong>{formatCatalogPrice(variant.price_minor, locale)}</strong></div>)}
        </div>
        <ProductPurchaseAction variants={product.variants} inStock={product.inStock} />
        <dl className="product-attributes">
          <div><dt>{t('concentration')}</dt><dd>{product.concentration}</dd></div>
          <div><dt>{t('longevity')}</dt><dd>{longevity}</dd></div>
          <div><dt>{t('projection')}</dt><dd>{projection}</dd></div>
          <div><dt>{t('family')}</dt><dd>{family}</dd></div>
          <div><dt>{t('gender')}</dt><dd>{gender}</dd></div>
          <div><dt>{t('seasons')}</dt><dd>{seasons || '—'}</dd></div>
          <div><dt>{t('occasions')}</dt><dd>{occasions || '—'}</dd></div>
        </dl>
        <section className="note-pyramid" aria-labelledby="notes-heading">
          <h2 id="notes-heading">{t('notes')}</h2>
          {layers.map(({label, notes}) => <div className="note-layer" key={label}><h3>{label}</h3><p>{notes.map((note) => locale === 'ar' ? note.name_ar : note.name_en).join(' · ') || '—'}</p></div>)}
        </section>
      </section>
    </div>
  </main>;
}
