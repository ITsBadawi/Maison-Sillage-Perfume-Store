import {NextRequest, NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {advisorError, sameOrigin, success} from '@/features/advisor/http';
import {completeQuiz} from '@/features/advisor/service.server';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const requestId = randomUUID();
  try {
    if (!sameOrigin(request)) return NextResponse.json({ok:false,error:{code:'invalid_origin'},requestId},{status:403});
    const body = z.object({locale:z.enum(['ar','en'])}).strict().parse(await request.json());
    return success(await completeQuiz((await params).id, body.locale));
  } catch (error) { return advisorError(error, requestId); }
}
