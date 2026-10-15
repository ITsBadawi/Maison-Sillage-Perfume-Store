import 'server-only';

import {createHash, randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {getPublicEnv} from '@/lib/env.client';
import {getServerEnv} from '@/lib/env.server';
import {getCurrentUser} from '@/lib/auth/current-user';
import {buildPreferenceProfile} from './profile';
import {matchProducts} from './filters';
import {AdvisorProductSchema, PreferenceAnswerSchema, scentDimensions, type AdvisorProduct} from './schemas';
import {explainCandidates, fallbackExplanation, type ExplanationCandidate} from '@/lib/integrations/gemini.server';

const COOKIE = 'maison_advisor_owner';
const cookieOptions = {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24};
const AnswerInputSchema = z.object({answers: z.array(z.object({questionId: z.string().uuid(), optionId: z.string().uuid()}).strict()).max(30)}).strict();
const IdSchema = z.string().uuid();
const localeSchema = z.enum(['ar', 'en']);

async function db() {
  const env = getPublicEnv();
  const secret = getServerEnv().SUPABASE_SECRET_KEY;
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !secret) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret, {auth: {persistSession: false, autoRefreshToken: false}});
}
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }

async function ownerToken(create: boolean) {
  const jar = await cookies();
  let value = jar.get(COOKIE)?.value;
  if (!value && create) {
    value = randomBytes(32).toString('hex');
    jar.set(COOKIE, value, cookieOptions);
  }
  return value ?? null;
}

async function currentOwner() {
  const user = await getCurrentUser();
  if (user) return {userId: user.id, tokenHash: null as string | null};
  const token = await ownerToken(false);
  return token ? {userId: null, tokenHash: hash(token)} : null;
}

export type AdvisorFailureCode = 'unavailable' | 'not_found' | 'invalid' | 'incomplete' | 'no_matches' | 'expired' | 'database';
export class AdvisorError extends Error {
  constructor(readonly code: AdvisorFailureCode) { super(code); }
}

export async function createQuizSession(localeInput: unknown) {
  localeSchema.parse(localeInput);
  const client = await db();
  if (!client) throw new AdvisorError('unavailable');
  const user = await getCurrentUser();
  const token = user ? null : await ownerToken(true);
  if (!user && !token) throw new AdvisorError('unavailable');
  const {data: versions, error: versionError} = await client.from('quiz_versions').select('id,version_number').eq('status', 'published').single();
  if (versionError || !versions) throw new AdvisorError('unavailable');
  const {data: questions, error: questionError} = await client.from('quiz_questions').select('id,key,title_ar,title_en,hint_ar,hint_en,kind,required,sort_order,quiz_options(id,label_ar,label_en,target_vector,dimension_weights,filter_payload,sort_order)').eq('quiz_version_id', versions.id).eq('enabled', true).order('sort_order').order('sort_order', {referencedTable: 'quiz_options'});
  if (questionError || !questions?.length) throw new AdvisorError('unavailable');
  const {data: sessionId, error} = await client.rpc('advisor_create_session', {p_user_id: user?.id ?? null, p_token_hash: token ? hash(token) : null, p_version_id: versions.id});
  if (error || typeof sessionId !== 'string') throw new AdvisorError('database');
  return {sessionId, quizVersion: versions.version_number, questions: questions.map((question) => ({...question, options: question.quiz_options}))};
}

async function assertOwned(sessionIdInput: unknown) {
  const sessionId = IdSchema.parse(sessionIdInput);
  const client = await db();
  const owner = await currentOwner();
  if (!client || !owner) throw new AdvisorError('not_found');
  const {data, error} = await client.rpc('advisor_session_owned', {p_session_id: sessionId, p_user_id: owner.userId, p_token_hash: owner.tokenHash});
  if (error) throw new AdvisorError('database');
  if (!data) throw new AdvisorError('not_found');
  return {client, sessionId, owner};
}

export async function saveQuizAnswers(sessionInput: unknown, input: unknown) {
  const {sessionId, owner} = await assertOwned(sessionInput);
  const parsed = AnswerInputSchema.safeParse(input);
  if (!parsed.success) throw new AdvisorError('invalid');
  const client = (await db())!;
  const {data, error} = await client.rpc('advisor_save_answers', {p_session_id: sessionId, p_user_id: owner.userId, p_token_hash: owner.tokenHash, p_answers: parsed.data.answers});
  if (error) throw new AdvisorError('invalid');
  return {savedCount: data as number};
}

