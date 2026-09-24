import { z } from 'zod';
import {
  ApiError,
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
} from '@/lib/server/auth';
import { transaction } from '@/lib/server/db';

/* Marks a form submission as a test, or back as real. A test stays listed under its own view
   and drops out of every count, so trying the form never inflates the numbers. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const { id, test } = z
      .object({ id: z.uuid(), test: z.boolean() })
      .parse(await readBody(req));
    await transaction(async (c) => {
      const changed = await c.query(
        'UPDATE job_submissions SET is_test=$2 WHERE job_id=$1 AND is_test<>$2',
        [id, test],
      );
      if (!changed.rowCount) {
        const exists = await c.query(
          'SELECT 1 FROM job_submissions WHERE job_id=$1',
          [id],
        );
        if (!exists.rowCount)
          throw new ApiError('განცხადება ვერ მოიძებნა', 404);
        return;
      }
      await c.query(
        "INSERT INTO audit_log(job_id,action,actor,after_data) VALUES($1,'submission.test','admin',$2)",
        [id, { test }],
      );
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
