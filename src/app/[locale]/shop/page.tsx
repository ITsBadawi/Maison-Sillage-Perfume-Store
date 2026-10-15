import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import type {Locale} from '@/features/catalog/types';
import {filterProducts} from '@/features/catalog/filter-products';
import {getCatalog} from '@/features/catalog/queries';
import {ProductGrid} from '@/components/catalog/product-grid';

type Props = {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>};

const arabicTerms: Record<string, string> = {
  amber:'عنبري', aquatic:'مائي', aromatic:'عطري', chypre:'شيبر', citrus:'حمضي', floral:'زهري', fougere:'فوجير', fruity:'فاكهي', gourmand:'حلو', green:'أخضر', leather:'جلدي', musky:'مسكي', oud:'عود', powdery:'بودري', spicy:'متبل', white:'أبيض', woody:'خشبي',
  men:'رجالي', women:'نسائي', unisex:'للجميع', spring:'الربيع', summer:'الصيف', autumn:'الخريف', winter:'الشتاء', day:'نهاري', evening:'مسائي', occasion:'مناسبات', office:'العمل', travel:'السفر',
};
function termLabel(value: string, locale: string) {
  return locale === 'ar' ? value.split(' ').map((part) => arabicTerms[part] ?? part).join(' ') : value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function scalar(value: string | string[] | undefined) { return typeof value === 'string' ? value : ''; }

export default async function ShopPage({params, searchParams}: Props) {
  const [{locale}, filters] = await Promise.all([params, searchParams]);
  const t = await getTranslations({locale, namespace:'catalog'});
  const catalog = await getCatalog();
  const query = scalar(filters.q);
  const category = scalar(filters.category);
  const availability = filters.availability === 'available' || filters.availability === 'unavailable' ? filters.availability : '';
  const family = scalar(filters.family), season = scalar(filters.season), occasion = scalar(filters.occasion), gender = scalar(filters.gender);
  const minPrice = /^\d{1,9}$/.test(scalar(filters.minPrice)) ? scalar(filters.minPrice) : '';
  const maxPrice = /^\d{1,9}$/.test(scalar(filters.maxPrice)) ? scalar(filters.maxPrice) : '';
  const products = filterProducts(catalog.products, {query, category, availability, family, season, occasion, gender, minPrice, maxPrice}, locale as Locale);
  const options = {
    family: [...new Set(catalog.products.map((product) => product.family))].sort(),
    season: [...new Set(catalog.products.flatMap((product) => product.seasons))].sort(),
    occasion: [...new Set(catalog.products.flatMap((product) => product.occasions))].sort(),
    gender: [...new Set(catalog.products.map((product) => product.gender))].sort(),
  };

  return <main className="catalog-page">
    <section className="catalog-heading"><p className="eyebrow">{t('eyebrow')}</p><h1>{t('title')}</h1><p>{t('intro')}</p></section>
    <form className="catalog-filters" action="">
      <label>{t('searchLabel')}<input type="search" name="q" defaultValue={query} placeholder={t('searchPlaceholder')} /></label>
      <label>{t('categoryLabel')}<select name="category" defaultValue={category}><option value="">{t('allCategories')}</option>{catalog.categories.map((item) => <option key={item.slug} value={item.slug}>{locale === 'ar' ? item.name_ar : item.name_en}</option>)}</select></label>
      <label>{t('availabilityLabel')}<select name="availability" defaultValue={availability}><option value="">{t('anyAvailability')}</option><option value="available">{t('availableOnly')}</option><option value="unavailable">{t('unavailableOnly')}</option></select></label>
      {(['family', 'season', 'occasion', 'gender'] as const).map((field) => <label key={field}>{t(`${field}Filter`)}<select name={field} defaultValue={{family, season, occasion, gender}[field]}><option value="">{t('anyFilter')}</option>{options[field].map((value) => <option key={value} value={value}>{termLabel(value, locale)}</option>)}</select></label>)}
      <label>{t('minPrice')}<input type="number" name="minPrice" min="0" inputMode="numeric" defaultValue={minPrice} /></label>
      <label>{t('maxPrice')}<input type="number" name="maxPrice" min="0" inputMode="numeric" defaultValue={maxPrice} /></label>
      <button type="submit" className="button button-dark">{t('applyFilters')}</button>
      <Link className="catalog-reset" href="/shop">{t('resetFilters')}</Link>
    </form>
    {catalog.status === 'unconfigured' ? <section className="catalog-state"><h2>{t('unconfigured')}</h2><p>{t('unconfiguredBody')}</p></section> : null}
    {catalog.status === 'error' ? <section className="catalog-state" role="alert"><h2>{t('loadError')}</h2><p>{t('loadErrorBody')}</p></section> : null}
    {catalog.status === 'ok' && <>
      <p className="catalog-result-count" aria-live="polite">{t('resultCount', {count: products.length})}</p>
      {products.length ? <ProductGrid products={products} locale={locale as Locale} /> : <section className="catalog-state"><h2>{t('noResults')}</h2><p>{t('noResultsBody')}</p></section>}
    </>}
    <Link href="/" className="catalog-home-link">{t('homeLink')}</Link>
  </main>;
}
