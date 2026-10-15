import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getTranslations} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {SiteHeader} from '@/components/site-header';
import {IntroChime} from '@/components/intro-chime';
import {getPublicEnv} from '@/lib/env.client';
import {getServerEnv} from '@/lib/env.server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import '../styles/globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'metadata'});
  return {title: t('title'), description: t('description'), robots: getServerEnv().APP_ENV === 'production' ? undefined : {index: false, follow: false}};
}

export default async function LocaleLayout({children, params}: Readonly<{children: React.ReactNode; params: Promise<{locale: string}>}>) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  getPublicEnv();
  const supabase=await createSupabaseServerClient();
  const {data}=supabase?await supabase.rpc('get_public_store_brand'):{data:null};
  const brand=data as {nameAr?:string;nameEn?:string;accentColor?:string}|null;
  const brandName=locale==='ar'?(brand?.nameAr||'ميزون سيلاج'):(brand?.nameEn||'MAISON SILLAGE');
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body style={brand?.accentColor?{'--accent':brand.accentColor} as React.CSSProperties:undefined}><NextIntlClientProvider>
        {getServerEnv().APP_ENV !== 'production' && <p className="demo-notice">{locale === 'ar' ? 'متجر تجريبي — لا تُرسل طلبات حقيقية ولا يوجد شحن فعلي' : 'Demo store — no real orders or shipping'}</p>}
        <SiteHeader brandName={brandName} />{children}<IntroChime />
      </NextIntlClientProvider></body>
    </html>
  );
}
