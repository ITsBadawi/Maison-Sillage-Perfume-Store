export function safeReturnTo(value: string | null | undefined, locale: 'ar' | 'en'): string {
  const fallback = `/${locale}/account`;
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, 'https://maison.invalid');
    if (url.origin !== 'https://maison.invalid') return fallback;
    if (url.pathname !== `/${locale}` && !url.pathname.startsWith(`/${locale}/`)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
