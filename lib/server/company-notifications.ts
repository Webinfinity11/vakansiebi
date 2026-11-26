import { z } from 'zod';
import type { CompanyIdentity } from '../company-portal';
import { ApiError } from './auth';
import { db, transaction } from './db';

const inputSchema = z.object({
  application_mode: z.enum(['instant', 'digest', 'off']),
  deadline_reminders: z.boolean(), auto_reply: z.boolean().optional(),
  auto_reply_template: z.string().optional(),
});
export type NotificationSettings = Pick<z.infer<typeof inputSchema>, 'application_mode' | 'deadline_reminders'>;
const fields = 'application_mode,deadline_reminders';
export async function companyNotifications(company: CompanyIdentity): Promise<NotificationSettings> {
  await db().query('INSERT INTO company_notification_settings(company_key) VALUES($1) ON CONFLICT DO NOTHING', [company.companyKey]);
  return (await db().query(`SELECT ${fields} FROM company_notification_settings WHERE company_key=$1`, [company.companyKey])).rows[0];
}
export async function saveCompanyNotifications(company: CompanyIdentity, input: unknown): Promise<NotificationSettings> {
  if (company.role !== 'owner') throw new ApiError('პარამეტრების შეცვლა მხოლოდ მფლობელს შეუძლია.', 403);
  const v = inputSchema.parse(input);
  const settings = await transaction(async c => {
    await c.query('INSERT INTO company_notification_settings(company_key) VALUES($1) ON CONFLICT DO NOTHING', [company.companyKey]);
    return (await c.query(`UPDATE company_notification_settings SET application_mode=$2,
      deadline_reminders=$3,auto_reply=false,
      updated_at=now() WHERE company_key=$1 RETURNING ${fields}`,
    [company.companyKey, v.application_mode, v.deadline_reminders])).rows[0];
  });
  return settings;
}
