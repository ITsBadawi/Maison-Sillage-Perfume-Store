export function bypassLocalImageOptimization(source: string): boolean {
  try {
    const url = new URL(source);
    return (url.hostname === '127.0.0.1' || url.hostname === 'localhost')
      && url.pathname.startsWith('/storage/v1/object/public/catalog-images/');
  } catch {
    return false;
  }
}
