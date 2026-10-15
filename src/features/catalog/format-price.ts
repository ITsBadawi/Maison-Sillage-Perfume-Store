import type {Locale} from './types';

export function formatCatalogPrice(minor: string, locale: Locale): string {
  return formatMoneyMinor(minor, locale, 'IQD', 3);
}

export function formatMoneyMinor(minor: string, locale: Locale, currency: string, exponent: number): string {
  if (!/^[A-Z]{3}$/.test(currency) || !Number.isInteger(exponent) || exponent < 0 || exponent > 9) throw new RangeError('Invalid currency');
  const value = BigInt(minor);
  const divisor = BigInt(10) ** BigInt(exponent);
  const major = value / divisor;
  const fraction = value % divisor;
  const formatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-IQ' : 'en-IQ', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
  const parts = formatter.formatToParts(major);
  if (fraction === BigInt('0')) return parts.map(({value: part}) => part).join('');

  const decimal = new Intl.NumberFormat(locale === 'ar' ? 'ar-IQ' : 'en-IQ')
    .formatToParts(1.1).find(({type}) => type === 'decimal')?.value ?? '.';
  const digits = new Intl.NumberFormat(locale === 'ar' ? 'ar-IQ' : 'en-IQ', {
    minimumIntegerDigits: exponent, useGrouping: false,
  }).format(Number(fraction));
  let insertAt = -1;
  parts.forEach(({type}, index) => {
    if (type === 'integer' || type === 'group') insertAt = index + 1;
  });
  parts.splice(insertAt, 0, {type: 'decimal', value: decimal}, {type: 'fraction', value: digits});
  return parts.map(({value: part}) => part).join('');
}
