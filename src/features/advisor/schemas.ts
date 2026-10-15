import {z} from 'zod';

export const scentDimensions = [
  'woody', 'floral', 'fresh', 'sweet', 'warm', 'smoky',
  'bold', 'calm', 'classic', 'modern', 'day', 'night',
] as const;

export const ScentDimensionSchema = z.enum(scentDimensions);
export type ScentDimension = z.infer<typeof ScentDimensionSchema>;

const dimensionValue = z.number().finite().min(0).max(100);
const dimensionWeight = z.number().finite().min(0);

export const ScentVectorSchema = z.object(
  Object.fromEntries(scentDimensions.map((dimension) => [dimension, dimensionValue])) as Record<ScentDimension, typeof dimensionValue>,
).strict();
export type ScentVector = z.infer<typeof ScentVectorSchema>;

export const TargetVectorSchema = ScentVectorSchema.partial().strict();
export type TargetVector = z.infer<typeof TargetVectorSchema>;

export const DimensionWeightsSchema = z.object(
  Object.fromEntries(scentDimensions.map((dimension) => [dimension, dimensionWeight])) as Record<ScentDimension, typeof dimensionWeight>,
).partial().strict();
export type DimensionWeights = z.infer<typeof DimensionWeightsSchema>;

export const PreferenceAnswerSchema = z.object({
  targetVector: TargetVectorSchema,
  dimensionWeights: DimensionWeightsSchema.optional(),
}).strict();
export type PreferenceAnswer = z.infer<typeof PreferenceAnswerSchema>;

export const MoneyMinorSchema = z.union([
  z.string().regex(/^(0|[1-9]\d*)$/),
  z.number().int().safe().nonnegative(),
]);
export type MoneyMinor = z.infer<typeof MoneyMinorSchema>;

export const AdvisorProductSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']),
  recommendationEnabled: z.boolean(),
  priority: z.number().int(),
  nameAr: z.string(),
  nameEn: z.string(),
  primaryImage: z.object({altAr: z.string(), altEn: z.string()}).strict().nullable(),
  attributes: ScentVectorSchema,
  noteIds: z.array(z.string().min(1)),
  variants: z.array(z.object({
    id: z.string().min(1),
    active: z.boolean(),
    stockAvailable: z.number().int().nonnegative(),
    priceMinor: MoneyMinorSchema,
  }).strict()),
}).strict();
export type AdvisorProduct = z.infer<typeof AdvisorProductSchema>;

export const MatchOptionsSchema = z.object({
  maxPriceMinor: MoneyMinorSchema.optional(),
  excludedNoteIds: z.array(z.string().min(1)).default([]),
  limit: z.number().int().min(0).max(3).default(3),
}).strict();
export type MatchOptions = z.input<typeof MatchOptionsSchema>;
