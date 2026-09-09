import { requireAdmin, apiError } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET() {
  try {
    await requireAdmin();
    try {
      const response = await fetch('https://vacancy.hr.gov.ge/', {
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
        headers: { 'User-Agent': 'ErtadVacancyBot/0.1' },
      });
      const text = await response.text();
      return Response.json({
        reachable:
          response.ok && text.includes('/JobProvider/UserOrgVaks/Details/'),
        status: response.status,
      });
    } catch {
      return Response.json({ reachable: false, reason: 'connection_failed' });
    }
  } catch (error) {
    return apiError(error);
  }
}
