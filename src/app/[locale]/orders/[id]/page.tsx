import {notFound} from 'next/navigation';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {getOrder, CheckoutError} from '@/features/checkout/service.server';
import {formatMoneyMinor} from '@/features/catalog/format-price';

export default async function OrderPage({params}: {params: Promise<{id: string; locale: 'ar'|'en'}>}) {
  const {id, locale} = await params;
  let order;
  try { order = await getOrder(id); } catch (error) { if (error instanceof CheckoutError) notFound(); throw error; }
  const t = await getTranslations({locale, namespace: 'orders'});
  const title = locale === 'ar' ? 'name_ar_snapshot' : 'name_en_snapshot';
  return <main className="commerce-page">
    <p className="eyebrow">MAISON SILLAGE</p><h1>{t('title')}</h1>
    <section className="order-card"><p className="order-number">{t('status')}: {t(order.status as 'new'|'confirmed'|'preparing'|'shipped'|'delivered'|'cancelled'|'returned')}</p><h2>{order.public_number}</h2>
      <p>{order.payment_method === 'cod' ? (locale === 'ar' ? 'الدفع نقدًا عند الاستلام' : 'Cash on delivery') : order.payment_method}</p>
      <div className="cart-lines">{order.items?.map((item, index) => <div className="summary-line" key={`${item.sku_snapshot}-${index}`}><span>{item[title]} × {item.quantity}</span><span>{formatMoneyMinor(String(item.line_total_minor), locale, order.currency_code, order.currency_exponent)}</span></div>)}</div>
      <div className="summary-line summary-grand"><span>{locale === 'ar' ? 'الإجمالي عند الاستلام' : 'Due on delivery'}</span><strong>{formatMoneyMinor(String(order.total_minor), locale, order.currency_code, order.currency_exponent)}</strong></div>
    </section>
    <Link className="text-link" href="/account">{t('back')}</Link>
  </main>;
}
