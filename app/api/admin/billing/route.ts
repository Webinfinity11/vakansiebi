import { billingSettingsSchema } from '@/lib/billing';
import { billingSettings } from '@/lib/server/billing';
import { db, transaction } from '@/lib/server/db';
import {
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const page = Math.max(
      1,
      Math.min(
        10000,
        Math.floor(Number(new URL(req.url).searchParams.get('page'))) || 1,
      ),
    );
    const invoices = (
      await db().query(
        'SELECT job_id,number,token,payer_name,vacancy_title,amount_gel,status,created_at FROM job_invoices ORDER BY created_at DESC LIMIT 30 OFFSET $1',
        [(page - 1) * 30],
      )
    ).rows;
    const total = (
      await db().query('SELECT count(*)::int total FROM job_invoices')
    ).rows[0].total;
    return Response.json(
      { settings: await billingSettings(), invoices, total },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const value = billingSettingsSchema.parse(await readBody(req));
    await transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(917450)');
      const before =
        (
          await c.query(
            'SELECT payee_name,bank_name,iban FROM billing_settings WHERE id=true',
          )
        ).rows[0] || null;
      await c.query(
        `INSERT INTO billing_settings(id,payee_name,bank_name,iban) VALUES(true,$1,$2,$3)
      ON CONFLICT(id) DO UPDATE SET payee_name=$1,bank_name=$2,iban=$3,updated_at=now()`,
        [value.payee_name, value.bank_name, value.iban],
      );
      await c.query(
        "INSERT INTO audit_log(action,actor,before_data,after_data) VALUES('billing.settings.updated','admin',$1,$2)",
        [before, value],
      );
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
