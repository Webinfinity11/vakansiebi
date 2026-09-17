import assert from 'node:assert/strict';
import test from 'node:test';
import { needsBuild, run } from '../scripts/scheduled-deploy.mjs';

const oldSha = 'a'.repeat(40);
const newSha = 'b'.repeat(40);

void test('deployment skips identical revisions and documentation-only changes', () => {
  assert.equal(needsBuild(oldSha, oldSha), false);
  assert.equal(needsBuild(oldSha, newSha, { status: 'ahead', files: [{ filename: 'README.md' }, { filename: 'docs/setup.md' }] }), false);
});

void test('runtime changes, renames, truncated comparisons and missing revisions require a build', () => {
  for (const comparison of [
    undefined,
    { status: 'diverged', files: [{ filename: 'README.md' }] },
    { status: 'ahead', files: [{ filename: 'app/page.tsx' }] },
    { status: 'ahead', files: [{ filename: 'docs/old.ts', previous_filename: 'lib/old.ts' }] },
    { status: 'ahead', files: Array.from({ length: 300 }, () => ({ filename: 'docs/a.md' })) },
  ]) assert.equal(needsBuild(oldSha, newSha, comparison), true);
  assert.equal(needsBuild(null, newSha), true);
});

void test('unchanged production never calls the deployment hook', async () => {
  const urls: string[] = [];
  await run({ fetchImpl: async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    urls.push(url);
    return Response.json(url.includes('api.github.com') ? { object: { sha: newSha } } : { status: 'ok', revision: newSha });
  } });
  assert.equal(urls.length, 2);
  assert.ok(urls.every((url) => !url.includes('integrations/deploy')));
});

void test('a changed revision requests exactly one build and waits for the live revision', async () => {
  const previous = process.env.VERCEL_DEPLOY_HOOK;
  process.env.VERCEL_DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/test';
  let requests = 0;
  let checks = 0;
  try {
    await run({ sleep: async () => {}, fetchImpl: async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('integrations/deploy')) { requests++; return Response.json({ job: { state: 'PENDING' } }); }
      if (url.includes('git/ref')) return Response.json({ object: { sha: newSha } });
      if (url.includes('/compare/')) return Response.json({ status: 'ahead', files: [{ filename: 'lib/seo-landing.ts' }] });
      return Response.json({ status: 'ok', revision: ++checks < 3 ? oldSha : newSha });
    } });
    assert.equal(requests, 1);
    assert.equal(checks, 3);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_DEPLOY_HOOK;
    else process.env.VERCEL_DEPLOY_HOOK = previous;
  }
});

void test('a build that never becomes live fails without requesting duplicate builds', async () => {
  const previous = process.env.VERCEL_DEPLOY_HOOK;
  process.env.VERCEL_DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/test';
  let requests = 0;
  try {
    await assert.rejects(run({ sleep: async () => {}, fetchImpl: async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('integrations/deploy')) { requests++; return Response.json({}); }
      if (url.includes('git/ref')) return Response.json({ object: { sha: newSha } });
      if (url.includes('/compare/')) return Response.json({ status: 'ahead', files: [{ filename: 'app/page.tsx' }] });
      return Response.json({ status: 'ok', revision: oldSha });
    } }), /within 10 minutes/);
    assert.equal(requests, 1);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_DEPLOY_HOOK;
    else process.env.VERCEL_DEPLOY_HOOK = previous;
  }
});
