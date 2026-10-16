import {
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
import {
  employerContacts,
  saveEmployerContact,
} from '@/lib/server/employer-contacts';
import { invoiceEmailEnabled } from '@/lib/server/invoice-email';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(
      {
        employers: await employerContacts(),
        emailEnabled: invoiceEmailEnabled(),
      },
      { headers },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    return Response.json(await saveEmployerContact(await readBody(req)), {
      headers,
    });
  } catch (e) {
    return apiError(e);
  }
}
