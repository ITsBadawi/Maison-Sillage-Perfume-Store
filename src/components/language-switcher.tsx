'use client';

import {useLocale} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextLocale = locale === 'ar' ? 'en' : 'ar';
  return <button className="language-link" type="button" onClick={() => router.replace({pathname, query: Object.fromEntries(searchParams.entries())}, {locale: nextLocale})} aria-label={nextLocale === 'ar' ? 'العربية' : 'English'}>{nextLocale === 'ar' ? 'العربية' : 'English'}</button>;
}
