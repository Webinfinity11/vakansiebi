import type { CompanyIdentity } from '../company-portal';
import { defaultTemplates, templateKinds, validTemplate, type MessageTemplates, type TemplateKey } from '../company-message-templates';
import { ApiError } from './auth';
import { db } from './db';
export async function companyMessageTemplates(company: CompanyIdentity): Promise<MessageTemplates> {
  const { rows } = await db().query('SELECT kind,subject,body FROM company_message_templates WHERE company_key=$1', [company.companyKey]);
  const templates = { ...defaultTemplates };
  for (const row of rows) if (templateKinds.includes(row.kind)) templates[row.kind as TemplateKey] = { subject: row.subject, body: row.body };
  return templates;
}
export async function saveCompanyMessageTemplate(company: CompanyIdentity, input: unknown) {
  if (!['owner', 'recruiter'].includes(company.role)) throw new ApiError('შაბლონის შეცვლის უფლება არ გაქვთ.', 403);
  const v = input as { kind?: TemplateKey; subject?: unknown; body?: unknown; reset?: boolean } | null;
  if (!v?.kind || !templateKinds.includes(v.kind) || (v.reset !== true && !validTemplate({ subject: v.subject, body: v.body }))) throw new ApiError('შეამოწმეთ წერილის სათაური და ტექსტი.', 400);
  if (v.reset === true) await db().query('DELETE FROM company_message_templates WHERE company_key=$1 AND kind=$2', [company.companyKey, v.kind]);
  else await db().query(`INSERT INTO company_message_templates(company_key,kind,subject,body,updated_by) VALUES($1,$2,$3,$4,$5)
    ON CONFLICT(company_key,kind) DO UPDATE SET subject=EXCLUDED.subject,body=EXCLUDED.body,updated_by=EXCLUDED.updated_by,updated_at=now()`, [company.companyKey, v.kind, v.subject, v.body, company.id]);
  return companyMessageTemplates(company);
}
