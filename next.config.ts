import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageOrigin = supabaseUrl ? new URL(supabaseUrl) : null;

export default withNextIntl({
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: storageOrigin ? [{
      protocol: storageOrigin.protocol.slice(0, -1) as 'http' | 'https',
      hostname: storageOrigin.hostname,
      port: storageOrigin.port,
      pathname: '/storage/v1/object/public/catalog-images/**',
    }] : [],
  },
});
