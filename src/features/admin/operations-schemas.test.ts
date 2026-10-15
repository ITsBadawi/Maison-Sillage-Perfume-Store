import {describe,expect,it} from 'vitest';
import {brandOperationSchema,couponOperationSchema,quizOperationSchema,shippingOperationSchema,staffOperationSchema} from './operations-schemas';

describe('manager operation request schemas',()=>{
  it('accepts a valid coupon and rejects reversed dates or percentages over 100',()=>{
    const base={code:'SPRING10',type:'percent',value:'10',maxDiscountMinor:'',minSubtotalMinor:'0',startsAt:'2026-10-02T09:00:00Z',expiresAt:'2026-10-03T09:00:00Z',totalLimit:'',perCustomerLimit:'1',active:true};
    expect(couponOperationSchema.safeParse(base).success).toBe(true);
    expect(couponOperationSchema.safeParse({...base,value:'101'}).success).toBe(false);
    expect(couponOperationSchema.safeParse({...base,expiresAt:'2026-10-01T09:00:00Z'}).success).toBe(false);
  });
  it('restricts staff role values and preserves explicit disable state',()=>{
    expect(staffOperationSchema.parse({email:'team@example.test',role:'orders_manager',active:'false'}).active).toBe(false);
    expect(staffOperationSchema.safeParse({email:'team@example.test',role:'owner',active:true}).success).toBe(false);
  });
  it('validates safe shipping slugs and brand color tokens',()=>{
    const zone={slug:'baghdad-center',nameAr:'وسط بغداد',nameEn:'Baghdad Center',feeMinor:'5000',active:true};
    expect(shippingOperationSchema.safeParse(zone).success).toBe(true);
    expect(shippingOperationSchema.safeParse({...zone,slug:'../admin'}).success).toBe(false);
    expect(brandOperationSchema.safeParse({nameAr:'ميزون',nameEn:'Maison',logoPath:'',heroImagePath:'',accentColor:'#806344',contactPhone:''}).success).toBe(true);
    expect(brandOperationSchema.safeParse({nameAr:'x',nameEn:'x',logoPath:'',heroImagePath:'',accentColor:'red',contactPhone:''}).success).toBe(false);
  });
  it('requires a version for publishing and supports draft creation',()=>{
    expect(quizOperationSchema.safeParse({action:'draft'}).success).toBe(true);
    expect(quizOperationSchema.safeParse({action:'publish',versionId:''}).success).toBe(false);
  });
});
