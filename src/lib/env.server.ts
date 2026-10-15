import 'server-only';
import {z} from 'zod';

const serverEnvSchema = z.object({
  APP_ENV: z.enum(['local', 'demo', 'production']).default('local'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.preprocess((value) => value === '' ? undefined : value, z.string().default('gemini-2.5-flash')),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  QUOTE_SIGNING_SECRET: z.string().min(32).optional(),
  RATE_LIMIT_SALT: z.string().min(32).optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}