type QuestionRow = {id: string; kind: 'preference' | 'budget' | 'exclusions'; required: boolean};
type AnswerRow = {question_id: string; option_id: string};
type OptionRow = {id: string; question_id: string; target_vector: unknown; dimension_weights: unknown; filter_payload: unknown};
type CatalogRow = {id: string; note_slugs: unknown; short_description_ar: string; short_description_en: string; notes_ar: string[]; notes_en: string[]; [key: string]: unknown};

function profileOutput(profile: Exclude<ReturnType<typeof buildPreferenceProfile>, {status: 'insufficient-dimensions'}>) {
  const values = Object.fromEntries(scentDimensions.map((dimension) => [dimension, profile.dimensions[dimension]?.target ?? null]));
  return {dimensions: values, measuredDimensions: profile.measuredDimensions, weights: Object.fromEntries(scentDimensions.map((dimension) => [dimension, profile.dimensions[dimension]?.weight ?? 0]))};
}

export async function completeQuiz(sessionInput: unknown, localeInput: unknown) {
  const {client, sessionId, owner} = await assertOwned(sessionInput);
  const locale = localeSchema.parse(localeInput);
  const {data: session, error: sessionError} = await client.from('quiz_sessions').select('id,quiz_version_id,expires_at,completed_at').eq('id', sessionId).single();
  if (sessionError || !session) throw new AdvisorError('not_found');
  if (new Date(session.expires_at).getTime() < Date.now()) throw new AdvisorError('expired');
  const {data: existing} = await client.from('recommendations').select('id').eq('session_id', sessionId).maybeSingle();
  if (existing) return {recommendationId: existing.id, status: 'complete'};

  const [{data: questions, error: questionError}, {data: answers, error: answerError}] = await Promise.all([
    client.from('quiz_questions').select('id,kind,required').eq('quiz_version_id', session.quiz_version_id).eq('enabled', true),
    client.from('quiz_answers').select('question_id,option_id').eq('session_id', sessionId),
  ]);
  if (questionError || answerError || !questions || !answers) throw new AdvisorError('database');
  const answerByQuestion = new Map((answers as AnswerRow[]).map((answer) => [answer.question_id, answer.option_id]));
  if ((questions as QuestionRow[]).some((question) => question.required && !answerByQuestion.has(question.id))) throw new AdvisorError('incomplete');
  const optionIds = [...answerByQuestion.values()];
  const {data: options, error: optionsError} = optionIds.length ? await client.from('quiz_options').select('id,question_id,target_vector,dimension_weights,filter_payload').in('id', optionIds) : {data: [], error: null};
  if (optionsError) throw new AdvisorError('database');
  const optionById = new Map(((options ?? []) as OptionRow[]).map((option) => [option.id, option]));
  const questionById = new Map((questions as QuestionRow[]).map((question) => [question.id, question]));
  const selections = optionIds.map((id) => optionById.get(id)).filter((option): option is OptionRow => Boolean(option));
  if (selections.length !== optionIds.length || selections.some((option) => answerByQuestion.get(option.question_id) !== option.id || !questionById.has(option.question_id))) throw new AdvisorError('invalid');
  const profile = buildPreferenceProfile(selections.filter((option) => questionById.get(option.question_id)?.kind === 'preference').map((option) => PreferenceAnswerSchema.parse({targetVector: option.target_vector, dimensionWeights: option.dimension_weights})));
  if (profile.status !== 'ready') throw new AdvisorError('incomplete');
  const profileSnapshot = profileOutput(profile);
  let maxPriceMinor: string | undefined;
  const excludedNoteIds = new Set<string>();
  const excludedNoteSlugs = new Set<string>();
  for (const option of selections) {
    const kind = questionById.get(option.question_id)?.kind;
    const filters = z.object({maxPriceMinor: z.union([z.string().regex(/^(0|[1-9]\d*)$/), z.number().int().nonnegative()]).optional(), excludedNoteIds: z.array(z.string().uuid()).optional(), excludedNoteSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional()}).passthrough().safeParse(option.filter_payload);
    if (!filters.success) continue;
    if (kind === 'budget' && filters.data.maxPriceMinor !== undefined) maxPriceMinor = String(filters.data.maxPriceMinor);
    if (kind === 'exclusions') for (const id of filters.data.excludedNoteIds ?? []) excludedNoteIds.add(id);
    if (kind === 'exclusions') for (const slug of filters.data.excludedNoteSlugs ?? []) excludedNoteSlugs.add(slug);
  }
  const {data: rows, error: catalogError} = await client.rpc('advisor_catalog_candidates', {p_excluded_note_ids: [...excludedNoteIds]});
  if (catalogError || !Array.isArray(rows)) throw new AdvisorError('database');
  const catalogRows = rows as CatalogRow[];
  const products: AdvisorProduct[] = catalogRows.flatMap((row) => {
    if (Array.isArray(row.note_slugs) && row.note_slugs.some((slug: unknown) => excludedNoteSlugs.has(String(slug)))) return [];
    const parsed = AdvisorProductSchema.safeParse({
      id: row.id, status: row.status, recommendationEnabled: row.recommendation_enabled, priority: row.priority, nameAr: row.name_ar, nameEn: row.name_en,
      primaryImage: row.primary_image, attributes: row.attributes, noteIds: row.note_ids, variants: row.variants,
    });
    return parsed.success ? [parsed.data] : [];
  });
  const matches = matchProducts(profile, products, {maxPriceMinor, excludedNoteIds: [...excludedNoteIds], limit: 3});
  if (!matches.length) {
    await client.rpc('advisor_mark_completed', {p_session_id: sessionId, p_user_id: owner.userId, p_token_hash: owner.tokenHash});
    throw new AdvisorError('no_matches');
  }
  const candidateById = new Map(products.map((product) => [product.id, product]));
  const descriptions: ExplanationCandidate[] = matches.map((match) => {
    const product = candidateById.get(match.productId)!;
    const source = catalogRows.find((row) => row.id === match.productId)!;
    const dims = Object.fromEntries(scentDimensions.map((dimension) => [dimension, product.attributes[dimension]]));
    const preferenceDimensions = Object.fromEntries(Object.entries(profileSnapshot.dimensions).filter((entry): entry is [string, number] => entry[1] !== null));
    return {productId: match.productId, name: locale === 'ar' ? product.nameAr : product.nameEn, shortDescription: locale === 'ar' ? source.short_description_ar : source.short_description_en, notes: locale === 'ar' ? source.notes_ar : source.notes_en, score: match.score, dimensions: dims, preferenceDimensions};
  });
  const explanations = await explainCandidates(locale, profileSnapshot, descriptions);
  const catalogHash = createHash('sha256').update(matches.map((match) => `${match.productId}:${match.variantId}:${match.score}`).join('|')).digest('hex');
  const items = matches.map((match, index) => ({
    product_id: match.productId, variant_id: match.variantId, rank: index + 1, score: match.score,
    product_profile_snapshot: candidateById.get(match.productId)!.attributes,
    explanation: explanations.byProductId.get(match.productId) ?? fallbackExplanation(locale, descriptions[index]!),
  }));
  const {data: recommendationId, error: saveError} = await client.rpc('advisor_save_recommendation', {
    p_session_id: sessionId, p_locale: locale, p_profile_snapshot: profileSnapshot, p_algorithm_version: 'v1',
    p_catalog_snapshot_hash: catalogHash, p_explanation_source: explanations.source, p_items: items,
    p_user_id: owner.userId, p_token_hash: owner.tokenHash,
  });
  if (saveError || typeof recommendationId !== 'string') throw new AdvisorError('database');
  return {recommendationId, status: 'complete'};
}

export async function readAdvisorResult(resultInput: unknown) {
  const recommendationId = IdSchema.parse(resultInput);
  const client = await db();
  if (!client) throw new AdvisorError('unavailable');
  const owner = await currentOwner();
  if (!owner) throw new AdvisorError('not_found');
  const {data, error} = await client.rpc('advisor_read_result', {p_recommendation_id: recommendationId, p_user_id: owner.userId, p_token_hash: owner.tokenHash});
  if (error || !data) throw new AdvisorError('not_found');
  const result = data as {items?: Array<{imagePath?: string | null}>};
  return {...result, items: result.items?.map((item) => ({...item, imageUrl: item.imagePath ? item.imagePath.startsWith('assets/') ? `/${item.imagePath}` : client.storage.from('catalog-images').getPublicUrl(item.imagePath).data.publicUrl : null}))};
}
