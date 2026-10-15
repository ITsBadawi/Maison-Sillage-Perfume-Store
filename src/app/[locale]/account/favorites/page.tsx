import {redirect} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {AccountNav} from '@/components/account/account-nav';
import {getCurrentUser} from '@/lib/auth/current-user';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {FavoriteAction} from '@/components/catalog/favorite-action';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default async function FavoritesPage({params}: {params: Promise<{locale: 'ar' | 'en'}>}) {
  const {locale} = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/auth/login?returnTo=${encodeURIComponent(`/${locale}/account/favorites`)}`);
  const t = await getTranslations({locale, namespace: 'account'});
  const client = await createSupabaseServerClient();
  const {data: favorites, error} = await client!.from('favorites')
    .select('product_id,products(slug,name_ar,name_en)').eq('user_id', user.id);
  return <main className="account-page"><AccountNav /><h1>{t('favorites')}</h1>
    {error ? <p role="alert">{t('loadError')}</p>
      : !favorites?.length ? <p>{t('emptyFavorites')}</p>
      : <ul className="account-list">{favorites.map((favorite) => {
        const product = Array.isArray(favorite.products) ? favorite.products[0] : favorite.products;
        return product && <li key={favorite.product_id}><Link href={`/products/${product.slug}`}>{locale === 'ar' ? product.name_ar : product.name_en}</Link><FavoriteAction productId={favorite.product_id} initialFavorite returnTo={`/${locale}/account/favorites`} /></li>;
      })}</ul>}
  </main>;
}
