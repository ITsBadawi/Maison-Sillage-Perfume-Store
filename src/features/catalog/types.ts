export type Locale = 'ar' | 'en';

export type CatalogCategory = {
  slug: string;
  name_ar: string;
  name_en: string;
};

export type CatalogNote = {
  layer: 'top' | 'heart' | 'base';
  name_ar: string;
  name_en: string;
};

export type CatalogVariant = {
  id: string;
  size_ml: number;
  price_minor: string;
  compare_at_minor: string | null;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  brand: string;
  name_ar: string;
  name_en: string;
  short_description_ar: string;
  short_description_en: string;
  description_ar: string;
  description_en: string;
  gender: string;
  family: string;
  seasons: string[];
  occasions: string[];
  concentration: string;
  longevity_hours_min: number | null;
  longevity_hours_max: number | null;
  projection: number | null;
  featured: boolean;
  category: CatalogCategory | null;
  image: string;
  alt_ar: string;
  alt_en: string;
  notes: CatalogNote[];
  variants: CatalogVariant[];
  inStock: boolean;
  isFavorite: boolean;
};

export type CatalogFilters = {
  query?: string;
  category?: string;
  availability?: 'available' | 'unavailable' | '';
  family?: string;
  season?: string;
  occasion?: string;
  gender?: string;
  minPrice?: string;
  maxPrice?: string;
};
