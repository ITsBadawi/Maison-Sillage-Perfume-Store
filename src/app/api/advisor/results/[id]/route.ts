import {NextRequest} from 'next/server';
import {randomUUID} from 'node:crypto';
import {advisorError, success} from '@/features/advisor/http';
import {readAdvisorResult} from '@/features/advisor/service.server';

export const dynamic = 'force-dynamic';
export async function GET(_request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const requestId = randomUUID();
  try { return success(await readAdvisorResult((await params).id)); }
  catch (error) { return advisorError(error, requestId); }
}
