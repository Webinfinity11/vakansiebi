import { z } from 'zod';
import { apiError, ApiError } from '@/lib/server/auth';
import { getVacancyPage } from '@/lib/server/vacancy-page';
import { loadJobQuestions } from '@/lib/server/job-questions';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    if (
      !rateLimit('questions:' + clientKey(req), { limit: 60, windowMs: 60000 })
        .allowed
    )
      throw new ApiError('სცადე მოგვიანებით.', 429);
    const id = z.uuid().parse(new URL(req.url).searchParams.get('job'));
    if (!(await getVacancyPage(id)))
      throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
    const questions = await loadJobQuestions(id);
    return Response.json(
      questions.map(({ id, text, kind, options }) => ({
        id,
        text,
        kind,
        options,
      })),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
