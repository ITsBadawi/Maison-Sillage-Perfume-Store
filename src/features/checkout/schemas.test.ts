import {describe, expect, it} from 'vitest';
import {placeOrderSchema, quoteRequestSchema} from './schemas';

const validAddress = {recipientName: 'Nadia Saleh', phone: '+9647701234567', city: 'Baghdad', district: 'Karrada', street: 'Street 12, building 4'};
const validItems = [{variantId: '4cc46582-ade4-4de2-9dae-bc6afcb4a6e7', quantity: 2}];

describe('checkout request schemas', () => {
  it('accepts COD order inputs with international phone and caps line quantities', () => {
    const result = placeOrderSchema.safeParse({
      items: validItems, shippingZoneId: '7648d397-cb23-4e56-962b-6f2d07020ff7',
      address: validAddress, quoteHash: 'a'.repeat(64),
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address.landmark).toBe('');
  });

  it('rejects duplicate SKUs, invalid phone formats, and more than 20 lines', () => {
    expect(quoteRequestSchema.safeParse({items: [...validItems, ...validItems], shippingZoneId: '7648d397-cb23-4e56-962b-6f2d07020ff7'}).success).toBe(false);
    expect(placeOrderSchema.safeParse({items: validItems, shippingZoneId: '7648d397-cb23-4e56-962b-6f2d07020ff7', address: {...validAddress, phone: '07701234567'}, quoteHash: 'a'.repeat(64)}).success).toBe(false);
    const many = Array.from({length: 21}, (_, index) => ({variantId: `00000000-0000-4000-8000-${String(index).padStart(12,'0')}`, quantity: 1}));
    expect(quoteRequestSchema.safeParse({items: many, shippingZoneId: '7648d397-cb23-4e56-962b-6f2d07020ff7'}).success).toBe(false);
  });
});
