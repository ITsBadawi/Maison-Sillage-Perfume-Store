import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getProduct, getProductText} from '@/features/catalog/queries';
import type {Locale} from '@/features/catalog/types';
import {ProductDetails} from '@/components/catalog/product-details';

type Props = {params: Promise<{locale: string; slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, slug} = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  const text = getProductText(product, locale as Locale);
  return {title: `${text.name} | Maison Sillage`, description: text.shortDescription};
}

export default async function ProductPage({params}: Props) {
  const {locale, slug} = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  return <ProductDetails product={product} locale={locale as Locale} />;
}
