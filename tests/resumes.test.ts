import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { emptyCv, sampleCv } from '../lib/cv';
import { createResumeSync } from '../lib/resume-client';
import {
  maxResumeBodyBytes,
  readResumeBody,
  resumeInput,
  resumePhoto,
  saveResume,
  deleteResume,
  resumeDetail,
  purgeResumes,
} from '../lib/server/resumes';

function storage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

void test('resume photo is bounded, resized and stripped of metadata; bad/oversized photos are omitted', async () => {
  const input = await sharp({
    create: { width: 1000, height: 600, channels: 3, background: '#334455' },
  })
    .jpeg()
    .toBuffer();
  const result = await resumePhoto(
    `data:image/jpeg;base64,${input.toString('base64')}`,
  );
  assert.ok(result);
  const meta = await sharp(result).metadata();
  assert.equal(meta.width, 512);
  assert.equal(meta.format, 'webp');
  assert.equal(meta.exif, undefined);
  assert.equal(await resumePhoto('data:image/jpeg;base64,YmFk'), null);
  assert.equal(await resumePhoto('x'.repeat(170001)), null);
  const parsed = resumeInput.parse({
    id: randomUUID(),
    token: randomUUID(),
    cv: { ...emptyCv(), photo: 'must not be in jsonb' },
    photo: 'x'.repeat(200000),
  });
  assert.equal('photo' in parsed.cv, false);
  assert.throws(() =>
    resumeInput.parse({
      ...parsed,
      cv: { ...parsed.cv, fullName: 'a'.repeat(121) },
    }),
  );
});

void test('resume body enforces actual byte length without content-length', async () => {
  const request = new Request('http://localhost/api/resumes', {
    method: 'POST',
    body: JSON.stringify({ text: 'ა'.repeat(maxResumeBodyBytes / 3) }),
  });
  await assert.rejects(
    readResumeBody(request),
    (e: unknown) => (e as { status: number }).status === 413,
  );
  assert.deepEqual(
    await readResumeBody(
      new Request('http://localhost', { method: 'POST', body: '{"ok":true}' }),
    ),
    { ok: true },
  );
});

void test('print saves one identity, removes photo over limit, and clear orders deletion after in-flight save', async () => {
  const saved = storage();
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const sync = createResumeSync(saved, async (_url, init) => {
    calls.push({
      method: init!.method!,
      body: JSON.parse(init!.body as string),
    });
    if (calls.length === 1) await gate;
    return Response.json({ ok: true });
  });
  const save = sync.save({ ...emptyCv(), photo: 'x'.repeat(170001) });
  await Promise.resolve();
  const clear = sync.clear();
  assert.equal(calls.length, 1);
  release();
  await save;
  await clear;
  assert.deepEqual(
    calls.map((c) => c.method),
    ['POST', 'DELETE'],
  );
  assert.equal(calls[0].body.id, calls[1].body.id);
  assert.equal(calls[0].body.photo, '');
  assert.equal('photo' in (calls[0].body.cv as object), false);
  await sync.save(emptyCv());
  assert.notEqual(calls[0].body.id, calls[2].body.id);
});

void test('offline clear retries after reload; storage/network failures never reject printing', async () => {
  const saved = storage();
  const offline = createResumeSync(saved, async () => {
    throw Error('offline');
  });
  await offline.save(emptyCv());
  await offline.clear();
  const calls: string[] = [];
  const online = createResumeSync(saved, async (_url, init) => {
    calls.push(init!.method!);
    return Response.json({ ok: true });
  });
  await online.retry();
  await online.retry();
  assert.deepEqual(calls, ['DELETE']);
  const unavailable = createResumeSync({
    ...saved,
    setItem: () => {
      throw Error('quota');
    },
  });
  await unavailable.save(emptyCv());
});

void test(
  'local resume lifecycle: update ownership, separate photo, admin read, expiry and delete',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).hostname, 'localhost');
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const { db } = await import('../lib/server/db');
    const id = randomUUID();
    const token = randomUUID();
    const input = { id, token, cv: sampleCv('ka'), photo: '' };
    try {
      await saveResume(input);
      await assert.rejects(saveResume({ ...input, token: randomUUID() }));
      await deleteResume({ id, token: randomUUID() });
      assert.equal((await resumeDetail(id))?.fullName, input.cv.fullName);
      await saveResume({
        ...input,
        cv: { ...input.cv, fullName: 'განახლებული' },
      });
      const row = (
        await db().query(
          "SELECT cv,photo,delete_token_hash,expires_at>now()+interval '11 months' AS retained FROM resumes WHERE id=$1",
          [id],
        )
      ).rows[0];
      assert.equal(row.cv.fullName, 'განახლებული');
      assert.equal('photo' in row.cv, false);
      assert.equal(row.photo, null);
      assert.notEqual(row.delete_token_hash, token);
      assert.equal(row.retained, true);
      await db().query(
        "UPDATE resumes SET expires_at=now()-interval '1 day' WHERE id=$1",
        [id],
      );
      assert.equal(await resumeDetail(id), null);
      await purgeResumes();
      assert.equal(
        (await db().query('SELECT id FROM resumes WHERE id=$1', [id])).rowCount,
        0,
      );
      await saveResume(input);
      await deleteResume({ id, token });
      assert.equal(await resumeDetail(id), null);
    } finally {
      await db().query('DELETE FROM resumes WHERE id=$1', [id]);
      await db().end();
    }
  },
);
