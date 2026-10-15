import {describe, expect, it} from 'vitest';
import {filterProducts} from './filter-products';
import type {CatalogProduct} from './types';

const products = [
  {slug:'rose',name_ar:'ورد',name_en:'Rose After Rain',brand:'Maison Sillage',family:'floral',category:{slug:'women'},inStock:true,gender:'women',seasons:['spring'],occasions:['day'],variants:[{price_minor:'80000000'}]},
  {slug:'fig',name_ar:'تين',name_en:'Fig at Dusk',brand:'Maison Sillage',family:'woody',category:{slug:'unisex'},inStock:false,gender:'unisex',seasons:['autumn'],occasions:['evening'],variants:[{price_minor:'120000000'}]},
].map((product) => product as CatalogProduct);

describe('filterProducts', () => {
  it('searches both language names and the brand without changing the source array', () => {
    expect(filterProducts(products, {query:'وَرْد'}, 'ar')).toHaveLength(1);
    expect(filterProducts(products, {query:'fig'}, 'en').map(({slug}) => slug)).toEqual(['fig']);
    expect(filterProducts(products, {query:'maison'}, 'en')).toHaveLength(2);
    expect(products).toHaveLength(2);
  });

  it('combines category and availability filters and treats unknown values as no match', () => {
    expect(filterProducts(products, {category:'women',availability:'available'}, 'en').map(({slug}) => slug)).toEqual(['rose']);
    expect(filterProducts(products, {category:'unisex',availability:'available'}, 'en')).toEqual([]);
    expect(filterProducts(products, {availability:'unavailable'}, 'en').map(({slug}) => slug)).toEqual(['fig']);
  });
  it('combines scent, use and exact IQD price filters', () => {
    expect(filterProducts(products, {family:'floral',season:'spring',occasion:'day',gender:'women',maxPrice:'80000'}, 'en').map(({slug}) => slug)).toEqual(['rose']);
    expect(filterProducts(products, {minPrice:'80001'}, 'en').map(({slug}) => slug)).toEqual(['fig']);
    expect(filterProducts(products, {occasion:'office'}, 'en')).toEqual([]);
  });
});
