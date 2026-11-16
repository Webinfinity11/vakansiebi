import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

void test(
  'CV reparse refreshes stale extracted text, keeps company edits and only writes with apply',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const { db } = await import('../lib/server/db');
    const { reparseCvProfiles } = await import('../lib/server/company-candidates');
    const key = 'reparseqa' + randomUUID().replaceAll('-', '');
    const upload = randomUUID();
    const entry = 'upload:' + upload;
    const cv = Buffer.from('ნინო ბერიძე\nბუღალტერი\nnino@example.com\nExcel, 1C');
    try {
      await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$2)', [key, 'Reparse QA']);
      await db().query(
        `INSERT INTO company_cv_uploads(id,company_key,name,file_name,file_hash,file_size,content,source)
         VALUES($1,$2,'Nino','cv.txt',$3,$4,$5,'upload')`,
        [upload, key, createHash('sha256').update(cv).digest('hex'), cv.length, cv],
      );
      await db().query(
        `INSERT INTO company_cv_profiles(company_key,entry,text,parsed,edited,parsed_at)
         VALUES($1,$2,'',$3,$4,now())`,
        [key, entry, JSON.stringify({ parse: { confidence: 0, reason: 'empty' } }), JSON.stringify({ title: 'მთავარი ბუღალტერი' })],
      );

      const dry = await reparseCvProfiles({ apply: false, companyKey: key });
      assert.deepEqual(dry.map((r) => [r.entry, r.status]), [[entry, 'updated']]);
      const untouched = (await db().query('SELECT text FROM company_cv_profiles WHERE company_key=$1', [key])).rows[0];
      assert.equal(untouched.text, '');

      await reparseCvProfiles({ apply: true, companyKey: key });
      const saved = (await db().query('SELECT text,edited,parsed FROM company_cv_profiles WHERE company_key=$1', [key])).rows[0];
      assert.match(saved.text, /ბუღალტერი/);
      assert.deepEqual(saved.edited, { title: 'მთავარი ბუღალტერი' });
      assert.equal(saved.parsed.parse.reason, null);

      const again = await reparseCvProfiles({ apply: false, companyKey: key });
      assert.equal(again[0].status, 'unchanged');
    } finally {
      await db().query('DELETE FROM company_cv_profiles WHERE company_key=$1', [key]);
      await db().query('DELETE FROM company_cv_uploads WHERE company_key=$1', [key]);
      await db().query('DELETE FROM company_profiles WHERE company_key=$1', [key]);
      await db().end();
    }
  },
);
