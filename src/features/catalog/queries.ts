import 'server-only';

import {createSupabaseServerClient} from '@/lib/supabase/server';
import {getCurrentUser} from '@/lib/auth/current-user';
import {minorUnitString} from './minor-units';
import type {CatalogCategory, CatalogNote, CatalogProduct, CatalogVariant, Locale} from './types';

type CatalogResult = {products: CatalogProduct[]; categories: CatalogCategory[]; status: 'ok' | 'unconfigured' | 'error'};
type RawProduct = Omit<CatalogProduct, 'category' | 'image' | 'alt_ar' | 'alt_en' | 'notes' | 'variants' | 'inStock'> & {
  category: CatalogCategory | CatalogCategory[] | null;
  product_images: {storage_path: string; alt_ar: string; alt_en: string; sort_order: number}[];
  product_notes: {layer: CatalogNote['layer']; note: {name_ar: string; name_en: string} | null}[];
  product_variants: {id: string; size_ml: number | string; price_minor: number | string; compare_at_minor: number | string | null; active: boolean}[];
};

const productColumns = `id,slug,brand,name_ar,name_en,short_description_ar,short_description_en,description_ar,description_en,gender,family,seasons,occasions,concentration,longevity_hours_min,longevity_hours_max,projection,featured,category:categories(slug,name_ar,name_en),product_images(storage_path,alt_ar,alt_en,sort_order),product_notes(layer,note:fragrance_notes(name_ar,name_en)),product_variants(id,size_ml,price_minor,compare_at_minor,active)`;

function mapProduct(row: RawProduct, availability: Map<string, boolean>, isFavorite = false, imageUrl?: (path: string) => string): CatalogProduct {
  const {product_images, product_notes, product_variants, category, ...fields} = row;
  const imageRow = [...product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
  const notes: CatalogNote[] = product_notes.map((item) => ({
    layer: item.layer,
    name_ar: item.note?.name_ar ?? '',
    name_en: item.note?.name_en ?? '',
  }));
  const variants: CatalogVariant[] = product_variants
    .filter((variant) => variant.active)
    .sort((a, b) => Number(a.size_ml) - Number(b.size_ml))
    .map((variant) => ({
      id: variant.id,
      size_ml: Number(variant.size_ml),
      price_minor: minorUnitString(variant.price_minor),
      compare_at_minor: variant.compare_at_minor === null ? null : minorUnitString(variant.compare_at_minor),
    }));

  return {
    ...fields,
    category: Array.isArray(category) ? category[0] ?? null : category,
    image: imageRow?.storage_path ? imageUrl?.(imageRow.storage_path) ?? `/${imageRow.storage_path.replace(/^\/+/, '')}` : '/assets/products/amber-veil.svg',
    alt_ar: imageRow?.alt_ar || fields.name_ar,
    alt_en: imageRow?.alt_en || fields.name_en,
    notes,
    variants,
    inStock: availability.get(fields.id) ?? false,
    isFavorite,
  } satisfies CatalogProduct;
}

export async function getCatalog(): Promise<CatalogResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return {products: [], categories: [], status: 'unconfigured'};

  const [productsResult, categoriesResult, availabilityResult] = await Promise.all([
    supabase.from('products').select(productColumns).eq('status', 'published').order('priority', {ascending: false}).order('name_en'),
    supabase.from('categories').select('slug,name_ar,name_en').eq('active', true).order('sort_order'),
    supabase.rpc('catalog_availability'),
  ]);

  if (productsResult.error || categoriesResult.error || availabilityResult.error) {
    return {products: [], categories: [], status: 'error'};
  }

  const availability = new Map<string, boolean>(
    (availabilityResult.data ?? []).map((row: {product_id: string; in_stock: boolean}) => [row.product_id, row.in_stock]),
  );
  return {
    products: (productsResult.data ?? []).map((row) => mapProduct(row as unknown as RawProduct, availability, false, (path) => path.startsWith('assets/') ? `/${path}` : supabase.storage.from('catalog-images').getPublicUrl(path).data.publicUrl)),
    categories: (categoriesResult.data ?? []) as CatalogCategory[],
    status: 'ok',
  };
}

export async function getProduct(slug: string): Promise<CatalogProduct | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const [productResult, availabilityResult, user] = await Promise.all([
    supabase.from('products').select(productColumns).eq('slug', slug).eq('status', 'published').maybeSingle(),
    supabase.rpc('catalog_availability'),
    getCurrentUser(),
  ]);

  if (productResult.error || availabilityResult.error || !productResult.data) return null;
  const favoriteResult = user
    ? await supabase.from('favorites').select('product_id').eq('user_id', user.id).eq('product_id', productResult.data.id).maybeSingle()
    : null;
  if (favoriteResult?.error) return null;
  const availability = new Map<string, boolean>(
    (availabilityResult.data ?? []).map((row: {product_id: string; in_stock: boolean}) => [row.product_id, row.in_stock]),
  );
  return mapProduct(productResult.data as unknown as RawProduct, availability, Boolean(favoriteResult?.data), (path) => path.startsWith('assets/') ? `/${path}` : supabase.storage.from('catalog-images').getPublicUrl(path).data.publicUrl);
}

export function getProductText(product: CatalogProduct, locale: Locale) {
  return {
    name: locale === 'ar' ? product.name_ar : product.name_en,
    shortDescription: locale === 'ar' ? product.short_description_ar : product.short_description_en,
    description: locale === 'ar' ? product.description_ar : product.description_en,
    alt: locale === 'ar' ? product.alt_ar : product.alt_en,
    category: locale === 'ar' ? product.category?.name_ar : product.category?.name_en,
  };
}
