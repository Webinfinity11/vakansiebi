import { z } from 'zod';
import type { CompanyIdentity } from '../company-portal';
import { autoReplyKinds, autoReplyReady, defaultTemplates, templateKinds, templateLabels, type MessageTemplate } from '../company-message-templates';
import { ApiError } from './auth';
import { db, transaction } from './db';

const inputSchema = z.object({
  application_mode: z.enum(['instant', 'digest', 'off']),
  deadline_reminders: z.boolean(), auto_reply: z.boolean(),
  auto_reply_template: z.enum(templateKinds),
});
export type NotificationSettings = z.infer<typeof inputSchema> & { templates: Record<(typeof autoReplyKinds)[number], { ready: boolean }> };
async function templateReadiness(companyKey: string) {
  const saved = (await db().query('SELECT kind,subject,body FROM company_message_templates WHERE company_key=$1', [companyKey])).rows;
  return Object.fromEntries(autoReplyKinds.map(key => [key, { ready: autoReplyReady(saved.find(t => t.kind === key) ?? defaultTemplates[key]) }])) as NotificationSettings['templates'];
}
const fields = 'application_mode,deadline_reminders,auto_reply,auto_reply_template';
export async function companyNotifications(company: CompanyIdentity): Promise<NotificationSettings> {
  await db().query('INSERT INTO company_notification_settings(company_key) VALUES($1) ON CONFLICT DO NOTHING', [company.companyKey]);
  return { ...(await db().query(`SELECT ${fields} FROM company_notification_settings WHERE company_key=$1`, [company.companyKey])).rows[0], templates: await templateReadiness(company.companyKey) };
}
export async function saveCompanyNotifications(company: CompanyIdentity, input: unknown): Promise<NotificationSettings> {
  if (company.role !== 'owner') throw new ApiError('პარამეტრების შეცვლა მხოლოდ მფლობელს შეუძლია.', 403);
  const v = inputSchema.parse(input);
  if (!(autoReplyKinds as readonly string[]).includes(v.auto_reply_template)) {
    throw new ApiError(`ეს შაბლონი ავტომატურ პასუხად ვერ გაიგზავნება. აირჩიეთ „${templateLabels.received}“ ან სხვა ზოგადი შაბლონი.`, 400);
  }
  const settings = await transaction(async c => {
    const template = (await c.query<MessageTemplate>('SELECT subject,body FROM company_message_templates WHERE company_key=$1 AND kind=$2', [company.companyKey, v.auto_reply_template])).rows[0] ?? defaultTemplates[v.auto_reply_template];
    if (!autoReplyReady(template)) throw new ApiError('ეს შაბლონი შეიცავს შესავსებ ადგილს და ავტომატურად ვერ გაიგზავნება. აირჩიეთ სხვა შაბლონი ან ჯერ შეავსეთ იგი.', 400);
    await c.query('INSERT INTO company_notification_settings(company_key) VALUES($1) ON CONFLICT DO NOTHING', [company.companyKey]);
    return (await c.query(`UPDATE company_notification_settings SET application_mode=$2,
      deadline_reminders=$3,auto_reply=$4,auto_reply_template=$5,
      auto_reply_since=CASE WHEN $4 AND NOT auto_reply THEN now() ELSE auto_reply_since END,
      updated_at=now() WHERE company_key=$1 RETURNING ${fields}`,
    [company.companyKey, v.application_mode, v.deadline_reminders, v.auto_reply, v.auto_reply_template])).rows[0];
  });
  return { ...settings, templates: await templateReadiness(company.companyKey) };
}
