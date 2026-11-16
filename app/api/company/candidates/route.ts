import { apiError, checkOrigin, readBody } from '@/lib/server/auth';
import { requireCompanyRole } from '@/lib/server/company-auth';
import {
  candidateNotes,
  changeCandidate,
  companyCandidates,
  companyCvBase,
} from '@/lib/server/company-candidates';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(req: Request) {
  try {
    const company = await requireCompanyRole(
      ['owner', 'recruiter', 'viewer'],
      true,
    );
    const params = new URL(req.url).searchParams;
    const entry = params.get('entry');
    return Response.json(
      entry
        ? await candidateNotes(company, entry)
        : params.get('base') === '1'
          ? await companyCvBase(company)
          : await companyCandidates(company),
      { headers },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    return Response.json(
      await changeCandidate(
        await requireCompanyRole(['owner', 'recruiter'], true),
        await readBody(req),
      ),
      { headers },
    );
  } catch (e) {
    return apiError(e);
  }
}
