import {NextRequest, NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {advisorError, sameOrigin, success} from '@/features/advisor/http';
import {createQuizSession} from '@/features/advisor/service.server';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  try {
    if (!sameOrigin(request)) return NextResponse.json({ok:false,error:{code:'invalid_origin'},requestId},{status:403});
    const input = await request.json();
    const body = z.object({locale: z.enum(['ar','en'])}).strict().parse(input);
    return success(await createQuizSession(body.locale), 201);
  } catch (error) { return advisorError(error, requestId); }
}
