import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

void test('bulk stage changes are owned, role restricted, bounded and atomic; hire dates follow transitions',
  { skip: process.env.RUN_COMPANY_DB_TESTS !== '1' }, async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
    assert.equal(url.pathname, '/jobx_company_local');
    const { db } = await import('../lib/server/db');
    const { changeCandidate, companyCandidates } = await import('../lib/server/company-candidates');
    const { ApiError } = await import('../lib/server/auth');
    const key = 'bulkqa' + randomUUID().replaceAll('-', '');
    const other = key + 'other';
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const entries = ids.map((id) => 'upload:' + id);
    const owner = { id: randomUUID(), companyKey: key, name: 'Bulk QA', username: key,
      email: key + '@example.com', mustChangePassword: false, role: 'owner' as const,
      approvalStatus: 'approved' as const, emailVerified: true, representativeName: 'QA' };
    const state = async () => (await db().query('SELECT entry,stage,hired_at FROM company_candidate_states WHERE company_key=$1 ORDER BY entry', [key])).rows;
    const move = (entries: string[], stage: string) => changeCandidate(owner, { action: 'stage', entries, stage });
    const constraint = 'bulk_qa_' + randomUUID().replaceAll('-', '');
    let constraintAdded = false;
    try {
      await db().query('INSERT INTO company_profiles(company_key,name) VALUES($1,$1),($2,$2)', [key, other]);
      for (const [i, id] of ids.entries()) await db().query(
        `INSERT INTO company_cv_uploads(id,company_key,name,file_name,file_hash,file_size,content)
         VALUES($1,$2,$3,'qa.txt',$4,1,$5)`,
        [id, i === 2 ? other : key, 'სატესტო bulk ' + i, createHash('sha256').update(id).digest('hex'), Buffer.from('x')]);
      await assert.rejects(changeCandidate({ ...owner, role: 'viewer' }, { action: 'stage', entries: [entries[0]], stage: 'hired' }), (error) => error instanceof ApiError && error.status === 403);
      await assert.rejects(move(Array(201).fill(entries[0]), 'hired'));
      await assert.rejects(move([entries[0], entries[2]], 'hired'), (error) => error instanceof ApiError && error.status === 404);
      assert.equal((await state()).length, 0, 'foreign entry aborts all writes');
      await move(Array(200).fill(entries[0]), 'hired');
      await move(entries.slice(0, 2), 'hired');
      let rows = await state();
      assert.equal(rows.length, 2);
      assert.ok(rows.every((row) => row.stage === 'hired' && row.hired_at instanceof Date));
      const firstDates = rows.map((row) => row.hired_at.toISOString());
      await move(entries.slice(0, 2), 'hired');
      assert.deepEqual((await state()).map((row) => row.hired_at.toISOString()), firstDates, 'idempotent stage save preserves hire date');
      assert.ok((await companyCandidates(owner)).every((candidate) => candidate.hiredAt));
      await move(entries.slice(0, 2), 'review');
      assert.ok((await state()).every((row) => row.hired_at === null));
      await move([entries[0]], 'hired');
      await changeCandidate(owner, { action: 'interview', entry: entries[0], interviewAt: '2026-12-01T12:00:00Z', moveToInterview: true });
      assert.ok((await state()).every((row) => row.hired_at === null), 'interview transition clears hire date');
      // A legacy hired row remains unknown when the same stage is saved again.
      await db().query("UPDATE company_candidate_states SET stage='hired',hired_at=NULL WHERE company_key=$1", [key]);
      await move(entries.slice(0, 2), 'hired');
      assert.ok((await state()).every((row) => row.hired_at === null));
      // Force a later row in one batch to fail; the earlier row must roll back too.
      await move(entries.slice(0, 2), 'review');
      await db().query(`ALTER TABLE company_candidate_states ADD CONSTRAINT ${constraint} CHECK (NOT (company_key='${key}' AND entry='${entries[1]}' AND stage='offer'))`);
      constraintAdded = true;
      await assert.rejects(move(entries.slice(0, 2), 'offer'));
      assert.ok((await state()).every((row) => row.stage === 'review'));
      await changeCandidate({ ...owner, role: 'recruiter' }, { action: 'stage', entries: [entries[0]], stage: 'shortlist' });
      assert.ok((await state()).some((row) => row.stage === 'shortlist'));
    } finally {
      if (constraintAdded) await db().query(`ALTER TABLE company_candidate_states DROP CONSTRAINT ${constraint}`);
      await db().query('DELETE FROM company_cv_profiles WHERE company_key=ANY($1::text[])', [[key, other]]);
      await db().query('DELETE FROM company_profiles WHERE company_key=ANY($1::text[])', [[key, other]]);
      await db().end();
    }
  });
