import {NextRequest, NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {advisorError, sameOrigin, success} from '@/features/advisor/http';
import {saveQuizAnswers} from '@/features/advisor/service.server';

export const dynamic = 'force-dynamic';
export async function PUT(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const requestId = randomUUID();
  try {
    if (!sameOrigin(request)) return NextResponse.json({ok:false,error:{code:'invalid_origin'},requestId},{status:403});
    return success(await saveQuizAnswers((await params).id, await request.json()));
  } catch (error) { return advisorError(error, requestId); }
}
