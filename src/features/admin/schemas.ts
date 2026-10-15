import {z} from 'zod';

export const staffRoles = ['manager', 'orders_manager', 'inventory_manager'] as const;
export type StaffRole = typeof staffRoles[number];

export function hasAnyRole(roles: readonly string[], allowed: readonly StaffRole[]): boolean {
  return roles.some((role) => allowed.includes(role as StaffRole));
}

export const adjustmentSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.coerce.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(250),
  eventKey: z.string().trim().min(8).max(120),
});

export const transitionSchema = z.object({
  toStatus: z.enum(['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned']),
  expectedVersion: z.coerce.number().int().positive(),
  reason: z.string().trim().max(250).default(''),
  confirmCashCollected: z.boolean().default(false),
});

export const productSchema = z.object({
  productId: z.string().uuid().optional(),
  expectedVersion: z.coerce.number().int().positive().optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  brand: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(160),
  nameEn: z.string().trim().min(1).max(160),
  shortDescriptionAr: z.string().max(300).default(''),
  shortDescriptionEn: z.string().max(300).default(''),
  descriptionAr: z.string().max(6000).default(''),
  descriptionEn: z.string().max(6000).default(''),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  categoryId: z.union([z.string().uuid(), z.literal('')]).optional().transform((v) => v || null),
  gender: z.enum(['women', 'men', 'unisex']).default('unisex'),
  family: z.string().trim().max(80).default(''),
  seasons: z.preprocess(parseJsonArray, z.array(z.enum(['spring','summer','autumn','winter'])).max(4)).default([]),
  occasions: z.preprocess(parseJsonArray, z.array(z.enum(['day','night','office','travel','evening'])).max(5)).default([]),
  concentration: z.string().trim().max(60).default(''),
  longevityHoursMin: z.union([z.coerce.number().min(0).max(999), z.literal('')]).optional().transform((v) => v === '' ? null : v),
  longevityHoursMax: z.union([z.coerce.number().min(0).max(999), z.literal('')]).optional().transform((v) => v === '' ? null : v),
  projection: z.union([z.coerce.number().int().min(1).max(5), z.literal('')]).optional().transform((v) => v === '' ? null : v),
  featured: z.boolean().default(false),
  recommendationEnabled: z.boolean().default(false),
  priority: z.coerce.number().int().min(-1000).max(1000).default(0),
  imagePath: z.string().trim().max(500).default(''),
  imageAltAr: z.string().trim().max(250).default(''),
  imageAltEn: z.string().trim().max(250).default(''),
  notes: z.preprocess(parseNotes, z.array(z.object({layer:z.enum(['top','heart','base']),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),nameAr:z.string().trim().min(1).max(100),nameEn:z.string().trim().min(1).max(100)})).max(30)).default([]),
  attributes: z.preprocess(parseJsonObject, z.record(z.string(), z.coerce.number().min(0).max(100))).default({}),
}).superRefine((value, ctx) => {
  if (value.productId && !value.expectedVersion) ctx.addIssue({code: 'custom', path: ['expectedVersion'], message: 'Required for edits'});
  if (value.longevityHoursMin != null && value.longevityHoursMax != null && value.longevityHoursMax < value.longevityHoursMin) ctx.addIssue({code:'custom',path:['longevityHoursMax'],message:'Maximum must be at least minimum'});
  if (value.status === 'published' && Object.keys(value.attributes).length !== 12) ctx.addIssue({code:'custom',path:['attributes'],message:'All scent dimensions are required to publish'});
});

function parseJsonArray(value: unknown) { if (typeof value !== 'string') return value; try { return JSON.parse(value) as unknown; } catch { return value.split(',').map((v)=>v.trim()).filter(Boolean); } }
function parseJsonObject(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch {
    return Object.fromEntries(value.split(/\r?\n/).map((line)=>line.trim()).filter(Boolean).map((line)=>line.split('=')).map(([key,val])=>[key?.trim(),Number(val?.trim())]));
  }
}
function parseNotes(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch { /* Allow a readable one-note-per-line editor. */ }
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [layer,slug,nameAr,nameEn] = line.split('|').map((part) => part.trim());
    return {layer,slug,nameAr,nameEn};
  });
}

export const variantSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  expectedProductVersion: z.coerce.number().int().positive(),
  sku: z.string().trim().min(1).max(80),
  sizeMl: z.coerce.number().positive().max(10000),
  priceIqd: z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/),
  compareAtIqd: z.union([z.string().regex(/^\d{1,12}(?:\.\d{1,3})?$/), z.literal('')]).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  active: z.boolean().default(true),
}).superRefine((value, ctx) => {
  try {
    if (value.compareAtIqd && value.compareAtIqd !== '' && iqdToMinor(value.compareAtIqd) < iqdToMinor(value.priceIqd)) {
      ctx.addIssue({code:'custom',path:['compareAtIqd'],message:'Compare-at amount must be at least the price'});
    }
  } catch { /* The field-level format validation reports malformed amounts. */ }
});

export function iqdToMinor(value: string): bigint {
  if (!/^\d{1,12}(?:\.\d{1,3})?$/.test(value)) throw new TypeError('Invalid IQD amount');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * BigInt(1000) + BigInt((fraction + '000').slice(0, 3));
}
