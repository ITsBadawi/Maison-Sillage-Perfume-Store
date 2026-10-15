import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireAdmin} from '@/features/admin/http.server';
import {isSameOrigin} from '@/lib/security/same-origin';

const settingsSchema = z.object({enabled: z.union([z.boolean(), z.enum(['true','false'])]).transform((v) => v === true || v === 'true'), chatId: z.string().max(120), includeCustomerDetails: z.union([z.boolean(), z.enum(['true','false'])]).transform((v) => v === true || v === 'true')});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error: 'INVALID_ORIGIN'}, {status: 403});
  const access = await requireAdmin(['manager']);
  if ('response' in access) return access.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({error: 'INVALID_JSON'}, {status: 400}); }
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error: 'INVALID_SETTINGS'}, {status: 400});
  const {data, error} = await access.supabase.rpc('admin_update_telegram_settings', {
    p_enabled: parsed.data.enabled, p_chat_id: parsed.data.chatId,
    p_include_customer_details: parsed.data.includeCustomerDetails,
  });
  if (error) return NextResponse.json({error: error.message}, {status: error.code === '42501' ? 403 : 400});
  return NextResponse.json(data);
}
