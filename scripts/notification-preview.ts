import { mkdir, writeFile } from 'node:fs/promises';
import { applicationsEmail, placementRenewalEmail } from '../lib/notification-emails';
import { paidPlacementPrices } from '../lib/billing';
import { jobRejectionEmail } from '../lib/job-rejection-email';
import { db } from '../lib/server/db';
import { runNotificationJobs } from '../lib/server/notification-jobs';

let localValidated = false;
async function main() {
  // Refuse inherited production credentials; never load .env here.
  const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost:5432/jobx_company_local');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/jobx_company_local')
    throw new Error('Preview requires the local jobx_company_local database');
  process.env.DATABASE_URL = url.href;
  localValidated = true;
  process.env.NOTIFICATION_EMAIL_ENABLED = 'false';
  await runNotificationJobs(new Date(), { deliver: false });
  const directory = '/tmp/jobx-notifications';
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const rows = (await db().query('SELECT id,kind,payload FROM notification_emails ORDER BY created_at')).rows;
  for (const row of rows) await writeFile(`${directory}/${row.kind}-${row.id}.html`, row.payload.html, { mode: 0o600 });
  const origin = 'https://jobx.ge', recipient = 'delivered@resend.dev';
  const samples = {
    applications: applicationsEmail([{ title: 'ბუღალტერი', count: 3 }], recipient, origin),
    placement_renewal: placementRenewalEmail({ placementTier: 'vip', amountGel: paidPlacementPrices.vip, token: '0'.repeat(64) }, 'ბუღალტერი <ტესტი>', new Date('2026-12-26T10:00:00Z'), recipient, origin),
    job_rejected: jobRejectionEmail({ id: '00000000-0000-4000-8000-000000000001', title: 'ბუღალტერი', owned: true }, { reason: 'other', note: 'გთხოვთ, დააზუსტოთ სამუშაო საათები.' }, recipient, origin),
  };
  for (const [kind, email] of Object.entries(samples)) if (!rows.some(row => row.kind === kind))
    await writeFile(`${directory}/${kind}-sample.html`, email.html, { mode: 0o600 });
  console.log(`Preview HTML: ${directory} (delivery disabled)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (localValidated) await db().end(); });
