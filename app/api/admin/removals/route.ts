import { z } from 'zod';
import { after } from 'next/server';
import { db } from '@/lib/server/db';
import {
  approveRemovalRequest,
  deliverRemovalConfirmations,
  recordRemovalRequest,
} from '@/lib/server/removal-requests';
import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import {
  previewEmployerRemoval,
  releaseEmployer,
  removedVacancies,
  suppressEmployer,
} from '@/lib/server/employer-removals';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    if (params.get('preview') === '1') {
      return Response.json(
        await previewEmployerRemoval({
          companyNames: params.getAll('companyName'),
          ...(params.get('email') ? { email: params.get('email') } : {}),
        }),
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    return Response.json(
      await removedVacancies(
        Number(new URL(request.url).searchParams.get('page')),
      ),
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireAdmin();
    checkOrigin(request);
    const input = await readBody(request);
    const action = z
      .object({ action: z.enum(['block', 'release', 'approve', 'ignore']) })
      .parse(input);
    let result;
    if (action.action === 'block') {
      const blocked = await suppressEmployer(input);
      const contact = z
        .object({
          email: z.email().optional(),
          companyNames: z.array(z.string()).optional(),
          reason: z.string(),
          evidence: z.string().optional(),
        })
        .parse(input);
      if (contact.email) {
        const request = await recordRemovalRequest({
          sourceId: `admin-rule:${blocked.id}`,
          sender: contact.email,
          source: 'admin',
          text: contact.evidence || contact.reason,
          authenticated: true,
          companyNames: contact.companyNames?.length
            ? contact.companyNames
            : undefined,
        });
        after(() => deliverRemovalConfirmations(request.id).then(() => {}));
      }
      result = blocked;
    } else {
      const { id } = z.object({ id: z.uuid() }).parse(input);
      if (action.action === 'release') result = await releaseEmployer(id);
      else if (action.action === 'approve') {
        result = await approveRemovalRequest(id);
        after(() => deliverRemovalConfirmations(id).then(() => {}));
      } else {
        await db().query(
          "UPDATE employer_removal_requests SET status='ignored',processed_at=now() WHERE id=$1 AND status='review'",
          [id],
        );
        result = { ok: true };
      }
    }
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
