import { z } from 'zod';
import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import {
  list,
  get,
  getForJob,
  save,
  remove,
} from '@/lib/server/company-job-drafts';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(req: Request) {
  try {
    const company = await requireCompanyRole();
    const params = new URL(req.url).searchParams;
    const result = params.has('id')
      ? await get(company, params.get('id')!)
      : params.has('job')
        ? await getForJob(company, params.get('job')!)
        : await list(company);
    return Response.json(result, { headers });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const company = await requireCompanyRole(['owner', 'recruiter']);
    const body = z
      .object({ action: z.enum(['save', 'delete']), id: z.uuid() })
      .passthrough()
      .parse(await readBody(req));
    if (body.action === 'delete') {
      await remove(company, body.id);
      return Response.json({ ok: true }, { headers });
    }
    return Response.json(await save(company, body), { headers });
  } catch (e) {
    return apiError(e);
  }
}
