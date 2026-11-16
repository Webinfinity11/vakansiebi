// Re-reads CVs that were already parsed, with the current extractor and rules.
// Dry run by default; pass --apply to write. --company=<key> limits it to one company.
// Files in private Blob storage need BLOB_READ_WRITE_TOKEN; without it they are reported
// as unavailable and left as they are. Manual edits made by a company are kept.
import 'dotenv/config';
import { reparseCvProfiles } from '../lib/server/company-candidates';

const apply = process.argv.includes('--apply');
const companyKey = process.argv
  .find((arg) => arg.startsWith('--company='))
  ?.slice('--company='.length);
try {
  const results = await reparseCvProfiles({ apply, companyKey });
  for (const r of results)
    console.log(`${r.status.padEnd(11)} ${r.companyKey} ${r.entry} text ${r.before} -> ${r.after}`);
  const count = (status: string) => results.filter((r) => r.status === status).length;
  console.log(
    `${apply ? 'applied' : 'dry run'}: ${results.length} CVs, ${count('updated')} changed, ` +
      `${count('unchanged')} unchanged, ${count('unavailable')} unavailable, ${count('failed')} failed`,
  );
} finally {
  const { db } = await import('../lib/server/db');
  await db().end();
}
