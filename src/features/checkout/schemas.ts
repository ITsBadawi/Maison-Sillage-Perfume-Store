import {z} from 'zod';

export const checkoutItemsSchema = z.array(z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
})).min(1).max(20).refine((items) => new Set(items.map((item) => item.variantId)).size === items.length, 'duplicateVariant');

export const quoteRequestSchema = z.object({
  items: checkoutItemsSchema,
  shippingZoneId: z.string().uuid(),
  couponCode: z.string().trim().max(64).optional(),
});

export const addressSchema = z.object({
  recipientName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
  city: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(120),
  street: z.string().trim().min(5).max(250),
  landmark: z.string().trim().max(150).optional().default(''),
});

export const placeOrderSchema = z.object({
  items: checkoutItemsSchema,
  shippingZoneId: z.string().uuid(),
  couponCode: z.string().trim().max(64).optional(),
  address: addressSchema,
  notes: z.string().trim().max(500).optional().default(''),
  quoteHash: z.string().min(20).max(4096),
});

export type CheckoutItems = z.infer<typeof checkoutItemsSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
