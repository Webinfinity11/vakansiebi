import { getVacancyPage } from '@/lib/server/vacancy-page';
import { similarVacancies } from '@/lib/server/similar-vacancies';
import { apiError } from '@/lib/server/auth';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await getVacancyPage(id);
    if (!job)
      return Response.json({ error: 'ვაკანსია ვერ მოიძებნა' }, { status: 404 });
    return Response.json(
      {
        jobs: await similarVacancies(
          job,
          new URL(request.url).searchParams.get('exclude') || '',
        ),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
