import { getCompany, saveCompany } from '@/lib/server/companies';
import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    return Response.json(
      await getCompany(
        (new URL(req.url).searchParams.get('name') || '').slice(0, 300),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    return Response.json(await saveCompany(await readBody(req)));
  } catch (e) {
    return apiError(e);
  }
}
